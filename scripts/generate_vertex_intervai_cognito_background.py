from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "frontend" / "src" / "assets" / "cognito-branding"
BACKGROUND_OUT = OUT_DIR / "cognito-background-vertex-intervai.jpg"
PREVIEW_OUT = OUT_DIR / "cognito-managed-login-preview-vertex-intervai.png"

W, H = 1920, 1080

NAVY = (3, 8, 22)
BLUE = (7, 18, 36)
SLATE = (15, 23, 42)
CYAN = (34, 211, 238)
TEAL = (45, 212, 191)
GREEN = (52, 211, 153)
VIOLET = (124, 58, 237)
WHITE = (248, 250, 252)
MUTED = (148, 163, 184)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]

    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size=size)
        except OSError:
            continue

    return ImageFont.load_default()


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def vertical_gradient(size: tuple[int, int], top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    image = Image.new("RGB", size)
    draw = ImageDraw.Draw(image)
    width, height = size

    for y in range(height):
        t = y / max(1, height - 1)
        color = tuple(lerp(top[i], bottom[i], t) for i in range(3))
        draw.line((0, y, width, y), fill=color)

    return image.convert("RGBA")


def add_glow(
    image: Image.Image,
    center: tuple[int, int],
    radius: int,
    color: tuple[int, int, int],
    opacity: int,
    blur: int,
) -> None:
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer, "RGBA")
    x, y = center
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(*color, opacity))
    image.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))


def shadowed_round_rect(
    image: Image.Image,
    box: tuple[int, int, int, int],
    radius: int,
    fill: tuple[int, int, int, int],
    outline: tuple[int, int, int, int] | None = None,
    shadow: tuple[int, int, int, int] = (0, 0, 0, 90),
    blur: int = 28,
) -> None:
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer, "RGBA")
    x1, y1, x2, y2 = box
    draw.rounded_rectangle((x1 + 8, y1 + 16, x2 + 8, y2 + 16), radius=radius, fill=shadow)
    image.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))

    draw = ImageDraw.Draw(image, "RGBA")
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=1 if outline else 0)


def draw_fine_mesh(image: Image.Image) -> None:
    draw = ImageDraw.Draw(image, "RGBA")

    for offset in range(-H, W, 160):
        draw.line((offset, H, offset + H, 0), fill=(*CYAN, 8), width=1)

    for x in range(0, W, 96):
        alpha = 5 if x % 192 else 10
        draw.line((x, 0, x, H), fill=(255, 255, 255, alpha), width=1)

    for y in range(0, H, 96):
        alpha = 5 if y % 192 else 10
        draw.line((0, y, W, y), fill=(255, 255, 255, alpha), width=1)


def draw_network(image: Image.Image, seed: int = 9) -> None:
    random.seed(seed)
    draw = ImageDraw.Draw(image, "RGBA")
    nodes: list[tuple[int, int, tuple[int, int, int]]] = []

    for _ in range(38):
        side = random.choice(["left", "right", "bottom"])
        if side == "left":
            x = random.randint(90, 650)
            y = random.randint(140, 930)
        elif side == "right":
            x = random.randint(1220, 1810)
            y = random.randint(120, 930)
        else:
            x = random.randint(430, 1540)
            y = random.randint(720, 1000)
        color = random.choice([CYAN, TEAL, GREEN, VIOLET])
        nodes.append((x, y, color))

    for i, (x, y, color) in enumerate(nodes):
        linked = sorted(nodes[i + 1 :], key=lambda node: math.dist((x, y), (node[0], node[1])))[:3]
        for ox, oy, _ in linked:
            if math.dist((x, y), (ox, oy)) < 270:
                draw.line((x, y, ox, oy), fill=(*color, 44), width=1)

    for x, y, color in nodes:
        draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill=(*color, 190))
        draw.ellipse((x - 16, y - 16, x + 16, y + 16), outline=(*color, 48), width=1)


def draw_cv_panel(image: Image.Image) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    box = (132, 240, 540, 760)
    shadowed_round_rect(
        image,
        box,
        28,
        fill=(8, 20, 39, 154),
        outline=(*CYAN, 70),
        shadow=(0, 0, 0, 100),
    )

    x1, y1, x2, _ = box
    draw.rounded_rectangle((x1 + 34, y1 + 38, x1 + 128, y1 + 132), radius=18, fill=(*CYAN, 26), outline=(*CYAN, 82), width=1)
    draw.ellipse((x1 + 64, y1 + 58, x1 + 96, y1 + 90), fill=(*TEAL, 120))
    draw.arc((x1 + 54, y1 + 84, x1 + 106, y1 + 134), 200, 340, fill=(*WHITE, 92), width=3)

    for i, width in enumerate([250, 188, 286, 226]):
        y = y1 + 46 + i * 28
        draw.rounded_rectangle((x1 + 154, y, x1 + 154 + width, y + 8), radius=4, fill=(*WHITE, 60))

    for i in range(8):
        y = y1 + 190 + i * 34
        color = CYAN if i % 3 == 0 else GREEN if i % 3 == 1 else VIOLET
        draw.rounded_rectangle((x1 + 36, y, x2 - 38, y + 11), radius=5, fill=(*WHITE, 35))
        draw.rounded_rectangle((x1 + 36, y, x1 + 120 + i * 22, y + 11), radius=5, fill=(*color, 88))

    for i, (cx, cy) in enumerate([(214, 674), (292, 626), (384, 670), (448, 616)]):
        color = [CYAN, GREEN, TEAL, VIOLET][i]
        draw.ellipse((cx - 11, cy - 11, cx + 11, cy + 11), fill=(*color, 165))
        if i:
            px, py = [(214, 674), (292, 626), (384, 670), (448, 616)][i - 1]
            draw.line((px, py, cx, cy), fill=(*color, 72), width=2)


def draw_ai_panel(image: Image.Image) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    center = (1508, 392)
    radius = 158

    for index, alpha in enumerate([24, 34, 58]):
        r = radius + index * 36
        draw.ellipse((center[0] - r, center[1] - r, center[0] + r, center[1] + r), outline=(*CYAN, alpha), width=2)

    shadowed_round_rect(
        image,
        (1254, 248, 1762, 646),
        38,
        fill=(8, 19, 38, 126),
        outline=(*TEAL, 58),
        shadow=(0, 0, 0, 70),
        blur=34,
    )

    draw.ellipse((center[0] - 96, center[1] - 96, center[0] + 96, center[1] + 96), fill=(4, 14, 30, 170), outline=(*CYAN, 100), width=2)
    draw.ellipse((center[0] - 34, center[1] - 46, center[0] - 14, center[1] - 26), fill=(*CYAN, 180))
    draw.ellipse((center[0] + 14, center[1] - 46, center[0] + 34, center[1] - 26), fill=(*GREEN, 180))
    draw.arc((center[0] - 48, center[1] - 30, center[0] + 48, center[1] + 58), 28, 152, fill=(*WHITE, 120), width=3)

    for i in range(9):
        angle = math.radians(i * 40 + 12)
        x = center[0] + math.cos(angle) * 132
        y = center[1] + math.sin(angle) * 132
        draw.line((center[0], center[1], x, y), fill=(*CYAN, 34), width=1)
        draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill=(*TEAL, 150))

    wave_y = 560
    last = None
    for i in range(150):
        x = 1302 + i * 3
        y = wave_y + math.sin(i / 7) * 18 + math.sin(i / 2.7) * 5
        if last:
            draw.line((*last, x, y), fill=(*CYAN, 106), width=2)
        last = (x, y)


def draw_center_focus(image: Image.Image) -> None:
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    draw.rounded_rectangle((600, 300, 1320, 830), radius=62, fill=(1, 5, 14, 136))
    image.alpha_composite(overlay.filter(ImageFilter.GaussianBlur(38)))


def add_vignette(image: Image.Image) -> None:
    vignette = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(vignette, "RGBA")

    for i in range(220):
        alpha = max(0, 155 - int(i * 0.7))
        draw.rectangle((i, i, W - i, H - i), outline=(0, 0, 0, alpha), width=1)

    image.alpha_composite(vignette)


def create_background() -> Image.Image:
    image = vertical_gradient((W, H), NAVY, BLUE)
    add_glow(image, (360, 840), 380, GREEN, 80, 110)
    add_glow(image, (1520, 280), 390, CYAN, 95, 110)
    add_glow(image, (1040, 780), 320, VIOLET, 66, 100)
    draw_fine_mesh(image)
    draw_network(image)
    draw_cv_panel(image)
    draw_ai_panel(image)
    draw_center_focus(image)
    add_vignette(image)
    return ImageEnhance.Contrast(image.convert("RGB")).enhance(1.04)


def create_preview(background: Image.Image) -> Image.Image:
    preview = background.convert("RGBA")
    draw = ImageDraw.Draw(preview, "RGBA")

    x1, y1, x2, y2 = 696, 346, 1224, 756
    shadowed_round_rect(
        preview,
        (x1, y1, x2, y2),
        26,
        fill=(248, 250, 252, 246),
        outline=(190, 232, 240, 210),
        shadow=(0, 0, 0, 150),
        blur=36,
    )

    draw.text((x1 + 56, y1 + 54), "Sign in", font=font(38, True), fill=(15, 23, 42, 255))
    draw.text((x1 + 56, y1 + 108), "Sign in to your account.", font=font(20), fill=(71, 85, 105, 255))
    draw.text((x1 + 56, y1 + 170), "Email address", font=font(18, True), fill=(15, 23, 42, 255))
    draw.rounded_rectangle((x1 + 56, y1 + 206, x2 - 56, y1 + 262), radius=13, fill=(255, 255, 255, 255), outline=(148, 163, 184, 255), width=2)
    draw.text((x1 + 78, y1 + 220), "name@host.com", font=font(18), fill=(100, 116, 139, 255))
    draw.rounded_rectangle((x1 + 56, y1 + 300, x2 - 56, y1 + 360), radius=15, fill=(15, 23, 42, 255))
    draw.text((x1 + 239, y1 + 314), "Next", font=font(20, True), fill=(255, 255, 255, 255))
    draw.text((x1 + 190, y1 + 386), "New user?", font=font(18), fill=(100, 116, 139, 255))
    draw.text((x1 + 282, y1 + 386), "Create an account", font=font(18), fill=(2, 132, 199, 255))

    return preview.convert("RGB")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    background = create_background()
    background.save(BACKGROUND_OUT, quality=90, optimize=True, progressive=True)
    create_preview(background).save(PREVIEW_OUT, optimize=True)
    print(f"Generated {BACKGROUND_OUT} ({BACKGROUND_OUT.stat().st_size} bytes)")
    print(f"Generated {PREVIEW_OUT} ({PREVIEW_OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
