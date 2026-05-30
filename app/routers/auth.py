"""Register, login, logout, refresh, me, switch-mode."""
from typing import Annotated

from fastapi import APIRouter, Cookie, HTTPException, Response, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.deps import CurrentUserDep, DBDep
from app.models import User, UserRole
from app.schemas import LoginIn, RegisterIn, UserOut
from app.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    needs_rehash,
    verify_password,
)

router = APIRouter()

# Maps the registration form's role choice to actual DB roles.
# "student" and "staff" both become "rider"; only role=driver gives
# driver privileges. Admin is granted manually, never via self-registration.
REGISTER_ROLE_MAP = {"student": "rider", "staff": "rider", "driver": "driver"}

# Login mode → which roles are acceptable.
LOGIN_MODE_ROLES = {"rider": {"rider"}, "staff": {"driver", "admin"}}


def _set_auth_cookies(resp: Response, user_id: int, active_role: str) -> None:
    """Issue access + refresh JWTs as HttpOnly cookies."""
    access  = create_access_token(user_id, active_role)
    refresh = create_refresh_token(user_id)
    common = dict(
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        domain=settings.cookie_domain or None,
        path="/",
    )
    resp.set_cookie(
        "access_token", access,
        max_age=settings.access_token_minutes * 60, **common,
    )
    resp.set_cookie(
        "refresh_token", refresh,
        max_age=settings.refresh_token_days * 24 * 3600, **common,
    )


def _clear_auth_cookies(resp: Response) -> None:
    for name in ("access_token", "refresh_token"):
        resp.delete_cookie(
            name, path="/", domain=settings.cookie_domain or None
        )


def _pick_active_role(roles: set[str]) -> str:
    """Pick the most privileged role the user has."""
    for candidate in ("admin", "driver", "rider"):
        if candidate in roles:
            return candidate
    raise HTTPException(status.HTTP_403_FORBIDDEN, "User has no valid role")


@router.post(
    "/register", response_model=UserOut, status_code=status.HTTP_201_CREATED
)
async def register(payload: RegisterIn, response: Response, db: DBDep):
    if not payload.terms:
        raise HTTPException(400, "You must agree to the Terms of Service.")

    existing = await db.scalar(
        select(User).where(
            or_(User.username == payload.username, User.email == payload.email)
        )
    )
    if existing:
        raise HTTPException(
            409, "That username or email is already registered."
        )

    primary_role = REGISTER_ROLE_MAP[payload.role]
    full_name = f"{payload.first_name} {payload.last_name}"

    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        email=payload.email.lower(),
        full_name=full_name,
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            409, "That username or email is already registered."
        )

    db.add(UserRole(user_id=user.user_id, role=primary_role))
    # Drivers also automatically get 'rider' so they can use the app
    # in student mode without registering twice.
    if primary_role == "driver":
        db.add(UserRole(user_id=user.user_id, role="rider"))
    await db.commit()
    await db.refresh(user)

    roles = {r.role for r in user.roles}
    _set_auth_cookies(response, user.user_id, primary_role)

    return UserOut(
        user_id=user.user_id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        active_role=primary_role,
        all_roles=sorted(roles),
    )


@router.post("/login", response_model=UserOut)
async def login(payload: LoginIn, response: Response, db: DBDep):
    user = await db.scalar(
        select(User).where(User.email == payload.email.lower())
    )
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password.")

    # Quietly upgrade old hashes on successful login.
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)
        await db.commit()

    roles = {r.role for r in user.roles}
    allowed = LOGIN_MODE_ROLES[payload.mode]
    matching = roles & allowed
    if not matching:
        msg = (
            "This account doesn't have driver or admin access."
            if payload.mode == "staff"
            else "This account doesn't have student/staff access."
        )
        raise HTTPException(403, msg)

    active_role = _pick_active_role(matching)
    _set_auth_cookies(response, user.user_id, active_role)

    return UserOut(
        user_id=user.user_id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        active_role=active_role,
        all_roles=sorted(roles),
    )


@router.post("/refresh")
async def refresh(
    response: Response,
    db: DBDep,
    refresh_token: Annotated[str | None, Cookie()] = None,
):
    """Rotate the access token using the refresh token cookie."""
    if not refresh_token:
        raise HTTPException(401, "No refresh token")
    payload = decode_token(refresh_token)
    if not payload or payload.get("typ") != "refresh":
        raise HTTPException(401, "Invalid refresh token")

    user_id = int(payload["sub"])
    roles = {
        r.role
        for r in await db.scalars(
            select(UserRole).where(UserRole.user_id == user_id)
        )
    }
    if not roles:
        raise HTTPException(401, "User has no roles")

    active_role = _pick_active_role(roles)
    _set_auth_cookies(response, user_id, active_role)
    return {"ok": True}


@router.post("/logout")
async def logout(response: Response):
    _clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUserDep):
    return UserOut(
        user_id=user.user_id,
        username=user.username,
        email="",  # not loaded; frontend usually has this cached
        full_name=user.full_name,
        active_role=user.active_role,
        all_roles=sorted(user.all_roles),
    )


@router.post("/switch-mode/{new_role}", response_model=UserOut)
async def switch_mode(
    new_role: str, response: Response, user: CurrentUserDep
):
    """For users with multiple roles, flip the active role."""
    if new_role not in user.all_roles:
        raise HTTPException(403, "You don't have access to that mode.")
    _set_auth_cookies(response, user.user_id, new_role)
    return UserOut(
        user_id=user.user_id,
        username=user.username,
        email="",
        full_name=user.full_name,
        active_role=new_role,
        all_roles=sorted(user.all_roles),
    )