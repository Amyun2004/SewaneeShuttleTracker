"""FastAPI dependencies for auth.

Routes that need a user write:        user: CurrentUserDep
Routes that need a driver:            user: DriverDep
Routes that need an admin:            user: AdminDep

The dependency resolves the auth cookie, decodes the JWT, loads the user
from the DB, verifies the active role is still valid, and returns a
CurrentUser. On any failure it raises 401 or 403 with a clear message.
"""
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, UserRole
from app.security import decode_token


class CurrentUser:
    """Plain object so we don't expose ORM internals to route handlers."""

    def __init__(
        self,
        user_id: int,
        username: str,
        full_name: str,
        active_role: str,
        all_roles: set[str],
    ):
        self.user_id     = user_id
        self.username    = username
        self.full_name   = full_name
        self.active_role = active_role
        self.all_roles   = all_roles


DBDep = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    db: DBDep,
    access_token: Annotated[str | None, Cookie()] = None,
) -> CurrentUser:
    if not access_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")

    payload = decode_token(access_token)
    if not payload or payload.get("typ") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")

    user_id     = int(payload["sub"])
    active_role = payload["role"]

    user = await db.scalar(select(User).where(User.user_id == user_id))
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")

    roles = {
        r.role
        for r in await db.scalars(
            select(UserRole).where(UserRole.user_id == user_id)
        )
    }
    if active_role not in roles:
        # The role was revoked since the token was issued. Force re-login.
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Role no longer valid"
        )

    return CurrentUser(
        user_id=user.user_id,
        username=user.username,
        full_name=user.full_name,
        active_role=active_role,
        all_roles=roles,
    )


def require_roles(*allowed: str):
    """Factory that builds a dependency restricting to specific roles."""

    async def check(
        user: Annotated[CurrentUser, Depends(get_current_user)],
    ) -> CurrentUser:
        if user.active_role not in allowed:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Requires one of: {', '.join(allowed)}",
            )
        return user

    return check


# Convenience type aliases used throughout the routers.
CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]
DriverDep      = Annotated[CurrentUser, Depends(require_roles("driver"))]
AdminDep       = Annotated[CurrentUser, Depends(require_roles("admin"))]
