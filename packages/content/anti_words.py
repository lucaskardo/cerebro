"""
CEREBRO v7 — Anti-AI Words Filter
Removes generic AI phrases that make content sound robotic and unnatural.
Also enforces domain-specific banned phrases with smart replacements.
"""
import re
from typing import Tuple

# 100+ frases AI prohibidas en español
ANTI_WORDS: list[str] = [
    # Frases de relleno y transición
    "sin lugar a dudas",
    "es importante destacar",
    "cabe señalar",
    "no es de extrañar",
    "en este sentido",
    "es fundamental",
    "vale la pena mencionar",
    "en la actualidad",
    "hoy en día más que nunca",
    "es crucial",
    "a lo largo de este artículo",
    "en definitiva",
    "resulta evidente",
    "no cabe duda",
    "en el panorama actual",
    "como es bien sabido",
    "es de vital importancia",
    "adentrarse en",
    "sumergirse en el mundo de",
    "potenciar",
    "una amplia gama de",
    "marca la diferencia",
    "juega un papel fundamental",
    "ha cobrado gran relevancia",
    "guía definitiva",
    "todo lo que necesitas saber",
    # Frases de apertura genéricas
    "en el mundo actual",
    "en el entorno actual",
    "en los tiempos actuales",
    "en el contexto actual",
    "en el escenario actual",
    "en el ecosistema actual",
    "en el siglo xxi",
    "en la era digital",
    "en tiempos modernos",
    "en el mundo moderno",
    # Frases de cierre vacías
    "en resumen",
    "en conclusión",
    "para concluir",
    "a modo de conclusión",
    "como hemos visto",
    "como pudimos observar",
    "a lo largo de este texto",
    "a lo largo del artículo",
    "en este artículo hemos explorado",
    # Exageraciones y superlativos vacíos
    "es absolutamente esencial",
    "de suma importancia",
    "de máxima relevancia",
    "de enorme importancia",
    "increíblemente importante",
    "extremadamente relevante",
    "altamente significativo",
    "verdaderamente importante",
    "realmente crucial",
    "genuinamente transformador",
    # Frases de transición robóticas
    "dicho esto",
    "con esto en mente",
    "teniendo en cuenta lo anterior",
    "a la luz de lo expuesto",
    "considerando todo lo anterior",
    "habiendo dicho todo esto",
    "en este orden de ideas",
    "en virtud de lo anterior",
    "dado lo anterior",
    "por consiguiente",
    # Clickbait y promesas vacías
    "aprende todo sobre",
    "descubre todo lo que",
    "lo que debes saber sobre",
    "lo que nadie te cuenta sobre",
    "los secretos de",
    "la verdad sobre",
    "lo que necesitas saber sobre",
    "todo lo que siempre quisiste saber",
    "la guía completa de",
    "el artículo definitivo sobre",
    # Frases de relleno estructural
    "es importante tener en cuenta",
    "es necesario mencionar",
    "no podemos dejar de mencionar",
    "merece especial atención",
    "vale la pena resaltar",
    "es preciso señalar",
    "cabe destacar que",
    "cabe mencionar que",
    "es relevante señalar",
    "es pertinente mencionar",
    # Frases corporativas vacías
    "soluciones integrales",
    "de manera holística",
    "de forma integral",
    "a nivel global",
    "a nivel mundial",
    "en todos los sentidos",
    "en múltiples dimensiones",
    "desde una perspectiva amplia",
    "de manera transversal",
    "en el largo plazo",
    # Más frases AI comunes
    "navegando por",
    "explorando el fascinante mundo",
    "en el apasionante mundo de",
    "sumergirnos en",
    "adentrémonos en",
    "acompáñanos en este recorrido",
    "en este viaje por",
    "hablemos sobre",
    "hoy vamos a explorar",
    "en esta guía te explicamos",
    "a continuación te presentamos",
    "a continuación exploraremos",
    "no podemos ignorar",
    "no hay que olvidar que",
    "debemos tener presente",
    # Clickbait específico detectado en output
    "te lo digo claro",
    "la verdad que nadie te cuenta",
    "la verdad que nadie",
    "esto te va a sorprender",
    "no vas a creer",
    "te cuento algo",
    "y aquí viene lo importante",
    "spoiler",
]

# Phrases that need smart replacement (not just deletion)
# Key = phrase to find (case-insensitive), Value = replacement string
BANNED_REPLACEMENTS: dict[str, str] = {
    "dormidores": "personas que duermen de lado",
    "dolor matutino": "dolor al levantarte",
    "superficie de descanso": "colchón",
    "experiencias de sueño": "cómo duermes",
    "experiencia de sueño": "cómo duermes",
    "firmeza óptima": "firmeza adecuada",
    "confort térmico": "temperatura al dormir",
    "el secreto de": "",
    "los secretos de": "",
    "descubre cómo": "mira cómo",
    "descubre qué": "mira qué",
    "descubre los": "conoce los",
    "descubre las": "conoce las",
    "descubre el": "conoce el",
    "descubre la": "conoce la",
}

# Compile pattern once for performance
_PATTERN = re.compile(
    r'\b(' + '|'.join(re.escape(p) for p in ANTI_WORDS) + r')\b',
    flags=re.IGNORECASE,
)

# Compile replacements pattern (longest first to avoid partial matches)
_SORTED_REPLACEMENTS = sorted(BANNED_REPLACEMENTS.keys(), key=len, reverse=True)
_REPLACEMENTS_PATTERN = re.compile(
    r'\b(' + '|'.join(re.escape(p) for p in _SORTED_REPLACEMENTS) + r')\b',
    flags=re.IGNORECASE,
)


def clean_anti_words(text: str) -> Tuple[str, list[str]]:
    """
    Remove AI-sounding filler phrases and enforce banned phrase replacements.

    Returns:
        (cleaned_text, list_of_removed_or_replaced_phrases)
    """
    removed = []

    # Step 1: Apply smart replacements first
    def _smart_replace(match: re.Match) -> str:
        phrase = match.group(0)
        key = phrase.lower()
        replacement = BANNED_REPLACEMENTS.get(key, "")
        # Try case-insensitive lookup
        if replacement == "" and key not in BANNED_REPLACEMENTS:
            for k, v in BANNED_REPLACEMENTS.items():
                if k.lower() == key:
                    replacement = v
                    break
        removed.append(f"{phrase.lower()} → {replacement or '(removed)'}")
        return replacement

    text = _REPLACEMENTS_PATTERN.sub(_smart_replace, text)

    # Step 2: Remove anti-words
    def _remove(match: re.Match) -> str:
        phrase = match.group(0)
        removed.append(phrase.lower())
        return ""

    cleaned = _PATTERN.sub(_remove, text)
    # Clean up double spaces and leading commas left by removal
    cleaned = re.sub(r'\s{2,}', ' ', cleaned)
    cleaned = re.sub(r',\s*,', ',', cleaned)
    cleaned = re.sub(r'\.\s*,', '.', cleaned)
    cleaned = cleaned.strip()

    return cleaned, removed


def count_anti_words(text: str) -> int:
    """Return count of anti-word matches in text."""
    return len(_PATTERN.findall(text))
