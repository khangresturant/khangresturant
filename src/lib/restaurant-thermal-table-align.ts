/** Fixed column widths (sum 100%) + totals row alignment for 80mm restaurant slips. */

/** Guest bill + paid receipt columns. Sum = 80mm roll. */
export const RESTAURANT_BILL_COL_MM = {
  item: 36,
  qty: 10,
  unitPrice: 17,
  lineTotal: 17,
} as const;

/** @deprecated Percentage split; print uses millimetre columns. */
export const RESTAURANT_BILL_TABLE_COLS = {
  item: 45,
  qty: 12,
  unitPrice: 21,
  lineTotal: 22,
} as const;

/** @deprecated Use RESTAURANT_BILL_TABLE_COLS */
export const THERMAL_PAYMENT_TABLE_COLS_4 = RESTAURANT_BILL_TABLE_COLS;

const KITCHEN_TABLE_BASE_CSS = `
table {
    width: 100%;
    border-collapse: collapse;
    margin: 0px;
    padding: 0px;
    table-layout: fixed;
    border-top: none;
    border-bottom: 0.45px solid #000;
    border-spacing: 0px;
}
table thead th {
    border-top: none;
}
.info + table,
.header + .info + table {
    margin-top: 0;
}
th {
    font-size: 11px;
    padding: 1px 0;
    margin: 0px;
    text-align: left;
    background: #dad9db;
    color: #000;
    border-bottom: 0.45px solid #000;
    line-height: 1.2;
    vertical-align: top;
}
td {
    font-size: 10px;
    padding: 1px 0;
    margin: 0px;
    text-align: center;
    border-bottom: 0.45px solid #000;
    line-height: 1.2;
    vertical-align: top;
}
td.product, th.product { text-align: left; overflow-wrap: anywhere; word-break: break-word; }
td.product, td.size, td.qty, td.price { overflow-wrap: anywhere; word-break: break-word; }
th.qty, td.qty { text-align: center; }
th.size, td.size { text-align: center; }
th.price, td.price { text-align: right; font-variant-numeric: tabular-nums; }
table.cols-2 th.product, table.cols-2 td.product { width: 65%; }
table.cols-2 th.qty, table.cols-2 td.qty { width: 35%; }
table.cols-3 th.product, table.cols-3 td.product { width: 50%; }
table.cols-3 th.size, table.cols-3 td.size { width: 25%; }
table.cols-3 th.qty, table.cols-3 td.qty { width: 25%; }
`;

/** Guest bill & payment receipt — identical line-item grid (not kitchen KOT). */
export const RESTAURANT_BILL_ITEMS_TABLE_CSS = `
.receipt-container {
  box-sizing: border-box !important;
  padding-right: 2px !important;
}
.receipt-container table.restaurant-bill-items {
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  table-layout: fixed !important;
  border-collapse: collapse !important;
}
.receipt-container table.restaurant-bill-items col.bill-col-item { width: ${RESTAURANT_BILL_COL_MM.item}mm !important; }
.receipt-container table.restaurant-bill-items col.bill-col-qty { width: ${RESTAURANT_BILL_COL_MM.qty}mm !important; }
.receipt-container table.restaurant-bill-items col.bill-col-unit { width: ${RESTAURANT_BILL_COL_MM.unitPrice}mm !important; }
.receipt-container table.restaurant-bill-items col.bill-col-total { width: ${RESTAURANT_BILL_COL_MM.lineTotal}mm !important; }
.receipt-container table.restaurant-bill-items th,
.receipt-container table.restaurant-bill-items td {
  font-size: 9px !important;
  line-height: 1.15 !important;
  padding: 1px 1px !important;
  overflow: hidden !important;
  display: table-cell !important;
  visibility: visible !important;
}
.receipt-container table.restaurant-bill-items th.bill-item,
.receipt-container table.restaurant-bill-items td.bill-item {
  width: ${RESTAURANT_BILL_COL_MM.item}mm !important;
  max-width: ${RESTAURANT_BILL_COL_MM.item}mm !important;
  text-align: left !important;
  overflow-wrap: anywhere !important;
  word-break: break-word !important;
  white-space: normal !important;
}
.receipt-container table.restaurant-bill-items th.bill-qty,
.receipt-container table.restaurant-bill-items td.bill-qty {
  width: ${RESTAURANT_BILL_COL_MM.qty}mm !important;
  max-width: ${RESTAURANT_BILL_COL_MM.qty}mm !important;
  text-align: center !important;
  white-space: nowrap !important;
  word-break: normal !important;
}
.receipt-container table.restaurant-bill-items th.bill-unit,
.receipt-container table.restaurant-bill-items td.bill-unit {
  width: ${RESTAURANT_BILL_COL_MM.unitPrice}mm !important;
  max-width: ${RESTAURANT_BILL_COL_MM.unitPrice}mm !important;
  text-align: right !important;
  white-space: nowrap !important;
  font-variant-numeric: tabular-nums !important;
  word-break: normal !important;
}
.receipt-container table.restaurant-bill-items th.bill-line-total,
.receipt-container table.restaurant-bill-items td.bill-line-total {
  width: ${RESTAURANT_BILL_COL_MM.lineTotal}mm !important;
  max-width: ${RESTAURANT_BILL_COL_MM.lineTotal}mm !important;
  text-align: right !important;
  white-space: nowrap !important;
  font-variant-numeric: tabular-nums !important;
  word-break: normal !important;
}
`;

const PAYMENT_TABLE_EXTRA_CSS = `
${RESTAURANT_BILL_ITEMS_TABLE_CSS}
.receipt-container .header,
.receipt-container .info {
  width: 100%;
  box-sizing: border-box;
}
`;

export const RESTAURANT_THERMAL_TABLE_ALIGN_CSS = `
${KITCHEN_TABLE_BASE_CSS}
${PAYMENT_TABLE_EXTRA_CSS}
.receipt-container table {
  width: 100% !important;
  max-width: 100% !important;
  table-layout: fixed !important;
}
.receipt-container .totals {
  width: 100%;
  box-sizing: border-box;
}
.receipt-container .totals p {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2px 6px;
  align-items: baseline;
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: 1px 0;
  line-height: 1.25;
  box-sizing: border-box;
}
.receipt-container .totals .total-label {
  text-align: left;
  padding-right: 0;
  min-width: 0;
  overflow-wrap: anywhere;
}
.receipt-container .totals .total-value {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.receipt-container .totals p.total-amount-line {
  margin-top: 3px;
  font-weight: 900 !important;
}
`;