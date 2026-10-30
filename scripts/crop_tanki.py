from PIL import Image
import os

img_path = r'C:\Users\UR SOFT\.gemini\antigravity-ide\brain\2fa41e69-60c3-408e-be0c-278b5dcc6611\.user_uploaded\media_1790319290500.jpg'
im = Image.open(img_path)
w, h = im.size

out_dir = r'c:\Users\UR SOFT\Downloads\theaccounts_cloud_code\theaccounts_cloud_code\scratch'
os.makedirs(out_dir, exist_ok=True)

crop = im.crop((0, int(h * 0.6), w, h))
crop.save(os.path.join(out_dir, 'tanki_bottom.png'))
print(f"Crop saved, size: {crop.size}")
