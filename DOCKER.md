# Docker Guide

## Setup

Run Docker Desktop with Linux containers (WSL 2 on Windows). Run commands from the project root.

If `.env` does not exist, copy `.env.example` to `.env`. Set:

```dotenv
API_PORT=8000
POSTGRES_USER=sales_app
POSTGRES_PASSWORD=YOUR_PASSWORD
POSTGRES_DB=sales_fine
DOCKER_DATABASE_URL=postgresql://sales_app:URL_ENCODED_PASSWORD@db:5432/sales_fine
```

Replace placeholders and keep the URL credentials consistent with the PostgreSQL settings. URL-encode special characters in URL credentials; single-quote `.env` values containing `$`. Do not commit `.env`.

Compose supplies the API's internal database and Redis URLs without changing your local connection settings.

## Start

```powershell
docker compose config --quiet
docker compose up -d --build --wait
```

Compose starts PostgreSQL and Redis. The API waits only for PostgreSQL readiness, then runs migrations, seeds, and the server. Redis connects asynchronously, so its unavailability does not prevent the API from starting. `--wait` still checks all started services. Existing migrations and product codes are skipped on subsequent starts.

API: **http://127.0.0.1:8000** (change `API_PORT` if needed).

Services communicate over an internal network using `db` and `redis` as hostnames. PostgreSQL data persists in the `postgres_data` volume; Redis caching is temporary.

## Verify

```powershell
curl.exe http://127.0.0.1:8000/health
curl.exe "http://127.0.0.1:8000/api/v1/products?page=1&limit=2"
```

In Postman, send `POST http://127.0.0.1:8000/api/v1/tickets` with a JSON body:

```json
{
  "ticket_number": 1001,
  "subject": "Docker verification",
  "description": "Created through the container API."
}
```

Expect `201` for creation, `409` for a duplicate number, and `400` for invalid fields.

Repeat the products request: API logs should show `MISS`, then `HIT`. Inspect the 120-second cache TTL:

```powershell
docker compose exec redis redis-cli TTL products:v2:page:1:limit:2
```

TTL decreases until expiration; `-2` means the key is absent. The next request fetches fresh data. Redis failures fall back to PostgreSQL.

Product prices are JSON numbers. The `v2` cache namespace prevents older string-price responses from being reused. On shutdown, the API drains active requests and closes connections, with a 10-second deadline and a 15-second Compose grace period.

For disposable real-service tests, see [TESTING.md](TESTING.md); do not run tests against this stack's persistent database.

## Common Commands

| Action | Command |
| --- | --- |
| View service health | `docker compose ps` |
| Follow API logs | `docker compose logs -f api` |
| Inspect recent logs | `docker compose logs --tail=100` |
| Stop services | `docker compose stop` |
| Start services again | `docker compose up -d --wait` |
| Rebuild after code changes | `docker compose up -d --build --wait` |
| Remove containers, keep database data | `docker compose down` |

`Ctrl+C` exits log streaming without stopping containers. **`docker compose down -v` deletes database storage.** PostgreSQL initialization settings apply only to an empty volume; changing `.env` does not update an existing database password.
