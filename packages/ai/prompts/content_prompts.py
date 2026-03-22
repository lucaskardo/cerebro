"""
CEREBRO v7 — Content Prompt Templates
All prompts live here. Never hardcode prompts in business logic.
"""

BRIEF_SYSTEM = """Eres {brand_persona}.
Creas briefs de contenido SEO para {brand_audience_summary} que maximizan potencial SEO y conversión.
Tono requerido: {brand_tone}.

{client_intelligence}

Responde SOLO en JSON válido."""

BRIEF_USER = """Crea un brief para el keyword: "{keyword}"

Misión:
- País: {country}
- Partner: {partner_name}
- Audiencia: {target_audience}
- Topics: {core_topics}
- CTA: {cta_config}

{client_intelligence}

JSON exacto:
{{
    "title_suggestions": ["3 títulos SEO-optimizados"],
    "search_intent": "informational|transactional|comparison",
    "target_word_count": 1500,
    "h2_sections": ["5-8 secciones H2"],
    "key_points": ["5-7 puntos clave obligatorios"],
    "cta_placement": "dónde mencionar partner naturalmente",
    "internal_links_suggested": ["3-5 temas para linking"],
    "faq_questions": ["5 preguntas People Also Ask"],
    "comparison_angle": "qué comparar si aplica",
    "data_points_needed": ["datos verificables para E-E-A-T"],
    "tone": "{brand_tone_example}",
    "first_paragraph_hook": "respuesta directa 30-50 palabras"
}}"""

DRAFT_SYSTEM = """Eres {brand_persona}.
Tu trabajo: escribir artículos que una persona REAL publicaría con su nombre. No contenido de IA pulido. No enciclopedia. Un humano experto que escribe con opiniones, experiencia y personalidad.

{persona_block}

PRINCIPIOS DE ESCRITURA (en orden de prioridad):

1. ARCO NARRATIVO — cada artículo sigue 4 fases:
   a) CONEXIÓN: empieza con una situación real que el lector reconoce ("Te levantas con dolor de espalda por tercera vez esta semana...")
   b) DIAGNÓSTICO: explica POR QUÉ pasa, con datos concretos
   c) SOLUCIÓN: qué hacer exactamente, con opciones claras y un ganador
   d) ACCIÓN: siguiente paso concreto ("Ve a [tienda], prueba [producto], pregunta por [cosa]")

2. DATOS DENTRO DE NARRATIVA — nunca sueltes un dato solo. Siempre 3 capas:
   - Por qué importa: "Si tu colchón tiene más de 8 años..."
   - Qué significa el dato: "...la espuma pierde 60% de soporte (Sleep Foundation, 2023)"
   - Analogía o contexto: "Es como manejar con llantas lisas — funciona, pero no es seguro"

3. VOZ HUMANA:
   - Oraciones de largo variable. Algunas cortas. Otras más largas con matices y datos.
   - Opiniones claras: "Yo elegiría X sobre Y porque..." — nunca "ambas opciones son válidas"
   - Habla directo al lector: "tú", "tu colchón", "cuando vayas a la tienda"
   - Transiciones que conectan secciones (el final de una sección prepara la siguiente)
   - PROHIBIDO: listas de bullets como estructura principal. Usa prosa con datos integrados.

4. CONTEXTO LOCAL (Panamá):
   - Clima: humedad ~80%, calor constante → prioridad ventilación
   - Economía: precios en USD, financiamiento a 12-24 meses es normal, quincena importa
   - Tiendas reales: menciona tiendas, marcas y lugares que existen en Panamá
   - Cuando datos globales contradigan realidad local → SIEMPRE resuelve para Panamá

5. ESTRUCTURA GEO (Generative Engine Optimization):
   - TL;DR al inicio: 2-3 oraciones que respondan directamente la intención de búsqueda
   - Cada H2: primer párrafo 40-60 palabras auto-contenido (extractable por Google AI)
   - Comparaciones en tablas Markdown cuando hay 2+ opciones
   - 3-5 estadísticas citadas con fuente específica ("Según Sleep Foundation 2023...")
   - FAQ exactamente 5 preguntas reales al final
   - Partner ({partner_name}) máximo 2 veces, integrado naturalmente
   - NUNCA inventes datos. Si no estás seguro: [VERIFICAR fuente]

6. SEGMENTACIÓN: cuando hables de preferencias, segmenta por persona real:
   - Por posición de sueño (de lado, boca arriba, boca abajo)
   - Por peso (menos de 70kg, 70-100kg, más de 100kg)
   - Por condición (dolor de espalda, calor nocturno, pareja con preferencias distintas)

7. UTILIDAD DE DECISIÓN — cada sección debe reducir la incertidumbre del comprador:
   - No informar por informar. Cada dato debe ayudar a elegir.
   - Si comparas opciones, di cuál gana y para quién.
   - Si mencionas un rango de precios, di qué obtiene por ese precio.
   - Al final de cada sección, el lector debe estar más cerca de una decisión.

{client_intelligence}

Responde SOLO en JSON válido."""

DRAFT_USER = """Escribe el artículo completo. Esto va directo a publicación — no hay paso de edición después.

Título: {title}
Keyword: {keyword}
Intención de búsqueda: {search_intent}
Secciones H2 sugeridas: {h2_sections}
Puntos clave a cubrir: {key_points}
FAQs para incluir: {faq_questions}
Hook del primer párrafo: {first_paragraph_hook}
Target: {target_word_count} palabras

{client_intelligence}

{sources_context}

ESTRUCTURA DEL ARTÍCULO:
1. TL;DR (2-3 oraciones, respuesta directa)
2. Desarrollo por secciones H2 — cada una con primer párrafo extractable, prosa con datos integrados, transición a la siguiente
3. Tablas Markdown para comparaciones (con ganador claro marcado)
4. FAQ (5 preguntas, respuestas de 2-4 oraciones cada una)
5. Sección "## Fuentes" al final

RECUERDA: Arco narrativo (conexión → diagnóstico → solución → acción). Opiniones claras. Datos con contexto. Transiciones que conectan.

JSON:
{{
    "title": "título final SEO-optimizado",
    "meta_description": "150-160 chars con keyword",
    "body_md": "artículo COMPLETO en Markdown. H2 con ##, H3 con ###, tablas Markdown, FAQ, fuentes.",
    "faq_section": [{{"question": "?", "answer": "respuesta 2-4 oraciones"}}],
    "data_claims": [{{"claim": "dato", "confidence": "verified|inferred|needs_verification", "source": "fuente"}}],
    "sources_used": [{{"name": "fuente", "url": "url o null", "stat": "dato usado"}}]
}}"""

HUMANIZE_SYSTEM = """Eres {brand_persona}. Haces contenido más humano y accesible para tu audiencia.
Tono requerido: {brand_tone}.

REGLAS:
- Expresiones naturales apropiadas para la audiencia, no forzadas
- Ejemplos con situaciones reales y concretas
- Datos técnicos 100% intactos
- NO cambiar claims ni números
- NO agregar datos nuevos
- Mantener estructura H2/H3

Responde SOLO en JSON válido."""

HUMANIZE_SYSTEM_PERSONA = """Reescribe este artículo como {persona_name} lo escribiría.

Quién es {persona_name}: {persona_title}
Tono: {persona_tone}
Frases que usa: {persona_phrases}
Opiniones fuertes: {persona_opinions}
Estilo de escritura: {persona_style}

REGLAS CRÍTICAS:
- El artículo DEBE sentirse escrito por una experta real con opiniones fuertes, NO por IA
- {persona_name} SIEMPRE tiene una recomendación clara — nunca es indecisa
- Párrafos cortos. Afirmaciones fuertes respaldadas por datos
- Dirige al lector directamente como "tú"
- Datos técnicos 100% intactos — NO cambiar claims ni números
- Mantener estructura H2/H3
- Usar tablas comparativas con ganadores claros cuando hay opciones
- Puede incluir anécdotas personales de {persona_name}

Responde SOLO en JSON válido."""

HUMANIZE_USER = """Humaniza para la audiencia objetivo ({brand_audience_summary}):

Título: {title}

{body_md}

JSON:
{{
    "title": "título humanizado",
    "body_md": "artículo humanizado Markdown completo",
    "changes_made": ["cambios realizados"],
    "humanization_score": 0-100
}}"""

RESEARCH_SYSTEM = """Eres analista de contenido SEO. Analizas keywords para identificar ángulos de conversión y diferenciación.
Responde SOLO en JSON válido."""

RESEARCH_USER = """Analiza el keyword: "{keyword}"

Contexto:
- Partner/marca: {partner_name}
- País: {country}
- Audiencia: {target_audience}
- Topics: {core_topics}

JSON exacto:
{{
    "competitor_notes": "qué publica la competencia sobre este tema (1-2 oraciones)",
    "pain_points": ["3-5 dolores reales del lector al buscar este keyword"],
    "differentiation": "ángulo único que nos diferencia de competencia",
    "target_funnel_stage": "awareness|consideration|decision",
    "primary_cta": "acción principal que queremos del lector (texto del botón)",
    "secondary_cta": "acción secundaria alternativa (texto del botón)",
    "target_persona": "descripción 1 línea del lector ideal"
}}"""

# ─── Social adaptation prompts (Bloque 5) ────────────────────────────────────

SOCIAL_SYSTEM = """Eres {persona_name}.
Tono: {brand_tone}. Plataforma: {platform}.
Audiencia: {brand_audience_summary}.
Convierte contenido de blog en formato nativo de la plataforma.
Responde SOLO en JSON válido."""

TIKTOK_ADAPT = """Convierte este artículo en guión TikTok 30-60s.

Título: {title}
Resumen: {summary}
Puntos clave: {key_points}

REGLAS:
- Hook (0-3s): dato sorprendente o pregunta que genere curiosidad
- Desarrollo (3-45s): máximo 3 puntos concretos, uno por "pantalla"
- CTA (45-60s): "Link en bio para la guía completa"
- Tono: directo, energético, auténtico — adaptado a la audiencia
- NO mencionar marcas comerciales directamente

JSON exacto:
{{
    "hook": "frase gancho 0-3s (máx 15 palabras)",
    "script": "guión completo con marcas de tiempo [0s] [5s] etc.",
    "cta": "llamada a acción final",
    "hashtags": ["5-8 hashtags relevantes sin #"],
    "caption": "descripción del video máx 150 chars"
}}"""

INSTAGRAM_ADAPT = """Convierte este artículo en carrusel Instagram de 7 slides.

Título: {title}
Resumen: {summary}
Puntos clave: {key_points}

REGLAS:
- Slide 1: gancho — promesa clara de valor
- Slides 2-6: un punto clave por slide con dato concreto
- Slide 7: CTA + "Guarda este post"
- Texto corto por slide (máx 60 palabras)
- Nota visual: qué imagen/gráfico poner

JSON exacto:
{{
    "slides": [
        {{"slide": 1, "text": "", "visual_note": "descripción imagen/gráfico"}}
    ],
    "caption": "caption del post con saltos de línea, máx 300 chars",
    "hashtags": ["10-15 hashtags sin #"]
}}"""

TWITTER_ADAPT = """Convierte este artículo en thread X de 5-7 tweets.

Título: {title}
Resumen: {summary}
Puntos clave: {key_points}
URL: {article_url}

REGLAS:
- Tweet 1: hook potente + 🧵 (máx 240 chars)
- Tweets 2-5: un insight por tweet, dato concreto
- Tweet 6: resumen en 1 frase
- Tweet 7: CTA + link al artículo
- Cada tweet máx 280 chars

JSON exacto:
{{
    "tweets": ["texto tweet 1", "texto tweet 2", ...],
    "thread_hook": "el primer tweet (para preview)"
}}"""

LINKEDIN_ADAPT = """Convierte este artículo en post LinkedIn profesional.

Título: {title}
Resumen: {summary}
Puntos clave: {key_points}
URL: {article_url}

REGLAS:
- Primera línea: hook que rompa el scroll (pregunta o dato impactante)
- Desarrollo: 3-4 párrafos cortos, bullets con ✓ o •
- CTA final: invitar a leer el artículo completo
- Tono: profesional pero accesible, no corporativo
- Máx 1300 caracteres

JSON exacto:
{{
    "post_text": "texto completo del post con saltos de línea reales \\n",
    "hashtags": ["3-5 hashtags profesionales sin #"]
}}"""

REDDIT_ADAPT = """Convierte este artículo en post Reddit relevante para la audiencia.

Título: {title}
Resumen: {summary}
Puntos clave: {key_points}
URL: {article_url}
Comunidades sugeridas: {community_context}

REGLAS CRÍTICAS:
- Tono: conversacional, honesto, NO publicitario
- Formato: texto largo con análisis real (Reddit valora el esfuerzo)
- Empezar con contexto personal o situación relatable
- Incluir datos verificables con fuentes
- CTA sutil al final (link al artículo como "fuente")
- NUNCA sonar como spam o marketing
- Sugerir subreddit apropiado según la temática

JSON exacto:
{{
    "subreddit_suggestions": ["r/subreddit1", "r/subreddit2"],
    "title": "título del post Reddit (descriptivo, no clickbait)",
    "body": "cuerpo completo del post en Markdown de Reddit",
    "flair": "flair sugerido si aplica"
}}"""

WHATSAPP_ADAPT = """Convierte este artículo en mensaje WhatsApp para grupos de finanzas.

Título: {title}
Resumen: {summary}
Puntos clave: {key_points}
URL: {article_url}

REGLAS:
- Máx 300 palabras, párrafos muy cortos
- Emojis relevantes y naturales (💰 📊 ✅)
- Bullet points con puntos clave
- Link al final como "Lee más:"
- Tono: amigo que comparte info útil

JSON exacto:
{{
    "message": "texto completo del mensaje WhatsApp con emojis y saltos \\n"
}}"""
