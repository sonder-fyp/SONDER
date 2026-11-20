import argparse
import os
import sys

import uvicorn

from sonder_db import database_url

from .app import create_app, memory_store_factory, postgres_store_factory


def main():
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="SONDER engine API (one worker, loopback only)")
    parser.add_argument("--host", choices=["127.0.0.1"], default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--trace", action="store_true")
    parser.add_argument("--store", choices=["postgres", "memory"], required=True,
                        help="postgres: durable sessions in SONDER_DATABASE_URL; memory: developer mode, sessions lost on restart")
    parser.add_argument("--release", default=os.environ.get("SONDER_RELEASE", ""))
    args = parser.parse_args()
    if args.store == "postgres":
        if not args.release:
            parser.error("--release (or SONDER_RELEASE) is required with --store postgres")
        try:
            url = database_url()
        except RuntimeError as exc:
            parser.error(str(exc))
        factory = postgres_store_factory(url, args.release)
    else:
        factory = memory_store_factory(capacity=int(os.environ.get("SONDER_SESSION_CAPACITY", "256")),
                                       ttl=float(os.environ.get("SONDER_SESSION_TTL", "86400")))
    app = create_app(os.environ.get("SONDER_ENGINE_TOKEN", ""), store_factory=factory, trace=args.trace)
    uvicorn.run(app, host=args.host, port=args.port, workers=1)


if __name__ == "__main__":
    main()
