"""Lead intent scoring — always computed server-side, never trusted from client."""


def calculate_intent_score(lead_data: dict) -> int:
    """Score 0-100 based on real behavioral signals."""
    score = 0

    # Source signals (where they came from)
    cta = (lead_data.get("cta_variant") or "").lower()
    if "quiz" in cta:         score += 30  # Completed quiz = high intent
    elif "contact" in cta:    score += 25  # Contacted directly = high intent
    elif "mejores" in cta:    score += 20  # Was on "best mattresses" page = comparison shopping
    elif "article" in cta:    score += 10  # Reading article = early research
    elif "newsletter" in cta: score += 5   # Newsletter = lowest intent

    # Quiz response signals (if they took the quiz)
    quiz = lead_data.get("quiz_responses") or {}
    if quiz:
        score += 10  # Taking quiz at all = engaged
        budget = str(quiz.get("¿Cuál es tu presupuesto?", ""))
        if "1000" in budget or "600" in budget:
            score += 10  # Higher budget = more serious
        pain = str(quiz.get("¿Sientes dolor de espalda al despertar?", ""))
        if "frecuentemente" in pain.lower():
            score += 10  # Pain = urgent need
        elif "veces" in pain.lower():
            score += 5

    # Commitment signals
    if lead_data.get("telefono"): score += 10  # Phone = more committed
    if lead_data.get("nombre"):   score += 5   # Name = more committed

    # UTM signals
    utm_source = (lead_data.get("utm_source") or "").lower()
    if "google" in utm_source:                       score += 5  # Search intent
    if "ad" in utm_source or "paid" in utm_source:   score += 5  # Clicked an ad

    return min(score, 100)
