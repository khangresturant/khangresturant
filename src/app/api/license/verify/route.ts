import { NextRequest, NextResponse } from 'next/server';
import { verifyLicenseKey } from '@/lib/license-engine';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const licenseKey = searchParams.get('key');
  const hwid = searchParams.get('hwid');

  if (!licenseKey || !hwid) {
    return NextResponse.json({ valid: false, error: 'Missing key or hwid' }, { status: 400 });
  }

  const isValid = verifyLicenseKey(licenseKey, hwid);

  return NextResponse.json({
    valid: isValid,
    status: isValid ? 'active' : 'invalid',
    checked_at: new Date().toISOString(),
  });
}
