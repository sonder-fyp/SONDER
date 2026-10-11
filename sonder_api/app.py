import logging
import secrets
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from sonder_engine.model import Params
from sonder_pack.maths_v2 import load_maths_v2

from .contracts import AnswerRequest, StartRequest
from .store import InMemoryStore, ServiceError

log = logging.getLogger("sonder_api")


def create_app(token: str, *, store=None, trace=False, capacity=256, ttl=86400):
    if len(token) < 32:
        raise ValueError("SONDER_ENGINE_TOKEN must contain at least 32 characters")

    @asynccontextmanager
    async def lifespan(app):
        if store is None:
            params = Params()
            pack = load_maths_v2(params=params)
            for warning in pack.warnings:
                log.warning("Pack warning: %s", warning)
            app.state.store = InMemoryStore(pack, params, capacity=capacity, ttl=ttl)
        else:
            app.state.store = store
        log.warning("SONDER local in-memory checkpoint: one worker; restart loses sessions")
        yield

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

    def trusted(x_sonder_token: str = Header(default="")):
        if not secrets.compare_digest(x_sonder_token.encode("utf-8"), token.encode("utf-8")):
            raise ServiceError(401, "internal_unauthorized")

    def owner(x_sonder_owner: str = Header(default="")):
        if len(x_sonder_owner) != 64 or any(c not in "0123456789abcdef" for c in x_sonder_owner):
            raise ServiceError(404, "session_unavailable")
        return x_sonder_owner

    @app.exception_handler(ServiceError)
    async def service_error(request, exc):
        return JSONResponse({"error": {"code": exc.code}}, status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def invalid(request, exc):
        return JSONResponse({"error": {"code": "invalid_request"}}, status_code=422)

    @app.middleware("http")
    async def safe_errors(request: Request, call_next):
        # Bound request bodies before FastAPI parses them, including chunked uploads.
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
    def health():
        return {"contract_version": 1, "mode": "in_memory", "ready": True}

    @app.get("/engine/units", dependencies=auth)
    def units(request: Request):
        return db(request).catalogue()

    @app.post("/engine/sessions", dependencies=auth)
    def create(request: Request, body: StartRequest, owner_id=Depends(owner)):
        return db(request).create(owner_id, body)

    @app.get("/engine/sessions/{sid}", dependencies=auth)
    def current(request: Request, sid: str, owner_id=Depends(owner)):
        return db(request).current(sid, owner_id)

    @app.post("/engine/sessions/{sid}/answers", dependencies=auth)
    def submit(request: Request, sid: str, body: AnswerRequest, owner_id=Depends(owner)):
        reply, accepted = db(request).submit(sid, owner_id, body)
        if trace and accepted:
            try:
                log.warning("Developer trace session %s: %s", sid, db(request).inspect(sid))
            except Exception:
                log.exception("Trace logging failed after acceptance")
        return reply

    @app.get("/engine/sessions/{sid}/trace", dependencies=auth)
    def inspect(request: Request, sid: str):
        return db(request).inspect(sid)

    return app
