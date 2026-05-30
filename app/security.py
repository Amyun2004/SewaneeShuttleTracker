"""Password hashing (Argon2id) and JWT helpers.

Argon2id is the modern default for password storage — winner of the
Password Hashing Competition, memory-hard so GPU attacks are expensive,
and the underlying library handles salting and parameters for us.

JWTs are signed with HS256 using the secret in .env. Two token types:
  - access  (15 min, short-lived, sent on every request)
  - refresh (7 days, used only to mint new access tokens)
Both ride in HttpOnly cookies — see app/routers/auth.py.
"""
from datetime import datetime, timedelta, timezone
from typing import Any

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from jose import JWTError, jwt

from app.config import settings

_hasher = PasswordHasher()


# ---------------------------------------------------------------------------
# Passwords
# ---------------------------------------------------------------------------
def hash_password(plain: str) -> str:
    """One-way hash. Output already contains the salt and parameters."""
    return _hasher.hash(plain)


def verify_password(plain: str, stored_hash: str) -> bool:
    """Constant-time compare. Returns False on any failure (incl. bad hash)."""
    try:
        _hasher.verify(stored_hash, plain)
        return True
    except VerifyMismatchError:
        return False
    except Exception:
        # Malformed hash, wrong algorithm, etc. Treat as a failed verify.
        return False


def needs_rehash(stored_hash: str) -> bool:
    """True if Argon2 parameters have been upgraded since this hash was made.

    Lets us transparently re-hash a password on successful login, so old
    users get migrated to stronger parameters without ever knowing.
    """
    return _hasher.check_needs_rehash(stored_hash)


# ---------------------------------------------------------------------------
# JWTs
# ---------------------------------------------------------------------------
def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(user_id: int, active_role: str) -> str:
    """Short-lived token carrying the user's id and current active role.

    The role goes in the token so role checks don't hit the DB on every
    request. Trade-off: if an admin demotes someone, they keep admin
    powers until their access token expires (max 15 min).
    """
    return jwt.encode(
        {
            "sub":  str(user_id),
            "role": active_role,
            "typ":  "access",
            "iat":  _now(),
            "exp":  _now() + timedelta(minutes=settings.access_token_minutes),
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def create_refresh_token(user_id: int) -> str:
    """Long-lived token. Used only to obtain new access tokens.

    No role embedded — role is re-fetched from the DB on refresh so any
    role change takes effect within one access-token lifetime.
    """
    return jwt.encode(
        {
            "sub": str(user_id),
            "typ": "refresh",
            "iat": _now(),
            "exp": _now() + timedelta(days=settings.refresh_token_days),
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def decode_token(token: str) -> dict[str, Any] | None:
    """Return the decoded claims, or None if the token is invalid/expired."""
    try:
        return jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except JWTError:
        return None