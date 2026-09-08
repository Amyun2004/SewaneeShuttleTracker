Open <http://localhost:5173>.

## Seeded accounts

The local seed script creates these accounts. Each account uses `Password1`.

| Username | Email | Roles |
| --- | --- | --- |
| `jsmith1` | `jsmith@sewanee.edu` | rider |
| `mpatel2` | `mpatel@sewanee.edu` | rider |
| `pgarcia5` | `pgarcia@sewanee.edu` | driver, rider |
| `admin0` | `admin@sewanee.edu` | admin, driver, rider |

These credentials are for local development only.

## API routes

### Authentication

- `POST /api/auth/register` creates an account and sets authentication cookies.
- `POST /api/auth/login` accepts `{email, password, mode}`, where `mode` is `rider` or `staff`.
- `POST /api/auth/refresh` rotates the access token using the refresh cookie.
- `POST /api/auth/logout` clears the authentication session.
- `GET /api/auth/me` returns the signed-in user.
- `POST /api/auth/switch-mode/{role}` changes the active role for a user with more than one role.

### Rider routes

- `GET /api/shuttles/live` returns each active shuttle's latest location.
- `GET /api/shuttles/nearest?lat&lng` returns the nearest shuttle with distance, bearing, and estimated arrival information.
- `GET /api/stops` returns the named shuttle stops.
- `GET /api/routes/{id}` returns a route and its ordered stops.

### Driver routes

- `POST /api/trips/start` starts a trip with a selected route and shuttle.
- `POST /api/trips/{id}/ping` stores a GPS sample and broadcasts it to `/ws/live`.
- `POST /api/trips/{id}/end` completes a trip.

### History and administration

- `GET /api/history?days&route_id&shuttle_id` returns past trips and their GPS traces.
- `GET /api/admin/dashboard` returns dashboard statistics, recent incidents, and alerts.
- `POST /api/incidents/{id}/status` updates an incident's status.
- `POST /api/alerts` publishes an alert.
- `DELETE /api/alerts/{id}` removes an alert.

### WebSocket route

- `WS /ws/live` sends shuttle-location events when drivers submit GPS updates.

## Project structure

```text
.
├── app/
│   ├── config.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── security.py
│   ├── deps.py
│   ├── ws_manager.py
│   ├── main.py
│   └── routers/
│       ├── auth.py
│       ├── trips.py
│       ├── shuttles.py
│       ├── history.py
│       ├── admin.py
│       ├── misc.py
│       └── ws.py
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── pages/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── migrations/
├── scripts/
├── alembic.ini
├── pyproject.toml
└── .env.example
```

## Changes from the original version

| Area | Original version | Current development version |
| --- | --- | --- |
| Backend | Flask with synchronous routes | FastAPI with asynchronous routes |
| Database | MySQL | PostgreSQL 16 with PostGIS 3.4 |
| Data access | Raw SQL through `mysql-connector` | SQLAlchemy 2 plus SQL for spatial operations |
| Nearest shuttle | Haversine calculations in a Python loop | PostGIS distance, bearing, and KNN ordering |
| Live updates | Five-second polling | WebSockets with an eight-second polling fallback |
| Password hashing | Werkzeug PBKDF2 | Argon2id |
| Authentication | Flask session cookie | JWT access and refresh tokens in HttpOnly cookies |
| Validation | Route-specific checks | Pydantic models and FastAPI parameter validation |
| Database changes | Hand-edited SQL file | Alembic migrations |
| API documentation | None | OpenAPI documentation at `/docs` |
| Frontend | Jinja2 templates | Vite, React, and TypeScript SPA on `phase-2-frontend` |

## Roadmap

- [x] Rewrite the backend with FastAPI, PostgreSQL/PostGIS, WebSockets, and JWT authentication.
- [x] Build the Vite, React, and TypeScript frontend.
- [ ] Merge `phase-2-frontend` into `main`.
- [ ] Add PWA support and push notifications.
- [ ] Add CI and expand the automated test coverage.
- [ ] Containerize the complete application and deploy it.

## License

Copyright 2026 Amyun Ghimire

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM, OUT OF, OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
