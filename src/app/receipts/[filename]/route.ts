import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    
    // Sanitize filename to prevent path traversal
    const safeName = path.basename(filename);
    const dir = path.join(process.cwd(), "public", "receipts");
    const filePath = path.join(dir, safeName);

    if (!fs.existsSync(filePath)) {
      return new NextResponse("Receipt or Statement file not found on server.", { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    
    // Determine the content type based on the file extension
    const ext = path.extname(safeName).toLowerCase();
    let contentType = "application/octet-stream";
    if (ext === ".pdf") {
      contentType = "application/pdf";
    } else if (ext === ".png") {
      contentType = "image/png";
    } else if (ext === ".jpg" || ext === ".jpeg") {
      contentType = "image/jpeg";
    } else if (ext === ".webp") {
      contentType = "image/webp";
    }

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "public, max-age=86400"
      }
    });
  } catch (err: any) {
    return new NextResponse(err.message, { status: 500 });
  }
}
