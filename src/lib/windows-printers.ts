/** List installed Windows printer names (Electron desktop first, then local API). */

export type WindowsPrinterListResult = {
  printers: string[];
  defaultPrinter: string | null;
  source: "electron" | "api";
};

function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const n = raw.trim();
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export async function fetchWindowsPrinterNames(): Promise<WindowsPrinterListResult> {
  if (typeof window !== "undefined" && window.electronAPI?.getPrinters) {
    const raw = await window.electronAPI.getPrinters();
    const printers = uniqueNames(raw.map((p) => p.name || p.displayName || ""));
    const defaultPrinter =
      raw.find((p) => p.isDefault)?.name?.trim() ||
      raw.find((p) => p.isDefault)?.displayName?.trim() ||
      null;
    return { printers, defaultPrinter, source: "electron" };
  }

  const res = await fetch("/api/restaurant/thermal-print");
  const data = (await res.json()) as {
    ok?: boolean;
    printers?: string[];
    defaultPrinter?: string | null;
    error?: string;
    note?: string;
  };

  if (!res.ok || data.ok === false) {
    throw new Error(data.error || data.note || res.statusText || "Could not list printers");
  }

  return {
    printers: uniqueNames(Array.isArray(data.printers) ? data.printers : []),
    defaultPrinter: data.defaultPrinter?.trim() || null,
    source: "api",
  };
}