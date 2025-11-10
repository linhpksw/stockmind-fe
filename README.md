# StockMind Frontend

Responsive inventory cockpit built with React + Vite for the StockMind domain model (see `Winmart_Stock_MVP_BA_Pack.pdf`). It surfaces the core flows already exposed by the existing ASP.NET backend: auth, alerts, inventory control, purchasing, receiving, markdowns, replenishment, and waste logging.

## Tech stack

- React 19 + TypeScript + Vite
- Material UI 6 for layout system and theming
- React Router 7 for routing
- React Query 5 for data fetching/caching
- Axios with interceptors for JWT handling
- Zustand for auth + global search state
- Vitest + Testing Library ready (jsdom env)

## Prerequisites

- Node.js ≥ 20 and npm ≥ 10 (use the `.nvmrc` from backend if available)
- StockMind backend running locally (default assumption: `http://localhost:8080`)

## Getting started

```bash
cd stockmind-fe
cp .env.example .env            # create your own env file
npm install
npm run dev
```

The most important env value is the backend origin:

```bash
# .env
VITE_API_BASE_URL=http://localhost:8080
VITE_APP_VERSION=1.0.0
```

## Available scripts

| Command            | Description                                                     |
| ------------------ | --------------------------------------------------------------- |
| `npm run dev`      | Start Vite dev server with HMR                                  |
| `npm run build`    | Type-check + production build                                   |
| `npm run preview`  | Preview the production build                                    |
| `npm run lint`     | ESLint with zero-warning budget                                 |
| `npm run lint:fix` | ESLint + autofix                                                |
| `npm run format`   | Prettier across the repo                                        |
| `npm run test`     | Vitest (jsdom)                                                  |

Husky + lint-staged run `eslint` + `prettier` automatically on commits once the repo is initialized (`git init && npx husky install`).

## Project structure

```
src/
  api/               REST clients mapped to backend controllers
  components/        Layout shell, reusable cards, sections
  pages/             Feature pages (auth, dashboard, inventory, etc.)
  stores/            Zustand stores for auth + global search
  types/             DTO mirrors of backend contracts
  utils/             Helpers (formatters, etc.)
```

Key UX elements:

- Left sidebar with the Stock features (inventory, suppliers, PO/GRN, markdowns, replenishment, waste).
- Top search + user menu (shows roles + logout).
- Dashboard surfaces alert aggregates (low stock, expiry, slow movers) and replenishment suggestions.
- Inventory workspace pulls ledger + movements and supports adjustments (FEFO-friendly).
- Purchasing / receiving forms align with backend DTOs (`CreatePoRequestDto`, `CreateGrnRequestDto`).
- Markdown, replenishment, and waste flows reuse backend rules without re-inventing logic.

## CI

`.github/workflows/ci.yml` runs lint + build + tests on Node 20 before merges into `main`. Adjust as required for your branching model.

## Coding guidelines

- Favor SOLID, KISS, YAGNI — keep forms lean, reuse DTO-driven helpers.
- All domain data flows through typed API modules to keep the UI thin.
- React Query handles caching/invalidations; hooks stay pure and small.
- Keep styling in the theme or MUI `sx` props instead of bespoke CSS.

## Next steps

- Plug in authentication secrets from your identity provider once backend exposes signup/refresh.
- Extend tables with virtualization or server filters if datasets grow.
- Add smoke/component tests for the most critical flows (login, adjustments, PO, markdown apply).
