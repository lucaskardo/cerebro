"""
CEREBRO v7 — Agent Writer
Single LLM call: intelligence MD → complete article.
"""
from packages.ai import complete
from packages.core import get_logger

logger = get_logger("content.agent_writer")


async def write_article(md: str, model: str = "sonnet") -> dict:
    """
    Takes an intelligence MD and returns a complete article.
    One LLM call. No rules. No post-processing.

    Returns: {"title": str, "body_md": str, "meta_description": str, "faq_section": list}
    """
    prompt = (
        md
        + '\n\nEscribe el artículo completo basándote en este brief. '
        'Responde en JSON con exactamente estas claves: '
        '{"title": "...", "body_md": "...", "meta_description": "...", '
        '"faq_section": [{"question": "...", "answer": "..."}]}'
    )

    result = await complete(
        prompt=prompt,
        system=(
            "Eres un editor de contenido web especializado en el mercado panameño. "
            "Tu trabajo es escribir artículos útiles, honestos y claros usando SOLO "
            "los datos del brief que recibes. "
            "Tono: amigo que sabe mucho, no experto académico. "
            "Responde SOLO en JSON válido."
        ),
        model=model,
        max_tokens=12000,
        json_mode=True,
        temperature=0.7,
        pipeline_step="agent_write",
    )

    parsed = result.get("parsed")
    if parsed and isinstance(parsed, dict) and parsed.get("body_md"):
        return parsed

    # Fallback: body_md from raw text
    logger.warning("agent_writer: parsed JSON missing, using raw text as body_md")
    return {
        "title": "",
        "body_md": result.get("text", ""),
        "meta_description": "",
        "faq_section": [],
    }
