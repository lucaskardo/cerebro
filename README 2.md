# CEREBRO v7

**Sistema Autónomo de Tráfico, Conversión y Generación de Leads**

## Quick Start

### 1. Clone & Setup
```bash
git clone https://github.com/YOUR_USER/cerebro.git
cd cerebro
cp .env.example .env
# Fill in your API keys in .env
```

### 2. Supabase
1. Create project at [supabase.com](https://supabase.com)
2. Go to SQL Editor → paste contents of `schema.sql` → Run
3. Copy URL and service key to `.env`

### 3. Run API
```bash
cd apps/api
pip install -e '.[dev]'
cd ../..
uvicorn apps.api.app.main:app --reload --port 8000
```

### 4. Test
```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/missions
curl http://localhost:8000/api/status
```

### 5. Generate First Article
```bash
# Get mission ID from /api/missions
curl -X POST http://localhost:8000/api/content/generate \
  -H "Content-Type: application/json" \
  -d '{"mission_id": "YOUR_MISSION_ID", "keyword": "como abrir cuenta en dolares desde colombia"}'
```

## Architecture

```
MISSION → DEMAND → OPPORTUNITY → CONTENT → EXPERIENCE
    → SOCIAL → CONVERSION → LEAD → MEASUREMENT → LEARNING
```

## Sprint Plan

| Sprint | Focus | Key Deliverable |
|--------|-------|-----------------|
| **1** (now) | Foundation | Pipeline + 5 articles + dashboard |
| 2 | Conversion | Calculator + landing pages + first lead |
| 3 | Discovery | Demand Engine + auto-publish |
| 4 | Analytics | Revenue per page + A/B testing |
| 5 | AutoLoop | Karpathy pattern active |
| 6 | Scale | Case study + client #2 |

## For Claude Code

See `CLAUDE.md` for detailed instructions on how to work with this codebase.
