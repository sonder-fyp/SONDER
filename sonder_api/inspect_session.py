import argparse
import json
import os
import sys
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser(description="Inspect a local developer trace, outside the student UI")
    parser.add_argument("session_id")
    args = parser.parse_args()
    from uuid import UUID
    sid = str(UUID(args.session_id))
    token = os.environ.get("SONDER_ENGINE_TOKEN", "")
    if len(token) < 32:
        parser.error("SONDER_ENGINE_TOKEN is required")
    request = Request(f"http://127.0.0.1:8000/engine/sessions/{sid}/trace",
                      headers={"X-Sonder-Token": token})
    with urlopen(request, timeout=15) as response:
        result = json.load(response)
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
