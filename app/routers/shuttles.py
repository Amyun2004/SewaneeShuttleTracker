"""Live shuttle queries. PostGIS does the geo math.

The nearest-shuttle query uses the <-> KNN operator + GiST index, which
means it stays fast as the fleet grows. The old Flask app looped over
every shuttle in Python; this is the same answer, indexed.
"""
from fastapi import APIRouter, Query
from sqlalchemy import text

from app.deps import DBDep
from app.schemas import LiveShuttle, NearestShuttle

router = APIRouter()

# DISTINCT ON gives us the most recent location row per shuttle in
# a single query — no correlated subquery needed.
LIVE_SQL = """
SELECT DISTINCT ON (s.shuttle_id)
    s.shuttle_id, s.shuttle_name, u.full_name AS driver,
    r.route_id, r.route_name,
    l.latitude::float  AS latitude,
    l.longitude::float AS longitude,
    l.speed_mph::float AS speed_mph,
    EXTRACT(EPOCH FROM (now() - l.recorded_at))::int AS seconds_ago
FROM shuttles s
JOIN trips t      ON t.shuttle_id = s.shuttle_id AND t.status = 'in_progress'
JOIN users u      ON u.user_id    = t.driver_id
JOIN routes r     ON r.route_id   = t.route_id
JOIN locations l  ON l.trip_id    = t.trip_id
ORDER BY s.shuttle_id, l.recorded_at DESC
"""


@router.get("/live", response_model=list[LiveShuttle])
async def live(db: DBDep):
    rows = (await db.execute(text(LIVE_SQL))).mappings().all()
    return [dict(r) for r in rows]


NEAREST_SQL = """
WITH latest AS (
    SELECT DISTINCT ON (t.shuttle_id)
        s.shuttle_id, s.shuttle_name, u.full_name AS driver,
        r.route_id, r.route_name,
        l.latitude::float  AS latitude,
        l.longitude::float AS longitude,
        l.speed_mph::float AS speed_mph,
        l.geom,
        EXTRACT(EPOCH FROM (now() - l.recorded_at))::int AS seconds_ago
    FROM shuttles s
    JOIN trips t      ON t.shuttle_id = s.shuttle_id AND t.status = 'in_progress'
    JOIN users u      ON u.user_id    = t.driver_id
    JOIN routes r     ON r.route_id   = t.route_id
    JOIN locations l  ON l.trip_id    = t.trip_id
    ORDER BY t.shuttle_id, l.recorded_at DESC
),
me AS (
    SELECT ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography AS geog
)
SELECT
    latest.shuttle_id, latest.shuttle_name, latest.driver,
    latest.route_id,   latest.route_name,
    latest.latitude,   latest.longitude,
    latest.speed_mph,  latest.seconds_ago,
    ST_Distance(latest.geom, me.geog)                          AS distance_m,
    degrees(ST_Azimuth(me.geog::geometry, latest.geom::geometry)) AS bearing
FROM latest, me
ORDER BY latest.geom <-> me.geog
LIMIT 1
"""


@router.get("/nearest", response_model=NearestShuttle | None)
async def nearest(
    db: DBDep,
    lat: float = Query(..., ge=-90,  le=90),
    lng: float = Query(..., ge=-180, le=180),
):
    row = (
        await db.execute(text(NEAREST_SQL), {"lat": lat, "lng": lng})
    ).mappings().first()
    if not row:
        return None

    distance_m = float(row["distance_m"])
    miles = distance_m / 1609.34
    speed = row["speed_mph"]
    eta = max(1, round(miles / speed * 60)) if (speed and speed > 1) else None

    return NearestShuttle(
        shuttle_id=row["shuttle_id"],
        shuttle_name=row["shuttle_name"],
        driver=row["driver"],
        route_id=row["route_id"],
        route_name=row["route_name"],
        latitude=row["latitude"],
        longitude=row["longitude"],
        speed_mph=speed,
        seconds_ago=row["seconds_ago"],
        distance_m=distance_m,
        distance_miles=round(miles, 2),
        distance_feet=round(distance_m * 3.28084),
        bearing=(float(row["bearing"]) + 360) % 360,
        walking_minutes=max(1, round(miles / 3 * 60)),
        shuttle_eta_minutes=eta,
    )