"""Chroma-key invite-floral-cutout.png (#FF00FF) → invite-floral-ark.png RGBA."""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "invite-floral-cutout.png"
DST = ROOT / "assets" / "invite-floral-ark.png"


def main() -> None:
    img = Image.open(SRC).convert("RGBA")
    arr = np.asarray(img).astype(np.float32)
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]

    key = np.array([255.0, 0.0, 255.0], dtype=np.float32)
    diff = np.sqrt((r - key[0]) ** 2 + (g - key[1]) ** 2 + (b - key[2]) ** 2)

    # Soft distance ramp from pure magenta
    t0, t1 = 45.0, 115.0
    alpha_from_dist = np.clip((diff - t0) / (t1 - t0), 0.0, 1.0)

    # Kill remaining hot-pink / magenta spill (high R+B, low G)
    rb_min = np.minimum(r, b)
    magenta_score = np.clip((rb_min - g * 1.35) / 90.0, 0.0, 1.0)
    magenta_score *= np.clip((r - 80) / 100.0, 0.0, 1.0)
    magenta_score *= np.clip((b - 80) / 100.0, 0.0, 1.0)
    alpha_from_magenta = 1.0 - magenta_score

    alpha_new = np.minimum(alpha_from_dist, alpha_from_magenta) * (a / 255.0)

    alpha_img = Image.fromarray((alpha_new * 255).astype(np.uint8), mode="L")
    alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(radius=1.2))
    alpha_feathered = np.asarray(alpha_img).astype(np.float32) / 255.0

    # Despill: pull R/B toward green on translucent magenta-tinted edges
    spill = magenta_score * (1.0 - alpha_feathered * 0.35)
    r2 = np.clip(r - (r - g) * spill * 0.85, 0, 255)
    b2 = np.clip(b - (b - g) * spill * 0.85, 0, 255)

    out = np.stack([r2, g, b2, alpha_feathered * 255], axis=-1).astype(np.uint8)
    mask0 = out[:, :, 3] == 0
    out[mask0, 0:3] = 0

    result = Image.fromarray(out, mode="RGBA")
    result.save(DST, optimize=True)

    h, w = out.shape[:2]
    corners = {
        "TL": int(out[0, 0, 3]),
        "TR": int(out[0, w - 1, 3]),
        "BL": int(out[h - 1, 0, 3]),
        "BR": int(out[h - 1, w - 1, 3]),
    }
    print(f"Saved {DST.name} {w}x{h} mode={result.mode}")
    print("Corner alphas:", corners)
    print(
        f"Alpha min/max/mean: {out[:,:,3].min()} / {out[:,:,3].max()} / {out[:,:,3].mean():.1f}"
    )
    pct = 100 * (out[:, :, 3] == 0).mean()
    print(f"Transparent pixels (a=0): {(out[:,:,3]==0).sum()} / {out[:,:,3].size} ({pct:.1f}%)")
    assert all(v == 0 for v in corners.values()), f"Corners not transparent: {corners}"
    assert result.mode == "RGBA"
    print("OK: corners transparent, RGBA confirmed")


if __name__ == "__main__":
    main()
