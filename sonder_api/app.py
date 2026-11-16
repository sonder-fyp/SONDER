import logging
import re
import secrets
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import Depends, FastAPI, Header, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from sonder_engine.model import Params
from sonder_pack.maths_v2 import load_maths_v2

from .contracts import AnswerRequest, StartRequest
from .store import InMemoryStore, ServiceError

log = logging.getLogger("sonder_api")
ACTOR = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")


def memory_store_factory(capacity=256, ttl=86400):
    """Explicit developer mode: one process, sessions lost on restart."""

    def build():
        params = Params()
        pack = load_maths_v2(params=params)
        for warning in pack.warnings:
            log.warning("Pack warning: %s", warning)
        return InMemoryStore(pack, params, capacity=capacity, ttl=ttl)
    return build


def postgres_store_factory(url: str, release: str):
    """Durable mode. Fails startup if the database or the release is unavailable."""

    def build():
        from .pgstore import PostgresStore  # psycopg is an optional extra
        return PostgresStore(url, release)
    return build


def create_app(token: str, *, store=None, store_factory=None, trace=False):
    if len(token) < 32:
        raise ValueError("SONDER_ENGINE_TOKEN must contain at least 32 characters")
    if (store is None) == (store_factory is None):
        raise ValueError("pass exactly one of store or store_factory")

    @asynccontextmanager
    async def lifespan(app):
        # A factory failure (missing database, bad release, bad pack) stops startup: no fallback.
        app.state.store = store if store is not None else store_factory()
        log.warning("SONDER engine API using the %s store", app.state.store.mode)
        try:
            yield
        finally:
            close = getattr(app.state.store, "close", None)
            if store is None and close is not None:
                close()

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

    def trusted(x_sonder_token: str = Header(default="")):
        if not secrets.compare_digest(x_sonder_token.encode("utf-8"), token.encode("utf-8")):
            raise ServiceError(401, "internal_unauthorized")

    def actor(x_sonder_actor: str = Header(default="")):
        if not ACTOR.fullmatch(x_sonder_actor):
            raise ServiceError(404, "session_unavailable")
        return x_sonder_actor

    @app.exception_handler(ServiceError)
    async def service_error(request, exc):
        return JSONResponse({"error": {"code": exc.code}}, status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def invalid(request, exc):
        return JSONResponse({"error": {"code": "invalid_request"}}, status_code=422)

    @app.middleware("http")
    async def safe_errors(request: Request, call_next):
        if request.method == "POST":
            body = await request.body()
            if len(body) > 4096:
                return JSONResponse({"error": {"code": "invalid_request"}}, status_code=422,
                                    headers={"Cache-Control": "no-store"})
        try:
            response = await call_next(request)
        except Exception:
            log.exception("Engine adapter operation failed")
            response = JSONResponse({"error": {"code": "engine_numeric_error"}}, status_code=500)
        response.headers["Cache-Control"] = "no-store"
        return response

    def db(request: Request):
        return request.app.state.store

    auth = [Depends(trusted)]

    @app.get("/engine/health", dependencies=auth)
    def health(request: Request):
        return db(request).health()

    @app.get("/engine/units", dependencies=auth)
    def units(request: Request):
        return db(request).catalogue()

    @app.post("/engine/sessions", dependencies=auth)
    def create(request: Request, body: StartRequest, actor_id=Depends(actor)):
        return db(request).create(actor_id, body)

    @app.get("/engine/sessions", dependencies=auth)
    def sessions(request: Request, actor_id=Depends(actor),
                 status: Literal["in_progress", "complete"] | None = None,
                 unit_id: str | None = Query(default=None, min_length=1, max_length=32)):
        return db(request).list_sessions(actor_id, status=status, unit_id=unit_id)

    @app.get("/engine/sessions/{sid}", dependencies=auth)
    def current(request: Request, sid: str, actor_id=Depends(actor)):
        return db(request).current(sid, actor_id)

    @app.post("/engine/sessions/{sid}/answers", dependencies=auth)
    def submit(request: Request, sid: str, body: AnswerRequest, actor_id=Depends(actor)):
        reply, accepted = db(request).submit(sid, actor_id, body)
        if trace and accepted:
            try:
                log.warning("Developer trace session %s: %s", sid, db(request).inspect(sid))
            except Exception:
                log.exception("Trace logging failed after acceptance")
        return reply

    @app.get("/engine/latest", dependencies=auth)
    def latest(request: Request):
        return db(request).latest_finished()

    @app.get("/engine/sessions/{sid}/trace", dependencies=auth)
    def inspect(request: Request, sid: str):
        return db(request).inspect(sid)

    return app
