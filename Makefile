.PHONY: test check deploy-web health status lint endpoints tables loc

test:
	pytest tests/ -v

check:
	python scripts/check_deploy.py

deploy-web:
	cd apps/web && npx vercel --prod --yes

health:
	@curl -s https://web-production-c6ed5.up.railway.app/health | python3 -m json.tool

status:
	@curl -s https://web-production-c6ed5.up.railway.app/api/status | python3 -m json.tool

lint:
	python3 -m py_compile apps/api/app/main.py
	@echo "Main compiles OK"
	@for f in apps/api/app/routers/*.py; do python3 -m py_compile "$$f" && echo "OK: $$f"; done

endpoints:
	@grep -rn '@router\.' apps/api/app/routers/*.py | grep -oE '"(/api/[^"]+)"' | sort -u

tables:
	@grep "CREATE TABLE" migrations/*.sql | sed 's/.*CREATE TABLE IF NOT EXISTS //' | sed 's/ (.*//' | sort

loc:
	@echo "=== Lines of Code ==="
	@echo -n "API routers: " && cat apps/api/app/routers/*.py | wc -l
	@echo -n "Schemas:     " && cat apps/api/app/schemas/*.py | wc -l
	@echo -n "Packages:    " && find packages -name "*.py" -exec cat {} + | wc -l
	@echo -n "Migrations:  " && cat migrations/*.sql | wc -l
	@echo -n "Frontend:    " && find apps/web/src -name "*.tsx" -exec cat {} + 2>/dev/null | wc -l
	@echo -n "Tests:       " && cat tests/*.py | wc -l
