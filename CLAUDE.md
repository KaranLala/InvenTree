# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Fork Context

This is **Fanzart's fork** of [InvenTree](https://github.com/inventree/InvenTree) (origin: `KaranLala/InvenTree`), extended with company-specific features. Branch strategy:

- `master` — tracks upstream InvenTree; periodically merged into `development`
- `development` — the fork's main integration branch; all Fanzart features live here
- `production` — deployed branch
- Feature branches (e.g. `inventree_base_auto_sales_price`) merge into `development`

When comparing against upstream behavior, diff against `master`. Fork features are visible via `git diff master...development`.

## Development Environment

Development runs in Docker (the `dev/venv` interpreter paths point inside the container):

```bash
docker compose -f contrib/container/dev-docker-compose.yml up -d
```

- Uses `contrib/container/.env.local` for environment config (not the upstream `docker.dev.env`)
- Postgres 17 is exposed on host port **54320**
- Repo root is mounted at `/home/inventree` in the containers; instance data (config.yaml, media, plugins) lives in `dev/`
- Run `invoke` tasks inside the container, e.g. `docker compose -f contrib/container/dev-docker-compose.yml exec inventree-dev-server invoke dev.test`

## Commands

All tooling is driven by `invoke` tasks defined in `tasks.py` (namespaces: `dev.` for development, `int.` for internal):

```bash
invoke dev.server                 # Run Django dev server (default: localhost:8000)
invoke worker                     # Run background worker (django-q)
invoke dev.frontend-server        # Run Vite frontend dev server
invoke migrate                    # Run database migrations
invoke update                     # Full update (install, backup, migrate, static)
invoke fz-updateServer            # Fork-specific: server-only update, skips frontend ops
```

### Tests

```bash
invoke dev.test                                   # All backend tests
invoke dev.test --runtest=order                   # One app
invoke dev.test --runtest=order.test_sales_order  # One file
invoke dev.test --runtest=company.test_api.TestCompanyAPI.test_create_company  # One test
invoke dev.test --keepdb                          # Reuse test DB (faster iteration)
```

Or directly: `cd src/backend/InvenTree && python manage.py test <path>`.

- Test output is teed to a timestamped log at `debug/test-<timestamp>.log` (fork-specific).
- A custom test runner (`src/backend/InvenTree/InvenTree/test_runner.py`) clears the ContentType cache and re-binds the plugin registry after test-DB creation — needed because the plugin registry is process-wide and ContentType IDs differ between app and test databases.
- Frontend tests: `invoke dev.frontend-test` (Playwright, in `src/frontend/tests/`).

### Lint / Format

Pre-commit runs everything: `pre-commit run --all-files`. Backend uses ruff; frontend uses biome (`biome.json` at repo root). Frontend type-check + build: `cd src/frontend && npm run build`.

## Architecture

Two main components under `src/`:

### Backend — `src/backend/InvenTree/` (Django + DRF)

Django apps, one per domain: `part`, `stock`, `order`, `build`, `company`, `users`, `common`, `report`, `plugin`, `machine`, `importer`, `web`, plus **fork-specific apps `tax` and `tenant`**.

- REST API under `/api/`, defined per-app in `api.py` / `serializers.py`. **Any API change requires bumping `INVENTREE_API_VERSION` in `src/backend/InvenTree/InvenTree/api_version.py`** with a changelog entry.
- Shared model mixins live in `InvenTree/models.py` (e.g. `InvenTreeMetadataModel`); shared API machinery in `InvenTree/api.py`, `InvenTree/filters.py`, `InvenTree/serializers.py`.
- Plugin system in `plugin/` — plugins register via mixins (`AppMixin`, etc.) through a process-wide `registry` (`plugin/registry.py`). Sample plugins in `plugin/samples/`.
- Background tasks run via django-q (`invoke worker`).

### Frontend — `src/frontend/` (React + Vite + Mantine)

- Pages in `src/pages/`, tables in `src/tables/`, forms in `src/forms/`; shared enums/API endpoint definitions in `lib/enums/` (`ApiEndpoints.tsx`, `ModelType.tsx`, `ModelInformation.tsx` — new backend models must be registered in all three).
- i18n via lingui (`npm run extract` / `compile`); locale files in `src/locales/`.
- **The compiled frontend is committed to git** at `src/backend/InvenTree/web/static/web/` (upstream downloads it instead). After frontend changes intended for deployment, rebuild (`invoke int.frontend-build`) and commit the build output.

## Fork-Specific Features

### Tenant app (`src/backend/InvenTree/tenant/`)

Lightweight multi-tenancy for **data filtering, not user isolation** — all users can access all tenants. `Tenant` model plus a `TenantMixin` abstract model providing a required `tenant` FK.

Tenant FKs exist on `StockLocation` and orders. Enforced invariants:
- A stock location's tenant must match its parent location's tenant
- Stock cannot be transferred between locations with different tenants
- Sales order allocation checks that stock tenant matches the order tenant
- A default tenant is created by migration `tenant/migrations/0002_create_default_tenant.py`

Managed via the Tenant Management panel in the frontend Admin Center. Tenant delete permission is removed for all users.

### Tax app (`src/backend/InvenTree/tax/`)

`TaxConfiguration` model: per-year tax rate/currency with `is_inclusive`, `applies_to_sales`, `applies_to_purchases` flags (one active config per year). Orders snapshot `tax_configuration`, `tax_rate`, `tax_inclusive`, and compute `tax_amount`; line items compute per-item tax via `get_effective_tax_rate()`. Managed via Tax Management panel in Admin Center; `TaxExtraLineItemTable` on sales orders.

### Customer-specific sale price breaks

`PartSellPriceBreak` has a `customer` FK. Sales order line item forms auto-apply the matching price break based on customer, currency, and quantity. Part list API exposes price breaks via a `price_breaks` query parameter.

### Other fork deviations

- `invoke dev.delete-partial` — wipes transactional data (parts, stock, orders, companies) while preserving users, groups, tenants, tax configs, settings, templates, part parameters, and location types
- Barcode generation is currently disabled (see commit `9aee58fcb`)
- Company address line length limits were increased
- Stock item tables show available stock instead of total stock
