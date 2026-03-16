#!/usr/bin/env python3
"""
CEREBRO v7 — Generate Sprint 1 Articles
Generates the first 5 articles for the ikigii mission.
Run: python scripts/generate_sprint1.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

# Sprint 1 keywords — chosen for high intent + low competition + ikigii relevance
SPRINT1_KEYWORDS = [
    "como abrir cuenta en dolares desde colombia 2026",
    "cuanto dinero pierdes en remesas a colombia",
    "wise vs western union colombia comparativa real",
    "es legal tener cuenta bancaria en panama siendo colombiano",
    "como proteger tus ahorros de la devaluacion del peso colombiano",
]


async def main():
    from packages.core import db, cost_tracker
    from packages.content.pipeline import run_pipeline
    
    print("🧠 CEREBRO v7 — Sprint 1 Article Generation")
    print("=" * 55)
    
    # Get mission
    missions = await db.get("missions", status="eq.active")
    if not missions:
        print("❌ No active mission. Run schema.sql first.")
        return
    
    mission = missions[0]
    print(f"Mission: {mission['name']}")
    
    budget = await cost_tracker.check_budget()
    print(f"Budget: ${budget['remaining']:.2f} remaining\n")
    
    results = []
    
    for i, keyword in enumerate(SPRINT1_KEYWORDS):
        print(f"\n[{i+1}/{len(SPRINT1_KEYWORDS)}] {keyword}")
        print("-" * 50)
        
        # Check budget before each article
        budget = await cost_tracker.check_budget()
        if budget["blocked"]:
            print("❌ Budget exceeded. Stopping.")
            break
        
        if budget["remaining"] < 2.0:
            print(f"⚠️  Low budget (${budget['remaining']:.2f}). Stopping to be safe.")
            break
        
        try:
            asset = await run_pipeline(keyword, mission["id"])
            results.append({
                "keyword": keyword,
                "title": asset.get("title", ""),
                "status": asset.get("status", ""),
                "quality": asset.get("quality_score", 0),
                "words": len(asset.get("body_md", "").split()),
            })
            print(f"  ✅ {asset['title']}")
            print(f"     Status: {asset['status']} | Quality: {asset['quality_score']} | Words: {results[-1]['words']}")
        except Exception as e:
            print(f"  ❌ Error: {e}")
            results.append({"keyword": keyword, "error": str(e)})
    
    # Summary
    print("\n" + "=" * 55)
    print("SUMMARY")
    print("=" * 55)
    
    budget = await cost_tracker.check_budget()
    
    success = [r for r in results if "error" not in r]
    errors = [r for r in results if "error" in r]
    
    print(f"  Generated: {len(success)}/{len(SPRINT1_KEYWORDS)}")
    print(f"  In review: {sum(1 for r in success if r['status'] == 'review')}")
    print(f"  Need work: {sum(1 for r in success if r['status'] == 'draft')}")
    print(f"  Errors: {len(errors)}")
    print(f"  Total cost: ${budget['spent']:.4f}")
    print(f"  Avg quality: {sum(r.get('quality',0) for r in success) / max(len(success),1):.1f}")
    
    if success:
        print(f"\n  Next: Review articles at http://localhost:3000/dashboard/content")
        print(f"  Or via API: curl http://localhost:8000/api/content?status=review")


if __name__ == "__main__":
    asyncio.run(main())
