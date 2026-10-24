# Backend Technical Assessment: Node.js / Express API

## Overview

Build a modular RESTful API using Node.js, Express, and a SQL relational database, preferably PostgreSQL or MySQL, with Knex.js as the query builder and migration tool.

The solution must incorporate Redis caching, relational persistence, input validation, Docker containerization, and unit/integration testing.

> **Clarification needed:** The overview includes testing as a requirement, while the technical specifications and automated testing section label it as a bonus. Whether testing is mandatory or optional remains unspecified.

## Technical Specifications

### Technology Stack

| Component | Technology |
| --- | --- |
| Runtime and framework | Node.js and Express.js |
| Query builder and migrations | Knex.js |
| Relational database | PostgreSQL, MySQL, or SQLite; PostgreSQL or MySQL preferred |
| Caching | Redis |
| Containerization | Docker and Docker Compose for the app, database, and Redis |
| Testing (bonus) | Jest and Supertest |

## Core Requirements

### 1. Product Catalog API

**Endpoint:** `GET /api/v1/products`

#### Response Payload Attributes

| Attribute | Type | Description |
| --- | --- | --- |
| `product_code` | String | Unique product identifier |
| `product_title` | String | Product title |
| `product_price` | Decimal / Number | Product price |

#### Caching Strategy

- [ ] Implement the cache-aside pattern using Redis.
- [ ] On an initial request (cache miss), query the database and populate Redis.
- [ ] Set the cache time-to-live (TTL) to **120 seconds (2 minutes)**.
- [ ] Serve subsequent requests directly from the cache while the cached data remains valid.

### 2. Support Ticket Submission API

**Endpoint:** `POST /api/v1/tickets`

#### Request Body

| Field | Type | Validation |
| --- | --- | --- |
| `ticket_number` | Integer | Required and strictly unique |
| `subject` | String | Required and non-empty |
| `description` | Text / String | Required and non-empty |

#### Validation and Business Logic

- [ ] Return `201 Created` for successful ticket creation (specified in the test coverage requirements).
- [ ] Return `400 Bad Request` or `422 Unprocessable Entity` when mandatory fields are missing or invalid.
- [ ] Handle unique constraint conflicts on `ticket_number` with `409 Conflict`.

### 3. Containerization

- [ ] Provide a production-ready `Dockerfile` for the Express service.
- [ ] Supply a complete `docker-compose.yml` that orchestrates:
  - Express API.
  - Relational database: PostgreSQL or MySQL.
  - Redis instance.
- [ ] Ensure database migrations and seeds run cleanly during environment initialization.

### 4. Automated Testing (Bonus)

Implement automated feature/integration tests using **Jest and Supertest**.

#### Product Catalog Test Coverage

For `GET /api/v1/products`:

- [ ] Verify the response payload structure.
- [ ] Verify the initial database fetch on a cache miss.
- [ ] Verify Redis cache-hit behavior.
- [ ] Verify cache TTL behavior.

#### Support Ticket Test Coverage

For `POST /api/v1/tickets`:

- [ ] Verify successful creation returns `201 Created`.
- [ ] Verify field validation errors return `400` or `422`.
- [ ] Verify duplicate `ticket_number` values are rejected with `409 Conflict`.

## Evaluation Criteria

| Area | Expectations |
| --- | --- |
| Code architecture and clean code | Separation of concerns across controllers, services/repositories, routes, and middleware |
| Robust error handling | Global exception handling, standardized API error responses, and database transaction safety |
| Database and migration design | Idiomatic Knex migration files, proper indexing, and schema definition |
| Cache management | Clean key namespacing, resilience to connection errors, and correct TTL enforcement |
| Container orchestration | Reliable container boot sequence, health checks, and environment variable configuration |

## Submission Guidelines

1. Push the complete source code to a **public GitHub repository**.
2. Include a comprehensive `README.md` containing:
   - Setup instructions using `docker-compose up`.
   - An environment variable template (`.env.example`).
   - Steps to execute automated tests.
3. Reply with the repository URL.
