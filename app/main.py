"""FastAPI application entry point.

Run with:
    uvicorn app.main:app --reload

OpenAPI docs at http://localhost:8000/docs
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import admin, auth, history, misc, shuttles, trips, ws


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Place for startup/shutdown work (warm caches, etc.) if needed later.
    yield


app = FastAPI(
    title="Sewanee Transit API",
    version="0.1.0",
    description="Live shuttle tracking for the University of the South",
    lifespan=lifespan,
)

# CORS: lets the Phase 2 frontend at localhost:5173 call this API
# with cookies. Tight allow-list, no wildcards.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,     prefix="/api/auth",     tags=["auth"])
app.include_router(trips.router,    prefix="/api/trips",    tags=["trips"])
app.include_router(shuttles.router, prefix="/api/shuttles", tags=["shuttles"])
app.include_router(history.router,  prefix="/api/history",  tags=["history"])
app.include_router(admin.router,    prefix="/api/admin",    tags=["admin"])
app.include_router(misc.router,     prefix="/api",          tags=["misc"])
app.include_router(ws.router,       prefix="/ws",           tags=["ws"])


@app.get("/api/health")
async def health():
    """Cheap liveness check. Used by uptime monitors and Docker healthchecks."""
    return {"status": "ok", "env": settings.env}
