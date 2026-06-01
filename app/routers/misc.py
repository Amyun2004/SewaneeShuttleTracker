"""Stops, route detail, incidents, alerts."""
from fastapi import APIRouter, HTTPException
from sqlalchemy import select, text

from app.deps import AdminDep, CurrentUserDep, DBDep
from app.models import Alert, Incident, Route
from app.schemas import (
    AlertIn, IncidentIn, IncidentStatusIn, RouteDetail, RouteSummary, StopOut,
)

router = APIRouter()


@router.get("/stops", response_model=list[StopOut])
async def stops(db: DBDep):
    rows = (await db.execute(text("""
        SELECT stop_id, stop_name,
               latitude::float  AS latitude,
               longitude::float AS longitude,
               description
        FROM stops ORDER BY stop_name
    """))).mappings().all()
    return [dict(r) for r in rows]

@router.get("/routes", response_model=list[RouteSummary])
async def list_routes(db: DBDep):
    """All routes for the schedule page. Active routes only."""
    rows = await db.scalars(
        select(Route).where(Route.is_active.is_(True)).order_by(Route.route_name)
    )
    return [
        RouteSummary(
            route_id=r.route_id,
            route_name=r.route_name,
            description=r.description,
        )
        for r in rows
    ]
@router.get("/routes/{route_id}", response_model=RouteDetail)
async def route_detail(route_id: int, db: DBDep):
    route = (await db.execute(text("""
        SELECT route_id, route_name, description FROM routes
        WHERE route_id = :rid
    """), {"rid": route_id})).mappings().first()
    if not route:
        raise HTTPException(404, "Route not found")

    stops_rows = (await db.execute(text("""
        SELECT st.stop_id, st.stop_name,
               st.latitude::float  AS latitude,
               st.longitude::float AS longitude,
               st.description,
               rs.sequence_number, rs.expected_min_from_start
        FROM route_stops rs JOIN stops st ON st.stop_id = rs.stop_id
        WHERE rs.route_id = :rid
        ORDER BY rs.sequence_number
    """), {"rid": route_id})).mappings().all()

    return {**dict(route), "stops": [dict(s) for s in stops_rows]}


@router.post("/incidents", status_code=201)
async def create_incident(
    payload: IncidentIn, user: CurrentUserDep, db: DBDep
):
    db.add(Incident(
        reporter_id=user.user_id,
        category=payload.category,
        location=payload.location,
        description=payload.description,
    ))
    await db.commit()
    return {"ok": True}


@router.post("/incidents/{incident_id}/status")
async def update_incident_status(
    incident_id: int, payload: IncidentStatusIn,
    user: AdminDep, db: DBDep,
):
    inc = await db.scalar(
        select(Incident).where(Incident.incident_id == incident_id)
    )
    if not inc:
        raise HTTPException(404, "Incident not found")
    inc.status = payload.status
    await db.commit()
    return {"ok": True, "incident_id": incident_id, "status": payload.status}


@router.post("/alerts", status_code=201)
async def create_alert(payload: AlertIn, user: AdminDep, db: DBDep):
    db.add(Alert(
        title=payload.title,
        body=payload.body,
        severity=payload.severity,
        created_by=user.user_id,
        expires_at=payload.expires_at,
    ))
    await db.commit()
    return {"ok": True}

@router.get("/alerts")
async def list_alerts(db: DBDep):
    """Public list of active (non-expired) alerts, newest first."""
    rows = (await db.execute(text("""
        SELECT a.alert_id, a.title, a.body, a.severity,
               a.created_at, a.expires_at,
               u.full_name AS author_name
        FROM alerts a
        LEFT JOIN users u ON u.user_id = a.created_by
        WHERE a.expires_at IS NULL OR a.expires_at > now()
        ORDER BY a.created_at DESC
        LIMIT 20
    """))).mappings().all()
    return [dict(r) for r in rows]

@router.delete("/alerts/{alert_id}")
async def delete_alert(alert_id: int, user: AdminDep, db: DBDep):
    alert = await db.scalar(
        select(Alert).where(Alert.alert_id == alert_id)
    )
    if not alert:
        raise HTTPException(404, "Alert not found")
    await db.delete(alert)
    await db.commit()
    return {"ok": True}

