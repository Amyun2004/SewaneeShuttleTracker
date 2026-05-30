"""SQLAlchemy 2 ORM models. These define the schema; Alembic reads them
to generate migrations.

Notes on the geo columns:
  - `latitude` / `longitude` stay as Decimal for human readability and so
    existing client code keeps working.
  - `geom` is a PostGIS Geography(Point, 4326) — a separate column that
    PostGIS can index with GiST. All spatial queries (nearest, within,
    distance) go through `geom`, not the decimals.
"""
from datetime import datetime
from decimal import Decimal

from geoalchemy2 import Geography
from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Single declarative base. Alembic targets Base.metadata."""
    pass


# ---------------------------------------------------------------------------
# Users + roles
# ---------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    user_id:       Mapped[int]      = mapped_column(primary_key=True)
    username:      Mapped[str]      = mapped_column(String(32), unique=True)
    password_hash: Mapped[str]      = mapped_column(String(255))
    email:         Mapped[str]      = mapped_column(String(128), unique=True)
    full_name:     Mapped[str]      = mapped_column(String(96))
    created_at:    Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # `selectin` loads roles in a second query instead of a JOIN —
    # cheaper for the common case of one user with 1–3 roles.
    roles: Mapped[list["UserRole"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class UserRole(Base):
    __tablename__ = "user_roles"
    __table_args__ = (
        CheckConstraint(
            "role IN ('rider','driver','admin')",
            name="ck_user_roles_role",
        ),
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[str] = mapped_column(String(12), primary_key=True)
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped[User] = relationship(back_populates="roles")


# ---------------------------------------------------------------------------
# Fleet, routes, stops
# ---------------------------------------------------------------------------
class Shuttle(Base):
    __tablename__ = "shuttles"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active','maintenance','retired')",
            name="ck_shuttles_status",
        ),
    )

    shuttle_id:    Mapped[int] = mapped_column(primary_key=True)
    shuttle_name:  Mapped[str] = mapped_column(String(32), unique=True)
    license_plate: Mapped[str] = mapped_column(String(16), unique=True)
    capacity:      Mapped[int]
    status:        Mapped[str] = mapped_column(String(16))


class Route(Base):
    __tablename__ = "routes"

    route_id:    Mapped[int]        = mapped_column(primary_key=True)
    route_name:  Mapped[str]        = mapped_column(String(64), unique=True)
    description: Mapped[str | None] = mapped_column(String(255))
    is_active:   Mapped[bool]       = mapped_column(Boolean, default=True)

    stops: Mapped[list["RouteStop"]] = relationship(
        back_populates="route", order_by="RouteStop.sequence_number"
    )


class Stop(Base):
    __tablename__ = "stops"

    stop_id:     Mapped[int]        = mapped_column(primary_key=True)
    stop_name:   Mapped[str]        = mapped_column(String(96), unique=True)
    latitude:    Mapped[Decimal]    = mapped_column(Numeric(9, 6))
    longitude:   Mapped[Decimal]    = mapped_column(Numeric(9, 6))
    description: Mapped[str | None] = mapped_column(String(255))
    geom:        Mapped[str]        = mapped_column(
        Geography(geometry_type="POINT", srid=4326)
    )


class RouteStop(Base):
    __tablename__ = "route_stops"

    route_id: Mapped[int] = mapped_column(
        ForeignKey("routes.route_id"), primary_key=True
    )
    stop_id: Mapped[int] = mapped_column(
        ForeignKey("stops.stop_id"), primary_key=True
    )
    sequence_number:         Mapped[int]
    expected_min_from_start: Mapped[int]

    route: Mapped[Route] = relationship(back_populates="stops")
    stop:  Mapped[Stop]  = relationship()


# ---------------------------------------------------------------------------
# Trips + GPS pings
# ---------------------------------------------------------------------------
class Trip(Base):
    __tablename__ = "trips"
    __table_args__ = (
        CheckConstraint(
            "status IN ('in_progress','completed','cancelled')",
            name="ck_trips_status",
        ),
    )

    trip_id:    Mapped[int]              = mapped_column(primary_key=True)
    driver_id:  Mapped[int]              = mapped_column(ForeignKey("users.user_id"))
    shuttle_id: Mapped[int]              = mapped_column(ForeignKey("shuttles.shuttle_id"))
    route_id:   Mapped[int]              = mapped_column(ForeignKey("routes.route_id"))
    start_time: Mapped[datetime]         = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    end_time:   Mapped[datetime | None]  = mapped_column(DateTime(timezone=True))
    status:     Mapped[str]              = mapped_column(String(16))


class Location(Base):
    __tablename__ = "locations"

    location_id:     Mapped[int]            = mapped_column(BigInteger, primary_key=True)
    trip_id:         Mapped[int]            = mapped_column(ForeignKey("trips.trip_id"))
    latitude:        Mapped[Decimal]        = mapped_column(Numeric(9, 6))
    longitude:       Mapped[Decimal]        = mapped_column(Numeric(9, 6))
    accuracy_meters: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    speed_mph:       Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    recorded_at:     Mapped[datetime]       = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    geom: Mapped[str] = mapped_column(
        Geography(geometry_type="POINT", srid=4326)
    )


# ---------------------------------------------------------------------------
# Incidents + alerts
# ---------------------------------------------------------------------------
class Incident(Base):
    __tablename__ = "incidents"
    __table_args__ = (
        CheckConstraint(
            "status IN ('open','reviewing','resolved')",
            name="ck_incidents_status",
        ),
        CheckConstraint(
            "category IN ('shuttle','stop','driver','safety','other')",
            name="ck_incidents_category",
        ),
    )

    incident_id: Mapped[int]        = mapped_column(primary_key=True)
    reporter_id: Mapped[int]        = mapped_column(ForeignKey("users.user_id"))
    category:    Mapped[str]        = mapped_column(String(16))
    location:    Mapped[str | None] = mapped_column(String(128))
    description: Mapped[str]        = mapped_column(Text)
    status:      Mapped[str]        = mapped_column(String(16), default="open")
    created_at:  Mapped[datetime]   = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Alert(Base):
    __tablename__ = "alerts"
    __table_args__ = (
        CheckConstraint(
            "severity IN ('info','warning','critical')",
            name="ck_alerts_severity",
        ),
    )

    alert_id:   Mapped[int]              = mapped_column(primary_key=True)
    title:      Mapped[str]              = mapped_column(String(120))
    body:       Mapped[str]              = mapped_column(String(500))
    severity:   Mapped[str]              = mapped_column(String(12))
    created_by: Mapped[int]              = mapped_column(ForeignKey("users.user_id"))
    created_at: Mapped[datetime]         = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    expires_at: Mapped[datetime | None]  = mapped_column(DateTime(timezone=True))