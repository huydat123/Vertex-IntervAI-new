from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "frontend" / "src" / "assets" / "cognito-branding"

CYAN = (103, 232, 249)
GREEN = (52, 211, 153)
VIOLET = (124, 58, 237)
NAVY = (6, 17, 31)
SLATE = (15, 23, 42)
TEXT = (241, 245, 249)
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
    width, height = size
    image = Image.new("RGB", size)
    draw = ImageDraw.Draw(image)

    for y in range(height):
        t = y / max(1, height - 1)
        color = tuple(lerp(top[i], bottom[i], t) for i in range(3))
        draw.line([(0, y), (width, y)], fill=color)

    return image.convert("RGBA")


def add_glow(
    image: Image.Image,
    center: tuple[int, int],
    radius: int,
    color: tuple[int, int, int],
    opacity: int = 130,
    blur: int = 60,
) -> None:
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    x, y = center
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(*color, opacity))
    image.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))


def add_grid(image: Image.Image, spacing: int = 54, opacity: int = 28) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    width, height = image.size

    for x in range(0, width + spacing, spacing):
        draw.line((x, 0, x, height), fill=(*CYAN, opacity), width=1)

    for y in range(0, height + spacing, spacing):
        draw.line((0, y, width, y), fill=(*CYAN, opacity), width=1)


def add_circuit_lines(image: Image.Image, count: int, seed: int) -> None:
    random.seed(seed)
    draw = ImageDraw.Draw(image, "RGBA")
    width, height = image.size

    for _ in range(count):
        x = random.randint(0, width)
        y = random.randint(0, height)
        steps = random.randint(2, 5)
        points = [(x, y)]

        for _step in range(steps):
            horizontal = random.choice([True, False])
            distance = random.randint(70, 220)
            if horizontal:
                x = max(0, min(width, x + random.choice([-1, 1]) * distance))
            else:
                y = max(0, min(height, y + random.choice([-1, 1]) * distance))
            points.append((x, y))

        color = CYAN if random.random() > 0.45 else GREEN
        draw.line(points, fill=(*color, random.randint(48, 92)), width=random.choice([1, 2]))
        for px, py in points[1:-1]:
            draw.ellipse((px - 4, py - 4, px + 4, py + 4), fill=(*color, 130))


def add_neural_nodes(image: Image.Image, count: int, seed: int) -> None:
    random.seed(seed)
    draw = ImageDraw.Draw(image, "RGBA")
    width, height = image.size
    nodes: list[tuple[int, int, tuple[int, int, int]]] = []

    for _ in range(count):
        x = random.randint(int(width * 0.08), int(width * 0.94))
        y = random.randint(int(height * 0.08), int(height * 0.92))
        color = random.choice([CYAN, GREEN, VIOLET])
        nodes.append((x, y, color))

    for index, (x, y, color) in enumerate(nodes):
        for other_x, other_y, _ in nodes[index + 1 : index + 4]:
            if math.dist((x, y), (other_x, other_y)) < min(width, height) * 0.22:
                draw.line((x, y, other_x, other_y), fill=(*color, 38), width=1)

    for x, y, color in nodes:
        draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill=(*color, 190))
        draw.ellipse((x - 13, y - 13, x + 13, y + 13), outline=(*color, 64), width=1)


def draw_hex_mark(draw: ImageDraw.ImageDraw, center: tuple[int, int], radius: int, alpha: int = 255) -> None:
    cx, cy = center
    points = []
    for i in range(6):
        angle = math.radians(60 * i - 30)
        points.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))

    draw.polygon(points, fill=(9, 24, 44, alpha), outline=(*CYAN, min(255, alpha)))
    inner = radius * 0.56
    draw.line((cx - inner, cy, cx - 16, cy - 22, cx + 12, cy - 20, cx + inner, cy), fill=(*GREEN, alpha), width=5)
    draw.line((cx - inner, cy, cx - 16, cy + 22, cx + 12, cy + 20, cx + inner, cy), fill=(*CYAN, alpha), width=5)
    draw.ellipse((cx - 10, cy - 10, cx + 10, cy + 10), fill=(*VIOLET, alpha))
    draw.ellipse((cx - 5, cy - 5, cx + 5, cy + 5), fill=(255, 255, 255, alpha))


def create_background() -> Image.Image:
    image = vertical_gradient((1920, 1080), NAVY, (2, 8, 23))
    add_glow(image, (1390, 260), 360, CYAN, 125, 95)
    add_glow(image, (430, 830), 330, GREEN, 105, 100)
    add_glow(image, (1070, 660), 290, VIOLET, 88, 95)
    add_grid(image, 54, 26)
    add_circuit_lines(image, 34, seed=42)
    add_neural_nodes(image, 42, seed=12)

    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    draw.rectangle((0, 0, 840, 1080), fill=(3, 10, 24, 150))
    draw.rectangle((0, 780, 1920, 1080), fill=(3, 10, 24, 118))
    draw.line((0, 760, 1920, 420), fill=(*CYAN, 44), width=2)
    draw.line((0, 820, 1920, 500), fill=(*GREEN, 34), width=2)
    image.alpha_composite(overlay)
    return image


def crop_banner(source: Image.Image, box: tuple[int, int, int, int], size: tuple[int, int], title: str) -> Image.Image:
    banner = source.crop(box).resize(size)
    layer = Image.new("RGBA", banner.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer, "RGBA")
    draw.rectangle((0, 0, size[0], size[1]), fill=(3, 10, 24, 72))
    draw_hex_mark(draw, (120, size[1] // 2), 54, 230)
    draw.text((196, size[1] // 2 - 42), "Vertex-IntervAI", font=font(48, True), fill=TEXT)
    draw.text((200, size[1] // 2 + 14), title, font=font(22), fill=(*MUTED, 235))
    banner.alpha_composite(layer)
    return banner


def create_logo() -> Image.Image:
    image = Image.new("RGBA", (1200, 360), (0, 0, 0, 0))
    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow, "RGBA")
    glow_draw.ellipse((36, 45, 270, 279), fill=(*CYAN, 78))
    image.alpha_composite(glow.filter(ImageFilter.GaussianBlur(30)))

    draw = ImageDraw.Draw(image, "RGBA")
    draw_hex_mark(draw, (152, 162), 82)
    draw.text((272, 96), "Vertex-IntervAI", font=font(68, True), fill=TEXT)
    draw.text((278, 184), "Talent Graph AI", font=font(31), fill=(*CYAN, 235))
    draw.line((278, 242, 735, 242), fill=(*GREEN, 190), width=3)
    draw.text((278, 266), "CV intelligence - AI interviews - candidate signals", font=font(24), fill=(*MUTED, 220))
    return image


def create_mark() -> Image.Image:
    image = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow, "RGBA")
    glow_draw.ellipse((88, 88, 424, 424), fill=(*CYAN, 95))
    image.alpha_composite(glow.filter(ImageFilter.GaussianBlur(42)))
    draw_hex_mark(ImageDraw.Draw(image, "RGBA"), (256, 256), 148)
    return image


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    background = create_background()
    background.save(OUT_DIR / "cognito-background-dark-neon.png")

    crop_banner(
        background,
        (0, 0, 1200, 360),
        (1200, 360),
        "Secure AI interview workspace",
    ).save(OUT_DIR / "cognito-header-dark-neon.png")

    crop_banner(
        background,
        (0, 720, 1200, 1080),
        (1200, 360),
        "Role-aware access powered by Cognito",
    ).save(OUT_DIR / "cognito-footer-dark-neon.png")

    create_logo().save(OUT_DIR / "cognito-logo-dark-neon.png")
    create_mark().save(OUT_DIR / "cognito-mark-dark-neon.png")

    print(f"Generated branding assets in {OUT_DIR}")


if __name__ == "__main__":
    main()
