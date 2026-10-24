# Testing Guide

## Run the tests

From the project root, run:

```powershell
npm test
```

Jest runs the tests sequentially (`--runInBand`) and exits with a nonzero code if a test fails. You do not need to start the API, PostgreSQL, Redis, or Docker. On a fresh checkout, run `npm ci` first; do not omit development dependencies when running tests.

Run one file:

```powershell
npm test -- tests/products.test.js
```

Run one named scenario and show individual results:

```powershell
npm test -- --verbose -t "stores the entire response"
```

## What are we testing?

Automated tests repeat checks you might otherwise perform in Postman. They help catch accidental behavior changes before you ship code.

- A **unit test** checks one small part in isolation, such as a cache helper.
- An **integration test** checks multiple parts working together.
- **Jest** discovers tests, checks expectations, provides mocks, and reports failures.
- **Supertest** sends HTTP requests to the exported Express app. It manages a temporary local listener; it does not use your running API or its configured port.
- A **mock** replaces a dependency with controlled behavior and records calls. It can return sample data or simulate a failure.

This suite contains application integration tests with mocked external dependencies:

```text
Supertest -> Express -> Routes -> Validation -> Controllers -> Services
                                                               |
                                        +----------------------+----------------+
                                        |                                       |
                                Mock repositories                  Real cache utility
                                                                                |
                                                                       Mock Redis client
```

The repositories and Redis connection module are replaced before the app loads. The real database connection module has a guard that throws if loaded. Tests do not load `.env`, connect to databases, run migrations, or modify development/production data.

These mocked tests prove that a cache miss calls the database-facing repository and that errors are handled correctly. They do not execute SQL or Redis commands. The separate real-service suite below covers persistence, constraints, and Redis expiration. The development Docker Compose stack is not a test database.

## Reading a test

Each test follows **Arrange -> Act -> Assert**:

```js
test('returns cached data', async () => {
  // Arrange: control the external dependency.
  redis.get.mockResolvedValue(JSON.stringify(cachedResponse));

  // Act: send a real HTTP request through Express.
  const response = await request(app).get('/api/v1/products');

  // Assert: check the result and the work that was skipped.
  expect(response.status).toBe(200);
  expect(response.body).toEqual(cachedResponse);
  expect(repository.findPage).not.toHaveBeenCalled();
});
```

| Syntax | Meaning |
| --- | --- |
| `describe('...', () => {})` | Groups related tests |
| `test('...', async () => {})` | Defines one scenario |
| `expect(actual).toBe(expected)` | Checks a primitive value, such as a status code |
| `expect(actual).toEqual(expected)` | Compares object or array contents |
| `jest.mock(path, factory)` | Replaces an imported module with the factory's result |
| `jest.fn()` | Creates a fake function that records its calls |
| `.mockResolvedValue(value)` | Makes an async mock return a value |
| `.mockRejectedValue(error)` | Makes an async mock fail |
| `.toHaveBeenCalledWith(...)` | Checks which arguments were passed |
| `.not.toHaveBeenCalled()` | Verifies work was skipped |
| `beforeEach(...)` | Sets up a fresh scenario before each test |
| `test.each(cases)` | Runs the same check separately for each input |
| `request(app)...expect(400)` | Supertest shorthand for checking the HTTP status |

`resetMocks` clears mock calls and implementations between tests; `restoreMocks` restores spied-on functions. Setup then supplies default Redis behavior and temporarily silences application logs. This prevents one test's simulated failure from affecting another.

## Product scenarios: 16 tests

| Scenario | What it checks and why |
| --- | --- |
| Cache miss | Correct JSON, numeric prices converted from PostgreSQL decimal strings, pagination, and both repository calls |
| TTL | The entire response is stored with `SET key JSON EX 120`; expiration is attached to the write |
| Cache hit | Cached content is returned; neither repository method nor `SET` is called, so the TTL is not refreshed |
| Expired key | A hit followed by a simulated miss fetches and caches fresh data without sleeping |
| Pagination | Page and limit determine the cache key, query offset, and response metadata |
| Empty catalog | Empty results produce an empty array and zero total pages |
| Redis disconnected | No Redis commands run; the repository still supplies a successful response |
| Redis read failure | A rejected `GET` does not break the API |
| Redis write failure | A rejected `SET` does not discard a successful database result |
| Malformed cached JSON | Invalid cached data is replaced using repository results |
| Invalid pagination (5 cases) | Zero/fractional pages, oversized/non-numeric limits, and repeated page parameters are rejected before external calls |
| Repository failure | Returns a generic `500` and does not cache an error |

The TTL test inspects the arguments sent to Redis. The expiration test controls what Redis returns. Neither depends on wall-clock timing or a real Redis server.

## Ticket scenarios: 27 tests

| Scenario | What it checks and why |
| --- | --- |
| Valid creation | Returns `201` and the repository's saved record |
| Extra fields | Client-supplied `id` or `admin` fields are not passed to the repository |
| Missing fields (3 cases) | Each required field is independently enforced |
| Invalid fields (16 cases) | Rejects zero, negative, fractional, string, oversized, or null ticket numbers; empty, whitespace-only, wrong-type, oversized subject, and null-character text inputs |
| Missing body | Rejects a request without a JSON object |
| Array body | Rejects arrays instead of objects |
| Malformed JSON | Returns a consistent JSON `400` response |
| Duplicate number | Simulated PostgreSQL code `23505` for `tickets_ticket_number_unique` becomes `409` |
| Different unique constraint | An unrelated constraint failure is not mislabeled as a duplicate ticket number |
| Unexpected database failure | Returns `500` without exposing database details |

Validation tests also check that no insert was attempted. Duplicate testing simulates PostgreSQL's error; it does not create duplicate rows in a real database.

## Understand results and failures

A successful run reports:

```text
Test Suites: 2 passed, 2 total
Tests:       43 passed, 43 total
```

A **suite** is one test file. `Snapshots: 0` is normal: these tests use explicit expectations rather than saved response snapshots.

For a failure, read the test name, then compare **Expected** and **Received**. For example, expected `409` but received `500` means the duplicate error was not translated as expected. Check the simulated error's `code` and `constraint`, then the ticket service and error middleware.

Run the failing test alone with `-t`. Decide whether application behavior is wrong or the expectation needs updating; do not simply change an expectation to make the result green. Remove a console spy temporarily if application logs would help debugging.

## Docker

Jest and Supertest are development dependencies. The API image uses `npm ci --omit=dev` and copies only runtime files. A separate `Dockerfile.test` installs testing dependencies for real-service tests.

## Real-service integration tests

Run the isolated stack (Docker Desktop must be running):

```powershell
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from tests
```

This builds the test runner, starts dedicated PostgreSQL and Redis services, waits for readiness, and runs the suite. The command returns the test runner's exit code and stops the stack when tests finish. Remove the stopped containers afterward:

```powershell
docker compose -f docker-compose.test.yml down
```

The stack has a separate project name, an internal network, memory-backed data directories, and no published ports or development volumes. No credentials from `.env` are used. PostgreSQL uses passwordless trust only inside this disposable test network. The setup guard checks test mode and exact test connection URLs before importing the app; running `npm run test:integration` directly from your normal shell intentionally fails before opening connections.

The 11 real-service tests cover:

1. Applying all migrations and rerunning seeds without duplicate products.
2. A real SQL fetch, numeric prices, response structure, and Redis TTL near 120 seconds.
3. A cache hit with no SQL queries and no TTL refresh.
4. Actual Redis key expiration followed by a fresh database read.
5. Real pagination queries.
6. PostgreSQL fallback after closing the Redis connection.
7. Persisting a ticket and rejecting its duplicate.
8. Concurrent submissions producing exactly one successful insert.
9. Invalid requests leaving the tickets table empty.
10. PostgreSQL check constraints enforcing positive numbers and non-empty text.
11. Starting the real server with an unreachable Redis port, serving products, and exiting cleanly on SIGTERM.

There are no mocked repositories or Redis methods in this suite. A Knex query listener records SQL for assertions without replacing execution. The expiration test shortens a test key's TTL to 1 millisecond and polls briefly for its disappearance; a separate test verifies that the application initially sets 120 seconds. This avoids a two-minute test while exercising real expiration.
