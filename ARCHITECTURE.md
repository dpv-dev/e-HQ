# ehq-platform — Architecture & Naming Plan

The consolidated rebuild of the ë ecosystem: one monorepo, four frontends, one
shared backend, one source of truth. Pairs with `AGENTS.md` (rules) and
`CODEX_BUILDING.md` (playbook).

---

## Naming rule

All **code** — folders, packages, paths, identifiers — is lowercase ASCII
kebab-case: no accents (`ë`), no symbols (`•`), no spaces. The pretty brand names
live **only** in UI display strings (French), never on the filesystem.

| Display name (UI) | Code name (folder / package) | Role                          |
|-------------------|------------------------------|-------------------------------|
| ë • Entreprise    | `ehq-platform` (repo root)   | Umbrella brand = the platform |
| ë • HQ            | `hq`                         | Hub: landing, login, switch   |
| ë • Office        | `office`                     | Finance                       |
| ë • Distribution  | `distribution`               | Music business                |
| Command Center    | `command-center`             | Admin / ops (internal)        |

> Root name: `ehq-platform` is recommended (it reads as the whole platform, not
> one app). If you prefer the brand name, `e-entreprise` works identically —
> it's a one-line change.

---

## Two maps, one platform

### Brand map — what people see
```
ehq-platform                       (ë • Entreprise — umbrella brand)
├── hq                             (ë • HQ — front door: login, home, switch)
│   ├── office                     (ë • Office — finance)
│   └── distribution               (ë • Distribution — music business)
└── command-center                 (Command Center — admin, internal)
```

### Technical map — how it's built
```
   hq      office   distribution   command-center      ← frontends (apps/)
     \         \         /               /
       ──────   services/api + engine   ──────          ← ONE shared backend
                       │
               existing database                        ← data (unchanged)
```

Four faces, one brain, one source of truth.
**Command Center is a frontend admin app — NOT the backend.** The backend is
`services/api` + the domain engine, shared by every app.

---

## Monorepo structure

```
ehq-platform/
├── apps/
│   ├── hq/                  # front door: landing, login, workspace pick
│   ├── office/              # finance cockpit
│   ├── distribution/        # music business engine
│   └── command-center/      # admin / ops control tower
├── services/
│   ├── api/                 # typed API + OpenAPI — the backend every app calls
│   ├── workers/             # Temporal workflows
│   └── realtime/            # WebSocket / SSE status
├── packages/
│   ├── domain-finance/      # the eHQ Financial Kernel
│   ├── domain-office/
│   ├── domain-distribution/
│   ├── db/                  # schema + typed repositories
│   ├── api-contracts/
│   ├── ui/                  # shared components + brand tokens
│   └── auth/
├── AGENTS.md
├── CODEX_BUILDING.md
├── PROMPTS.md
└── ARCHITECTURE.md          # this file
```

---

## Package names (pnpm)

Scope everything under `@ehq/`:

```
@ehq/hq            @ehq/office          @ehq/distribution     @ehq/command-center
@ehq/api           @ehq/workers         @ehq/realtime
@ehq/domain-finance  @ehq/domain-office  @ehq/domain-distribution
@ehq/db            @ehq/api-contracts   @ehq/ui               @ehq/auth
```

---

## Data

"Same database first." The platform points at the existing database through
`services/api`; there is no migration to build now. A move to PostgreSQL is
later, controlled, and table-by-table — see `CODEX_BUILDING.md`. Imported
financial data is never mutated in place; corrections are audited override
records.
