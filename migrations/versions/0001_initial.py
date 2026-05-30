"""Initial schema with PostGIS.

Revision ID: 0001
Revises:
Create Date: 2026-05-30
"""
from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geography

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "users",
        sa.Column("user_id", sa.Integer, primary_key=True),
        sa.Column("username", sa.String(32), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("email", sa.String(128), nullable=False, unique=True),
        sa.Column("full_name", sa.String(96), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "user_roles",
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.user_id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("role", sa.String(12), primary_key=True),
        sa.Column(
            "granted_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "role IN ('rider','driver','admin')", name="ck_user_roles_role"
        ),
    )
    op.create_index("idx_user_roles_role", "user_roles", ["role"])

    op.create_table(
        "shuttles",
        sa.Column("shuttle_id", sa.Integer, primary_key=True),
        sa.Column("shuttle_name", sa.String(32), nullable=False, unique=True),
        sa.Column("license_plate", sa.String(16), nullable=False, unique=True),
        sa.Column("capacity", sa.Integer, nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.CheckConstraint(
            "status IN ('active','maintenance','retired')",
            name="ck_shuttles_status",
        ),
    )

    op.create_table(
        "routes",
        sa.Column("route_id", sa.Integer, primary_key=True),
        sa.Column("route_name", sa.String(64), nullable=False, unique=True),
        sa.Column("description", sa.String(255)),
        sa.Column(
            "is_active", sa.Boolean, nullable=False, server_default=sa.text("true")
        ),
    )

    op.create_table(
        "stops",
        sa.Column("stop_id", sa.Integer, primary_key=True),
        sa.Column("stop_name", sa.String(96), nullable=False, unique=True),
        sa.Column("latitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("longitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("description", sa.String(255)),
        sa.Column(
            "geom",
            Geography(geometry_type="POINT", srid=4326,spatial_index=False),
            nullable=False,
        ),
    )
    op.create_index("idx_stops_geom", "stops", ["geom"], postgresql_using="gist")

    op.create_table(
        "route_stops",
        sa.Column(
            "route_id", sa.Integer, sa.ForeignKey("routes.route_id"), primary_key=True
        ),
        sa.Column(
            "stop_id", sa.Integer, sa.ForeignKey("stops.stop_id"), primary_key=True
        ),
        sa.Column("sequence_number", sa.Integer, nullable=False),
        sa.Column("expected_min_from_start", sa.Integer, nullable=False),
    )
    op.create_index("idx_route_stops_route", "route_stops", ["route_id"])

    op.create_table(
        "trips",
        sa.Column("trip_id", sa.Integer, primary_key=True),
        sa.Column(
            "driver_id", sa.Integer, sa.ForeignKey("users.user_id"), nullable=False
        ),
        sa.Column(
            "shuttle_id",
            sa.Integer,
            sa.ForeignKey("shuttles.shuttle_id"),
            nullable=False,
        ),
        sa.Column(
            "route_id", sa.Integer, sa.ForeignKey("routes.route_id"), nullable=False
        ),
        sa.Column(
            "start_time",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("end_time", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(16), nullable=False),
        sa.CheckConstraint(
            "status IN ('in_progress','completed','cancelled')",
            name="ck_trips_status",
        ),
    )
    op.create_index("idx_trips_driver", "trips", ["driver_id"])
    op.create_index("idx_trips_shuttle", "trips", ["shuttle_id"])
    op.create_index("idx_trips_route", "trips", ["route_id"])
    op.create_index("idx_trips_status", "trips", ["status"])
    op.create_index("idx_trips_start_time", "trips", ["start_time"])

    op.create_table(
        "locations",
        sa.Column("location_id", sa.BigInteger, primary_key=True),
        sa.Column(
            "trip_id", sa.Integer, sa.ForeignKey("trips.trip_id"), nullable=False
        ),
        sa.Column("latitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("longitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("accuracy_meters", sa.Numeric(6, 2)),
        sa.Column("speed_mph", sa.Numeric(5, 2)),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "geom",
            Geography(geometry_type="POINT", srid=4326, spatial_index=False),
            nullable=False,
        ),
    )
    op.create_index("idx_locations_trip", "locations", ["trip_id"])
    op.create_index("idx_locations_recorded", "locations", ["recorded_at"])
    op.create_index(
        "idx_locations_geom", "locations", ["geom"], postgresql_using="gist"
    )
    # Composite for "most recent ping per trip" queries
    op.create_index(
        "idx_locations_trip_recorded",
        "locations",
        ["trip_id", sa.text("recorded_at DESC")],
    )

    op.create_table(
        "incidents",
        sa.Column("incident_id", sa.Integer, primary_key=True),
        sa.Column(
            "reporter_id", sa.Integer, sa.ForeignKey("users.user_id"), nullable=False
        ),
        sa.Column("category", sa.String(16), nullable=False),
        sa.Column("location", sa.String(128)),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="open"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('open','reviewing','resolved')",
            name="ck_incidents_status",
        ),
        sa.CheckConstraint(
            "category IN ('shuttle','stop','driver','safety','other')",
            name="ck_incidents_category",
        ),
    )
    op.create_index("idx_incidents_status", "incidents", ["status"])

    op.create_table(
        "alerts",
        sa.Column("alert_id", sa.Integer, primary_key=True),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("body", sa.String(500), nullable=False),
        sa.Column("severity", sa.String(12), nullable=False),
        sa.Column(
            "created_by", sa.Integer, sa.ForeignKey("users.user_id"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint(
            "severity IN ('info','warning','critical')",
            name="ck_alerts_severity",
        ),
    )


def downgrade() -> None:
    op.drop_table("alerts")
    op.drop_table("incidents")
    op.drop_table("locations")
    op.drop_table("trips")
    op.drop_table("route_stops")
    op.drop_table("stops")
    op.drop_table("routes")
    op.drop_table("shuttles")
    op.drop_table("user_roles")
    op.drop_table("users")