import argparse
import os
import sys

import uvicorn

from .app import create_app


def main():
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="SONDER local in-memory API (one worker, no database)")
    parser.add_argument("--host", choices=["127.0.0.1"], default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--trace", action="store_true")
    args = parser.parse_args()
    app = create_app(os.environ.get("SONDER_ENGINE_TOKEN", ""), trace=args.trace,
                     capacity=int(os.environ.get("SONDER_SESSION_CAPACITY", "256")),
                     ttl=float(os.environ.get("SONDER_SESSION_TTL", "86400")))
    uvicorn.run(app, host=args.host, port=args.port, workers=1)


if __name__ == "__main__":
    main()
