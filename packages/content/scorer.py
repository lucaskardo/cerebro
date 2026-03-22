"""
CEREBRO — Content Quality Scorer
5-dimension scoring using Haiku (cheap + fast).
Called after humanize step in the content pipeline.
"""
import json
from packages.ai import complete
from packages.core import get_logger

logger = get_logger("content.scorer")

SCORE_PROMPT = """Note: You are evaluating 3 representative samples from the article (beginning, middle, end), not the full text. The [...MIDDLE SECTION...] and [...END SECTION...] markers indicate sample boundaries — they are NOT missing content or gaps in the article. Score based on the quality of what you see.

Score this article on 5 dimensions (0-100 each). Be strict — 70 is good, 90 is exceptional.

CONTEXT: This article is for {site_context}
KEYWORD: {keyword}
TITLE: {title}
ARTICLE:
{body_preview}

Score each dimension:
1. HUMANITY (0-100): Does it read like a real person wrote it? Natural patterns, personal touches, humor, opinions, varied sentences. NOT like AI-generated content.
2. SPECIFICITY (0-100): Concrete data, real examples, actual numbers, local references, named brands, specific comparisons. NOT vague generalities.
3. STRUCTURE (0-100): Proper H2/H3 hierarchy, scannable sections, FAQ block, comparison tables if relevant, logical progression. NOT wall of text.
4. SEO (0-100): Keyword in title/H1/first paragraph, keyword variations in H2s, meta description potential, internal linking opportunities, content length adequate. NOT keyword stuffed.
5. READABILITY (0-100): Appropriate vocabulary for audience, short paragraphs (3-4 sentences), varied sentence length, clear explanations of technical terms. NOT academic or robotic.

Respond ONLY in JSON:
{{"humanity":N,"specificity":N,"structure":N,"seo":N,"readability":N,"total":N,"feedback":"2-3 sentences on what to improve"}}

total = round(humanity*0.25 + specificity*0.25 + structure*0.2 + seo*0.2 + readability*0.1)"""


async def score_content(
    title: str,
    body_md: str,
    keyword: str,
    site_context: str,
    run_id: str = "scorer",
) -> dict:
    """Score article on 5 dimensions using Haiku.
    Evaluates 3 samples (beginning, middle, end) for full coverage.
    """
    try:
        # Build 3 samples: beginning, middle, end (~1500 chars each)
        total_len = len(body_md)
        if total_len <= 4500:
            # Short article: score all of it
            body_preview = body_md
        else:
            chunk = 1500
            beginning = body_md[:chunk]
            mid_start = (total_len // 2) - (chunk // 2)
            middle = body_md[mid_start:mid_start + chunk]
            end = body_md[-chunk:]
            body_preview = (
                beginning
                + "\n\n[...MIDDLE SECTION...]\n\n"
                + middle
                + "\n\n[...END SECTION...]\n\n"
                + end
            )

        result = await complete(
            prompt=SCORE_PROMPT.format(
                site_context=site_context or "a content website",
                keyword=keyword,
                title=title,
                body_preview=body_preview,
            ),
            system="You are a strict content quality evaluator. Return only valid JSON.",
            model="haiku",
            json_mode=True,
            pipeline_step="score",
            run_id=run_id,
        )
        scores = result.get("parsed") or {}
        for key in ("humanity", "specificity", "structure", "seo", "readability", "total"):
            val = scores.get(key, 0)
            try:
                scores[key] = max(0, min(100, int(val)))
            except (TypeError, ValueError):
                scores[key] = 0
        if not scores.get("total"):
            scores["total"] = round(
                scores["humanity"] * 0.25
                + scores["specificity"] * 0.25
                + scores["structure"] * 0.2
                + scores["seo"] * 0.2
                + scores["readability"] * 0.1
            )
        scores.setdefault("feedback", "")
        return scores
    except Exception as e:
        logger.error(f"[{run_id}] Scoring failed: {e}")
        return {"humanity": 0, "specificity": 0, "structure": 0, "seo": 0, "readability": 0, "total": 0, "feedback": "Scoring failed"}
