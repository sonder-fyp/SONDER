"""DEV TOOL (not run in CI): count database round trips per engine request.

    SONDER_TEST_DATABASE_URL=postgresql://sonder:local-test-only@127.0.0.1:55432/sonder_test \\
        python scripts/measure_db_latency.py [--delay 0.1] [--runs 5]

It creates a throwaway database on the server named by SONDER_TEST_DATABASE_URL (the Docker
database from docker-compose.yml, never a shared one), migrates and seeds it directly, then
starts a TCP relay on 127.0.0.1:55433 that waits --delay seconds before forwarding every
server->client chunk, so each database round trip costs about --delay. The engine API
(--store postgres) is started against the relay and each endpoint is timed. The printed
"~round trips" is median / delay; it is an estimate, not an exact count.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import socket
import statistics
import subprocess
import sys
import threading
import time
from pathlib import Path
from uuid import uuid4

import httpx
import psycopg
from psycopg.conninfo import conninfo_to_dict, make_conninfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sonder_api.devseed import seed  # noqa: E402
from sonder_db.migrate import up  # noqa: E402

RELAY_PORT = 55433
TOKEN = "t" * 32


class Relay:
    """asyncio TCP relay that delays every server->client chunk."""

    def __init__(self, listen_port: int, host: str, port: int, delay: float):
        self.listen_port, self.host, self.port, self.delay = listen_port, host, port, delay
        self.loop = asyncio.new_event_loop()
        self.ready = threading.Event()

    async def _pipe(self, reader, writer, delay: float):
        try:
            while data := await reader.read(65536):
                if delay:
                    await asyncio.sleep(delay)
                writer.write(data)
                await writer.drain()
        except (ConnectionError, asyncio.CancelledError):
            pass
        finally:
            writer.close()

    async def _handle(self, client_reader, client_writer):
        try:
            server_reader, server_writer = await asyncio.open_connection(self.host, self.port)
        except OSError:
            client_writer.close()
            return
        await asyncio.gather(self._pipe(client_reader, server_writer, 0.0),
                             self._pipe(server_reader, client_writer, self.delay))

    async def _serve(self):
        server = await asyncio.start_server(self._handle, "127.0.0.1", self.listen_port)
        self.ready.set()
        async with server:
            await server.serve_forever()

    def start(self) -> None:
        def run():
            asyncio.set_event_loop(self.loop)
            self.loop.run_until_complete(self._serve())
        threading.Thread(target=run, daemon=True).start()
        if not self.ready.wait(10):
            raise RuntimeError("relay did not start")


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--delay", type=float, default=0.1, help="seconds added to every server->client chunk")
    parser.add_argument("--runs", type=int, default=5)
    parser.add_argument("--admin-url", default=os.environ.get("SONDER_TEST_DATABASE_URL", ""))
    args = parser.parse_args()
    if not args.admin_url:
        print("Set SONDER_TEST_DATABASE_URL (the throwaway Docker database).", file=sys.stderr)
        return 2
    info = conninfo_to_dict(args.admin_url)
    db_name = f"lat_{uuid4().hex[:12]}"
    with psycopg.connect(args.admin_url, autocommit=True) as conn:
        conn.execute(f'CREATE DATABASE "{db_name}"')
    direct = make_conninfo(args.admin_url, dbname=db_name)
    proc = None
    try:
        up(direct)
        with psycopg.connect(direct) as conn:
            seeded = seed(conn, synthetic_students=2)
        actor = next(iter(seeded["students"].values()))
        relay = Relay(RELAY_PORT, info.get("host", "127.0.0.1"), int(info.get("port", 5432)), args.delay)
        relay.start()
        api_port = free_port()
        env = {**os.environ, "SONDER_DATABASE_URL": make_conninfo(args.admin_url, dbname=db_name,
                                                                  host="127.0.0.1", port=str(RELAY_PORT)),
               "SONDER_ENGINE_TOKEN": TOKEN, "PYTHONPATH": str(ROOT)}
        proc = subprocess.Popen([sys.executable, "-m", "sonder_api", "--store", "postgres", "--release",
                                 seeded["release"], "--port", str(api_port)], env=env,
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        base = f"http://127.0.0.1:{api_port}"
        headers = {"X-Sonder-Token": TOKEN, "X-Sonder-Actor": actor}
        with httpx.Client(base_url=base, headers=headers, timeout=60) as client:
            deadline = time.monotonic() + 60
            while True:
                if proc.poll() is not None:
                    print("API exited before it became healthy", file=sys.stderr)
                    return 1
                try:
                    if client.get("/engine/health").status_code == 200:
                        break
                except httpx.HTTPError:
                    pass
                if time.monotonic() > deadline:
                    print("API health timed out", file=sys.stderr)
                    return 1
                time.sleep(0.2)

            def timed(call) -> float:
                started = time.perf_counter()
                response = call()
                elapsed = (time.perf_counter() - started) * 1000.0
                if response.status_code != 200:
                    raise RuntimeError(f"unexpected {response.status_code}: {response.text[:200]}")
                return elapsed

            def start():
                return client.post("/engine/sessions", json={"unit_id": "U1", "create_request_id": str(uuid4())})

            sid = start().json()["session_id"]
            results: dict[str, list[float]] = {name: [] for name in ("health", "units", "list", "start", "current", "answer")}
            # One untimed warm-up call each, so one-time caches (release, unit, catalogue) are filled.
            client.get("/engine/health"); client.get("/engine/units")
            client.get("/engine/sessions"); client.get(f"/engine/sessions/{sid}")
            for _ in range(args.runs):
                results["health"].append(timed(lambda: client.get("/engine/health")))
                results["units"].append(timed(lambda: client.get("/engine/units")))
                results["list"].append(timed(lambda: client.get("/engine/sessions", params={"unit_id": "U1"})))
                results["start"].append(timed(start))
                fresh = start().json()
                results["current"].append(timed(lambda: client.get(f"/engine/sessions/{fresh['session_id']}")))
                q = fresh["question"]
                body = {"step_index": q["step_index"], "item_id": q["item_id"], "option_id": "D"}
                results["answer"].append(timed(lambda: client.post(f"/engine/sessions/{fresh['session_id']}/answers", json=body)))
        print(f"delay = {args.delay} s, {args.runs} runs, median ms (~round trips = median / delay)")
        for name, values in results.items():
            median = statistics.median(values)
            print(f"{name:8s} {median:8.0f} ms  ~{median / (args.delay * 1000.0):5.1f}")
        return 0
    finally:
        if proc is not None and proc.poll() is None:
            proc.kill()
            proc.wait(timeout=10)
        with psycopg.connect(args.admin_url, autocommit=True) as conn:
            conn.execute(f'DROP DATABASE IF EXISTS "{db_name}" WITH (FORCE)')


if __name__ == "__main__":
    raise SystemExit(main())
