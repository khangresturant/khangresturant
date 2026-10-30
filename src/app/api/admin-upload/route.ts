import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { requireSuperAdmin } from "@/lib/auth/apiAuth";
import {
  ADMIN_UPLOAD_EXTENSIONS,
  sanitizeUploadBasename,
} from "@/lib/auth/apiSecurity";

const QR_DIR = path.join(process.cwd(), "public", "qr-codes");
if (!fs.existsSync(QR_DIR)) fs.mkdirSync(QR_DIR, { recursive: true });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://theaccounts.cloud";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const admin = await requireSuperAdmin();
  if (!admin.ok) return admin.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const name = sanitizeUploadBasename((formData.get("name") as string) || "upload");

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    if (!ADMIN_UPLOAD_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    const fileName = `${name}_${Date.now()}.${ext}`;
    const filePath = path.join(QR_DIR, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    const url = `${APP_URL}/qr-codes/${fileName}`;
    return NextResponse.json({ success: true, url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
