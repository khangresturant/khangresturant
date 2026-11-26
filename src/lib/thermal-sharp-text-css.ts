/**
 * Shared sharp thermal text rules — every receipt template (Default, Modern Carbon, etc.).
 * Sharpens black text/lines; preserves white-on-dark and each element's font-weight.
 */
export const THERMAL_SHARP_TEXT_CSS = `
*, *::before, *::after {
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  color-adjust: exact !important;
}
html, body, .receipt-container, .thermal-slip-root, .thermal-receipt-view {
  -webkit-font-smoothing: none !important;
  -moz-osx-font-smoothing: grayscale !important;
  text-rendering: geometricPrecision !important;
}
.text-black,
.text-black\\/10, .text-black\\/20, .text-black\\/30, .text-black\\/40,
.text-slate-400, .text-slate-500, .text-slate-600, .text-slate-700,
.text-gray-500, .text-muted-foreground,
.receipt-container, .thermal-receipt-view,
.receipt-container .info, .receipt-container .totals, .receipt-container .header,
.receipt-container .footer, .receipt-container th, .receipt-container td,
.receipt-container p, .receipt-container span:not(.text-white),
.kitchen-order-heading, .section-title, .shop-name {
  color: #000000 !important;
  -webkit-text-fill-color: #000000 !important;
}
.bg-black, .bg-slate-900, .bg-zinc-900 {
  background-color: #000000 !important;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}
.text-white,
.bg-black .text-white,
.bg-black h1, .bg-black h2, .bg-black h3, .bg-black th, .bg-black td,
.bg-black span, .bg-black div, .bg-black p {
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
  -webkit-text-stroke: 0 !important;
  text-shadow: none !important;
}
.receipt-developed-by {
  text-align: center;
  font-size: 10px;
  padding: 6px 0 2px;
  margin: 0;
  line-height: 1.2;
  color: #000000 !important;
}
hr, .receipt-hairline,
.receipt-container hr,
.border-black, .border-black\\/10, .border-black\\/20, .border-black\\/30, .border-black\\/40,
.border-t, .border-b, .border-l, .border-r, .border, .border-2,
.border-t-2, .border-b-2, .border-y, .border-x, .border-y-2, .border-y-4,
.divide-y > * + *, .divide-black\\/30 > * + *,
.receipt-container table,
.receipt-container th, .receipt-container td {
  border-color: #000000 !important;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}
hr, .receipt-hairline {
  border-top-color: #000000 !important;
  border-top-width: 1px !important;
  opacity: 1 !important;
}
.receipt-container [style*="border"][style*="#000"],
.receipt-container [style*="border-top: 1px dashed #000"] {
  border-color: #000000 !important;
}
`;

/** @deprecated Use THERMAL_SHARP_TEXT_CSS */
export const THERMAL_HIGH_INK_CSS = THERMAL_SHARP_TEXT_CSS;