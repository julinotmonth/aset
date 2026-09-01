# Reethau Inventory Admin Portal

A multi-site spare-part inventory admin portal for Reethau Clean Energy (CNG/LNG/Biomass), built with React + TypeScript + Vite on the frontend and a Node.js + Express + PostgreSQL REST API backend (see `server/`).

## Quick start (both frontend and backend)

You'll run two processes in two terminals.

### 1. Backend (terminal 1)

```bash
cd server
npm install
cp .env.example .env        # adjust DATABASE_URL if needed — see server/README.md
npm run migrate             # creates tables + seeds default data
npm run dev                 # http://localhost:4000
```

Full backend setup (installing PostgreSQL, default accounts, API reference) is documented in **[`server/README.md`](./server/README.md)**.

### 2. Frontend (terminal 2, from the project root)

```bash
npm install
npm run dev                 # http://localhost:5173 — /api/* is proxied to the backend automatically
```

Log in with `admin@reethau.com` / `reethau123` (or any of the other seed accounts — see `server/README.md`).

### Production build

```bash
npm run build      # outputs to dist/ — serve it with any static host, with /api proxied to the backend
```

---

## Frontend stack notes

This app uses Vite + React + TypeScript, originally scaffolded from the standard Vite React template.

### Expanding the Oxlint configuration

If you are developing this further, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
