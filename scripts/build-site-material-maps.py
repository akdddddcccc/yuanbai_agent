"""Build compact PBR maps from Yuanbai photo-derived tiles.

Normals and roughness are restrained artistic estimates, not measured scans.
The source PNGs remain untouched so the material can be refined later.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
TEXTURES = ROOT / "public" / "models" / "textures" / "yuanbai-site"
SOURCES = ROOT / "assets" / "materials" / "yuanbai-site"
SIZE = 768


def normal_from_height(image: Image.Image, strength: float) -> Image.Image:
    height = np.asarray(image.convert("L").filter(ImageFilter.GaussianBlur(0.7)), dtype=np.float32) / 255.0
    gradient_y, gradient_x = np.gradient(height)
    normal = np.dstack((-gradient_x * strength, -gradient_y * strength, np.ones_like(height)))
    normal /= np.linalg.norm(normal, axis=2, keepdims=True)
    return Image.fromarray(np.uint8(np.clip(normal * 0.5 + 0.5, 0, 1) * 255), "RGB")


def roughness_from_image(image: Image.Image, base: int, variation: float) -> Image.Image:
    gray = np.asarray(image.convert("L").filter(ImageFilter.GaussianBlur(1.1)), dtype=np.float32)
    detail = gray - np.asarray(image.convert("L").filter(ImageFilter.GaussianBlur(8)), dtype=np.float32)
    roughness = np.clip(base + detail * variation, 35, 245).astype(np.uint8)
    return Image.fromarray(roughness, "L")


def build_material(name: str, contrast: float, color: float, normal_strength: float, roughness: int, variation: float):
    source = Image.open(SOURCES / f"{name}-source.png").convert("RGB")
    source = source.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    albedo = ImageEnhance.Contrast(source).enhance(contrast)
    albedo = ImageEnhance.Color(albedo).enhance(color)
    albedo.save(TEXTURES / f"{name}-albedo.jpg", quality=90, optimize=True, progressive=True)
    normal_from_height(albedo, normal_strength).save(TEXTURES / f"{name}-normal.jpg", quality=88, optimize=True)
    roughness_from_image(albedo, roughness, variation).save(TEXTURES / f"{name}-roughness.png", optimize=True)
    if name == "painted-steel":
        # Steel cages should read as dark steel; the original orange paint remains
        # visible only as low-saturation wear, never as a uniform orange frame.
        muted = ImageEnhance.Color(albedo).enhance(0.12)
        ImageEnhance.Brightness(muted).enhance(0.32).save(
            TEXTURES / "steel-muted-albedo.jpg", quality=90, optimize=True
        )


def main():
    build_material("concrete", contrast=0.94, color=0.55, normal_strength=1.25, roughness=222, variation=0.32)
    build_material("brick", contrast=0.98, color=0.90, normal_strength=5.0, roughness=208, variation=0.42)
    build_material("painted-steel", contrast=0.96, color=0.86, normal_strength=0.7, roughness=156, variation=0.36)
    print("YUANBAI_MATERIAL_MAPS_READY")


if __name__ == "__main__":
    main()
