/**
 * Ported from POSRESTURANT `fast_food_display.py` + `fast_food_order_view.build_kitchen_receipt_html`
 * / `generate_payment_receipt_content` — same labels, font sizes, and CSS classes.
 */

export const POS_RECEIPT_CONTAINER_PX = 320;

export const RECEIPT_ITEMS_TABLE_HEADER_PX = 9;
export const RECEIPT_ITEMS_TABLE_CELL_PX = 10;
export const RECEIPT_TOTAL_LINE_BASE_PX = 10;
export const RECEIPT_TOTAL_AMOUNT_FONT_PX = RECEIPT_TOTAL_LINE_BASE_PX + 3;
export const RECEIPT_FOOTER_FONT_PX = 8;
export const RECEIPT_INFO_FONT_PX = 8;
export const RECEIPT_KITCHEN_INFO_FONT_PX = 9;
export const RECEIPT_KITCHEN_TITLE_PX = 12;

export const RECEIPT_BODY_STYLE =
  "font-family: Arial, Helvetica, sans-serif; direction: ltr; text-align: left;";

export const RECEIPT_FOOTER_CSS = `
.footer {
    text-align: center;
    font-size: ${RECEIPT_FOOTER_FONT_PX}px;
    margin: 0;
    padding: 0;
    border-top: 0;
}
.footer p,
.footer .receipt-footer-note,
.footer .policy-item {
    text-align: left;
    font-size: inherit;
    font-style: normal;
    font-weight: normal;
    color: #000;
    text-decoration: none;
    margin: 2px 0;
    padding: 0;
    line-height: 1.25;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}
`;

export const RECEIPT_META_CSS = `
.info, .totals {
    direction: ltr;
    text-align: left;
}
.info {
    font-size: ${RECEIPT_INFO_FONT_PX}px;
}
.totals p {
    text-align: left;
    margin: 2px 0;
    padding: 0;
    line-height: 1.25;
    font-size: ${RECEIPT_INFO_FONT_PX}px;
}
.totals p.subtotal-line span {
    font-size: ${RECEIPT_TOTAL_LINE_BASE_PX}px;
    font-weight: bold;
}
.totals p.total-amount-line span {
    font-size: ${RECEIPT_TOTAL_AMOUNT_FONT_PX}px;
    font-weight: bold;
}
.info p {
    text-align: left;
    margin: 2px 0;
    padding: 0;
    line-height: 1.25;
}
.items-table {
    direction: ltr;
    text-align: left;
    margin-left: 0;
    margin-right: 15px;
    width: calc(100% - 15px);
    border-collapse: collapse;
    table-layout: fixed;
}
.items-table th {
    font-size: ${RECEIPT_ITEMS_TABLE_HEADER_PX}px;
    padding: 3px;
    text-align: left;
}
.items-table td {
    font-size: ${RECEIPT_ITEMS_TABLE_CELL_PX}px;
    padding: 3px;
    text-align: left;
}
.items-table th.product,
.items-table td:first-child {
    text-align: left;
}
`;

/** Kitchen KOT `<style>` block from `build_kitchen_receipt_html`. */
export const POS_KITCHEN_RECEIPT_CSS = `
body {
    font-family: Arial, Helvetica, sans-serif;
    margin: 0;
    padding: 0;
    background: white;
}
.receipt-container {
    width: ${POS_RECEIPT_CONTAINER_PX}px;
    margin: 0;
    padding: 0;
}
.info p {
    margin: 0;
    padding: 0;
    line-height: 1.2;
    font-size: ${RECEIPT_KITCHEN_INFO_FONT_PX}px;
}
table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
}
th {
    font-size: ${RECEIPT_ITEMS_TABLE_HEADER_PX}px;
    text-align: left;
    border: none;
    border-top: 1px solid #000;
    padding: 3px 6px;
    background: transparent;
}
`;

/** Payment receipt `<style>` from `generate_payment_receipt_content`. */
export const POS_PAYMENT_RECEIPT_CSS = `
body {
    font-family: Arial, Helvetica, sans-serif;
    margin: 0;
    padding: 0;
    background-color: white;
}
.receipt-container {
    width: ${POS_RECEIPT_CONTAINER_PX}px;
    background: white;
    padding: 0;
    margin: 0;
}
.header {
    text-align: center;
    border-bottom: 0 solid #000;
    padding-bottom: 0;
    margin: 0;
}
.header h2 {
    font-size: 11px;
    margin: 0;
    padding: 0;
    color: #000;
}
.header p {
    font-size: ${RECEIPT_INFO_FONT_PX}px;
    margin: 0;
    padding: 0;
    color: #000;
}
.info, .totals {
    font-size: ${RECEIPT_INFO_FONT_PX}px;
    margin: 0;
    padding: 0;
}
.info p, .totals p {
    margin: 0;
    padding: 0;
    line-height: 1;
}
.info strong, .totals strong {
    color: #000;
}
table {
    width: 100%;
    border-collapse: collapse;
    margin: 0;
    padding: 0;
    table-layout: fixed;
    border-bottom: 1px solid #000;
    border-spacing: 0;
}
th {
    font-size: ${RECEIPT_ITEMS_TABLE_HEADER_PX}px;
    padding: 2px 0;
    margin: 0;
    text-align: center;
    background: #dad9db;
    color: #000;
    border-bottom: 1px solid #000;
    line-height: 1;
    vertical-align: top;
}
td {
    font-size: ${RECEIPT_ITEMS_TABLE_CELL_PX}px;
    padding: 2px 0;
    margin: 0;
    text-align: center;
    border-bottom: 1px solid #000;
    line-height: 1;
    vertical-align: top;
}
th.product { width: 40%; }
th.price, th.qty, th.size { width: 20%; }
${RECEIPT_META_CSS}
${RECEIPT_FOOTER_CSS}
`;

export type PosRestaurantSlipKind = "kitchen" | "payment";

export function posRestaurantPaperWidthMm(kind: PosRestaurantSlipKind): number {
  void kind;
  return 80;
}