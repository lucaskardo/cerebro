"""
CEREBRO Pre-Deploy Checklist
Run before every deploy: python scripts/check_deploy.py
Catches the mistakes we've made before.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
errors = []
warnings = []

# Check 1: All domain_sites domains are in CORS origins
main_py = (ROOT / "apps/api/app/main.py").read_text()
# If DynamicCORSMiddleware is in use, domains are loaded from DB at startup — skip static check
if "DynamicCORSMiddleware" not in main_py:
    for sql_file in (ROOT / "migrations").glob("*.sql"):
        for match in re.finditer(r"'([\w.-]+\.(?:com|co|org))'", sql_file.read_text()):
            domain = match.group(1)
            if domain not in main_py and f"*.{domain.split('.')[-1]}" not in main_py:
                warnings.append(f"Domain '{domain}' found in migrations but not in CORS origins (main.py)")
else:
    print("ℹ️  CORS: DynamicCORSMiddleware detected — domains are loaded from DB at startup (skip static check)")

# Check 2: All dashboard pages are "use client"
dashboard_pages = list((ROOT / "apps/web/src/app/dashboard").rglob("page.tsx"))
for page in dashboard_pages:
    content = page.read_text()
    if '"use client"' not in content and "'use client'" not in content:
        errors.append(f"Dashboard page {page.relative_to(ROOT)} missing 'use client'")

# Check 3: All GET endpoints in routers have try/except
for router_file in (ROOT / "apps/api/app/routers").glob("*.py"):
    content = router_file.read_text()
    # Simple heuristic: count @router.get vs try blocks
    gets = len(re.findall(r'@router\.get', content))
    tries = len(re.findall(r'try:', content))
    if gets > tries + 1:  # Allow 1 tolerance
        warnings.append(f"{router_file.name}: {gets} GET endpoints but only {tries} try/except blocks")

# Check 4: crypto.randomUUID not used without fallback in sites
for tsx_file in (ROOT / "apps/sites").rglob("*.tsx") if (ROOT / "apps/sites").exists() else []:
    content = tsx_file.read_text()
    has_fallback = (
        "fallback" in content.lower()
        or "generateId" in content
        or "randomUUID?.()" in content   # optional chaining pattern
        or "?? " in content              # nullish coalescing fallback
    )
    if "crypto.randomUUID" in content and not has_fallback:
        errors.append(f"{tsx_file.relative_to(ROOT)} uses crypto.randomUUID without fallback")

# Check 5: All site projects have NEXT_PUBLIC_API_URL referenced
for site_dir in (ROOT / "apps/sites").iterdir() if (ROOT / "apps/sites").exists() else []:
    if site_dir.is_dir() and (site_dir / "package.json").exists():
        has_api_ref = False
        for ts_file in site_dir.rglob("*.ts*"):
            if "NEXT_PUBLIC_API_URL" in ts_file.read_text():
                has_api_ref = True
                break
        if not has_api_ref:
            errors.append(f"Site {site_dir.name} has no NEXT_PUBLIC_API_URL reference")

# Check 6: Public tracking/capture endpoints are in auth whitelist
auth_file = (ROOT / "apps/api/app/middleware/auth.py").read_text()
required_public = ["/api/leads/capture", "/api/tracking/visitor", "/api/tracking/session", "/api/tracking/event"]
for endpoint in required_public:
    if endpoint not in auth_file:
        errors.append(f"Public endpoint {endpoint} not in auth whitelist (middleware/auth.py)")

# Check 7: CORS middleware is added BEFORE other middleware in main.py
cors_pos = main_py.find("CORSMiddleware")
ratelimit_pos = main_py.find("RateLimitMiddleware")
auth_pos = main_py.find("AuthMiddleware")
if cors_pos > 0 and ratelimit_pos > 0 and cors_pos > ratelimit_pos:
    errors.append("CORSMiddleware must be added BEFORE RateLimitMiddleware in main.py")
if cors_pos > 0 and auth_pos > 0 and cors_pos > auth_pos:
    errors.append("CORSMiddleware must be added BEFORE AuthMiddleware in main.py")

# Report
if errors:
    print("\u274c ERRORS (must fix before deploy):")
    for e in errors:
        print(f"  - {e}")
if warnings:
    print("\u26a0\ufe0f  WARNINGS (review before deploy):")
    for w in warnings:
        print(f"  - {w}")
if not errors and not warnings:
    print("\u2705 All pre-deploy checks passed!")

sys.exit(1 if errors else 0)
