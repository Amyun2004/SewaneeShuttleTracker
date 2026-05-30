# Sewanee Transit

A live shuttle-tracking web application for the University of the South.
Riders see every shuttle on the campus map in real time. Drivers stream
GPS pings from their phones. Admins manage routes, triage incidents, and
publish system alerts.

Originally built for CSCI 284 (Spring 2026) on Flask + MySQL. Currently
being modernized to a production-grade stack: FastAPI, PostgreSQL with
PostGIS, WebSockets, JWT auth, and a Vite + React + TypeScript frontend.

This branch (`phase-1-backend`) contains the rewritten API. The frontend
rewrite is tracked on `phase-2-frontend` (next).

---

## Stack

**Backend**
- Python 3.11+ with FastAPI (async, OpenAPI/Swagger auto-generated)
- SQLAlchemy 2 (async ORM) with `asyncpg`
- Alembic for schema migrations
- Pydantic v2 for request/response validation
- Argon2id for password hashing
- JWT (access + refresh) in HttpOnly cookies
- WebSockets for real-time shuttle pings

**Database**
- PostgreSQL 16 with PostGIS 3.4
- `geography(Point, 4326)` columns with GiST indexes for spatial queries
- `ST_Distance`, `ST_Azimuth`, and KNN (`<->`) operators do the geo math
  in SQL — no Haversine loops in Python

**Tooling**
- Docker for the local Postgres + PostGIS environment
- `pyproject.toml` (PEP 621) for dependencies
- `ruff` for linting, `pytest-asyncio` for tests

---

## Highlights

**Single-query nearest-shuttle.** The original Flask app pulled every
live shuttle from MySQL and looped over them in Python computing
Haversine distance. The rewrite does the entire calculation — distance,
bearing, K-nearest ordering — in one indexed PostGIS query that stays
fast as the fleet grows.

**Sub-second live tracking.** Drivers `POST /api/trips/{id}/ping` every
few seconds. The server inserts the location row and immediately
broadcasts the ping over WebSockets to every connected rider. Replaces
the 5-second polling loop in the original app.

**Defense-in-depth auth.** Argon2id (PHC winner) for password storage
with transparent rehash-on-login when parameters get upgraded. JWT
access tokens (15 min) and refresh tokens (7 days) are stored as
HttpOnly cookies, so they're invisible to XSS and work for WebSocket
authentication. Role checks happen via dependency injection — every
protected route declares its required role at the function signature.

**Schema, not strings.** Every endpoint validates input through a
Pydantic schema; FastAPI rejects malformed payloads with a structured
422 before any route code runs. Replaces hand-rolled regex/length checks
sprinkled through the old Flask views.

---

## Running locally

### 1. Start Postgres + PostGIS

```bash
docker run -d --name sewanee-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  postgis/postgis:16-3.4
docker exec sewanee-pg psql -U postgres -c "CREATE DATABASE sewanee_transit;"
```

### 2. Install Python deps

```bash
python -m venv .venv
.venv\Scripts\Activate.ps1     # Windows
# source .venv/bin/activate    # macOS / Linux
pip install -e ".[dev]"
```

### 3. Configure environment

```bash
cp .env.example .env
# Generate a JWT secret:
python -c "import secrets; print(secrets.token_hex(32))"
# Paste it into .env as JWT_SECRET
```

### 4. Migrate and seed

```bash
alembic upgrade head
python -m scripts.seed
```

### 5. Run

```bash
uvicorn app.main:app --reload
```

Open <http://localhost:8000/docs> for Swagger UI.

---

## Test accounts

All seeded accounts use the password `Password1`.

| Username  | Email                | Roles                   |
|-----------|----------------------|-------------------------|
| jsmith1   | jsmith@sewanee.edu   | rider                   |
| mpatel2   | mpatel@sewanee.edu   | rider                   |
| pgarcia5  | pgarcia@sewanee.edu  | driver, rider           |
| admin0    | admin@sewanee.edu    | admin, driver, rider    |

---

## API surface

Auth
- `POST /api/auth/register` — create account, sets auth cookies
- `POST /api/auth/login` — `{email, password, mode}` where `mode` is `rider` or `staff`
- `POST /api/auth/refresh` — rotate access token via refresh cookie
- `POST /api/auth/logout`
- `GET  /api/auth/me`
- `POST /api/auth/switch-mode/{role}` — for users with multiple roles

Shuttles (rider-facing)
- `GET  /api/shuttles/live` — every live shuttle with most recent ping
- `GET  /api/shuttles/nearest?lat&lng` — closest shuttle with distance, bearing, ETA
- `GET  /api/stops` — all named stops
- `GET  /api/routes/{id}` — route metadata plus ordered stops

Trips (driver-facing)
- `POST /api/trips/start` — begin a trip on a route + shuttle
- `POST /api/trips/{id}/ping` — push a GPS sample; broadcasts to `/ws/live`
- `POST /api/trips/{id}/end` — complete the trip

History
- `GET  /api/history?days&route_id&shuttle_id` — past trips with GPS traces

Admin
- `GET  /api/admin/dashboard` — aggregate stats, top driver, weekend stops,
  route efficiency, recent incidents, alerts
- `POST /api/incidents/{id}/status` — triage an incident
- `POST /api/alerts` / `DELETE /api/alerts/{id}` — publish/remove alerts

Real-time
- `WS   /ws/live` — JSON ping events as drivers update position

---

## Project layout
.
├── app/
│   ├── config.py         # pydantic-settings, reads .env
│   ├── database.py       # async engine + session factory
│   ├── models.py         # SQLAlchemy 2 ORM (10 tables, PostGIS)
│   ├── schemas.py        # Pydantic v2 request/response schemas
│   ├── security.py       # Argon2 + JWT helpers
│   ├── deps.py           # CurrentUser / Driver / Admin dependencies
│   ├── ws_manager.py     # WebSocket fan-out
│   ├── main.py           # FastAPI app + router wiring
│   └── routers/
│       ├── auth.py
│       ├── trips.py
│       ├── shuttles.py
│       ├── history.py
│       ├── admin.py
│       ├── misc.py       # stops, routes, incidents, alerts
│       └── ws.py
├── migrations/
│   ├── env.py
│   └── versions/0001_initial.py
├── scripts/
│   └── seed.py           # mock users, routes, stops, trips, live ping
├── pyproject.toml
├── alembic.ini
└── .env.example

---

## What changed from the original

| Concern              | Original                          | Now                                                      |
|----------------------|-----------------------------------|----------------------------------------------------------|
| Web framework        | Flask, sync                       | FastAPI, async                                           |
| Database             | MySQL                             | PostgreSQL 16 + PostGIS 3.4                              |
| ORM / queries        | Raw SQL via `mysql-connector`     | SQLAlchemy 2 async, raw SQL for spatial queries          |
| Nearest-shuttle      | Python loop over Haversine        | PostGIS `ST_Distance` + GiST index, single query         |
| Live updates         | 5-second polling                  | WebSockets, pushed instantly                             |
| Password hashing     | werkzeug pbkdf2                   | Argon2id                                                 |
| Sessions             | Flask server-side cookie          | JWT (access + refresh) in HttpOnly cookies               |
| Input validation     | Hand-rolled regex per view        | Pydantic schemas, automatic 422 on bad input             |
| Schema management    | Hand-edited `db-build.sql`        | Alembic migrations                                       |
| API documentation    | None                              | OpenAPI / Swagger UI at `/docs`                          |
| Templates            | Jinja2 server-rendered            | (Phase 2 — Vite + React + TypeScript SPA)                |

---

## Roadmap

- [x] **Phase 1** — Backend rewrite (FastAPI, PostGIS, WebSockets, JWT)
- [ ] **Phase 2** — Vite + React + TypeScript frontend with PWA + push notifications
- [ ] **Phase 3** — Containerize, GitHub Actions CI, deploy to Fly.io / Railway,
       Sentry error tracking

---


## The MIT License
Copyright 2026 Amyun Ghimire

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
