"""
CEREBRO — Internal Link Injector
Scans draft body_md and injects 3-5 internal links to existing articles.
"""
import re
from packages.core import get_logger

logger = get_logger("content.linker")


def _normalize(text: str) -> str:
    """Lowercase + strip Spanish accents for fuzzy matching."""
    for a, b in [("á","a"),("é","e"),("í","i"),("ó","o"),("ú","u"),("ü","u"),("ñ","n")]:
        text = text.replace(a, b).replace(a.upper(), b)
    return text.lower()


def inject_internal_links(
    body_md: str,
    articles: list[dict],
    current_keyword: str,
    current_slug: str = "",
    url_prefix: str = "/blog/",
    max_links: int = 5,
) -> str:
    """Scan body_md for keyword mentions and insert markdown internal links.

    Rules:
    - Max 5 links per article
    - Never link to the current article (skip by keyword or slug)
    - Never link the same article twice
    - Only replace the FIRST occurrence of each keyword phrase
    - Skip text already inside a markdown link [...](...) or heading lines ##
    - Prefer longer/more specific keyword matches (sorted desc)
    - Uses fuzzy accent-insensitive matching
    - Preserves original text casing/accents in anchor text

    Args:
        body_md: the article body in Markdown
        articles: list of dicts with keys: keyword, slug, title
        current_keyword: keyword of the article being written (skip self-links)
        current_slug: slug of the article being written (skip self-links)
        url_prefix: path prefix, e.g. "/blog/" or "/articulo/"
        max_links: maximum internal links to inject (default 5)
    """
    if not body_md or not articles:
        return body_md

    current_kw_norm = _normalize(current_keyword)

    # Build candidates sorted by keyword length descending (specific > generic)
    candidates: list[tuple[str, str]] = []  # (keyword, slug)
    for art in articles:
        kw = (art.get("keyword") or "").strip()
        slug = (art.get("slug") or "").strip()
        if not kw or not slug:
            continue
        if slug == current_slug or _normalize(kw) == current_kw_norm:
            continue
        candidates.append((kw, slug))

    # Sort by keyword length desc — match more specific phrases first
    candidates.sort(key=lambda x: len(x[0]), reverse=True)

    def _occupied_ranges(text: str) -> list[tuple[int, int]]:
        """Return ranges already occupied by links or heading lines."""
        occupied = []
        for m in re.finditer(r'\[([^\]]*)\]\([^)]*\)', text):
            occupied.append((m.start(), m.end()))
        for m in re.finditer(r'^#{1,6}\s.*$', text, flags=re.MULTILINE):
            occupied.append((m.start(), m.end()))
        return occupied

    linked_slugs: set[str] = set()
    links_added = 0
    result = body_md

    for kw, slug in candidates:
        if links_added >= max_links:
            break
        if slug in linked_slugs:
            continue

        norm_result = _normalize(result)
        words = kw.split()

        # Try full keyword, then N-1 words (drop trailing word)
        matched = False
        for length in range(len(words), max(1, len(words) - 1) - 1, -1):
            phrase = " ".join(words[:length])
            if len(phrase) < 4:
                continue
            phrase_norm = _normalize(phrase)
            pattern = re.compile(
                r'(?<!\[)(?<!\()(?<!\w)' + re.escape(phrase_norm) + r'(?!\w)(?!\])',
                flags=re.IGNORECASE,
            )
            m = pattern.search(norm_result)
            if not m:
                continue

            # Check position is not inside an existing link or heading
            start, end = m.start(), m.end()
            if any(os <= start < oe or os < end <= oe for os, oe in _occupied_ranges(result)):
                continue

            # Preserve original casing/accents from the source text
            original_text = result[start:end]
            link_md = f"[{original_text}]({url_prefix}{slug})"
            result = result[:start] + link_md + result[end:]
            linked_slugs.add(slug)
            links_added += 1
            matched = True
            break

        if not matched:
            continue

    if links_added:
        logger.debug(f"Internal links injected: {links_added} → {list(linked_slugs)}")

    return result
