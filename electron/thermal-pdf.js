/** Physical roll width for silent print (80mm hardware; 58mm when detected). */
const THERMAL_ROLL_WIDTH_MM = 80;
/** Max slip length on roll (guest/KOT bill) — continuous thermal, not A4. */
const THERMAL_ROLL_MAX_HEIGHT_MM = 1200;
/** Extra PDF height beyond measured slip (footer, cutter feed, rounding). */
const THERMAL_SLIP_HEIGHT_SLACK_MM = 12;
/** 1.15× — light sharpen when the driver rasterizes; stays text-like (not 3× bitmap). */
const THERMAL_PDF_RENDER_SCALE = 1.15;

function mmToMicrons(mm) {
  return Math.round(Number(mm) * 1000);
}

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
    const candidates = [
      document.querySelector(".receipt-container"),
      document.querySelector(".thermal-slip-root"),
      document.querySelector(".thermal-receipt-view"),
      document.body,
      document.documentElement,
    ].filter(Boolean);
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;left:-9999px;width:1mm;height:1mm;";
    document.body.appendChild(probe);
    const mmPx = probe.getBoundingClientRect().height || 3.78;
    probe.remove();
    let hPx = 40;
    for (const el of candidates) {
      const rect = el.getBoundingClientRect();
      hPx = Math.max(
        hPx,
        el.scrollHeight,
        el.offsetHeight,
        rect.height,
        rect.bottom
      );
    }
    const docH = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight
    );
    hPx = Math.max(hPx, docH);
    return Math.ceil(hPx / mmPx) + ${THERMAL_SLIP_HEIGHT_SLACK_MM};
  })()`);
}

/**
 * PDF page matches thermal roll: narrow width, height = content (not Letter/A4).
 * @param {import("electron").WebContents} webContents
 * @param {number} paperWidthMm
 */
async function prepareThermalSlipForPrint(webContents, paperWidthMm) {
  await webContents.executeJavaScript(`(function () {
    document.documentElement.style.height = "auto";
    document.documentElement.style.minHeight = "0";
    document.body.style.height = "auto";
    document.body.style.minHeight = "0";
  })()`);
  let heightMm = await measureSlipHeightMm(webContents);
  await webContents.executeJavaScript(
    `new Promise(function(resolve) {
      requestAnimationFrame(function() {
        requestAnimationFrame(resolve);
      });
    })`
  );
  const heightMmAfterLayout = await measureSlipHeightMm(webContents);
  heightMm = Math.max(heightMm, heightMmAfterLayout);
  const clampedHeightMm = clampThermalRollHeightMm(heightMm, paperWidthMm);
  await applyThermalPageSizeToDocument(
    webContents,
    paperWidthMm,
    clampedHeightMm
  );
  return clampedHeightMm;
}

async function printWindowToThermalPdf(
  webContents,
  paperWidthMm,
  preppedHeightMm = 0
) {
  const clampedHeightMm = preppedHeightMm
    ? clampThermalRollHeightMm(preppedHeightMm, paperWidthMm)
    : await prepareThermalSlipForPrint(webContents, paperWidthMm);

  const widthIn = paperWidthMm / 25.4;
  let heightIn = clampedHeightMm / 25.4;
  if (heightIn <= widthIn) {
    heightIn = widthIn + 0.25;
  }

  await applyThermalPdfVectorInk(webContents);
  await webContents.executeJavaScript(
    `Promise.all([
      document.fonts.ready,
      new Promise(function (r) {
        requestAnimationFrame(function () {
          requestAnimationFrame(r);
        });
      }),
    ])`
  );

  const pdfScale = Math.max(1, Math.min(2, THERMAL_PDF_RENDER_SCALE));

  // Explicit roll page size + modest scale → readable vector glyphs in PDF.
  const pdfBuffer = await webContents.printToPDF({
    printBackground: true,
    landscape: false,
    preferCSSPageSize: false,
    displayHeaderFooter: false,
    margins: { marginType: "none" },
    pageSize: { width: widthIn, height: heightIn },
    scale: pdfScale,
    generateTaggedPDF: false,
    generateDocumentOutline: false,
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
const { THERMAL_PDF_VECTOR_PRINT_CSS } = require("./thermal-pdf-vector-print-css");

/** Pre-load layout: generous roll height so text is never squashed before measure. */
function injectThermalRollLayoutHtml(html, paperWidthMm) {
  const style = `<style id="cookswift-thermal-page">html,body{width:${paperWidthMm}mm!important;max-width:${paperWidthMm}mm!important;margin:0!important;padding:0!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;}</style><style id="cookswift-thermal-ink">${THERMAL_PDF_VECTOR_PRINT_CSS}</style>`;
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

/** Override dashboard "sharp thermal" rules so PDF keeps normal vector glyphs. */
async function applyThermalPdfVectorInk(webContents) {
  const css = THERMAL_PDF_VECTOR_PRINT_CSS;
  await webContents.executeJavaScript(`(function () {
    const inkCss = ${JSON.stringify(css)};
    let ink = document.getElementById("cookswift-thermal-ink");
    if (!ink) {
      ink = document.createElement("style");
      ink.id = "cookswift-thermal-ink";
      document.head.appendChild(ink);
    }
    ink.textContent = inkCss;
    const killSharp = document.getElementById("cookswift-pdf-kill-sharp");
    if (killSharp) killSharp.remove();
    const neutral = document.createElement("style");
    neutral.id = "cookswift-pdf-kill-sharp";
    neutral.textContent =
      "*,*::before,*::after{-webkit-font-smoothing:antialiased!important;-moz-osx-font-smoothing:grayscale!important;" +
      "text-rendering:auto!important;font-variant-ligatures:none!important;text-shadow:none!important;" +
      "-webkit-text-fill-color:currentColor!important;filter:none!important;transform:none!important;}" +
      "html,body{font-family:Arial,Helvetica,'Segoe UI',Tahoma,sans-serif!important;}";
    document.head.appendChild(neutral);
  })()`);
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
      ".receipt-container,.thermal-receipt-view,.thermal-slip-root{width:" + w + "mm!important;max-width:" + w + "mm!important;margin:0!important;box-sizing:border-box!important;}";
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
    const inkCss = ${JSON.stringify(THERMAL_PDF_VECTOR_PRINT_CSS)};
    let ink = document.getElementById("cookswift-thermal-ink");
    if (!ink) {
      ink = document.createElement("style");
      ink.id = "cookswift-thermal-ink";
      document.head.appendChild(ink);
    }
    ink.textContent = inkCss;
  })()`);
}

/**
 * Hidden windows may not paint until a capture — force a raster pass before print.
 * @param {import("electron").WebContents} webContents
 */
async function ensureThermalSlipPainted(webContents, paperWidthMm, heightMm) {
  const wPx = Math.max(200, Math.round((paperWidthMm / 25.4) * 96) + 32);
  const safeHMm = clampThermalRollHeightMm(heightMm, paperWidthMm);
  const hPx = Math.min(8000, Math.max(120, Math.round((safeHMm / 25.4) * 96)));
  try {
    await webContents.capturePage({ x: 0, y: 0, width: wPx, height: hPx });
  } catch (err) {
    console.warn("[Thermal Print] capturePage paint nudge:", err);
  }
}

/** @param {import("electron").WebContents} webContents */
async function assertSlipHasPrintableContent(webContents) {
  const textLen = await webContents.executeJavaScript(`(function () {
    const t = (document.body && document.body.innerText) || "";
    return t.replace(/\\s+/g, "").length;
  })()`);
  if (textLen < 2) {
    throw new Error("Receipt slip has no printable text");
  }
}

/**
 * Direct spooler print — text stays vector/GDI (not PDF bitmap). Preferred for thermal.
 * @param {import("electron").WebContents} webContents
 */
function printWindowDirectThermal(
  webContents,
  printerName,
  copies = 1,
  paperWidthMm = THERMAL_ROLL_WIDTH_MM,
  heightMm = 0
) {
  const copyCount = Math.max(1, Math.min(99, Math.floor(Number(copies) || 1)));
  const deviceName = String(printerName || "").trim();
  if (!deviceName) {
    return Promise.reject(new Error("Printer name required for direct thermal print"));
  }
  const pageHeightMm = clampThermalRollHeightMm(
    heightMm || paperWidthMm + 40,
    paperWidthMm
  );
  const options = {
    silent: true,
    printBackground: true,
    deviceName,
    color: true,
    landscape: false,
    margins: { marginType: "none" },
    scaleFactor: 100,
    copies: copyCount,
    pageSize: {
      width: mmToMicrons(paperWidthMm),
      height: mmToMicrons(pageHeightMm),
    },
  };
  return new Promise((resolve, reject) => {
    try {
      webContents.print(options, (success, failureReason) => {
        if (success) resolve({ success: true });
        else {
          reject(
            new Error(
              failureReason && String(failureReason).trim()
                ? String(failureReason)
                : "Direct thermal print failed"
            )
          );
        }
      });
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

module.exports = {
  parseThermalPaperWidthMm,
  measureSlipHeightMm,
  prepareThermalSlipForPrint,
  ensureThermalSlipPainted,
  assertSlipHasPrintableContent,
  printWindowDirectThermal,
  printWindowToThermalPdf,
  estimateSlipHeightMm,
  injectThermalPageSize,
  injectThermalRollLayoutHtml,
  applyThermalPageSizeToDocument,
  THERMAL_ROLL_WIDTH_MM,
  THERMAL_ROLL_MAX_HEIGHT_MM,
  clampThermalRollHeightMm,
};