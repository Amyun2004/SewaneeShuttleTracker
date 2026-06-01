"""Past-trip queries: GPS traces, filterable by date/route/shuttle."""
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import text

from app.deps import DBDep

router = APIRouter()

TRIPS_SQL = """
SELECT t.trip_id, t.start_time, t.end_time,
       r.route_id, r.route_name,
       s.shuttle_id, s.shuttle_name,
       u.full_name AS driver_name,
       EXTRACT(EPOCH FROM (t.end_time - t.start_time))::int / 60 AS duration_min
FROM trips t
JOIN routes   r ON r.route_id   = t.route_id
JOIN shuttles s ON s.shuttle_id = t.shuttle_id
JOIN users    u ON u.user_id    = t.driver_id
WHERE t.status = 'completed'
  AND t.start_time >= now() - (:days || ' days')::interval
  AND (CAST(:route_id   AS INT) IS NULL OR t.route_id   = :route_id)
  AND (CAST(:shuttle_id AS INT) IS NULL OR t.shuttle_id = :shuttle_id)
ORDER BY t.start_time DESC
"""

LOCS_SQL = """
SELECT trip_id, latitude::float AS lat, longitude::float AS lng, recorded_at
FROM locations
WHERE trip_id = ANY(:trip_ids)
ORDER BY trip_id, recorded_at
"""


@router.get("")
async def history(
    db: DBDep,
    days: Annotated[int, Query(ge=1, le=30)] = 7,
    route_id:   int | None = None,
    shuttle_id: int | None = None,
):
    trips_rows = (await db.execute(text(TRIPS_SQL), {
        "days": str(days), "route_id": route_id, "shuttle_id": shuttle_id,
    })).mappings().all()

    trips = [dict(t) for t in trips_rows]
    trip_ids = [t["trip_id"] for t in trips]

    by_trip: dict[int, list[list[float]]] = {tid: [] for tid in trip_ids}
    if trip_ids:
        loc_rows = (await db.execute(
            text(LOCS_SQL), {"trip_ids": trip_ids}
        )).mappings().all()
        for l in loc_rows:
            by_trip[l["trip_id"]].append([l["lat"], l["lng"]])

    for t in trips:
        t["path"] = by_trip.get(t["trip_id"], [])
        for k in ("start_time", "end_time"):
            v = t.get(k)
            t[k] = v.isoformat() if isinstance(v, datetime) else v

    routes = (await db.execute(text(
        "SELECT route_id, route_name FROM routes "
        "WHERE is_active = true ORDER BY route_name"
    ))).mappings().all()
    shuttles = (await db.execute(text(
        "SELECT shuttle_id, shuttle_name FROM shuttles "
        "WHERE status = 'active' ORDER BY shuttle_name"
    ))).mappings().all()

    return {
        "trips":    trips,
        "routes":   [dict(r) for r in routes],
        "shuttles": [dict(s) for s in shuttles],
        "days":     days,
    }
