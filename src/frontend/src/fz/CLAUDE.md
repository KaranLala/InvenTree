# FZ App — Design Rules

This directory is the **FZ app** (a.k.a. "the new website", "the new app",
"the branch app"): a streamlined internal UI at route `/b/*` for Fanzart's
~10-person single-office team. The rest of `src/frontend` is the **classic
UI** ("the old website", "full InvenTree") — a generic multi-tenant product
we keep intact as an admin/edge-case escape hatch. When a request says "the
new website", work HERE; when it says "the old website", work in the classic
UI and do not apply these rules there.

## Non-negotiable constraints

1. **Simple beats complete.** Single-page workflows, minimal clicks, inline
   editing, search-first lists, clear empty/loading states. Only the fields
   daily work needs; everything rare stays behind an "Open in InvenTree"
   escape-hatch link to the classic UI. Resist rebuilding generic InvenTree
   screens here.
2. **Mantine only.** The user explicitly rejected HeroUI/Tailwind. The FZ app
   shares the classic UI's Mantine theme and dark mode automatically — no
   custom design system, no new styling dependencies.
3. **No lingui.** Plain English strings, never `t\`...\`` macros. (`yarn
   extract` simply ignores these files.)
4. **UI strings say "Branch", never "Tenant".** Backend model/field/API
   parameter names stay `tenant` — only display strings differ.
5. **Branch scoping**: all stock/SO/PO data flows through `useBranchQuery`
   ([api/useBranchQuery.ts](api/useBranchQuery.ts)) — it prefixes query keys
   with the active branch and merges `tenant=<id>` into list params, so
   switching branch refetches everything. Per-record detail queries use
   `scoped: false`. **Global data** (parts, parameter templates, customers,
   categories) uses `useGlobalQuery`/`fzGlobalKey` instead, so branch
   switches don't touch it.
6. **Bypass the generic machinery for core interactions.** Line grids,
   stock browser, and editors are hand-built from Mantine primitives with
   direct `useQuery`/`useMutation` calls. Do reuse: `StatusRenderer`,
   `formatCurrency`/`formatDecimal`, `ProgressBar`, and the
   `useCreateApiFormModal` hooks for rare modal flows (e.g. order creation
   with `tenant` preset hidden).
7. **Optimistic updates policy**: inline line-item edits are optimistic
   (`onMutate` snapshot, `onError` rollback + toast, `onSettled` invalidate
   the whole order prefix — the server recomputes tax totals). NEVER
   optimistic on allocations, receiving, or status transitions — spinner +
   refetch there.
8. **Errors**: map DRF field errors to per-input `error` props where a form
   exists; otherwise toast via `extractErrorMessage`
   ([api/errors.ts](api/errors.ts)).
9. **Testing**: `data-testid='fz-*'` attributes on key elements; smoke-level
   Playwright specs in `src/frontend/tests/fz_*.spec.ts` (they run against
   the CI fixture dataset, not the local dev DB). Type-check with
   `node_modules/.bin/tsc --noEmit`.
10. **Zero-backend-change bias.** Prefer existing API surface. Any real API
    change needs an `INVENTREE_API_VERSION` bump + changelog (see repo
    CLAUDE.md) and must keep upstream merges clean — touch as few upstream
    files as possible (`router.tsx` is the only upstream file the FZ app
    currently modifies).

## Layout

```
fz/
  FzLayout.tsx / FzProtectedRoute.tsx / components/FzTopBar.tsx   shell
  state/BranchState.ts        active branch (zustand, localStorage 'fz-branch')
  api/useBranchQuery.ts       branch + global query helpers
  api/errors.ts               DRF error extraction
  api/soStatus.ts             SO status map + soActions() — Phase 2 approval hook
  api/poStatus.ts             PO equivalent
  api/priceBreaks.ts          customer-aware price break selection
  pages/so/  pages/po/  pages/stock/  pages/items/
```

Patterns to clone: list page = `pages/so/FzSalesOrderList.tsx`; side drawer =
`pages/po/ReceiveDrawer.tsx`; inline-editable grid = `pages/so/LineItemGrid.tsx`
(exports `EditableNumberCell`); editor drawer with dynamic inputs =
`pages/items/ItemEditorDrawer.tsx`.

## Phase 2 (designed, not built)

- SO approval gate (Draft → Pending approval → Approved): plugs into
  `soActions()` in `api/soStatus.ts` plus a future nullable
  `SalesOrder.approval_status` fork field.
- Client-side PDF invoice (`@react-pdf/renderer`, lazy) from the order's tax
  snapshot fields — no backend work needed.

## Deploying

The compiled bundle is NOT committed (gitignored). After FZ changes ship:
`yarn run compile && yarn run build` in `src/frontend` (or
`invoke int.frontend-compile` in the dev container) and commit the tracked
metadata files that change (`index.html`, `.vite/manifest.json`,
`.vite/dependencies.json`).
