"""
CEREBRO v7 — Image Generation
Generates hero images for articles.
- SVG placeholder: always available, geometric art based on topic keywords
- Gemini: when GEMINI_API_KEY set, generates real images via Imagen API
"""
import hashlib
import random
import httpx
from typing import Optional
from packages.core import db, config, get_logger

logger = get_logger("images")

# ── Color palettes by style ───────────────────────────────────────────────────
_PALETTES = {
    "financial": {
        "bg_start":  "#0f172a",   # slate-900
        "bg_end":    "#1e293b",   # slate-800
        "accent1":   "#22c55e",   # green-500
        "accent2":   "#16a34a",   # green-600
        "grid":      "#1e293b",   # slate-800
        "text":      "#334155",   # slate-700 (subtle watermark)
    },
    "lifestyle": {
        "bg_start":  "#0c1445",   # deep blue
        "bg_end":    "#0e7490",   # cyan-700
        "accent1":   "#06b6d4",   # cyan-500
        "accent2":   "#0284c7",   # sky-600
        "grid":      "#155e75",   # cyan-800
        "text":      "#164e63",   # cyan-900 (subtle watermark)
    },
    "remittance": {
        "bg_start":  "#1c0a00",   # deep amber/brown
        "bg_end":    "#92400e",   # amber-800
        "accent1":   "#f59e0b",   # amber-500
        "accent2":   "#d97706",   # amber-600
        "grid":      "#78350f",   # amber-900
        "text":      "#451a03",   # amber-950 (subtle watermark)
    },
}

_GEMINI_ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "imagen-3.0-fast-generate-001:generateImages"
)

_PROMPT_TEMPLATE = (
    "Financial infographic hero image for article about {keyword}. "
    "Clean, professional, dark background with {color} accents. "
    "Minimalist data visualization aesthetic. No text, no people."
)

_COLOR_NAMES = {
    "financial": "green",
    "lifestyle": "cyan",
    "remittance": "amber",
}


# ── Public API ────────────────────────────────────────────────────────────────

async def generate_hero_image(
    keyword: str,
    title: str,
    asset_id: str = None,
    style: str = "financial",
) -> dict:
    """
    Generate a hero image for an article.

    Returns:
        {
            "type": "svg" | "gemini",
            "data": str,          # SVG string or base64 image
            "content_type": "image/svg+xml" | "image/jpeg",
            "prompt_used": str,
            "cached": bool,
        }
    """
    # 1. Check Supabase cache first
    if asset_id:
        cached = await _check_cache(asset_id)
        if cached:
            logger.info(f"Image cache hit for asset {asset_id}")
            return cached

    # 2. Try Gemini if key is configured
    if config.GEMINI_KEY:
        try:
            result = await _generate_gemini(keyword, style)
            logger.info(f"Gemini image generated for keyword={keyword!r}")
            await _try_save_to_supabase(asset_id, result)
            return result
        except Exception as exc:
            logger.warning(f"Gemini image generation failed ({exc}), falling back to SVG")

    # 3. SVG fallback (always works)
    result = _generate_svg(keyword, style)
    logger.info(f"SVG image generated for keyword={keyword!r}")
    await _try_save_to_supabase(asset_id, result)
    return result


# ── SVG Generator ─────────────────────────────────────────────────────────────

def _generate_svg(keyword: str, style: str = "financial") -> dict:
    """Create an abstract 800×400 SVG that looks like a finance/data viz."""
    palette = _PALETTES.get(style, _PALETTES["financial"])

    # Seeded RNG so the same keyword always produces the same image
    seed = int(hashlib.md5(keyword.lower().encode()).hexdigest(), 16) % (2 ** 32)
    rng = random.Random(seed)

    W, H = 800, 400

    # Watermark: first 3 words of keyword
    watermark_words = keyword.split()[:3]
    watermark = " ".join(watermark_words).upper()

    # ── Build SVG elements ───────────────────────────────────────────────────
    parts = []

    # Defs: gradient background
    grad_id = "bg_grad"
    parts.append(f"""<defs>
  <linearGradient id="{grad_id}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="{palette['bg_start']}"/>
    <stop offset="100%" stop-color="{palette['bg_end']}"/>
  </linearGradient>
</defs>""")

    # Background rect
    parts.append(f'<rect width="{W}" height="{H}" fill="url(#{grad_id})"/>')

    # Grid lines (horizontal + vertical)
    grid_opacity = "0.15"
    for i in range(1, 8):
        y = int(H * i / 8)
        parts.append(
            f'<line x1="0" y1="{y}" x2="{W}" y2="{y}" '
            f'stroke="{palette["accent1"]}" stroke-width="1" opacity="{grid_opacity}"/>'
        )
    for i in range(1, 12):
        x = int(W * i / 12)
        parts.append(
            f'<line x1="{x}" y1="0" x2="{x}" y2="{H}" '
            f'stroke="{palette["accent1"]}" stroke-width="1" opacity="{grid_opacity}"/>'
        )

    # Diagonal accent lines (3–5)
    n_diag = rng.randint(3, 5)
    for _ in range(n_diag):
        x1 = rng.randint(0, W)
        y1 = rng.randint(0, H)
        x2 = rng.randint(0, W)
        y2 = rng.randint(0, H)
        op = round(rng.uniform(0.05, 0.25), 2)
        parts.append(
            f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
            f'stroke="{palette["accent2"]}" stroke-width="2" opacity="{op}"/>'
        )

    # Bar chart (right third of image, 5–7 bars)
    n_bars = rng.randint(5, 7)
    bar_zone_x = int(W * 0.62)
    bar_zone_w = int(W * 0.30)
    bar_w = max(8, bar_zone_w // (n_bars * 2))
    bar_max_h = int(H * 0.55)
    bar_base_y = int(H * 0.80)
    for i in range(n_bars):
        bx = bar_zone_x + i * (bar_w * 2)
        bh = rng.randint(int(bar_max_h * 0.2), bar_max_h)
        by = bar_base_y - bh
        op = round(rng.uniform(0.4, 0.85), 2)
        color = palette["accent1"] if i % 2 == 0 else palette["accent2"]
        parts.append(
            f'<rect x="{bx}" y="{by}" width="{bar_w}" height="{bh}" '
            f'fill="{color}" opacity="{op}" rx="2"/>'
        )

    # Circle clusters (left/center area, 6–10 circles)
    n_circles = rng.randint(6, 10)
    for _ in range(n_circles):
        cx = rng.randint(30, int(W * 0.55))
        cy = rng.randint(30, H - 30)
        r = rng.randint(4, 28)
        op = round(rng.uniform(0.04, 0.22), 2)
        color = rng.choice([palette["accent1"], palette["accent2"]])
        parts.append(
            f'<circle cx="{cx}" cy="{cy}" r="{r}" '
            f'fill="{color}" opacity="{op}"/>'
        )

    # Subtle watermark text
    parts.append(
        f'<text x="{W // 2}" y="{H - 18}" text-anchor="middle" '
        f'font-family="monospace" font-size="11" fill="{palette["accent1"]}" '
        f'opacity="0.18" letter-spacing="3">{watermark}</text>'
    )

    # Assemble
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
        f'viewBox="0 0 {W} {H}">\n'
        + "\n".join(parts)
        + "\n</svg>"
    )

    return {
        "type": "svg",
        "data": svg,
        "content_type": "image/svg+xml",
        "prompt_used": f"SVG geometric art — keyword={keyword!r} style={style}",
        "cached": False,
    }


# ── Gemini Generator ──────────────────────────────────────────────────────────

async def _generate_gemini(keyword: str, style: str = "financial") -> dict:
    """Call Gemini Imagen API and return base64 image data."""
    color_name = _COLOR_NAMES.get(style, "green")
    prompt = _PROMPT_TEMPLATE.format(keyword=keyword, color=color_name)

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            _GEMINI_ENDPOINT,
            params={"key": config.GEMINI_KEY},
            json={
                "instances": [{"prompt": prompt}],
                "parameters": {"sampleCount": 1},
            },
        )

    if resp.status_code >= 400:
        raise RuntimeError(f"Gemini API {resp.status_code}: {resp.text[:300]}")

    data = resp.json()
    # Response shape: {"predictions": [{"bytesBase64Encoded": "...", "mimeType": "image/jpeg"}]}
    predictions = data.get("predictions", [])
    if not predictions:
        raise RuntimeError(f"Gemini returned no predictions: {data}")

    b64 = predictions[0].get("bytesBase64Encoded") or predictions[0].get("bytesBase64")
    if not b64:
        raise RuntimeError(f"Gemini prediction missing image data: {predictions[0]}")

    return {
        "type": "gemini",
        "data": b64,
        "content_type": "image/jpeg",
        "prompt_used": prompt,
        "cached": False,
    }


# ── Caching helpers ───────────────────────────────────────────────────────────

async def _check_cache(asset_id: str) -> Optional[dict]:
    """Return a cached result dict if the asset already has an image_url in Supabase."""
    try:
        asset = await db.get_by_id("content_assets", asset_id)
        if asset and asset.get("image_url"):
            url: str = asset["image_url"]
            # Decide type from URL extension
            if url.endswith(".svg"):
                content_type = "image/svg+xml"
                img_type = "svg"
            else:
                content_type = "image/jpeg"
                img_type = "gemini"
            return {
                "type": img_type,
                "data": url,          # URL rather than raw data
                "content_type": content_type,
                "prompt_used": "cached",
                "cached": True,
            }
    except Exception as exc:
        logger.warning(f"Cache check failed for asset {asset_id}: {exc}")
    return None


async def _try_save_to_supabase(asset_id: Optional[str], result: dict) -> None:
    """
    Best-effort: if we have an asset_id, record the image_url on the content_asset row.
    For SVG we store a data-URI so the URL is self-contained.
    For Gemini images we would upload to Storage; for now we just skip (no bucket assumed).
    """
    if not asset_id:
        return
    try:
        if result["type"] == "svg":
            import base64 as _b64
            encoded = _b64.b64encode(result["data"].encode()).decode()
            data_uri = f"data:image/svg+xml;base64,{encoded}"
            await db.update("content_assets", asset_id, {"image_url": data_uri})
            logger.info(f"SVG data-URI saved to content_assets.image_url for asset {asset_id}")
        # Gemini: skip Supabase Storage upload (no bucket configured);
        # caller receives raw base64 directly.
    except Exception as exc:
        logger.warning(f"Could not save image to Supabase for asset {asset_id}: {exc}")
