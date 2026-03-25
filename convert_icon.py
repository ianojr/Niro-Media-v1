import os
from PIL import Image

def generate_icons():
    src_path = r'C:\Users\Hp\.gemini\antigravity\brain\39e8aefb-0c78-4351-a232-134b2e5ed2c3\niro_media_icon_1774192810631.png'
    dest_dir = r'C:\Software Engineering\Rust\Media Player\src-tauri\icons'
    
    if not os.path.exists(dest_dir):
        os.makedirs(dest_dir)
        
    print(f"Opening source image: {src_path}")
    img = Image.open(src_path).convert("RGBA")
    
    # Standard sizes for Tauri
    sizes = {
        "32x32.png": (32, 32),
        "128x128.png": (128, 128),
        "128x128@2x.png": (256, 256),
        "icon.png": (512, 512)
    }
    
    for filename, size in sizes.items():
        resized = img.resize(size, Image.Resampling.LANCZOS)
        resized.save(os.path.join(dest_dir, filename))
        print(f"Saved {filename}")
        
    # Generate .ico
    ico_path = os.path.join(dest_dir, "icon.ico")
    img.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print(f"Saved icon.ico")

if __name__ == "__main__":
    generate_icons()
