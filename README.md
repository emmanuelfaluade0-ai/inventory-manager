# Inventory Manager

Tracks products and stock movements. Current stock is never stored — it's
always derived from the movement log at query time.

## Running locally

### API

```
cd api
npm install
```

Create `api/.env` with:

```
DATABASE_URL="<pooled connection string, port 6543>"
DIRECT_URL="<direct connection string, port 5432>"
```

Run the migration (uses `DIRECT_URL`):

```
npx prisma migrate deploy
```

Start the API:

```
npm run dev
```

Listens on `http://localhost:3001` by default (`PORT` env var to override).

Note: a fresh connection to Supabase's pooled endpoint can take a few
seconds to establish (observed 2-6s on the first request after the API
starts or sits idle). Later requests are fast. This is network/infra
latency, not application code — the UI's loading state covers it, but
don't mistake the first request of a session for something hanging.

### Frontend

```
cd web
npm install
npm run dev
```

Listens on `http://localhost:5173`. The dev server proxies `/api/*` to
`http://localhost:3001`, so the API needs to be running too (same-origin
relative paths, no CORS setup needed in either dev or prod).

Both pages are built:

- `/` — product list: search, low-stock filter, add-product form.
- `/products/:id` — product detail: current stock, movement history
  newest-first, and a form to record a movement. A 409 from recording an
  "out" that exceeds stock shows the server's exact message (e.g. "Only 2
  available"), not a generic error.

Both pages refetch after a successful write (add product / record movement)
rather than reloading the page. That refetch only replaces the data in
place — it doesn't fall back to a full loading-state teardown, since an
earlier version of both pages did that and it turned out to unmount the
movement form mid-interaction (see git history / code comments in
`ProductListPage.jsx` and `ProductDetailPage.jsx` for the "only the first
load, not every refetch" loading-state guard this required).

## Deploying to Vercel

One Vercel project serves both: the root `vercel.json` builds `web/` as the
static frontend (`buildCommand`/`outputDirectory`) and rewrites `/api/*` to
the single Express function at `api/index.js`; everything else falls back to
`index.html` so React Router can handle client-side routes like
`/products/:id`.

Before the first deploy, set these in the Vercel dashboard (Project Settings
→ Environment Variables), for Production and Preview:

- `DATABASE_URL` — the pooled connection string (port 6543, `pgbouncer=true`).
  This is what the deployed app actually queries with.
- `DIRECT_URL` — the direct connection string (port 5432). Not read by the
  app at runtime (only `prisma migrate` uses it), but harmless to set and
  useful if migrations ever need to run from a Vercel context later.

Schema migrations are **not** run automatically as part of the Vercel build.
Run `npx prisma migrate deploy` manually from `api/` (with `DIRECT_URL`
pointed at the same database) whenever the schema changes, before or after
deploying the code that depends on it.

`api/package.json` has a `postinstall: prisma generate` script so the
Prisma Client gets (re)generated wherever `npm install` runs, including on
Vercel's build machine — and `schema.prisma`'s `binaryTargets` includes
`rhel-openssl-3.0.x` alongside `native`, since Vercel's Node.js functions run
on Amazon Linux, not whatever OS you developed on. Skipping either of these
is a common way a Prisma+Vercel deploy builds fine but crashes at runtime.

## Schema

Two models: `Product` (sku, name, reorderThreshold) and `Movement`
(productId, type, quantity, note, createdAt). Notable constraints:

- `Product.sku` is unique at the database level (`@unique`), not just checked
  in application code — the create endpoint relies on this and catches the
  constraint violation rather than checking-then-inserting.
- `Movement.type` has a DB `CHECK` constraint restricting it to `'in'` or
  `'out'`, enforced in addition to the application-level validation.
- `Movement.quantity` has a DB `CHECK` constraint requiring it to be `> 0`.
- Movements are immutable — there's no update or delete path. The only way
  stock changes is by appending a new movement row.

## How stock is calculated

Stock for a product is `SUM(quantity WHERE type = 'in') - SUM(quantity WHERE
type = 'out')` over its movements — never a stored/incremented column. This
lives in `api/_lib/stock.js`:

- `calculateStock(movements)` is a pure function over an already-fetched
  array of `{ type, quantity }` rows.
- `getStock(client, productId)` fetches one product's movements and reduces
  them with `calculateStock`.
- `getStockMap(client, productIds)` does the same in bulk (one query, not
  N+1) for endpoints that list multiple products.

Endpoints reuse whichever fits: the product-detail endpoint already has the
movements in hand from its own query and calls `calculateStock` directly; the
list endpoint fetches many products at once and uses `getStockMap`.

## Recording a movement: preventing overdraw under concurrency

`POST /api/products/:id/movements` is the one endpoint where a naive
"read stock, check it, then insert" is unsafe: two simultaneous `"out"`
requests could both read the same stock figure, both pass the check, and
both insert, leaving stock negative.

This is prevented by doing the check and the insert inside a single Postgres
transaction, with a row lock acquired first:

1. `SELECT id FROM "Product" WHERE id = $1 FOR UPDATE` locks the product row.
   A second concurrent `"out"` request for the same product blocks on this
   line until the first transaction commits or rolls back.
2. Only once the lock is held does it re-read the movement log and compute
   current stock.
3. If `quantity` exceeds that freshly-read stock, the transaction throws and
   rolls back, and the request gets a `409` with the available quantity in
   the body (`{ "error": { "message": "Only 2 available", "available": 2 } }`).
4. Otherwise the movement is inserted in the same transaction.

`"in"` movements skip the lock — there's no read-then-conditional-write
dependency to protect, since concurrent additions can't overdraw anything.
They still run inside a transaction that checks the product exists first, so
a movement against a deleted/nonexistent product can't slip through.

**Tested directly**: with a product's stock at 2, I fired two concurrent
`POST .../movements` requests for `{ "type": "out", "quantity": 2 }` (the
exact remaining stock) at the same time. One request received `201` and the
movement was recorded; the other blocked on the row lock, then re-read stock
as `0` post-commit and correctly received `409` with
`{ "available": 0 }`. Fetching the product afterward confirmed stock was
exactly `0` — never negative, and no duplicate/lost movement.

(First attempt at this test surfaced a real bug: the blocked request hit
Prisma's default 2-second `maxWait` for starting a transaction and returned
a raw `500` instead of waiting for the lock. Fixed by raising `maxWait` and
`timeout` on that transaction call — the locking logic itself was correct
from the start, it just needed enough headroom to wait its turn.)

## Deliberate scope cuts

_Filled in as the build progresses — see the final version of this section
for the complete list._

## What I'd do with more time

_To be filled in._
