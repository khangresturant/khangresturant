/**
 * Weighing Scale Barcode Parser for Grocery / Supermarkets.
 * Parses 13-digit EAN-13 scale barcodes formatted as:
 * 20 + 5-digit Product Code + 5-digit Weight (in grams or price) + 1 Check Digit
 * Example: 2000105005007 -> Product Code "00105", Weight: 0.500 kg (500g)
 */

export interface ParsedScaleBarcode {
  isScaleBarcode: boolean;
  productCode: string;
  weightKg: number;
  weightGrams: number;
  rawBarcode: string;
}

export function parseScaleBarcode(barcode: string): ParsedScaleBarcode {
  const cleanBarcode = barcode.trim();

  // Scale barcodes start with 20 or 21 and are exactly 13 digits long
  if (/^(20|21)\d{11}$/.test(cleanBarcode)) {
    const productCode = cleanBarcode.substring(2, 7); // 5-digit product code
    const weightValStr = cleanBarcode.substring(7, 12); // 5-digit weight/price value
    const weightGrams = parseInt(weightValStr, 10) || 0;
    const weightKg = weightGrams / 1000;

    return {
      isScaleBarcode: true,
      productCode,
      weightKg,
      weightGrams,
      rawBarcode: cleanBarcode,
    };
  }

  return {
    isScaleBarcode: false,
    productCode: "",
    weightKg: 0,
    weightGrams: 0,
    rawBarcode: cleanBarcode,
  };
}
