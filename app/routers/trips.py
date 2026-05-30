"""Driver trip lifecycle + GPS pings."""
from fastapi import APIRouter, HTTPException
from sqlalchemy import select, text

from app.deps import DBDep, DriverDep
from app.models import Trip
from app.schemas import PingIn, TripOut, TripStartIn
from app.ws_manager import manager

router = APIRouter()


@router.post("/start", response_model=TripOut, status_code=201)
async def start(payload: TripStartIn, user: DriverDep, db: DBDep):
    existing = await db.scalar(
        select(Trip).where(
            Trip.driver_id == user.user_id, Trip.status == "in_progress"
        )
    )
    if existing:
        raise HTTPException(
            409, f"You already have an active trip (#{existing.trip_id})"
        )

    trip = Trip(
        driver_id=user.user_id,
        shuttle_id=payload.shuttle_id,
        route_id=payload.route_id,
        status="in_progress",
    )
    db.add(trip)
    await db.commit()
    await db.refresh(trip)
    return trip


@router.post("/{trip_id}/end", response_model=TripOut)
async def end(trip_id: int, user: DriverDep, db: DBDep):
    trip = await db.scalar(
        select(Trip).where(
            Trip.trip_id == trip_id,
            Trip.driver_id == user.user_id,
            Trip.status == "in_progress",
        )
    )
    if not trip:
        raise HTTPException(404, "Trip not found or not yours")

    await db.execute(
        text(
            "UPDATE trips SET end_time = now(), status = 'completed' "
            "WHERE trip_id = :tid"
        ),
        {"tid": trip_id},
    )
    await db.commit()
    await db.refresh(trip)
    return trip


@router.post("/{trip_id}/ping")
async def ping(trip_id: int, payload: PingIn, user: DriverDep, db: DBDep):
    """Driver phone posts here every few seconds.

    Inserts a location row with a PostGIS geography point, then
    broadcasts the ping to every connected rider WebSocket.
    """
    trip = await db.scalar(
        select(Trip).where(
            Trip.trip_id == trip_id,
            Trip.driver_id == user.user_id,
            Trip.status == "in_progress",
        )
    )
    if not trip:
        raise HTTPException(404, "Trip not found or not active")

    await db.execute(
        text("""
            INSERT INTO locations
                (trip_id, latitude, longitude, accuracy_meters, speed_mph,
                 recorded_at, geom)
            VALUES
                (:tid, :lat, :lng, :acc, :spd, now(),
                 ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography)
        """),
        {
            "tid": trip_id,
            "lat": payload.latitude,
            "lng": payload.longitude,
            "acc": payload.accuracy,
            "spd": payload.speed,
        },
    )
    await db.commit()

    await manager.broadcast({
        "type":       "ping",
        "trip_id":    trip_id,
        "shuttle_id": trip.shuttle_id,
        "route_id":   trip.route_id,
        "latitude":   payload.latitude,
        "longitude":  payload.longitude,
        "speed_mph":  payload.speed,
    })
    return {"status": "ok"}