import crypto from 'crypto';

const DEV_ACTIVATION_FALLBACK =
  "ursoft-The Accounts-pr0-2025-s3cr3t!@#$%";

function getActivationSecret(): string {
  const fromEnv = process.env.ACTIVATION_SECRET?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error("ACTIVATION_SECRET is required in production.");
  }
  return DEV_ACTIVATION_FALLBACK;
}

/**
 * Generates HMAC-SHA256 signature for data string
 */
export function signData(data: string): string {
  return crypto
    .createHmac('sha256', getActivationSecret())
    .update(data)
    .digest('hex')
    .toUpperCase();
}

/**
 * Generates a license key for a given HWID or unique purchase ID.
 * Returns format: HBX-XXXXX-XXXXX-XXXXX-XXXXX
 */
export function generateLicenseKey(hwid: string): string {
  const payload = `The Accounts:${hwid.toUpperCase()}`;
  const signature = signData(payload);
  const sigShort = signature.slice(0, 20);

  const part1 = sigShort.slice(0, 5);
  const part2 = sigShort.slice(5, 10);
  const part3 = sigShort.slice(10, 15);
  const part4 = sigShort.slice(15, 20);

  return `HBX-${part1}-${part2}-${part3}-${part4}`;
}

/**
 * Verifies if a given license key is valid for the provided HWID
 */
export function verifyLicenseKey(licenseKey: string, hwid: string): boolean {
  if (!licenseKey || !hwid) return false;
  const cleanKey = licenseKey.trim().toUpperCase();
  const expectedKey = generateLicenseKey(hwid);
  return cleanKey === expectedKey;
}

/**
 * Generates a generic offline standalone purchase license key
 */
export function generateStandaloneKey(productSlug: string, orderId: string): string {
  const seed = `${productSlug}:${orderId}:${Date.now()}`;
  const hash = crypto.createHash('sha256').update(seed).digest('hex').toUpperCase();
  const s = hash.slice(0, 20);
  return `The Accounts-${s.slice(0, 5)}-${s.slice(5, 10)}-${s.slice(10, 15)}-${s.slice(15, 20)}`;
}
