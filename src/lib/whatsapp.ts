/**
 * Formats Pakistani & International phone numbers for WhatsApp api/wa.me links.
 * Converts local 03xx-xxxxxxx to international format 923xxxxxxxxx.
 */
export function formatWhatsAppPhone(phoneStr: string | null | undefined): string {
  if (!phoneStr) return "";
  let cleaned = phoneStr.replace(/[^0-9]/g, "");
  if (!cleaned) return "";
  
  // If starts with 03xx (local format)
  if (cleaned.startsWith("03") && cleaned.length === 11) {
    cleaned = "92" + cleaned.slice(1);
  } else if (cleaned.startsWith("3") && cleaned.length === 10) {
    cleaned = "92" + cleaned;
  } else if (cleaned.startsWith("0")) {
    cleaned = "92" + cleaned.slice(1);
  }
  
  return cleaned;
}
