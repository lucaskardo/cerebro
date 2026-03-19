"""
CEREBRO — Smoke Tests
Fast structural tests using FastAPI TestClient (no real DB/AI calls).
Run: cd /path/to/cerebro && pytest tests/ -v
"""
import os
import sys
from pathlib import Path

# Ensure project root is on PYTHONPATH
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Stub out env vars so imports don't fail in CI
os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ.setdefault("API_SECRET_KEY", "test-secret")
os.environ.setdefault("ENCRYPTION_KEY", "")
os.environ.setdefault("MASTER_KEY", "master-test")

import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient


# ── Helpers ─────────────────────────────────────────────────────────────────

def _make_client():
    """Build a TestClient with DB calls patched out."""
    from apps.api.app.main import app
    return TestClient(app, raise_server_exceptions=False)


# ── Tests ────────────────────────────────────────────────────────────────────

class TestPublicEndpoints:
    """No auth required — these must return 200."""

    def test_health(self):
        with _make_client() as client:
            r = client.get("/health")
            assert r.status_code == 200
            assert r.json()["status"] == "ok"

    def test_api_status(self):
        with patch("packages.core.SupabaseClient.query", new_callable=AsyncMock, return_value=[]):
            with patch("packages.core.CostTracker.check_budget", new_callable=AsyncMock,
                       return_value={"spent": 0, "limit": 30, "remaining": 30,
                                     "percent": 0, "blocked": False, "warning": False}):
                with _make_client() as client:
                    r = client.get("/api/status")
                    assert r.status_code == 200


class TestAuthProtection:
    """Sensitive GETs and all mutations must require X-API-Key."""

    def test_leads_list_requires_auth(self):
        with _make_client() as client:
            r = client.get("/api/leads")
            assert r.status_code == 401, f"Expected 401, got {r.status_code}"

    def test_personas_list_requires_auth(self):
        with _make_client() as client:
            r = client.get("/api/personas")
            assert r.status_code == 401, f"Expected 401, got {r.status_code}"

    def test_goals_list_requires_auth(self):
        with _make_client() as client:
            r = client.get("/api/goals")
            assert r.status_code == 401, f"Expected 401, got {r.status_code}"

    def test_content_generate_without_auth_returns_401(self):
        with _make_client() as client:
            r = client.post("/api/content/generate", json={
                "mission_id": "test", "keyword": "test"
            })
            assert r.status_code == 401

    def test_content_generate_invalid_body_returns_422(self):
        with _make_client() as client:
            r = client.post("/api/content/generate",
                            headers={"x-api-key": "test-secret"},
                            json={})  # missing required fields
            assert r.status_code == 422

    def test_lead_capture_no_body_returns_422(self):
        """Lead capture is public but requires body."""
        with _make_client() as client:
            r = client.post("/api/leads/capture", json={})
            assert r.status_code == 422  # missing required `email`

    def test_loop_run_requires_auth(self):
        with _make_client() as client:
            r = client.post("/api/loop/run", json={"goal_id": "test"})
            assert r.status_code == 401


class TestSchemas:
    """Pydantic models are importable from schemas package."""

    def test_content_schemas_importable(self):
        from apps.api.app.schemas.content import ContentGenerate, ContentApprove
        m = ContentGenerate(mission_id="x", keyword="test")
        assert m.keyword == "test"

    def test_leads_schemas_importable(self):
        from apps.api.app.schemas.leads import LeadCapture, LeadTransition, LeadOutcomeCreate
        m = LeadCapture(email="test@test.com")
        assert m.email == "test@test.com"

    def test_execution_schemas_importable(self):
        from apps.api.app.schemas.execution import (
            OpportunityCreate, ExperimentCreate, TaskCreate, ApprovalResolve
        )
        m = ApprovalResolve(action="approve")
        assert m.action == "approve"

    def test_strategy_schemas_importable(self):
        from apps.api.app.schemas.strategy import GoalCreate
        m = GoalCreate(description="test", target_metric="leads", target_value=100)
        assert m.target_value == 100

    def test_personas_schemas_importable(self):
        from apps.api.app.schemas.personas import PersonaCreate, ScheduleConfigUpsert
        m = PersonaCreate(site_id="x", name="Test")
        assert m.name == "Test"

    def test_loop_schemas_importable(self):
        from apps.api.app.schemas.loop import LoopRunRequest
        m = LoopRunRequest(goal_id="x")
        assert m.dry_run is False


class TestCoreExceptions:
    """SupabaseError and SupabaseTimeout are importable."""

    def test_supabase_exceptions_importable(self):
        from packages.core import SupabaseError, SupabaseTimeout
        e = SupabaseError("test error")
        assert str(e) == "test error"
        assert issubclass(SupabaseError, Exception)
        assert issubclass(SupabaseTimeout, Exception)


class TestIntelligenceV2:
    """Smoke tests for /api/v2/intelligence endpoints."""

    _AUTH = {"X-API-Key": "test-secret"}
    _SITE = "d3920d22-2c34-40b1-9e8e-59142af08e2a"

    def test_entities_requires_auth(self):
        with _make_client() as client:
            r = client.get(f"/api/v2/intelligence/entities/{self._SITE}")
            assert r.status_code == 401

    def test_facts_requires_auth(self):
        with _make_client() as client:
            r = client.get(f"/api/v2/intelligence/facts/{self._SITE}")
            assert r.status_code == 401

    def test_entities_returns_list(self):
        with patch("packages.core.SupabaseClient.query", new_callable=AsyncMock, return_value=[]):
            with _make_client() as client:
                r = client.get(
                    f"/api/v2/intelligence/entities/{self._SITE}",
                    headers=self._AUTH,
                )
                assert r.status_code == 200
                assert isinstance(r.json(), list)

    def test_facts_returns_list(self):
        with patch("packages.core.SupabaseClient.query", new_callable=AsyncMock, return_value=[]):
            with _make_client() as client:
                r = client.get(
                    f"/api/v2/intelligence/facts/{self._SITE}",
                    headers=self._AUTH,
                )
                assert r.status_code == 200
                assert isinstance(r.json(), list)

    def test_completeness_returns_list(self):
        with patch("packages.core.SupabaseClient.rpc", new_callable=AsyncMock, return_value=[]):
            with _make_client() as client:
                r = client.get(
                    f"/api/v2/intelligence/completeness/{self._SITE}",
                    headers=self._AUTH,
                )
                assert r.status_code == 200
                assert isinstance(r.json(), list)

    def test_insights_returns_list(self):
        with patch("packages.core.SupabaseClient.query", new_callable=AsyncMock, return_value=[]):
            with _make_client() as client:
                r = client.get(
                    f"/api/v2/intelligence/insights/{self._SITE}",
                    headers=self._AUTH,
                )
                assert r.status_code == 200
                assert isinstance(r.json(), list)

    def test_discoveries_returns_list(self):
        with patch("packages.core.SupabaseClient.query", new_callable=AsyncMock, return_value=[]):
            with _make_client() as client:
                r = client.get(
                    f"/api/v2/intelligence/discoveries/{self._SITE}",
                    headers=self._AUTH,
                )
                assert r.status_code == 200
                assert isinstance(r.json(), list)

    def test_research_runs_returns_list(self):
        with patch("packages.core.SupabaseClient.query", new_callable=AsyncMock, return_value=[]):
            with _make_client() as client:
                r = client.get(
                    f"/api/v2/intelligence/research/{self._SITE}",
                    headers=self._AUTH,
                )
                assert r.status_code == 200
                assert isinstance(r.json(), list)

    def test_migrate_endpoint_exists(self):
        # Patch at module level (where router imported it) so mock is effective
        with patch("apps.api.app.routers.intelligence_v2._run_migration",
                   new_callable=AsyncMock,
                   return_value={"entities": 0, "facts": 0, "relations": 0, "policies": 0}):
            with _make_client() as client:
                r = client.post(
                    f"/api/v2/intelligence/migrate/{self._SITE}",
                    headers=self._AUTH,
                )
                assert r.status_code == 200
                assert r.json()["ok"] is True


class TestIntelligenceService:
    """Smoke tests for IntelligenceService."""

    def test_intelligence_service_importable(self):
        from packages.intelligence.service import IntelligenceService
        svc = IntelligenceService()
        assert callable(getattr(svc, "for_content", None))
        assert callable(getattr(svc, "for_whatsapp", None))
        assert callable(getattr(svc, "for_quiz", None))
        assert callable(getattr(svc, "for_dashboard", None))
        assert callable(getattr(svc, "for_briefing", None))

    def test_content_packet_importable(self):
        from packages.intelligence.service import ContentPacket
        packet = ContentPacket(
            site_id="x",
            keyword="test",
            facts=[],
            company="TestCo",
            country="MX",
            value_prop="Test value prop",
            brand_voice="directo",
            products=[],
        )
        assert packet.keyword == "test"
        assert packet.to_prompt() == ""  # empty facts → empty string

    def test_content_packet_to_prompt_renders(self):
        from packages.intelligence.service import ContentPacket
        packet = ContentPacket(
            site_id="x",
            keyword="colchon ortopédico",
            facts=[
                {"fact_type": "pain_point", "fact_key": "dolor_espalda", "value_text": "Dolor lumbar crónico", "value_number": None, "utility_score": 0.9},
                {"fact_type": "competitor", "fact_key": "main_competitor", "value_text": "Dormimundo", "value_number": None, "utility_score": 0.7},
                {"fact_type": "desire", "fact_key": "mejor_sueno", "value_text": "Adultos con dolor crónico que buscan dormir mejor", "value_number": None, "utility_score": 0.8},
            ],
            company="NauralSleep",
            country="MX",
            value_prop="Colchones ortopédicos premium para dormir mejor",
            brand_voice="Honesta y directa",
            products=[{"display_name": "Naural Basic"}],
        )
        prompt = packet.to_prompt()
        assert "colchon ortopédico" in prompt
        assert "NauralSleep" in prompt
        assert "Dolor lumbar" in prompt
        assert "AUDIENCIA PARA ESTE ARTÍCULO" in prompt
        assert len(prompt.split()) <= 260  # ~250 words limit

    def test_for_content_empty_db_returns_fallback_packet(self):
        """for_content() with empty DB returns packet with no facts (triggers pipeline fallback)."""
        import asyncio
        from unittest.mock import AsyncMock, patch
        from packages.intelligence.service import IntelligenceService

        async def _run():
            with patch("packages.core.SupabaseClient.query", new_callable=AsyncMock, return_value=[]):
                with patch("packages.core.SupabaseClient.insert", new_callable=AsyncMock, return_value={"id": "receipt-id"}):
                    svc = IntelligenceService()
                    packet = await svc.for_content("test-site-id", "colchon precio", [])
                    assert packet.facts == []
                    assert packet.to_prompt() == ""
                    return packet

        packet = asyncio.run(_run())
        assert packet.keyword == "colchon precio"
