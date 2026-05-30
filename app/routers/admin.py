"""Admin dashboard. The five rubric queries, ported to PostgreSQL."""
from fastapi import APIRouter
from sqlalchemy import text

from app.deps import AdminDep, DBDep

router = APIRouter()


@router.get("/dashboard")
async def dashboard(user: AdminDep, db: DBDep):
    stats = (await db.execute(text("""
        SELECT
          (SELECT COUNT(*) FROM trips
             WHERE status='completed' AND start_time >= '2026-01-15')   AS total_trips,
          (SELECT COUNT(DISTINCT driver_id) FROM trips
             WHERE status='completed' AND start_time >= '2026-01-15')   AS active_drivers,
          (SELECT COUNT(*) FROM user_roles WHERE role='driver')         AS registered_drivers,
          (SELECT COUNT(*) FROM incidents  WHERE status='open')         AS open_incidents
    """))).mappings().first()

    ontime = (await db.execute(text("""
        SELECT COUNT(*) AS total,
               SUM(CASE
                 WHEN EXTRACT(EPOCH FROM (t.end_time - t.start_time))/60
                      <= sched.scheduled_minutes + 5
                 THEN 1 ELSE 0 END) AS on_time
        FROM trips t
        JOIN (SELECT route_id, MAX(expected_min_from_start) AS scheduled_minutes
              FROM route_stops GROUP BY route_id) sched
              ON sched.route_id = t.route_id
        WHERE t.status = 'completed'
          AND t.start_time >= now() - interval '7 days'
    """))).mappings().first()
    ontime_rate = (
        round(100 * ontime["on_time"] / ontime["total"])
        if ontime["total"] else None
    )

    top_driver = (await db.execute(text("""
        SELECT u.full_name AS driver,
               ROUND((SUM(EXTRACT(EPOCH FROM (t.end_time - t.start_time)))/3600)::numeric, 2)
                                                            AS total_hours,
               COUNT(*)                                     AS trip_count
        FROM users u JOIN trips t ON t.driver_id = u.user_id
        WHERE t.status = 'completed' AND t.start_time >= '2026-01-15'
        GROUP BY u.user_id, u.full_name
        ORDER BY total_hours DESC LIMIT 1
    """))).mappings().first()

    all_drivers_ranked = (await db.execute(text("""
        SELECT u.full_name AS driver,
               ROUND((SUM(EXTRACT(EPOCH FROM (t.end_time - t.start_time)))/3600)::numeric, 2)
                                                            AS total_hours
        FROM users u JOIN trips t ON t.driver_id = u.user_id
        WHERE t.status = 'completed' AND t.start_time >= '2026-01-15'
        GROUP BY u.user_id, u.full_name
        ORDER BY total_hours DESC LIMIT 5
    """))).mappings().all()

    weekend_stops = (await db.execute(text("""
        SELECT st.stop_name, COUNT(*) AS visits
        FROM trips t
        JOIN routes r       ON r.route_id  = t.route_id
        JOIN route_stops rs ON rs.route_id = r.route_id
        JOIN stops st       ON st.stop_id  = rs.stop_id
        WHERE
          (EXTRACT(DOW FROM t.start_time) = 5 AND EXTRACT(HOUR FROM t.start_time) >= 22)
       OR (EXTRACT(DOW FROM t.start_time) = 6)
       OR (EXTRACT(DOW FROM t.start_time) = 0 AND EXTRACT(HOUR FROM t.start_time) < 2)
        GROUP BY st.stop_id, st.stop_name
        ORDER BY visits DESC, st.stop_name
        LIMIT 5
    """))).mappings().all()

    route_efficiency = (await db.execute(text("""
        SELECT r.route_name,
               actual.avg_actual_minutes,
               sched.scheduled_minutes,
               ROUND((actual.avg_actual_minutes - sched.scheduled_minutes)::numeric, 2)
                                                        AS minutes_over_schedule
        FROM routes r
        LEFT JOIN (
          SELECT t.route_id,
                 ROUND((AVG(EXTRACT(EPOCH FROM (t.end_time - t.start_time)))/60)::numeric, 2)
                                                        AS avg_actual_minutes
          FROM trips t WHERE t.status = 'completed' GROUP BY t.route_id
        ) actual ON actual.route_id = r.route_id
        LEFT JOIN (
          SELECT rs.route_id, MAX(rs.expected_min_from_start) AS scheduled_minutes
          FROM route_stops rs GROUP BY rs.route_id
        ) sched ON sched.route_id = r.route_id
        ORDER BY r.route_name
    """))).mappings().all()

    new_drivers = (await db.execute(text("""
        SELECT u.username, u.full_name, u.email, u.created_at,
               COUNT(t.trip_id) AS trip_count
        FROM users u
        JOIN user_roles ur ON ur.user_id = u.user_id AND ur.role = 'driver'
        LEFT JOIN trips t  ON t.driver_id = u.user_id AND t.start_time >= u.created_at
        WHERE u.created_at >= now() - interval '14 days'
          AND u.username ~ '^[A-Za-z].*[0-9]$'
        GROUP BY u.user_id, u.username, u.full_name, u.email, u.created_at
        ORDER BY u.created_at DESC
    """))).mappings().all()

    incidents = (await db.execute(text("""
        SELECT i.incident_id, i.category, i.location, i.description,
               i.status, i.created_at,
               u.username AS reporter_username, u.full_name AS reporter_name
        FROM incidents i JOIN users u ON u.user_id = i.reporter_id
        ORDER BY
          CASE i.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END,
          i.created_at DESC
        LIMIT 25
    """))).mappings().all()

    alerts = (await db.execute(text("""
        SELECT a.alert_id, a.title, a.body, a.severity,
               a.created_at, a.expires_at,
               u.full_name AS author_name,
               (a.expires_at IS NULL OR a.expires_at >= now()) AS is_active
        FROM alerts a JOIN users u ON u.user_id = a.created_by
        ORDER BY is_active DESC, a.created_at DESC
        LIMIT 25
    """))).mappings().all()

    recent_trips = (await db.execute(text("""
        SELECT t.trip_id, t.start_time, t.end_time,
               r.route_name, s.shuttle_name, u.full_name AS driver_name,
               EXTRACT(EPOCH FROM (t.end_time - t.start_time))/60 AS duration_min,
               sched.scheduled_minutes,
               CASE WHEN EXTRACT(EPOCH FROM (t.end_time - t.start_time))/60
                          <= sched.scheduled_minutes + 5
                    THEN 'on_time' ELSE 'delayed' END AS punctuality
        FROM trips t
        JOIN routes r   ON r.route_id   = t.route_id
        JOIN shuttles s ON s.shuttle_id = t.shuttle_id
        JOIN users u    ON u.user_id    = t.driver_id
        LEFT JOIN (SELECT route_id, MAX(expected_min_from_start) AS scheduled_minutes
                   FROM route_stops GROUP BY route_id) sched
               ON sched.route_id = t.route_id
        WHERE t.status = 'completed'
        ORDER BY t.end_time DESC LIMIT 8
    """))).mappings().all()

    return {
        "stats":              dict(stats),
        "ontime_rate":        ontime_rate,
        "top_driver":         dict(top_driver) if top_driver else None,
        "all_drivers_ranked": [dict(r) for r in all_drivers_ranked],
        "weekend_stops":      [dict(r) for r in weekend_stops],
        "route_efficiency":   [dict(r) for r in route_efficiency],
        "new_drivers":        [dict(r) for r in new_drivers],
        "incidents":          [dict(r) for r in incidents],
        "alerts":             [dict(r) for r in alerts],
        "recent_trips":       [dict(r) for r in recent_trips],
    }

