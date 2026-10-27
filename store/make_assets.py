"""Builds the Google Play icon and feature graphic from the app icon.

Run with any Python that has Pillow:  python store/make_assets.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "store" / "android"
ICON = ROOT / "mobile" / "assets" / "icon.png"
FONTS = Path("/System/Library/Fonts/Supplemental")

BG = (231, 242, 236)  # theme bg #E7F2EC
INK = (26, 46, 40)  # theme ink #1A2E28
ACCENT = (15, 107, 92)  # theme accent #0F6B5C
MUTED = (92, 114, 106)


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / name), size)


def play_icon() -> None:
    Image.open(ICON).convert("RGB").resize((512, 512), Image.LANCZOS).save(OUT / "icon-512.png", optimize=True)


def feature_graphic() -> None:
    w, h = 1024, 500
    img = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(img)
    draw.ellipse((640, -180, 1240, 420), fill=(215, 232, 223))

    icon_size = 260
    icon = Image.open(ICON).convert("RGB").resize((icon_size, icon_size), Image.LANCZOS)
    mask = Image.new("L", (icon_size, icon_size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, icon_size, icon_size), radius=58, fill=255)
    img.paste(icon, (w - icon_size - 90, (h - icon_size) // 2), mask)

    x = 72
    draw.text((x, 92), "4UME", font=font("Arial Black.ttf", 96), fill=ACCENT)
    draw.text((x, 222), "Học tiếng Anh mỗi ngày", font=font("Arial Bold.ttf", 46), fill=INK)
    draw.text((x, 296), "Từ vựng · Phát âm · Nghe · Ngữ pháp", font=font("Arial.ttf", 32), fill=MUTED)
    draw.text((x, 352), "Hoàn toàn miễn phí", font=font("Arial.ttf", 32), fill=MUTED)
    img.save(OUT / "feature-graphic-1024x500.png", optimize=True)


def screenshots() -> None:
    """store/raw/01.png … (iPhone screenshots, in order) -> Play, App Store 6.9", and 6.1" Connect slot."""
    raw_dir = ROOT / "store" / "raw"
    # Only numbered files (01.png …); accept .PNG from iPhone AirDrop.
    raw = sorted(
        p
        for p in raw_dir.iterdir()
        if p.is_file()
        and p.suffix.lower() in {".png", ".jpg", ".jpeg"}
        and p.stem.isdigit()
    )
    if not raw:
        raise SystemExit(f"No numbered screenshots in {raw_dir} (expected 01.png, 02.png, …)")
    play_dir = OUT / "screenshots"
    ios_69 = ROOT / "store" / "ios" / "screenshots-6.9"
    ios_61 = ROOT / "store" / "ios" / "screenshots-6.1-connect"
    for d in (play_dir, ios_69, ios_61):
        d.mkdir(parents=True, exist_ok=True)
    for i, path in enumerate(raw, 1):
        shot = Image.open(path).convert("RGB")
        # Google Play: the long side may be at most twice the short side, so centre the shot on a 1080x2160 canvas.
        canvas = Image.new("RGB", (1080, 2160), BG)
        scaled = shot.resize((round(shot.width * 2160 / shot.height), 2160), Image.LANCZOS)
        canvas.paste(scaled, ((1080 - scaled.width) // 2, 0))
        canvas.save(play_dir / f"{i:02d}.png", optimize=True)
        # App Store 6.9" / 6.7": 1290×2796 (or scale to 1320×2868).
        ios = shot if shot.size in {(1290, 2796), (1320, 2868)} else shot.resize((1320, 2868), Image.LANCZOS)
        ios.save(ios_69 / f"{i:02d}.png", optimize=True)
        # Connect tab "iPhone 6.1" / Dynamic Island medium: 1179×2556 portrait.
        ios_61_out = ios if ios.size == (1290, 2796) else ios.resize((1290, 2796), Image.LANCZOS)
        ios_61_out.resize((1179, 2556), Image.LANCZOS).save(ios_61 / f"{i:02d}.png", optimize=True)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    play_icon()
    feature_graphic()
    screenshots()
    print("Wrote", *sorted(p.name for p in OUT.iterdir()))
