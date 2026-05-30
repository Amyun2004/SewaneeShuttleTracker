"""Seed mock data into a freshly migrated database.

Run AFTER `alembic upgrade head`:

    python -m scripts.seed

Wipes everything first, so it's idempotent — safe to re-run any time
you want fresh demo data.
"""
import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from app.database import SessionLocal
from app.models import (
    Alert, Incident, Route, RouteStop, Shuttle, Trip, User, UserRole,
)
from app.security import hash_password


SEED_PASSWORD = "Password1"


async def seed():
    print("→ entered seed()", flush=True)
    async with SessionLocal() as db:
        print("→ session opened", flush=True)

        for tbl in (
            "alerts", "incidents", "locations", "trips",
            "route_stops", "stops", "routes", "shuttles",
            "user_roles", "users",
        ):
            print(f"  truncating {tbl}...", flush=True)
            await db.execute(text(
                f'TRUNCATE TABLE {tbl} RESTART IDENTITY CASCADE'
            ))
        await db.commit()
        print("→ truncate done", flush=True)

        pw = hash_password(SEED_PASSWORD)
        print("→ password hashed", flush=True)

        users = [
            User(username="jsmith1",  password_hash=pw,
                 email="jsmith@sewanee.edu",  full_name="Jordan Smith"),
            User(username="mpatel2",  password_hash=pw,
                 email="mpatel@sewanee.edu",  full_name="Maya Patel"),
            User(username="pgarcia5", password_hash=pw,
                 email="pgarcia@sewanee.edu", full_name="Paulo Garcia"),
            User(username="admin0",   password_hash=pw,
                 email="admin@sewanee.edu",   full_name="Amyun Ghimire"),
        ]
        db.add_all(users)
        await db.flush()
        print("→ users inserted", flush=True)

        role_assignments = [
            (users[0], "rider"),
            (users[1], "rider"),
            (users[2], "driver"), (users[2], "rider"),
            (users[3], "admin"),  (users[3], "driver"), (users[3], "rider"),
        ]
        for u, role in role_assignments:
            db.add(UserRole(user_id=u.user_id, role=role))
        await db.flush()
        print("→ roles inserted", flush=True)

        shuttles = [
            Shuttle(shuttle_name="Tiger-1", license_plate="TN-ABC123",
                    capacity=14, status="active"),
            Shuttle(shuttle_name="Tiger-2", license_plate="TN-XYZ789",
                    capacity=20, status="active"),
        ]
        db.add_all(shuttles)
        await db.flush()
        print("→ shuttles inserted", flush=True)

        routes = [
            Route(route_name="Daytime Loop",
                  description="Weekday daytime shuttle around central campus and residence halls.",
                  is_active=True),
            Route(route_name="Weekend Night Route",
                  description="Friday and Saturday evening route serving the Village and Shenanigans.",
                  is_active=True),
        ]
        db.add_all(routes)
        await db.flush()
        print("→ routes inserted", flush=True)

        stops_data = [
            ("McClurg Dining Hall", 35.205400, -85.922100, "Main dining hall, central campus."),
            ("duPont Library",      35.204800, -85.921500, "Library and study hub."),
            ("Hodson Hill",         35.203000, -85.925000, "Upperclass residence area."),
            ("Quintard Hall",       35.204200, -85.924000, "Residence hall near the Village."),
            ("Sewanee Inn",         35.206800, -85.920000, "Near the entrance to campus."),
            ("Sewanee Market",      35.207500, -85.919000, "Grocery in Sewanee Village."),
            ("Shenanigans",         35.207200, -85.918500, "Restaurant / bar in the Village."),
            ("Spencer Hall",        35.204500, -85.923200, "Science classroom building."),
        ]
        for name, lat, lng, desc in stops_data:
            await db.execute(text("""
                INSERT INTO stops (stop_name, latitude, longitude, description, geom)
                VALUES (
                    :n,
                    CAST(:lat AS numeric),
                    CAST(:lng AS numeric),
                    :d,
                    ST_SetSRID(
                        ST_MakePoint(CAST(:lng AS float8), CAST(:lat AS float8)),
                        4326
                    )::geography
                )
            """), {"n": name, "lat": lat, "lng": lng, "d": desc})
        await db.flush()
        print("→ stops inserted", flush=True)

        route_ids = {r.route_name: r.route_id for r in routes}
        stop_ids = dict((await db.execute(text(
            "SELECT stop_name, stop_id FROM stops"
        ))).all())

        route_stops_data = [
            ("Daytime Loop",        "McClurg Dining Hall", 1,  0),
            ("Daytime Loop",        "duPont Library",      2,  5),
            ("Daytime Loop",        "Spencer Hall",        3, 10),
            ("Daytime Loop",        "Quintard Hall",       4, 18),
            ("Daytime Loop",        "Hodson Hill",         5, 26),
            ("Weekend Night Route", "McClurg Dining Hall", 1,  0),
            ("Weekend Night Route", "Sewanee Inn",         2,  6),
            ("Weekend Night Route", "Sewanee Market",      3, 11),
            ("Weekend Night Route", "Shenanigans",         4, 15),
            ("Weekend Night Route", "Hodson Hill",         5, 22),
        ]
        for rname, sname, seq, mins in route_stops_data:
            db.add(RouteStop(
                route_id=route_ids[rname], stop_id=stop_ids[sname],
                sequence_number=seq, expected_min_from_start=mins,
            ))
        await db.flush()
        print("→ route_stops inserted", flush=True)

        pgarcia, admin = users[2], users[3]
        T1, T2 = pgarcia.user_id, admin.user_id
        S1, S2 = shuttles[0].shuttle_id, shuttles[1].shuttle_id
        R1 = route_ids["Daytime Loop"]
        R2 = route_ids["Weekend Night Route"]

        def dt(s: str) -> datetime:
            return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)

        completed_trips = [
            (T1, S1, R1, "2026-04-13T08:00:00", "2026-04-13T08:28:00"),
            (T1, S1, R1, "2026-04-13T09:00:00", "2026-04-13T09:30:00"),
            (T1, S1, R1, "2026-04-14T08:00:00", "2026-04-14T08:27:00"),
            (T2, S2, R1, "2026-04-15T08:05:00", "2026-04-15T08:35:00"),
            (T1, S1, R2, "2026-04-17T22:30:00", "2026-04-17T22:55:00"),
            (T1, S1, R2, "2026-04-17T23:15:00", "2026-04-17T23:40:00"),
            (T2, S2, R2, "2026-04-18T22:00:00", "2026-04-18T22:24:00"),
            (T2, S2, R2, "2026-04-18T23:00:00", "2026-04-18T23:26:00"),
        ]
        trip_objs = []
        for drv, sh, rt, start, end in completed_trips:
            t = Trip(driver_id=drv, shuttle_id=sh, route_id=rt,
                     start_time=dt(start), end_time=dt(end),
                     status="completed")
            trip_objs.append(t)
            db.add(t)

        live_trip = Trip(
            driver_id=T1, shuttle_id=S1, route_id=R1,
            start_time=datetime.now(timezone.utc) - timedelta(minutes=5),
            end_time=None, status="in_progress",
        )
        trip_objs.append(live_trip)
        db.add(live_trip)
        await db.flush()
        print("→ trips inserted", flush=True)

        history_locs = [
            (trip_objs[0].trip_id, 35.205400, -85.922100,  8.0, 12.0, "2026-04-13T08:00:05"),
            (trip_objs[0].trip_id, 35.204800, -85.921500,  8.0, 14.0, "2026-04-13T08:05:20"),
            (trip_objs[0].trip_id, 35.203000, -85.925000,  9.0, 10.0, "2026-04-13T08:26:40"),
            (trip_objs[4].trip_id, 35.205400, -85.922100,  7.0, 11.0, "2026-04-17T22:30:10"),
            (trip_objs[4].trip_id, 35.207200, -85.918500,  8.0, 13.0, "2026-04-17T22:45:30"),
        ]
        for tid, lat, lng, acc, spd, recorded in history_locs:
            recorded = dt(recorded)  
            await db.execute(text("""
                INSERT INTO locations
                    (trip_id, latitude, longitude, accuracy_meters, speed_mph,
                     recorded_at, geom)
                VALUES (
                    :tid,
                    CAST(:lat AS numeric),
                    CAST(:lng AS numeric),
                    :acc,
                    :spd,
                    :rec,
                    ST_SetSRID(
                        ST_MakePoint(CAST(:lng AS float8), CAST(:lat AS float8)),
                        4326
                    )::geography
                )
            """), {"tid": tid, "lat": lat, "lng": lng,
                   "acc": acc, "spd": spd, "rec": recorded})

        now = datetime.now(timezone.utc)
        live_locs = [
            (35.205400, -85.922100, 6.0, 10.0,  now - timedelta(minutes=4)),
            (35.204800, -85.921500, 6.5, 12.0,  now - timedelta(minutes=2)),
            (35.203500, -85.923800, 5.8, 11.5,  now - timedelta(seconds=30)),
        ]
        for lat, lng, acc, spd, recorded in live_locs:
            await db.execute(text("""
                INSERT INTO locations
                    (trip_id, latitude, longitude, accuracy_meters, speed_mph,
                     recorded_at, geom)
                VALUES (
                    :tid,
                    CAST(:lat AS numeric),
                    CAST(:lng AS numeric),
                    :acc,
                    :spd,
                    :rec,
                    ST_SetSRID(
                        ST_MakePoint(CAST(:lng AS float8), CAST(:lat AS float8)),
                        4326
                    )::geography
                )
            """), {"tid": live_trip.trip_id, "lat": lat, "lng": lng,
                   "acc": acc, "spd": spd, "rec": recorded})
        await db.flush()
        print("→ locations inserted", flush=True)

        db.add(Alert(
            title="Welcome to Sewanee Transit",
            body="Live tracking is now available. Tap a shuttle on the map for ETAs.",
            severity="info", created_by=admin.user_id,
        ))
        db.add(Incident(
            reporter_id=users[0].user_id, category="stop",
            location="duPont Library",
            description="Sign at duPont stop is loose and spinning in the wind.",
            status="open",
        ))

        await db.commit()
        print(f"✓ Seeded. All accounts use password: {SEED_PASSWORD}", flush=True)


def _main():
    print("→ _main starting", flush=True)
    try:
        asyncio.run(seed())
    except Exception as e:
        import traceback
        print(f"✗ Seeding failed: {type(e).__name__}: {e}", flush=True)
        traceback.print_exc()
        raise
    print("→ _main done", flush=True)


if __name__ == "__main__":
    _main()