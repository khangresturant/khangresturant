/**
 * Showroom Media Compression & Google Drive Automatic Folder Organizer
 * Compresses vehicle photos, CNIC scans, party photos and documents,
 * and uploads them directly into the connected Google Drive with structured folders.
 */

// 1. Client-side Image Compression (max 1200px width/height, WebP/JPEG ~80KB-150KB)
export async function compressImage(file: File, maxDimension = 1200, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // If not an image (e.g. PDF), return original blob
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP first, fallback to JPEG
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              canvas.toBlob(
                (jpegBlob) => resolve(jpegBlob || file),
                "image/jpeg",
                quality
              );
            }
          },
          "image/webp",
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

// Convert Blob to Base64 Data URL (for fast preview & offline fallback)
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Upload file to Google Drive under:
 * "The Accounts" -> "[Category]" (e.g. "Vehicles", "Customers", "Sellers") -> "[ItemName]" (e.g. "Toyota Corolla LEA-2024")
 */
export async function uploadToShowroomDrive(
  shopId: string,
  file: File,
  category: "Vehicles" | "Customers" | "Sellers" | "Guarantors" | "Documents",
  itemName: string
): Promise<{ url: string; driveFileId?: string; error?: string }> {
  try {
    // 1. Compress image first
    const compressedBlob = await compressImage(file);
    const dataUrlFallback = await blobToDataUrl(compressedBlob);

    // 2. Check if shop has Google Drive linked
    const tokenRes = await fetch(`/api/backups/gdrive-token?shopId=${encodeURIComponent(shopId)}`);
    if (!tokenRes.ok) {
      // Return compressed base64 if Drive not linked
      return { url: dataUrlFallback };
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return { url: dataUrlFallback };
    }

    // 3. Find or create root folder "The Accounts"
    const rootFolderId = await getOrCreateFolder(accessToken, "The Accounts", tokenData.folder_id || undefined);
    
    // 4. Find or create category folder (e.g. "Vehicles" or "Customers")
    const categoryFolderId = await getOrCreateFolder(accessToken, category, rootFolderId);

    // 5. Find or create item specific folder (e.g. "Honda Civic - LEA 9821")
    const sanitizedItemName = (itemName || "General").replace(/[\/\\:*?"<>|]/g, "_").trim();
    const itemFolderId = await getOrCreateFolder(accessToken, sanitizedItemName, categoryFolderId);

    // 6. Upload the file to the item folder
    const metadata = {
      name: `${Date.now()}_${file.name.replace(/[\/\\:*?"<>|]/g, "_")}`,
      parents: [itemFolderId],
    };

    const formData = new FormData();
    formData.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    formData.append("file", compressedBlob, file.name);

    const uploadRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,thumbnailLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      }
    );

    if (!uploadRes.ok) {
      console.warn("Drive upload failed, using local compressed data URL fallback");
      return { url: dataUrlFallback };
    }

    const fileResult = await uploadRes.json();
    
    // Make file readable if possible or use drive link
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileResult.id}/permissions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: "reader", type: "anyone" }),
      });
    } catch (_) {}

    // Google Drive direct thumbnail / view URL
    const gdriveUrl =
      fileResult.thumbnailLink?.replace(/=s\d+/, "=s1600") ||
      fileResult.webViewLink ||
      dataUrlFallback;

    return {
      url: gdriveUrl,
      driveFileId: fileResult.id,
    };
  } catch (err: any) {
    console.error("Error in showroom media upload:", err);
    try {
      const fallback = await blobToDataUrl(file);
      return { url: fallback };
    } catch {
      return { url: "", error: err.message };
    }
  }
}

// Helper: Find or create Google Drive folder
async function getOrCreateFolder(accessToken: string, folderName: string, parentId?: string): Promise<string> {
  try {
    let query = `name='${folderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    }

    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
      }
    }

    // Create folder if not found
    const meta: { name: string; mimeType: string; parents?: string[] } = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    };
    if (parentId) {
      meta.parents = [parentId];
    }

    const createRes = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(meta),
    });

    if (createRes.ok) {
      const createData = await createRes.json();
      return createData.id;
    }
  } catch (e) {
    console.warn("Folder search/create failed:", e);
  }

  return parentId || "root";
}
