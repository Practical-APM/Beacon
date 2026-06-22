.PHONY: help install dev build test lint typecheck up down reset db-migrate db-seed db-seed-load-test security-audit load-test e2e-smoke website clean verify-vercel

help:
	@echo "Beacon — local commands"
	@echo ""
	@echo "  make install     Install dependencies"
	@echo "  make up          Start Postgres + Redis (Docker)"
	@echo "  make down        Stop Docker services"
	@echo "  make reset       Reset DB volumes and re-migrate + seed"
	@echo "  make dev         Run web + API in dev mode"
	@echo "  make build       Build all packages"
	@echo "  make test        Run all tests"
	@echo "  make lint        Lint all packages"
	@echo "  make typecheck   Typecheck all packages"
	@echo "  make db-migrate  Run database migrations"
	@echo "  make db-seed     Seed demo data"
	@echo "  make db-seed-load-test  Seed 50 projects / 10K tasks / 100K events"
	@echo "  make security-audit     Run npm audit + outdated check"
	@echo "  make load-test TENANT_ID=<uuid>  API load smoke test"
	@echo "  make e2e-smoke TENANT_ID=<uuid>  API end-to-end smoke test"
	@echo "  make website     (Legacy) Serve static website folder on http://localhost:4321"
	@echo "  make verify-vercel  Simulate Vercel install + web production build"

install:
	npm install

up:
	docker compose up -d
	@echo "Waiting for services..."
	@sleep 3
	@docker compose ps

down:
	docker compose down

reset: down
	docker compose down -v
	docker compose up -d
	@sleep 4
	$(MAKE) db-migrate
	$(MAKE) db-seed

dev:
	npm run dev

build:
	npm run build

test:
	npm run test

lint:
	npm run lint

typecheck:
	npm run typecheck

db-migrate:
	npm run db:migrate --workspace=@beacon/db

db-seed:
	npm run db:seed --workspace=@beacon/db

db-seed-load-test:
	npm run db:seed-load-test --workspace=@beacon/db

security-audit:
	bash scripts/security-audit.sh

load-test:
	node scripts/load-test.mjs http://localhost:3001 admin-a $(TENANT_ID)

e2e-smoke:
	node scripts/e2e-smoke.mjs http://localhost:3001 admin-a $(TENANT_ID)

website:
	@echo "The marketing site is served by Next.js at http://localhost:3000 (make dev)."
	@echo "The legacy website/ HTML folder has been removed."

clean:
	npm run clean

verify-vercel:
	bash scripts/verify-vercel-build.sh
