#!/bin/bash
# ============================================
# CEREBRO v7 — Setup Script
# Run this ONCE after cloning the repo
# ============================================

set -e

echo "🧠 CEREBRO v7 — Setup"
echo "====================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

step() { echo -e "\n${GREEN}[$1/7]${NC} $2"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; exit 1; }

# Step 1: Check prerequisites
step 1 "Checking prerequisites..."

command -v python3 >/dev/null 2>&1 || fail "Python 3.11+ required. Install: https://python.org"
command -v node >/dev/null 2>&1 || fail "Node.js 18+ required. Install: https://nodejs.org"
command -v git >/dev/null 2>&1 || fail "Git required"

PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo "  Python: $PYTHON_VERSION"
echo "  Node: $(node --version)"
echo "  Git: $(git --version | cut -d' ' -f3)"

# Step 2: Environment file
step 2 "Setting up environment..."

if [ ! -f .env ]; then
    cp .env.example .env
    echo "  Created .env from .env.example"
    warn "EDIT .env with your API keys before running the API!"
else
    echo "  .env already exists, skipping"
fi

# Step 3: Python dependencies
step 3 "Installing Python dependencies..."

cd apps/api
python3 -m pip install -e ".[dev]" --quiet 2>/dev/null || python3 -m pip install -e ".[dev]"
cd ../..
echo "  FastAPI + dependencies installed"

# Step 4: Node dependencies (for web app later)
step 4 "Checking Node setup..."

if [ -f apps/web/package.json ]; then
    cd apps/web && npm install --silent 2>/dev/null && cd ../..
    echo "  Web dependencies installed"
else
    echo "  Web app not created yet (Sprint 1 task for Claude Code)"
fi

# Step 5: Verify .env has keys
step 5 "Checking API keys..."

check_key() {
    local key=$1
    local name=$2
    local val=$(grep "^${key}=" .env 2>/dev/null | cut -d'=' -f2-)
    if [ -z "$val" ] || [[ "$val" == *"your-"* ]] || [[ "$val" == *"your_"* ]]; then
        warn "$name not configured in .env"
        return 1
    else
        echo "  ✅ $name configured"
        return 0
    fi
}

KEYS_OK=true
check_key "SUPABASE_URL" "Supabase URL" || KEYS_OK=false
check_key "SUPABASE_SERVICE_KEY" "Supabase Key" || KEYS_OK=false
check_key "ANTHROPIC_API_KEY" "Anthropic API Key" || KEYS_OK=false

if [ "$KEYS_OK" = false ]; then
    warn "Some keys missing. Edit .env before starting the API."
fi

# Step 6: Test API startup
step 6 "Testing API startup..."

if [ "$KEYS_OK" = true ]; then
    # Start API briefly to test
    timeout 5 python3 -m uvicorn apps.api.app.main:app --port 8765 2>/dev/null &
    API_PID=$!
    sleep 2
    
    if curl -s http://localhost:8765/health | grep -q "ok" 2>/dev/null; then
        echo "  ✅ API starts correctly"
    else
        warn "API didn't respond. Check .env configuration."
    fi
    
    kill $API_PID 2>/dev/null || true
    wait $API_PID 2>/dev/null || true
else
    echo "  Skipped (missing API keys)"
fi

# Step 7: Summary
step 7 "Setup complete!"

echo ""
echo "============================================"
echo "  CEREBRO v7 — Ready for Development"
echo "============================================"
echo ""
echo "  Next steps:"
echo ""
echo "  1. Edit .env with your API keys"
echo "     - Supabase: Create project at supabase.com"
echo "     - Run schema.sql in Supabase SQL Editor"
echo "     - Copy URL + service key to .env"
echo "     - Anthropic: Get key at console.anthropic.com"
echo ""
echo "  2. Start the API:"
echo "     python3 -m uvicorn apps.api.app.main:app --reload --port 8000"
echo ""
echo "  3. Open Claude Code:"
echo "     cd $(pwd) && claude"
echo "     > 'Read CLAUDE.md. We're in Sprint 1.'"
echo ""
echo "  4. Generate first article:"
echo "     curl -X POST http://localhost:8000/api/content/generate \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -d '{\"mission_id\": \"ID\", \"keyword\": \"como abrir cuenta en dolares\"}'"
echo ""
