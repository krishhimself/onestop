"""App entrypoint. Wires middleware and mounts the versioned API router."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router


def create_app() -> FastAPI:
    app = FastAPI(title="OneStop Job Platform API")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # tighten before deploying
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix="/api/v1")

    @app.get("/")
    def root():
        return {"status": "ok", "service": "onestop-job-platform"}

    return app


app = create_app()
