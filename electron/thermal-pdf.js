/** Physical roll width for silent print (80mm hardware; 58mm when detected). */
const THERMAL_ROLL_WIDTH_MM = 80;
/** Max slip length on roll (guest/KOT bill) — content height, capped here. */
const THERMAL_ROLL_MAX_HEIGHT_MM = 297;
/** Extra PDF height beyond measured slip (feed only — not a full blank page). */
const THERMAL_SLIP_HEIGHT_SLACK_MM = 2;

function clampThermalRollHeightMm(heightMm, paperWidthMm) {
  const rollW = Math.ceil(Number(paperWidthMm) || 80);
  /** Portrait thermal: height must clearly exceed width (drivers rotate near-square pages). */
  const minPortraitMm = Math.ceil(rollW * 1.35);
  return Math.min(
    Math.max(Math.ceil(Number(heightMm) || 0), minPortraitMm),
    THERMAL_ROLL_MAX_HEIGHT_MM
  );
}

/** @param {string} html */
function parseThermalPaperWidthMm(html) {
  if (
    /MM58|pageSize:\s*["']?MM58|paperWidth:\s*["']58mm/i.test(html) ||
    /name=["']x-thermal-width-mm["']\s+content=["']58["']/i.test(html)
  ) {
    return 58;
  }
  const meta =
    html.match(/name=["']x-thermal-width-mm["']\s+content=["'](\d+)["']/i) ||
    html.match(/content=["'](\d+)["']\s+name=["']x-thermal-width-mm["']/i);
  if (meta) {
    const n = Number(meta[1]);
    if (n >= 50 && n <= 58) return 58;
  }
  return THERMAL_ROLL_WIDTH_MM;
}

/**
 * Measure slip height in mm inside the loaded print window.
 * @param {import("electron").WebContents} webContents
 */
async function measureSlipHeightMm(webContents) {
  return webContents.executeJavaScript(`(function () {
    const root =
      document.querySelector(".receipt-container") ||
      document.querySelector(".thermal-slip-root") ||
      document.body;
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;left:-9999px;width:1mm;height:1mm;";
    document.body.appendChild(probe);
    const mmPx = probe.getBoundingClientRect().height || 3.78;
    probe.remove();
    const rect = root.getBoundingClientRect();
    const hPx = Math.max(
      root.scrollHeight,
      root.offsetHeight,
      rect.height,
      40
    );
    return Math.ceil(hPx / mmPx) + ${THERMAL_SLIP_HEIGHT_SLACK_MM};
  })()`);
}

/**
 * PDF page matches thermal roll: narrow width, height = content (not Letter/A4).
 * @param {import("electron").WebContents} webContents
 * @param {number} paperWidthMm
 */
async function printWindowToThermalPdf(webContents, paperWidthMm) {
  await webContents.executeJavaScript(`(function () {
    document.documentElement.style.height = "auto";
    document.documentElement.style.minHeight = "0";
    document.body.style.height = "auto";
    document.body.style.minHeight = "0";
  })()`);
  const heightMm = await measureSlipHeightMm(webContents);
  const clampedHeightMm = clampThermalRollHeightMm(heightMm, paperWidthMm);
  await applyThermalPageSizeToDocument(
    webContents,
    paperWidthMm,
    clampedHeightMm
  );
  await webContents.executeJavaScript(
    `new Promise(function(resolve) {
      requestAnimationFrame(function() {
        requestAnimationFrame(resolve);
      });
    })`
  );

  const widthIn = paperWidthMm / 25.4;
  let heightIn = clampedHeightMm / 25.4;
  if (heightIn <= widthIn) {
    heightIn = widthIn + 0.25;
  }

  // Portrait only: width = roll (80mm), height = slip — never rely on CSS "auto" page size.
  const pdfBuffer = await webContents.printToPDF({
    printBackground: true,
    landscape: false,
    preferCSSPageSize: false,
    margins: { marginType: "none" },
    pageSize: { width: widthIn, height: heightIn },
    scale: 1,
  });

  console.info(
    `[Thermal PDF] portrait page ${paperWidthMm}x${clampedHeightMm}mm (${widthIn.toFixed(2)}x${heightIn.toFixed(2)}in)`
  );

  return { pdfBuffer, paperWidthMm, heightMm: clampedHeightMm, widthIn, heightIn };
}

/** Rough height when we only have HTML (API / Edge path). */
function estimateSlipHeightMm(html) {
  const blocks = (html.match(/<\/div>|<\/tr>|<br\s*\/?>|\\n/gi) || []).length;
  return Math.min(Math.max(blocks * 4.2 + 30, 40), THERMAL_ROLL_MAX_HEIGHT_MM);
}

/** Force @page to thermal roll size before Chromium PDF (no Letter/A4). */
/** Pre-load layout: generous roll height so text is never squashed before measure. */
function injectThermalRollLayoutHtml(html, paperWidthMm) {
  const style = `<style id="cookswift-thermal-page">html,body{width:${paperWidthMm}mm!important;max-width:${paperWidthMm}mm!important;margin:0!important;padding:0!important;height:auto!important;min-height:0!important;max-height:none!important;}.receipt-container{width:${paperWidthMm}mm!important;max-width:${paperWidthMm}mm!important;margin:0!important;padding-right:2px!important;box-sizing:border-box!important;}</style>`;
  if (html.includes("</head>")) {
    return html.replace("</head>", `${style}</head>`);
  }
  return style + html;
}

function injectThermalPageSize(html, paperWidthMm, heightMm) {
  const safeH = clampThermalRollHeightMm(heightMm, paperWidthMm);
  const style = `<style id="cookswift-thermal-page">@page{size:${paperWidthMm}mm ${safeH}mm portrait!important;margin:0!important;}html,body{width:${paperWidthMm}mm!important;max-width:${paperWidthMm}mm!important;margin:0 auto!important;height:auto!important;}</style>`;
  if (html.includes("</head>")) {
    return html.replace("</head>", `${style}</head>`);
  }
  return style + html;
}

/** Apply measured @page size before webContents.print (POS-style direct HTML). */
async function applyThermalPageSizeToDocument(webContents, paperWidthMm, heightMm) {
  const safeH = clampThermalRollHeightMm(heightMm, paperWidthMm);
  await webContents.executeJavaScript(`(function () {
    const w = ${paperWidthMm};
    const h = ${safeH};
  const pageCss =
      "@page{size:" + w + "mm " + h + "mm portrait!important;margin:0!important;padding:0!important;}" +
      "html,body{width:" + w + "mm!important;max-width:" + w + "mm!important;margin:0!important;padding:0!important;" +
      "height:auto!important;min-height:0!important;overflow:visible!important;}" +
      ".receipt-container{width:" + w + "mm!important;max-width:" + w + "mm!important;margin:0!important;padding-right:2px!important;box-sizing:border-box!important;}";
    let preload = document.getElementById("cookswift-thermal-page");
    if (preload) {
      preload.textContent = pageCss;
    } else {
      preload = document.createElement("style");
      preload.id = "cookswift-thermal-page";
      preload.textContent = pageCss;
      document.head.appendChild(preload);
    }
    const runtime = document.getElementById("cookswift-thermal-page-runtime");
    if (runtime) runtime.remove();
  })()`);
}

module.exports = {
  parseThermalPaperWidthMm,
  measureSlipHeightMm,
  printWindowToThermalPdf,
  estimateSlipHeightMm,
  injectThermalPageSize,
  injectThermalRollLayoutHtml,
  applyThermalPageSizeToDocument,
  THERMAL_ROLL_WIDTH_MM,
  THERMAL_ROLL_MAX_HEIGHT_MM,
  clampThermalRollHeightMm,
};