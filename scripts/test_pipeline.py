"""
CEREBRO v7 — Pipeline Test Script
Tests DB connection, AI connection, and runs a mini pipeline.
Usage: python3 scripts/test_pipeline.py
"""
import asyncio
import sys
import os
from pathlib import Path

# Add project root to path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from packages.core import db, cost_tracker, config, get_logger

logger = get_logger("test")


async def test_config():
    print("\n=== 1. Config ===")
    print(f"  SUPABASE_URL: {'✓ set' if config.SUPABASE_URL else '✗ MISSING'}")
    print(f"  ANTHROPIC_KEY: {'✓ set' if config.ANTHROPIC_KEY else '✗ MISSING'}")
    print(f"  DAILY_BUDGET: ${config.DAILY_BUDGET}")
    print(f"  PRIMARY_DOMAIN: {config.PRIMARY_DOMAIN}")

    missing = []
    if not config.SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not config.SUPABASE_KEY:
        missing.append("SUPABASE_SERVICE_KEY")
    if not config.ANTHROPIC_KEY:
        missing.append("ANTHROPIC_API_KEY")

    if missing:
        print(f"\n  ✗ Missing env vars: {', '.join(missing)}")
        print("  Check your .env file!")
        return False

    return True


async def test_database():
    print("\n=== 2. Database (Supabase) ===")
    try:
        missions = await db.get("missions")
        print(f"  ✓ Connected — {len(missions)} missions found")

        if missions:
            m = missions[0]
            print(f"  First mission: {m.get('name', 'unnamed')} ({m.get('status', 'unknown')})")
            return missions[0]["id"]
        else:
            print("  No missions found. Creating test mission...")
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
                "daily_budget_usd": 5.0,
            })
            if mission:
                print(f"  ✓ Mission created: {mission['id']}")
                return mission["id"]
            else:
                print("  ✗ Failed to create mission")
                return None
    except Exception as e:
        print(f"  ✗ DB Error: {e}")
        return None


async def test_budget():
    print("\n=== 3. Budget Check ===")
    try:
        budget = await cost_tracker.check_budget()
        print(f"  Spent today: ${budget['spent']:.4f}")
        print(f"  Limit: ${budget['limit']:.2f}")
        print(f"  Remaining: ${budget['remaining']:.4f}")
        print(f"  Blocked: {budget['blocked']}")
        if budget["blocked"]:
            print("  ✗ Budget exceeded! Cannot run pipeline.")
            return False
        print("  ✓ Budget OK")
        return True
    except Exception as e:
        print(f"  ✗ Budget check error: {e}")
        return False


async def test_ai():
    print("\n=== 4. AI (Claude) ===")
    try:
        from packages.ai import complete
        result = await complete(
            prompt='Responde solo: {"status": "ok", "message": "CEREBRO AI funcionando"}',
            system="Responde SOLO JSON válido sin texto adicional.",
            model="haiku",
            json_mode=True,
            pipeline_step="test",
        )
        if result["parsed"] and result["parsed"].get("status") == "ok":
            print(f"  ✓ AI OK — cost: ${result['cost']:.4f} ({result['tokens_in']}+{result['tokens_out']} tokens)")
            return True
        else:
            print(f"  ✗ AI returned unexpected: {result['text'][:100]}")
            return False
    except Exception as e:
        print(f"  ✗ AI Error: {e}")
        return False


async def test_mini_pipeline(mission_id: str):
    print("\n=== 5. Mini Pipeline Test ===")
    keyword = "cuenta en dolares colombia"
    print(f"  Keyword: '{keyword}'")
    print(f"  Mission ID: {mission_id}")

    try:
        from packages.content.pipeline import run_pipeline
        print("  Running pipeline (brief → draft → humanize → validate)...")
        result = await run_pipeline(keyword, mission_id)

        if result:
            print(f"\n  ✓ Pipeline PASSED!")
            print(f"  Title: {result.get('title', 'N/A')}")
            print(f"  Status: {result.get('status', 'N/A')}")
            print(f"  Quality score: {result.get('quality_score', 0)}%")
            print(f"  Word count: ~{len(result.get('body_md', '').split())} words")
            if result.get("validation_results"):
                issues = result["validation_results"].get("issues", [])
                if issues:
                    print(f"  Issues: {issues}")
            return True
        else:
            print("  ✗ Pipeline returned no result")
            return False
    except Exception as e:
        print(f"  ✗ Pipeline Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    print("=" * 50)
    print("CEREBRO v7 — Pipeline Test")
    print("=" * 50)

    # 1. Config
    if not await test_config():
        sys.exit(1)

    # 2. Database
    mission_id = await test_database()
    if not mission_id:
        print("\n✗ Cannot continue without DB connection")
        sys.exit(1)

    # 3. Budget
    if not await test_budget():
        sys.exit(1)

    # 4. AI
    if not await test_ai():
        sys.exit(1)

    # 5. Full pipeline
    pipeline_ok = await test_mini_pipeline(mission_id)

    print("\n" + "=" * 50)
    if pipeline_ok:
        print("✓ ALL TESTS PASSED — Pipeline is working!")
        print(f"\nMission ID (save this): {mission_id}")
    else:
        print("✗ PIPELINE TEST FAILED — check errors above")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
