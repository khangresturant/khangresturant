import os
from PIL import Image

src_path = r"C:/Users/Dell/.gemini/antigravity/brain/46734b87-906c-4560-93e8-82e406f80090/.user_uploaded/media_1795194739726_2d9797ba.png"
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

print(f"Loading source image from: {src_path}")
img = Image.open(src_path).convert("RGBA")

# 1. Trim empty transparent margins
bbox = img.getbbox()
if bbox:
    img = img.crop(bbox)
    print(f"Cropped to content bbox: {img.size}")

# 2. Create square canvas with solid white background
CANVAS_SIZE = 1024
canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (255, 255, 255, 255))

# 3. Fit chef into canvas with a neat margin (approx 5% padding)
target_h = int(CANVAS_SIZE * 0.90)
target_w = int(CANVAS_SIZE * 0.90)

ratio = min(target_w / img.width, target_h / img.height)
new_w = int(img.width * ratio)
new_h = int(img.height * ratio)

resized_chef = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

# Position chef in center horizontally, bottom-aligned or centered vertically
offset_x = (CANVAS_SIZE - new_w) // 2
offset_y = (CANVAS_SIZE - new_h) // 2

# Paste chef onto white canvas using alpha mask
canvas.paste(resized_chef, (offset_x, offset_y), resized_chef)

# Convert to RGB (pure white background)
final_rgb = canvas.convert("RGB")

# Target file paths
public_ico = os.path.join(root_dir, "public", "icon.ico")
public_png = os.path.join(root_dir, "public", "icon.png")
electron_ico = os.path.join(root_dir, "electron", "icon.ico")
electron_png = os.path.join(root_dir, "electron", "icon.png")

# Save PNG (512x512)
png_512 = canvas.resize((512, 512), Image.Resampling.LANCZOS)
png_512.save(public_png, format="PNG")
png_512.save(electron_png, format="PNG")
print(f"Saved PNG icons to:\n  {public_png}\n  {electron_png}")

# Save Multi-size Windows ICO
icon_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
canvas.save(public_ico, format="ICO", sizes=icon_sizes)
canvas.save(electron_ico, format="ICO", sizes=icon_sizes)
print(f"Saved ICO icons to:\n  {public_ico}\n  {electron_ico}")

print("Icon generation completed successfully!")
