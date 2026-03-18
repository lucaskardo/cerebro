"""
CEREBRO v7 — SEO Rules Module
Modular, versioned. When Google updates algorithm, only this file changes.
"""

VERSION = "v2026.03"


def generate_article_schema(title: str, description: str, url: str,
                            author: str = "",
                            author_job_title: str = "",
                            publisher_name: str = "",
                            date_published: str = "", date_modified: str = "",
                            image_url: str = None) -> dict:
    schema = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": title[:110],
        "description": description[:160],
        "author": {
            "@type": "Person",
            "name": author,
        },
        "datePublished": date_published,
        "dateModified": date_modified or date_published,
        "mainEntityOfPage": {"@type": "WebPage", "@id": url},
        "publisher": {"@type": "Organization", "name": publisher_name},
    }
    if author_job_title:
        schema["author"]["jobTitle"] = author_job_title
    if image_url:
        schema["image"] = image_url
    return schema


def generate_faq_schema(faqs: list) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": f["question"],
                "acceptedAnswer": {"@type": "Answer", "text": f["answer"]},
            }
            for f in faqs if f.get("question") and f.get("answer")
        ],
    }


def generate_breadcrumb_schema(items: list) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": item["name"], "item": item["url"]}
            for i, item in enumerate(items)
        ],
    }


def generate_meta_tags(title: str, description: str, url: str,
                       brand_name: str = "",
                       image_url: str = None) -> dict:
    title_tag = f"{title} | {brand_name}" if brand_name else title
    return {
        "title": title_tag,
        "description": description[:160],
        "canonical": url,
        "og:title": title[:60],
        "og:description": description[:160],
        "og:url": url,
        "og:type": "article",
        "og:image": image_url or "",
        "twitter:card": "summary_large_image",
        "robots": "index, follow",
    }


def validate_seo(content: dict) -> dict:
    """Validate content against current SEO rules."""
    body = content.get("body_md", "")
    title = content.get("title", "")
    meta = content.get("meta_description", "")
    
    # Get paragraphs (skip headings)
    paragraphs = [p.strip() for p in body.split("\n\n") if p.strip() and not p.startswith("#")]
    first_para_words = len(paragraphs[0].split()) if paragraphs else 0
    
    checks = {
        "title_length": 30 <= len(title) <= 70,
        "meta_length": 100 <= len(meta) <= 165,
        "first_para_aeo": first_para_words <= 60,  # For AI Overviews
        "has_h2": body.count("## ") >= 3,
        "h2_not_excessive": body.count("## ") <= 15,
        "word_count_min": len(body.split()) >= 800,
        "has_faq": bool(content.get("faq_section")),
    }
    
    score = round(sum(1 for v in checks.values() if v) / len(checks) * 100, 1)
    return {"version": VERSION, "score": score, "passed": score >= 60, "checks": checks}


ROBOTS_TXT = """User-agent: *
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

Sitemap: https://{domain}/sitemap.xml
"""
