"""
CEREBRO — Persona Content Adapter Skill
When an article is approved, generates platform-specific content for each
persona linked to the same site_id.

Generates per platform:
  instagram   → carousel (7 slides JSON) + reel script (60s)
  tiktok      → video script (30-60s) with 3s hook
  x           → thread (5-7 tweets)
  reddit      → draft response — ALWAYS status='draft', NEVER auto-publish
  linkedin    → professional post
  whatsapp    → short message with link

All queue items: status='draft', audio_url=null, video_url=null.
audio_url / video_url populated later by Chatterbox / HeyGen integration.
"""
import json
from packages.core import db, get_logger
from packages.ai import complete
from packages.skills import Skill

logger = get_logger("skill.persona_content_adapter")

# Anti-detection constants (enforced at queue level, not here)
ANTI_BAN = {
    "max_posts_per_day": 3,
    "min_minutes_between_posts": 30,
    "reddit_always_draft": True,
    "no_duplicate_text_across_platforms": True,
    "value_to_promo_ratio": "90/10",
}

_JOBS = [
    # (job_key, platform, content_type)
    ("instagram_carousel", "instagram", "carousel"),
    ("instagram_reel",     "instagram", "reel"),
    ("tiktok_video",       "tiktok",    "video_script"),
    ("x_thread",           "x",         "thread"),
    ("reddit_draft",       "reddit",    "comment"),
    ("linkedin_post",      "linkedin",  "post"),
    ("whatsapp_message",   "whatsapp",  "whatsapp_message"),
]

_SYSTEMS = {
    "instagram_carousel": (
        "Eres {name}, {role} con tono {tone}. "
        "Creas carousels de Instagram que educan. Regla 90/10: 90% valor puro, "
        "máximo 1 mención suave al final. NUNCA el mismo texto en 2 plataformas."
    ),
    "instagram_reel": (
        "Eres {name}. Creas scripts de Reels de 60 segundos. "
        "Hook en los primeros 3 segundos. Ritmo rápido. Lenguaje hablado natural."
    ),
    "tiktok_video": (
        "Eres {name}. Creas videos de TikTok de 30-60 segundos. "
        "HOOK EN LOS PRIMEROS 3 SEGUNDOS o nadie lo ve. Lenguaje coloquial colombiano."
    ),
    "x_thread": (
        "Eres {name}, {role}. Creas threads de X/Twitter con datos y opinión directa. "
        "Cada tweet max 280 chars. Primer tweet es el hook. Tono {tone}."
    ),
    "reddit_draft": (
        "Eres {name}. Redactas respuestas genuinas para Reddit. "
        "NUNCA incluir links en el primer post. NUNCA promo directa. "
        "Respuesta aporta valor real. SIEMPRE requiere aprobación humana."
    ),
    "linkedin_post": (
        "Eres {name}, {role}. Creas posts de LinkedIn profesionales. "
        "Tono más formal. Perspectiva de experto. Max 3 hashtags."
    ),
    "whatsapp_message": (
        "Eres {name}. Creas mensajes cortos para compartir en grupos de WhatsApp. "
        "Directo, sin spam, con link. Como si lo enviara un amigo."
    ),
}

_USERS = {
    "instagram_carousel": (
        'Artículo: {title}\nKeyword: {keyword}\n\n'
        'Crea carousel de Instagram de EXACTAMENTE 7 slides. JSON:\n'
        '{{"slides":[{{"slide":1,"headline":"Hook fuerte (max 8 palabras)","body":"1-2 líneas","image_prompt":"descripción visual para IA"}},...7 slides...],'
        '"caption":"Caption con hashtags (max 150 chars)","hashtags":["#finanzas","...5 más"]}}'
    ),
    "instagram_reel": (
        'Artículo: {title}. Keyword: {keyword}.\n'
        'Script de Reel 60 segundos. JSON:\n'
        '{{"hook":"Primeros 3s","script":"Script completo con [PAUSA] [ÉNFASIS]",'
        '"cta":"CTA final 5s","total_seconds":60,"image_prompt":"thumbnail ideal"}}'
    ),
    "tiktok_video": (
        'Artículo: {title}. Keyword: {keyword}.\n'
        'Script TikTok 30-60s. JSON:\n'
        '{{"hook":"EXACTAMENTE primeros 3s (1 frase)","script":"Script con marcas [0:05]",'
        '"cta":"CTA final","total_seconds":45,"image_prompt":"primer frame"}}'
    ),
    "x_thread": (
        'Artículo: {title}. Keyword: {keyword}.\n'
        'Thread 5-7 tweets. JSON:\n'
        '{{"tweets":[{{"n":1,"text":"Hook con dato (max 280 chars)"}},...,{{"n":7,"text":"CTA suave + link"}}]}}'
    ),
    "reddit_draft": (
        'Artículo: {title}. Keyword: {keyword}.\n'
        'Borrador Reddit. JSON:\n'
        '{{"suggested_subreddits":["r/Colombia","...2 más"],'
        '"response_text":"Respuesta sin links ni promo, solo valor",'
        '"notes":"Tipo de thread a buscar"}}'
    ),
    "linkedin_post": (
        'Artículo: {title}. Keyword: {keyword}.\n'
        'Post LinkedIn. JSON:\n'
        '{{"text":"Post 200-400 palabras","hashtags":["#finanzas","#colombia"],"cta":"CTA final"}}'
    ),
    "whatsapp_message": (
        'Artículo: {title}. URL: {article_url}.\n'
        'Mensaje WhatsApp. JSON:\n'
        '{{"message":"Mensaje corto max 3 líneas con hook + link. Tono amigable."}}'
    ),
}


async def adapt_article_to_platforms(
    asset_id: str,
    title: str,
    keyword: str,
    slug: str,
    site_id: str,
    base_url: str = "https://dolarafuera.co",
) -> list[dict]:
    """Generate social queue items for all active personas on this site."""
    personas = await db.query("personas", params={
        "select": "*",
        "site_id": f"eq.{site_id}",
        "status": "eq.active",
    })
    if not personas:
        logger.info(f"No active personas for site {site_id} — skipping adaptation")
        return []

    article_url = f"{base_url}/articulo/{slug}"
    created: list[dict] = []

    for persona in personas:
        name = persona["name"]
        traits = persona.get("personality_traits") or {}
        tone = traits.get("tone", "cercano y práctico")
        role = traits.get("role", "especialista en finanzas LATAM")
        persona_platforms = set((persona.get("platforms") or {}).keys())

        logger.info(f"Adapting '{title[:40]}' for {name}")

        for job_key, platform, content_type in _JOBS:
            # Skip platforms this persona isn't configured for
            # (always generate for instagram/tiktok/x as core platforms)
            if platform not in {"instagram", "tiktok", "x"} and platform not in persona_platforms:
                continue

            system = _SYSTEMS[job_key].format(name=name, role=role, tone=tone)
            user = _USERS[job_key].format(
                name=name, title=title, keyword=keyword,
                article_url=article_url,
            )

            try:
                result = await complete(
                    prompt=user,
                    system=system,
                    model="haiku",
                    max_tokens=1500,
                    json_mode=True,
                    pipeline_step="content_adaptation",
                    run_id=f"adapt_{asset_id[:8]}_{platform}",
                )
                content = result.get("parsed") or {}
                content_text = json.dumps(content, ensure_ascii=False)

                # Extract image_prompt if present at top level or in first slide
                image_prompt: str | None = content.get("image_prompt")
                if not image_prompt and isinstance(content.get("slides"), list) and content["slides"]:
                    image_prompt = content["slides"][0].get("image_prompt")

                item = await db.insert("social_content_queue", {
                    "content_asset_id": asset_id,
                    "persona_id": persona["id"],
                    "platform": platform,
                    "content_type": content_type,
                    "content_text": content_text,
                    "image_prompt": image_prompt,
                    "audio_url": None,   # populated later by Chatterbox
                    "video_url": None,   # populated later by HeyGen
                    "status": "draft",   # always draft — human approves before publish
                })
                if item:
                    created.append(item)
                    logger.info(f"  ✓ {platform}/{content_type}")
            except Exception as e:
                logger.error(f"  ✗ {platform} for {name}: {e}")

    return created


class PersonaContentAdapterSkill(Skill):
    name = "persona_content_adapter"
    description = "Adapts approved articles into social content for each active persona"
    channel = "social"

    async def execute(self, params: dict) -> dict:
        items = await adapt_article_to_platforms(
            asset_id=params["asset_id"],
            title=params["title"],
            keyword=params["keyword"],
            slug=params["slug"],
            site_id=params["site_id"],
            base_url=params.get("base_url", "https://dolarafuera.co"),
        )
        return {"created": len(items), "items": items}
