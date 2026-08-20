"""One-shot web image compression for the wedding RSVP site."""
from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "assets"
BACKUP = ROOT / "_precompress_backup"


def size_kb(path: Path) -> float:
    return path.stat().st_size / 1024


def backup_once(src: Path) -> None:
    BACKUP.mkdir(exist_ok=True)
    dest = BACKUP / src.name
    if not dest.exists():
        shutil.copy2(src, dest)


def main() -> None:
    report: list[str] = []

    # 1) entourage-bg.jpg — 9504px → 2200w JPEG
    src = ROOT / "entourage-bg.jpg"
    backup_once(src)
    im = Image.open(src).convert("RGB")
    w, h = im.size
    max_w = 2200
    if w > max_w:
        im = im.resize((max_w, int(h * max_w / w)), Image.Resampling.LANCZOS)
    before = size_kb(src)
    im.save(src, "JPEG", quality=78, optimize=True, progressive=True)
    report.append(f"entourage-bg.jpg {before:.0f}→{size_kb(src):.0f}KB {im.size}")

    # 2) invite-toile → WebP (no alpha)
    src = ROOT / "invite-toile-botanical.png"
    backup_once(src)
    im = Image.open(src).convert("RGB")
    out = ROOT / "invite-toile-botanical.webp"
    before = size_kb(src)
    im.save(out, "WEBP", quality=72, method=6)
    report.append(f"invite-toile {before:.0f}KB png → {size_kb(out):.0f}KB webp {im.size}")

    # 3) invite-floral-ark → WebP alpha
    src = ROOT / "invite-floral-ark.png"
    backup_once(src)
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    if w > 1400:
        im = im.resize((1400, int(h * 1400 / w)), Image.Resampling.LANCZOS)
    out = ROOT / "invite-floral-ark.webp"
    before = size_kb(src)
    im.save(out, "WEBP", quality=80, method=6)
    report.append(f"invite-floral-ark {before:.0f}KB png → {size_kb(out):.0f}KB webp {im.size}")

    # 4) envelope-sprig → WebP alpha
    src = ROOT / "envelope-sprig.png"
    backup_once(src)
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    max_h = 900
    if h > max_h:
        im = im.resize((int(w * max_h / h), max_h), Image.Resampling.LANCZOS)
    out = ROOT / "envelope-sprig.webp"
    before = size_kb(src)
    im.save(out, "WEBP", quality=78, method=6)
    report.append(f"envelope-sprig {before:.0f}KB png → {size_kb(out):.0f}KB webp {im.size}")

    # 5) entourage-center-flower → WebP alpha
    src = ROOT / "entourage-center-flower.png"
    backup_once(src)
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    max_w = 700
    if w > max_w:
        im = im.resize((max_w, int(h * max_w / w)), Image.Resampling.LANCZOS)
    out = ROOT / "entourage-center-flower.webp"
    before = size_kb(src)
    im.save(out, "WEBP", quality=78, method=6)
    report.append(f"entourage-flower {before:.0f}KB png → {size_kb(out):.0f}KB webp {im.size}")

    # 6) bride-portrait → WebP
    src = ROOT / "bride-portrait.png"
    backup_once(src)
    im = Image.open(src).convert("RGBA")
    out = ROOT / "bride-portrait.webp"
    before = size_kb(src)
    im.save(out, "WEBP", quality=82, method=6)
    report.append(f"bride-portrait {before:.0f}KB png → {size_kb(out):.0f}KB webp {im.size}")

    # 7) welcome-1 gifts bg
    src = ROOT / "welcome-1.jpg"
    backup_once(src)
    im = Image.open(src).convert("RGB")
    w, h = im.size
    before = size_kb(src)
    if w > 1400:
        im = im.resize((1400, int(h * 1400 / w)), Image.Resampling.LANCZOS)
    im.save(src, "JPEG", quality=76, optimize=True, progressive=True)
    report.append(f"welcome-1.jpg {before:.0f}→{size_kb(src):.0f}KB {im.size}")

    # 8) estancia-main
    src = ROOT / "estancia-main.jpg"
    backup_once(src)
    im = Image.open(src).convert("RGB")
    w, h = im.size
    before = size_kb(src)
    if w > 1600:
        im = im.resize((1600, int(h * 1600 / w)), Image.Resampling.LANCZOS)
    im.save(src, "JPEG", quality=78, optimize=True, progressive=True)
    report.append(f"estancia-main.jpg {before:.0f}→{size_kb(src):.0f}KB {im.size}")

    # 9) gallery frames
    for src in sorted((ROOT / "gallery").glob("frame-*.jpg")):
        im = Image.open(src).convert("RGB")
        w, h = im.size
        before = size_kb(src)
        long_edge = max(w, h)
        if long_edge > 1200:
            scale = 1200 / long_edge
            im = im.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
        im.save(src, "JPEG", quality=76, optimize=True, progressive=True)
        report.append(f"{src.name} {before:.0f}→{size_kb(src):.0f}KB {im.size}")

    print("\n".join(report))


if __name__ == "__main__":
    main()
