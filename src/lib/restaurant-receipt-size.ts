/**
 * POS thermal rule: if size is already in the item name (e.g. "Latte (Small)"),
 * do not repeat it in a separate Size column.
 */

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Size text suitable for a receipt Size column (empty = omit cell). */
export function receiptSizeColumnValue(
  itemName: string,
  sizeLabel?: string | null
): string {
  const name = (itemName || "").trim();
  const size = (sizeLabel || "").trim();
  if (!size) return "";
  if (sizeAlreadyInItemName(name, size)) return "";

  const low = size.toLowerCase();
  if (low === "standard" || low === "std" || low === "deal package" || low === "deal") {
    return "";
  }
  return size;
}

export function sizeAlreadyInItemName(itemName: string, sizeLabel: string): boolean {
  const name = norm(itemName);
  const size = norm(sizeLabel);
  if (!size || !name) return !size;

  if (name.includes(`(${size})`)) return true;
  if (name.includes(` ${size}`)) return true;
  if (name.endsWith(size)) return true;

  const paren = name.match(/\(([^)]+)\)/);
  if (paren) {
    const inside = norm(paren[1]!);
    if (inside === size || inside.includes(size) || size.includes(inside)) return true;
  }

  if (name.includes(" · ")) {
    const [, tail] = name.split(" · ", 2);
    if (tail && norm(tail) === size) return true;
  }
  return false;
}

/** True when no line on the slip needs a Size column. */
export function slipUsesTwoColumnItemTable(
  lines: { name: string; sizeLabel?: string | null }[]
): boolean {
  if (!lines.length) return true;
  return lines.every((l) => !receiptSizeColumnValue(l.name, l.sizeLabel));
}