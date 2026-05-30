"""Pydantic v2 schemas: request/response validation.

These replace every hand-rolled regex and length check from the original
Flask app. FastAPI uses them automatically for:
  - input validation (rejects malformed requests with a 422)
  - response serialization (converts ORM objects to JSON)
  - OpenAPI/Swagger doc generation
"""
from datetime import datetime
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    field_validator,
)

# ---------------------------------------------------------------------------
# Reusable constrained types
# ---------------------------------------------------------------------------
# Same rule as the original USERNAME_RE: starts with a letter, ends with
# a digit, 4-32 chars, letters/digits/underscores only.
# (No look-ahead needed here — Pydantic v2 regex handles this fine.)
Username = Annotated[
    str,
    StringConstraints(pattern=r"^[A-Za-z][A-Za-z0-9_]{2,30}[0-9]$"),
]

Role         = Literal["rider", "driver", "admin"]
RegisterRole = Literal["student", "staff", "driver"]


def _validate_password(value: str) -> str:
    """At least 8 chars, contains at least one letter AND one digit.

    Done in Python instead of regex because Pydantic v2 uses Rust regex,
    which doesn't support look-ahead assertions.
    """
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters")
    if not any(c.isalpha() for c in value):
        raise ValueError("Password must contain at least one letter")
    if not any(c.isdigit() for c in value):
        raise ValueError("Password must contain at least one digit")
    return value


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class RegisterIn(BaseModel):
    username:   Username
    first_name: str = Field(min_length=1, max_length=48)
    last_name:  str = Field(min_length=1, max_length=48)
    email:      EmailStr
    password:   str
    role:       RegisterRole
    terms:      bool

    @field_validator("password")
    @classmethod
    def check_password(cls, v: str) -> str:
        return _validate_password(v)


class LoginIn(BaseModel):
    email:    EmailStr
    password: str
    mode:     Literal["rider", "staff"] = "rider"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id:     int
    username:    str
    email:       EmailStr
    full_name:   str
    active_role: Role
    all_roles:   list[Role]


# ---------------------------------------------------------------------------
# Trips + pings
# ---------------------------------------------------------------------------
class TripStartIn(BaseModel):
    route_id:   int
    shuttle_id: int


class TripOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    trip_id:    int
    status:     str
    route_id:   int
    shuttle_id: int
    start_time: datetime
    end_time:   datetime | None = None


class PingIn(BaseModel):
    latitude:  float = Field(ge=-90,  le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy:  float | None = Field(default=None, ge=0)
    speed:     float | None = Field(default=None, ge=0)


# ---------------------------------------------------------------------------
# Live shuttle data
# ---------------------------------------------------------------------------
class LiveShuttle(BaseModel):
    shuttle_id:   int
    shuttle_name: str
    driver:       str
    route_id:     int
    route_name:   str
    latitude:     float
    longitude:    float
    speed_mph:    float | None
    seconds_ago:  int


class NearestShuttle(LiveShuttle):
    distance_m:          float
    distance_miles:      float
    distance_feet:       int
    bearing:             float
    walking_minutes:     int
    shuttle_eta_minutes: int | None


# ---------------------------------------------------------------------------
# Routes + stops
# ---------------------------------------------------------------------------
class StopOut(BaseModel):
    stop_id:     int
    stop_name:   str
    latitude:    float
    longitude:   float
    description: str | None
    sequence_number:         int | None = None
    expected_min_from_start: int | None = None


class RouteDetail(BaseModel):
    route_id:    int
    route_name:  str
    description: str | None
    stops:       list[StopOut]


# ---------------------------------------------------------------------------
# Incidents + alerts
# ---------------------------------------------------------------------------
class IncidentIn(BaseModel):
    category:    Literal["shuttle", "stop", "driver", "safety", "other"]
    location:    str | None = None
    description: str = Field(min_length=10, max_length=1000)


class IncidentStatusIn(BaseModel):
    status: Literal["open", "reviewing", "resolved"]


class AlertIn(BaseModel):
    title:      str = Field(min_length=1, max_length=120)
    body:       str = Field(min_length=1, max_length=500)
    severity:   Literal["info", "warning", "critical"] = "info"
    expires_at: datetime | None = None