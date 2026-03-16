#!/usr/bin/env python3
"""
CEREBRO v7 — Pipeline Test
Validates the full content pipeline works end-to-end.
Run: python scripts/test_pipeline.py
"""
import asyncio
import os
import sys
import json
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")


async def main():
    print("🧠 CEREBRO v7 — Pipeline Test")
    print("=" * 50)
    
    # Check env
    required = ["SUPABASE_URL", "SUPABASE_SERVICE_KEY", "ANTHROPIC_API_KEY"]
    missing = [k for k in required if not os.getenv(k)]
    if missing:
        print(f"❌ Missing env vars: {', '.join(missing)}")
        print("   Edit .env first.")
        return
    
    from packages.core import db, cost_tracker
    
    # Test 1: Database connection
    print("\n[1/5] Testing database connection...")
    missions = await db.get("missions", status="eq.active")
    if not missions:
        print("  ❌ No active missions found. Did you run schema.sql?")
        return
    
    mission = missions[0]
    print(f"  ✅ Connected. Mission: {mission['name']} ({mission['id'][:8]}...)")
    
    # Test 2: Budget check
    print("\n[2/5] Testing budget tracker...")
    budget = await cost_tracker.check_budget()
    print(f"  ✅ Budget: ${budget['spent']:.2f} / ${budget['limit']:.2f} ({budget['percent']}%)")
    if budget["blocked"]:
        print("  ❌ Budget exceeded! Cannot run pipeline.")
        return
    
    # Test 3: LLM connection
    print("\n[3/5] Testing LLM connection (Haiku)...")
    from packages.ai import complete
    
    try:
        result = await complete(
            prompt="Respond with exactly: {\"status\": \"ok\"}",
            system="You are a test bot. Respond only with the JSON requested.",
            model="haiku",
            max_tokens=50,
            json_mode=True,
            pipeline_step="test",
        )
        if result["parsed"] and result["parsed"].get("status") == "ok":
            print(f"  ✅ Haiku working. Cost: ${result['cost']:.4f}")
        else:
            print(f"  ⚠️  Haiku responded but JSON parse issue: {result['text'][:100]}")
    except Exception as e:
        print(f"  ❌ LLM error: {e}")
        return
    
    # Test 4: Brief generation
    print("\n[4/5] Testing brief generation...")
    keyword = "como abrir cuenta en dolares desde colombia"
    
    from packages.content.pipeline import _generate_brief
    try:
        brief = await _generate_brief(keyword, mission, "test")
        titles = brief.get("title_suggestions", [])
        print(f"  ✅ Brief generated. Titles: {titles[:2]}")
        print(f"     Sections: {len(brief.get('h2_sections', []))} H2s")
        print(f"     FAQs: {len(brief.get('faq_questions', []))}")
    except Exception as e:
        print(f"  ❌ Brief error: {e}")
        return
    
    # Test 5: Full pipeline (optional)
    print("\n[5/5] Full pipeline test...")
    print("  This will generate a complete article (~$0.05-0.15 LLM cost)")
    
    # Auto-run in CI, ask in interactive
    if sys.stdin.isatty():
        answer = input("  Run full pipeline? (y/N): ").strip().lower()
        if answer != "y":
            print("  Skipped. Run manually:")
            print(f'  curl -X POST http://localhost:8000/api/content/generate -H "Content-Type: application/json" -d \'{{"mission_id": "{mission["id"]}", "keyword": "{keyword}"}}\'')
            print("\n✅ Basic tests passed!")
            return
    
    from packages.content.pipeline import run_pipeline
    try:
        asset = await run_pipeline(keyword, mission["id"])
        print(f"  ✅ Article generated!")
        print(f"     Title: {asset['title']}")
        print(f"     Status: {asset['status']}")
        print(f"     Quality: {asset['quality_score']}")
        print(f"     Words: {len(asset.get('body_md', '').split())}")
    except Exception as e:
        print(f"  ❌ Pipeline error: {e}")
        return
    
    # Final budget
    budget = await cost_tracker.check_budget()
    print(f"\n💰 Total cost: ${budget['spent']:.4f}")
    print("\n✅ All tests passed!")


if __name__ == "__main__":
    asyncio.run(main())
