# Sewanee Transit

Sewanee Transit is a campus shuttle-tracking application built for the University of the South. The rider view shows active shuttles on a Leaflet map. Drivers can start trips and send GPS updates from their phones, while administrators can review system activity, update incident reports, and publish alerts.

The project began in CSCI 284 in Spring 2026 using Flask and MySQL. I later rewrote the backend with FastAPI and PostgreSQL/PostGIS, then built a Vite, React, and TypeScript frontend.

## Current status

The `main` branch contains the rewritten backend. The React frontend is implemented on the `phase-2-frontend` branch and has not yet been merged into `main`. The application currently runs locally and has not been deployed for public use.

## Technology

### Backend

- Python 3.11 and FastAPI
- SQLAlchemy 2 with `asyncpg`
- Pydantic v2 request and response models
- Alembic database migrations
- Argon2id password hashing
- JWT access and refresh tokens stored in HttpOnly cookies
- WebSockets for live shuttle-location updates

### Frontend

- Vite, React, and TypeScript
- React Leaflet and Leaflet for the campus map
- TanStack Query for server-state requests
- React Router
- Tailwind CSS

### Database and development tools

- PostgreSQL 16 with PostGIS 3.4
- `geography(Point, 4326)` columns for stops and shuttle locations
- GiST indexes on the geographic columns
- PostGIS `ST_Distance`, `ST_Azimuth`, and KNN (`<->`) operations
- Docker for the local PostgreSQL/PostGIS environment
- `ruff`, `pytest`, and `pytest-asyncio`

## How it works

### Nearest-shuttle calculation

The original Flask version loaded active shuttle locations from MySQL and calculated Haversine distance in Python. The current backend performs the geographic work in PostgreSQL. The nearest-shuttle endpoint uses PostGIS to calculate distance and bearing and orders shuttle locations with the KNN operator. The `locations.geom` column also has a GiST index. Estimated arrival time is calculated separately from the shuttle's reported speed.

### Live location updates

A driver sends GPS samples to `POST /api/trips/{id}/ping`. The backend stores each sample as a PostGIS geography point and broadcasts it to clients connected to `/ws/live`.

The rider interface first loads active shuttles through the REST API, then listens for WebSocket events. If the socket disconnects, the frontend polls `/api/shuttles/live` every eight seconds and tries to reconnect every five seconds.

### Authentication and validation

Passwords are hashed with Argon2id. Access and refresh tokens are stored in HttpOnly cookies, which prevents frontend JavaScript from reading them directly. Protected routes use FastAPI dependencies to check rider, driver, and administrator roles.

Request bodies use Pydantic models. FastAPI returns a structured validation response when a request does not match the expected schema, and coordinate query parameters are limited to valid latitude and longitude ranges.

## Run the project locally

### 1. Start PostgreSQL and PostGIS

```bash
docker run -d --name sewanee-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  postgis/postgis:16-3.4

docker exec sewanee-pg psql -U postgres -c "CREATE DATABASE sewanee_transit;"
```

### 2. Set up the backend

```bash
python -m venv .venv
```

Activate the environment on Windows:

```powershell
.venv\Scripts\Activate.ps1
```

Or activate it on macOS or Linux:

```bash
source .venv/bin/activate
```

Install the dependencies:

```bash
pip install -e ".[dev]"
```

### 3. Configure the environment

Copy `.env.example` to `.env`, then generate a JWT secret:
