import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireApiUser, requireShopAccess } from "@/lib/auth/apiAuth";

const ALLOWED_EXT = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const filenameHeader = request.headers.get("x-filename");
    const shopIdHeader = request.headers.get("x-shop-id") || auth.ctx.shopId;

    if (!filenameHeader) {
      return NextResponse.json({ error: "x-filename header is missing" }, { status: 400 });
    }

    // Sanitize filename (no path traversal)
    const baseName = path.basename(filenameHeader).replace(/[^\w.\-()+ ]/g, "_");
    const ext = path.extname(baseName).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return NextResponse.json(
        { error: "File type not allowed. Use pdf, png, jpg, or webp." },
        { status: 400 }
      );
    }

    const shopCheck = await requireShopAccess(auth.ctx, shopIdHeader);
    if (!shopCheck.ok) return shopCheck.response;

    const data = await request.arrayBuffer();
    if (data.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "File exceeds 10 MB limit." }, { status: 413 });
    }

    const buffer = Buffer.from(data);
    const safeName = `${shopIdHeader}_${Date.now()}_${baseName}`;

    const dir = path.join(process.cwd(), "public", "receipts");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filePath = path.join(dir, safeName);
    fs.writeFileSync(filePath, buffer);

    const url = `/receipts/${safeName}`;
    return NextResponse.json({ success: true, url });
  } catch (err: any) {
    console.error("Local PDF Upload Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
