import argparse
import os
import sys

import uvicorn

from .app import create_app, memory_store_factory


def main():
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="SONDER engine API (one worker, loopback only)")
    parser.add_argument("--host", choices=["127.0.0.1"], default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--trace", action="store_true")
    parser.add_argument("--store", choices=["memory"], required=True,
                        help="'memory' is the developer mode: sessions are lost on restart")
    args = parser.parse_args()
    factory = memory_store_factory(capacity=int(os.environ.get("SONDER_SESSION_CAPACITY", "256")),
                                   ttl=float(os.environ.get("SONDER_SESSION_TTL", "86400")))
    app = create_app(os.environ.get("SONDER_ENGINE_TOKEN", ""), store_factory=factory, trace=args.trace)
    uvicorn.run(app, host=args.host, port=args.port, workers=1)


if __name__ == "__main__":
    main()
