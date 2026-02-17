import os
import json
import time
from pathlib import Path
import requests

def require_env(name: str) -> str:
    v = os.getenv(name)
    if not v:
        raise SystemExit(f"Missing env var: {name}")
    return v

def fetch_all_submissions(server: str, asset_uid: str, token: str, page_size: int = 300):
    """
    Kobo v2 data endpoint supports pagination via 'limit' and 'start'.
    We fetch all results to keep it simple and robust.
    """
    base_url = f"{server.rstrip('/')}/api/v2/assets/{asset_uid}/data/"
    headers = {"Authorization": f"Token {token}"}

    all_results = []
    start = 0
    total_count = None

    while True:
        params = {"format": "json", "limit": page_size, "start": start}
        r = requests.get(base_url, headers=headers, params=params, timeout=60)
        r.raise_for_status()
        payload = r.json()

        if total_count is None:
            total_count = payload.get("count", 0)

        results = payload.get("results", [])
        all_results.extend(results)

        # Kobo returns "next": null when finished (sometimes), but we don't rely only on it
        if not results:
            break

        start += len(results)

        # Safety: if we already reached count, stop
        if total_count is not None and start >= total_count:
            break

        time.sleep(0.2)  # gentle pacing

    return {"count": len(all_results), "results": all_results}

def main():
    server = require_env("KOBO_SERVER")
    asset_uid = require_env("KOBO_ASSET_UID")
    token = require_env("KOBO_TOKEN")

    out_dir = Path("docs/data")
    out_dir.mkdir(parents=True, exist_ok=True)

    data = fetch_all_submissions(server, asset_uid, token, page_size=300)

    out_path = out_dir / "submissions.json"
    out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {data['count']} submissions to {out_path}")

if __name__ == "__main__":
    main()
