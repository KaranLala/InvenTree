# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Fork Context

This is **Fanzart's fork** of [InvenTree](https://github.com/inventree/InvenTree) (origin: `KaranLala/InvenTree`), extended with company-specific features. Branch strategy:

- `master` — tracks upstream InvenTree; periodically merged into `development`
- `development` — the fork's main integration branch; all Fanzart features live here
- `production` — deployed branch
- Feature branches (e.g. `inventree_base_auto_sales_price`) merge into `development`

**Never commit or push directly to `production`.** All changes land on `development` first (either committed there or on a feature branch that is merged into `development`), and `production` is only ever advanced by merging `development` into it. This keeps `development` a strict superset of `production` and prevents stale/divergent state on the deployed branch.

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
- **The compiled frontend bundle is NOT committed to git** — `.gitignore` excludes `src/backend/InvenTree/web/static`, and `web/static/web/` is now fully untracked (the previously-committed `index.html`, `.vite/manifest.json`, `.vite/dependencies.json`, `inventree.svg` and two stray CSS files were removed from git — a stale committed `manifest.json` could shadow the CI-built bundle and point `<script src>` at missing JS, breaking the deploy with INVE-E1). The deployed bundle comes solely from the "FZ Frontend Build" CI artifact that `contrib/fz/update.sh` downloads; local dev regenerates it via `yarn build`. The JS/CSS assets must be rebuilt at deploy time: `invoke int.frontend-compile --extract` inside the dev container (yarn install + translation extract + compile + build), or `yarn run extract && yarn run compile && yarn run build` in `src/frontend`. **Always `extract` before `compile`** — `compile` only reads existing `.po` catalogs, so any newly added/changed translatable string that wasn't extracted first leaks into the UI as a lingui hash ID (e.g. "UTVshK") instead of its text. The CI "FZ Frontend Build" workflow runs `extract` for this reason; `invoke int.frontend-compile` defaults `--extract` off, so pass it explicitly. Neither deploy task builds the frontend automatically: `invoke fz-updateServer` skips all frontend operations, and `invoke update` skips them inside Docker unless passed `--frontend` — build the frontend explicitly when deploying frontend changes.

## Fork-Specific Features

### FZ app — "the new website" (`src/frontend/src/fz/`)

A streamlined internal UI at route `/b/*` (Sales, Purchasing, Stock, Item
master), coexisting with the stock InvenTree UI ("the old website" / "classic
UI"), which stays intact for admin/edge tasks. Requests phrased as "the new
website/app" mean `src/frontend/src/fz/`; "the old website" means the classic
UI everywhere else. **Before changing FZ code, read
`src/frontend/src/fz/CLAUDE.md`** — it carries the binding design rules
(simple/minimal-click single-page workflows, Mantine only, no lingui, UI says
"Branch" never "Tenant", branch-scoped vs global query helpers, optimistic
update policy, escape-hatch philosophy). The FZ app is the default landing
page after login.

### Tenant app (`src/backend/InvenTree/tenant/`)

Lightweight multi-tenancy for **data filtering, not user isolation** — all users can access all tenants. `Tenant` model plus a `TenantMixin` abstract model providing a required `tenant` FK.

Tenant FKs exist on `StockLocation` and orders. Enforced invariants:
- A stock location's tenant must match its parent location's tenant
- Stock cannot be transferred between locations with different tenants
- Sales order allocation checks that stock tenant matches the order tenant
- Transfer orders operate within a single tenant: source/destination locations must
  match the order tenant (and each other), and allocated stock must come from a
  location of the order's tenant
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

## Upstream Merge: Migration Conflict Strategy

Django identifies migrations by the full file name recorded in the `django_migrations`
table; the numeric prefix is cosmetic. Duplicate numbers (e.g. two `0117_*.py` files in
`stock`) are harmless. Follow these rules on every upstream sync:

1. **Fork migrations in upstream apps are NEW files** at the next free number with a
   descriptive name. Never edit or delete upstream migration files.
   (Legacy exception, keep as-is: `order/0112_tax.py` replaced upstream's
   `0112_alter_salesorderlineitem_part.py`, whose AlterField was folded into our
   rewritten `0113`.)
2. **Never rename/renumber a fork migration once applied anywhere** — Django would
   treat the new name as unapplied and re-run it against deployed databases.
3. **Never repoint an applied fork migration's `dependencies`** at newer upstream
   migrations — existing databases would raise `InconsistentMigrationHistory`
   (applied before its dependency).
4. **After each upstream merge**, if an app has two leaf migrations (upstream chain +
   fork migration sharing a parent), run
   `python manage.py makemigrations --merge` (inside the dev container) and commit the
   generated `NNNN_merge_*.py` files. This is the ONLY intervention needed — upstream
   itself carries such merge migrations (e.g. `order/0061_merge_...`).
5. Also run plain `makemigrations` afterwards: new upstream models inheriting fork
   mixins (e.g. `TransferOrder` gaining the `tenant` FK) may need a fork migration.
6. **Verify**: `manage.py makemigrations --check` (clean graph, no missing migrations),
   then apply migrations on a fresh test DB (running the test suite does this) AND on a
   copy of a production DB before deploying.
7. **GitHub Actions**: upstream workflow files under `.github/workflows/` are deleted
   on `development`/`production` (only the fork's `fz-frontend-build.yaml` remains —
   it builds the frontend on pushes to `production`). Upstream edits to those files
   cause modify/delete conflicts on syncs — resolve by keeping them deleted. After each
   sync, run `gh workflow list --repo KaranLala/InvenTree --all` and disable any
   newly-indexed workflows (new/renamed upstream workflow files arrive enabled, and
   workflows existing only on `master` can only be disabled after their first run).

## Upstream Policies

Upstream InvenTree guidance (kept from upstream's CLAUDE.md): see [CONTRIBUTING.md](CONTRIBUTING.md) for codebase guidance. Security reports must follow [SECURITY.md](docs/docs/SECURITY.md) and the [threat model](docs/docs/concepts/threat_model.md). When contributing upstream: do not open a pull request without manual review by a human, and do not file AI-generated issues.
