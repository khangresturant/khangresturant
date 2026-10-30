import { NextRequest, NextResponse } from 'next/server';
import { verifyLicenseKey, generateLicenseKey, signData } from '@/lib/license-engine';
import { createServiceSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { license_key, hwid, software_slug, app_version } = body;

    if (!license_key || !hwid) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: license_key and hwid' },
        { status: 400 }
      );
    }

    const supabase = createServiceSupabaseClient();
    const cleanKey = license_key.trim().toUpperCase();
    const cleanHWID = hwid.trim().toUpperCase();

    // 1. Direct HWID Cryptographic Validation
    const expectedKey = generateLicenseKey(cleanHWID);
    const isValidKey = cleanKey === expectedKey;

    if (!isValidKey) {
      // 2. Check Database for standalone license keys
      const { data: licenseRecord } = await supabase
        .from('software_licenses')
        .select('*')
        .eq('license_key', cleanKey)
        .maybeSingle();

      if (!licenseRecord) {
        return NextResponse.json({
          success: false,
          error: 'Invalid license key. Please check your key or contact support.',
          is_activated: false,
        }, { status: 401 });
      }

      // Check device activation limit
      const currentHwids: string[] = licenseRecord.activated_hwids || [];
      if (!currentHwids.includes(cleanHWID)) {
        if (currentHwids.length >= (licenseRecord.max_devices || 1)) {
          return NextResponse.json({
            success: false,
            error: `Device limit reached. Maximum ${licenseRecord.max_devices || 1} PC(s) allowed.`,
            is_activated: false,
          }, { status: 403 });
        }

        // Register new HWID
        currentHwids.push(cleanHWID);
        await supabase
          .from('software_licenses')
          .update({
            activated_hwids: currentHwids,
            updated_at: new Date().toISOString(),
          })
          .eq('id', licenseRecord.id);
      }
    }

    // Generate activation signature token for client
    const file_sig = signData(`${cleanHWID}:${cleanKey}`);

    return NextResponse.json({
      success: true,
      message: 'Activation successful! Software unlocked.',
      is_activated: true,
      license_key: cleanKey,
      hwid: cleanHWID,
      file_sig: file_sig,
      activated_at: new Date().toISOString(),
      status: 'active',
      plan: 'Lifetime One-Time Purchase',
      software_slug: software_slug || null,
      app_version: app_version || null,
    });

  } catch (err: any) {
    console.error('License Activation API Error:', err);
    const message =
      err?.message?.includes('ACTIVATION_SECRET')
        ? 'License server is not configured.'
        : err?.message || 'Server error during activation';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
