from PIL import Image
import os

src = r"C:\Users\UR SOFT\.cursor\projects\c-Users-UR-SOFT-Desktop-HISAB-X-HisabX-web\assets\c__Users_UR_SOFT_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_logo-d49a3307-d525-4f5f-948e-dd17430fa14e.png"
out_dir = r"C:\Users\UR SOFT\Desktop\HISAB X\HisabX web\public"
out_full = os.path.join(out_dir, "logo-brand.png")
out_icon = os.path.join(out_dir, "logo.png")
out_backup = os.path.join(out_dir, "logo_old_backup.png")

# backup existing logo.png if present
old = os.path.join(out_dir, "logo.png")
if os.path.exists(old) and not os.path.exists(out_backup):
    Image.open(old).save(out_backup)

img = Image.open(src).convert("RGBA")
pixels = img.load()
w, h = img.size

for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        if r >= 245 and g >= 245 and b >= 245:
            pixels[x, y] = (r, g, b, 0)
        elif r >= 230 and g >= 230 and b >= 230 and min(r, g, b) > 220:
            avg = (r + g + b) / 3.0
            alpha = int(max(0, min(255, (255 - avg) * 8)))
            pixels[x, y] = (r, g, b, alpha)

bbox = img.getbbox()
if bbox:
    img = img.crop(bbox)

img.save(out_full, "PNG")
print("saved", out_full, img.size)

iw, ih = img.size
emblem = img.crop((0, 0, iw, int(ih * 0.62)))
eb = emblem.getbbox()
if eb:
    emblem = emblem.crop(eb)
ew, eh = emblem.size
side = max(ew, eh)
square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
square.paste(emblem, ((side - ew) // 2, (side - eh) // 2), emblem)
square = square.resize((512, 512), Image.Resampling.LANCZOS)
square.save(out_icon, "PNG")
print("saved", out_icon, square.size)
