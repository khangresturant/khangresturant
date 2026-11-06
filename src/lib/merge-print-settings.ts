import {
  DEFAULT_RECEIPT_SETTINGS,
  type ReceiptSettings,
} from "@/components/ReceiptTemplate";

/** Normalize print_settings row → ReceiptSettings (logo, margins, template, etc.). */
export function mergePrintSettingsFromRow(
  printRow: Record<string, unknown> | null | undefined
): ReceiptSettings {
  if (!printRow) return { ...DEFAULT_RECEIPT_SETTINGS };
  const stored =
    (printRow.receipt_design_settings as Partial<ReceiptSettings> | null) || {};
  return {
    ...DEFAULT_RECEIPT_SETTINGS,
    pageSize:
      (printRow.receipt_page_size as ReceiptSettings["pageSize"]) ||
      DEFAULT_RECEIPT_SETTINGS.pageSize,
    fontFamily:
      (printRow.receipt_font as string) || DEFAULT_RECEIPT_SETTINGS.fontFamily,
    fontSize:
      Number(printRow.receipt_font_size) || DEFAULT_RECEIPT_SETTINGS.fontSize,
    ...stored,
  };
}
