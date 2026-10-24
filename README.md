# Product Catalog & Support API

A CommonJS Node.js/Express API using PostgreSQL, Knex, and Redis. Includes Docker Compose and Jest/Supertest tests.

## Quick start with Docker

Install Docker Desktop with Linux containers (WSL 2 on Windows). From the project root, copy `.env.example` to `.env` if it does not already exist:

```powershell
Copy-Item .env.example .env
```

Set these values in `.env`:

```dotenv
API_PORT=8000
POSTGRES_USER=sales_app
POSTGRES_PASSWORD=YOUR_PASSWORD
POSTGRES_DB=sales_fine
DOCKER_DATABASE_URL=postgresql://sales_app:URL_ENCODED_PASSWORD@db:5432/sales_fine
```

Use matching credentials and database names. URL-encode special characters in URL credentials. Single-quote `.env` values containing `$`. Never commit `.env`.

Validate configuration without printing secrets, then build and start:

```powershell
docker compose config --quiet
docker compose up -d --build --wait
```

The API waits for PostgreSQL, applies pending migrations, runs the repeatable product seed, then starts on **http://127.0.0.1:8000**. Redis connects asynchronously; the API can start and serve products while Redis is unavailable. Compose's `--wait` still reports failure if any started service's health check fails.

PostgreSQL data persists in a named volume. Redis is temporary. Database and Redis ports are not published to the host.

## Endpoints

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/health` | Process liveness; returns `200` |
| GET | `/api/v1/products?page=1&limit=10` | Paginated catalog with numeric prices |
| POST | `/api/v1/tickets` | Creates a support ticket |

Products use positive integer pagination; `limit` must be at most 100. Example response:

```json
{
  "data": [{ "product_code": "PRD-001", "product_title": "Keyboard", "product_price": 49.99 }],
  "pagination": { "page": 1, "limit": 1, "total": 3, "totalPages": 3 }
}
```

Ticket request (Postman: raw JSON with `Content-Type: application/json`):

```json
{
  "ticket_number": 1001,
  "subject": "Cannot log in",
  "description": "My account rejects my password."
}
```

Returns `201` with the saved ticket. `ticket_number` must be a unique integer from 1 to 2147483647. Subject and description must be non-empty strings; subject is limited to 255 characters. Invalid input returns `400`; duplicate numbers return `409`. Errors use `{ "error": { "message": "...", "details": {} } }`, with field details included for validation failures. Unexpected errors return a generic `500`.

## Architecture and caching

```text
Route -> Validation -> Controller -> Service -> Repository -> PostgreSQL
                                       |
                                  Cache utility -> Redis
```

`src/app.js` exports Express; `src/index.js` starts connections and the HTTP server. SIGTERM/SIGINT stop new requests, allow active requests to finish, and close connections, with a 10-second shutdown deadline.

Product responses use cache-aside with keys such as `products:v2:page:1:limit:10`. Misses query PostgreSQL and cache JSON with a **120-second TTL**; hits skip SQL without refreshing expiration. Redis failures fall back to PostgreSQL. Results may be stale for up to two minutes. The `v2` namespace separates numeric-price responses from earlier string-price caches.

## Tests

Install development dependencies and run the fast mocked suite (no services needed):

```powershell
npm ci
npm test
```

Run real PostgreSQL/Redis integration tests in a separate disposable Docker stack:

```powershell
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from tests
```

Afterward, remove the test containers and network:

```powershell
docker compose -f docker-compose.test.yml down
```

The test stack uses its own private network and memory-backed storage, no development volumes or host ports. Its guard rejects other connection settings. See [TESTING.md](TESTING.md) for coverage and explanations.

## Local development without Docker

Use Node.js 24, PostgreSQL, and Redis. Configure `PORT`, `DATABASE_URL`, and `REDIS_URL` in `.env` for your local services, then run:

```powershell
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

`npm start` runs normally; `npm run dev` enables file watching. Knex currently uses one environment-driven configuration named `development`, including in Docker. `NODE_ENV=production` does not select a separate Knex configuration.

## Operations

| Task | Command |
| --- | --- |
| Service status | `docker compose ps` |
| Follow API logs | `docker compose logs -f api` |
| Rebuild after code changes | `docker compose up -d --build --wait` |
| Stop services, retain data | `docker compose stop` |
| Remove containers, retain database volume | `docker compose down` |
| Migration status inside Docker | `docker compose exec api npm run db:status` |
| Local migration status | `npm run db:status` |
| Roll back latest local migration batch | `npm run db:rollback` |

Rollback reverses that batch's changes; table-creation rollbacks delete their tables and data. `docker compose down -v` deletes persistent database storage. PostgreSQL initialization variables apply only when its data directory is empty.

See [DOCKER.md](DOCKER.md) for the shorter Docker guide and [requirments.md](requirments.md) for the assessment specification.
