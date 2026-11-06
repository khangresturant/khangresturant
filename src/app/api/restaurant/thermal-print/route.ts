import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import os from "os";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

function edgeExecutable(): string | null {
  const candidates = [
    process.env.LOCAL_EDGE_PATH,
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    try {
      fs.accessSync(p);
      return p;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function listWindowsPrinters(): Promise<string[]> {
  const ps =
    "Get-CimInstance Win32_Printer | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress";
  const { stdout } = await execFileAsync(
    "powershell",
    ["-NoProfile", "-NonInteractive", "-Command", ps],
    { timeout: 15000, windowsHide: true }
  );
  const raw = stdout.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as string | string[];
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

async function defaultWindowsPrinter(): Promise<string | null> {
  const ps =
    "(Get-CimInstance Win32_Printer -Filter 'Default=$true').Name";
  try {
    const { stdout } = await execFileAsync(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command", ps],
      { timeout: 10000, windowsHide: true }
    );
    const name = stdout.trim();
    return name || null;
  } catch {
    return null;
  }
}

async function htmlToPdf(htmlPath: string, pdfPath: string): Promise<void> {
  const browser = edgeExecutable();
  if (!browser) {
    throw new Error("Microsoft Edge / Chrome not found for PDF rendering.");
  }
  const fileUrl = "file:///" + htmlPath.replace(/\\/g, "/");
  await execFileAsync(
    browser,
    [
      "--headless",
      "--disable-gpu",
      "--no-first-run",
      "--no-pdf-header-footer",
      `--print-to-pdf=${pdfPath}`,
      fileUrl,
    ],
    { timeout: 45000, windowsHide: true }
  );
}

async function printPdfSilent(pdfPath: string, printerName: string): Promise<void> {
  try {
    const mod = await import("pdf-to-printer");
    const printFn = mod.print || mod.default?.print;
    if (typeof printFn === "function") {
      await printFn(pdfPath, { printer: printerName, silent: true });
      return;
    }
  } catch {
    /* fall through */
  }

  const safePdf = pdfPath.replace(/'/g, "''");
  const safePrinter = printerName.replace(/'/g, "''");
  const ps = `$p='${safePdf}'; $n='${safePrinter}'; Start-Process -FilePath $p -Verb PrintTo -ArgumentList @($n) -Wait`;
  await execFileAsync(
    "powershell",
    ["-NoProfile", "-NonInteractive", "-Command", ps],
    { timeout: 90000, windowsHide: true }
  );
}

export async function GET(req: NextRequest) {
  if (process.platform !== "win32") {
    return NextResponse.json({
      ok: true,
      platform: process.platform,
      printers: [],
      defaultPrinter: null,
      note: "Named printer routing works on local Windows POS only.",
    });
  }
  try {
    const [printers, defaultPrinter] = await Promise.all([
      listWindowsPrinters(),
      defaultWindowsPrinter(),
    ]);
    return NextResponse.json({ ok: true, printers, defaultPrinter });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (process.platform !== "win32") {
    return NextResponse.json({
      ok: false,
      useBrowser: true,
      reason: "non_windows",
    });
  }

  let body: { html?: string; printerName?: string; title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const html = body.html?.trim();
  if (!html) {
    return NextResponse.json({ ok: false, error: "Missing html" }, { status: 400 });
  }

  let printerName = body.printerName?.trim() || "";
  if (!printerName) {
    printerName = (await defaultWindowsPrinter()) || "";
  }
  if (!printerName) {
    return NextResponse.json({
      ok: false,
      useBrowser: true,
      reason: "no_printer",
    });
  }

  const stamp = Date.now();
  const tmpDir = path.join(os.tmpdir(), "cafe-master-thermal");
  await fsPromises.mkdir(tmpDir, { recursive: true });
  const htmlPath = path.join(tmpDir, `receipt-${stamp}.html`);
  const pdfPath = path.join(tmpDir, `receipt-${stamp}.pdf`);

  try {
    await fsPromises.writeFile(htmlPath, html, "utf8");
    await htmlToPdf(htmlPath, pdfPath);
    await printPdfSilent(pdfPath, printerName);
    return NextResponse.json({ ok: true, printer: printerName });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      ok: false,
      useBrowser: true,
      error: message,
      printer: printerName,
    });
  } finally {
    await fsPromises.unlink(htmlPath).catch(() => undefined);
    await fsPromises.unlink(pdfPath).catch(() => undefined);
  }
}
