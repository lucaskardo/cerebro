"""
CEREBRO v7 — Sprint 1 Content Generation
Generates 5 articles for Dólar Afuera — finanzas internacionales para colombianos.
Usage: python3 scripts/generate_sprint1.py
"""
import asyncio
import sys
import os
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from packages.core import db, cost_tracker, config, get_logger

logger = get_logger("sprint1")

# 5 target keywords for finanzas internacionales LATAM
SPRINT1_KEYWORDS = [
    "como abrir cuenta en dolares desde colombia",
    "cuenta bancaria en panama para colombianos",
    "como proteger ahorros de la devaluacion del peso colombiano",
    "remesas internacionales colombia como enviar dinero al exterior",
    "banca offshore colombia requisitos y opciones",
]

# Keywords already generated (skip these)
SKIP_KEYWORDS = [
    "como abrir cuenta en dolares desde colombia",
    "banca offshore colombia requisitos y opciones",
]


async def get_or_create_mission() -> str:
    """Get active mission or create it."""
    missions = await db.get("missions", status="eq.active")
    if missions:
        mission = missions[0]
        print(f"  Using mission: {mission['name']} ({mission['id']})")
        return mission["id"]

    print("  No active mission found. Creating...")
    mission = await db.insert("missions", {
        "name": "Finanzas LATAM",
        "slug": "finanzas-latam",
        "country": "Colombia",
        "language": "es-CO",
        "partner_name": "Dólar Afuera",
        "status": "active",
        "primary_domain": config.PRIMARY_DOMAIN,
        "target_audience": {
            "primary": "Colombianos 25-45 interesados en finanzas internacionales, USD y remesas",
            "pain_points": ["devaluación COP", "altas comisiones en remesas", "acceso banca internacional"],
            "goals": ["proteger ahorros", "abrir cuenta USD", "enviar/recibir remesas fácil"]
        },
        "core_topics": [
            "cuentas en dólares desde Colombia",
            "remesas internacionales",
            "banca offshore para colombianos",
            "protección contra devaluación COP",
            "fintech internacional Colombia"
        ],
        "cta_config": {
            "primary": "Recibe nuestra guía gratis",
            "url": "/suscribirse",
            "placement": "end_of_section_2_and_conclusion"
        },
        "daily_budget_usd": 10.0,
    })
    if not mission:
        raise ValueError("Failed to create mission")
    print(f"  ✓ Mission created: {mission['id']}")
    return mission["id"]


async def generate_article(keyword: str, mission_id: str, index: int, total: int) -> dict:
    """Run pipeline for one keyword."""
    print(f"\n[{index}/{total}] Generating: '{keyword}'")
    print("-" * 50)

    from packages.content.pipeline import run_pipeline
    try:
        result = await run_pipeline(keyword, mission_id)
        if result:
            print(f"  ✓ Done: {result.get('title', keyword)}")
            print(f"    Status: {result.get('status')} | Quality: {result.get('quality_score')}% | Words: ~{len(result.get('body_md','').split())}")
            return {"keyword": keyword, "success": True, "result": result}
        else:
            print(f"  ✗ Pipeline returned nothing")
            return {"keyword": keyword, "success": False, "error": "No result"}
    except Exception as e:
        print(f"  ✗ Error: {type(e).__name__}: {e}")
        return {"keyword": keyword, "success": False, "error": str(e)}


async def main():
    print("=" * 60)
    print("CEREBRO v7 — Sprint 1 Content Generation")
    print("=" * 60)
    print(f"Keywords: {len(SPRINT1_KEYWORDS)}")
    print(f"Domain: {config.PRIMARY_DOMAIN}")

    # Check budget
    budget = await cost_tracker.check_budget()
    print(f"\nBudget: ${budget['spent']:.4f} spent / ${budget['limit']:.2f} limit")
    if budget["blocked"]:
        print("✗ Daily budget exceeded. Cannot generate content.")
        sys.exit(1)

    estimated_cost = len(SPRINT1_KEYWORDS) * 0.08  # ~$0.08 per article estimate
    print(f"Estimated cost: ~${estimated_cost:.2f}")
    print(f"Remaining budget: ${budget['remaining']:.4f}")

    if budget["remaining"] < estimated_cost:
        print(f"✗ Insufficient budget. Need ~${estimated_cost:.2f}, have ${budget['remaining']:.4f}")
        sys.exit(1)

    # Get/create mission
    print("\n--- Mission ---")
    mission_id = await get_or_create_mission()

    # Generate articles (skip already done ones)
    remaining = [k for k in SPRINT1_KEYWORDS if k not in SKIP_KEYWORDS]
    print("\n--- Generating Articles ---")
    if SKIP_KEYWORDS:
        print(f"  Skipping {len(SKIP_KEYWORDS)} already generated: {SKIP_KEYWORDS}")
    results = []
    for i, keyword in enumerate(remaining, 1):
        r = await generate_article(keyword, mission_id, i, len(remaining))
        results.append(r)

        # Check budget after each article
        budget = await cost_tracker.check_budget()
        if budget["blocked"]:
            print(f"\n⚠ Budget limit reached after article {i}. Stopping.")
            break

        # Wait between articles to avoid rate limits (skip after last)
        if i < len(remaining):
            print(f"  Waiting 30s before next article...")
            await asyncio.sleep(30)

    # Summary
    print("\n" + "=" * 60)
    print("SPRINT 1 SUMMARY")
    print("=" * 60)
    success = [r for r in results if r["success"]]
    failed = [r for r in results if not r["success"]]

    print(f"✓ Successful: {len(success)}/{len(results)}")
    for r in success:
        res = r["result"]
        print(f"  - {res.get('title', r['keyword'])[:60]} [{res.get('status')}] {res.get('quality_score')}%")

    if failed:
        print(f"\n✗ Failed: {len(failed)}")
        for r in failed:
            print(f"  - {r['keyword']}: {r['error']}")

    final_budget = await cost_tracker.check_budget()
    session_cost = final_budget["spent"] - budget["spent"] if budget else 0
    print(f"\nTotal spent today: ${final_budget['spent']:.4f}")

    if len(success) >= 5:
        print("\n✓ Sprint 1 goal achieved: 5 articles generated!")
    else:
        print(f"\n⚠ Sprint 1 incomplete: {len(success)}/5 articles. Check errors above.")

    print("\nNext: Review articles at /api/content?status=review")
    print(f"Then build the dashboard: cd apps/web && npm run dev")


if __name__ == "__main__":
    asyncio.run(main())
