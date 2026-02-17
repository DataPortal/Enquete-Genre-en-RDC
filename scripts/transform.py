import json
from pathlib import Path
from collections import Counter, defaultdict

MULTI_FIELDS = [
    "sec4/obstacles",
    "sec4/actions",
    "sec5/sgtgtg_connus",
]

KEY_FIELDS = [
    "sec1/ministere",
    "sec1/sexe",
    "sec1/fonction",
    "sec1/annees_experience_ministere",
    "sec1/formation_genre",
    "sec2/compr_genre",
    "sec2/politiques_genre_connaissance",
    "sec3/cellule_genre",
    "sec3/plan_action_genre",
    "sec3/indicateurs_genre",
    "sec3/outils_guide_genre",
    "sec5/gtg_connaissance",
    "sec4/importance_genre_secteur",
]

def split_multi(value):
    """
    Kobo multiselect often stored like: "obs2 obs3 obs4"
    """
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if not isinstance(value, str):
        return []
    value = value.strip()
    if not value:
        return []
    return value.split()

def flatten_record(rec: dict) -> dict:
    # Keep a safe set of fields for table display
    flat = {}
    flat["_id"] = rec.get("_id")
    flat["_submission_time"] = rec.get("_submission_time")
    flat["_status"] = rec.get("_status")

    # Copy all sec* fields as-is
    for k, v in rec.items():
        if k.startswith("sec") or k.startswith("consent"):
            flat[k] = v

    # Also keep a short uuid
    flat["_uuid"] = rec.get("_uuid")
    return flat

def main():
    in_path = Path("docs/data/submissions.json")
    out_flat = Path("docs/data/submissions_flat.json")
    out_stats = Path("docs/data/stats.json")

    payload = json.loads(in_path.read_text(encoding="utf-8"))
    results = payload.get("results", [])

    flat_rows = [flatten_record(r) for r in results]
    out_flat.write_text(json.dumps(flat_rows, ensure_ascii=False, indent=2), encoding="utf-8")

    # Stats: simple counters
    stats = {
        "n": len(results),
        "counters": {},
        "multi": {},
    }

    # Single-choice counters
    for field in KEY_FIELDS:
        c = Counter()
        for r in results:
            val = r.get(field)
            if val is None or val == "":
                c["_missing"] += 1
            else:
                c[str(val)] += 1
        stats["counters"][field] = dict(c)

    # Multi-choice counters
    for field in MULTI_FIELDS:
        c = Counter()
        for r in results:
            for item in split_multi(r.get(field)):
                c[item] += 1
        stats["multi"][field] = dict(c)

    out_stats.write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Flattened rows: {len(flat_rows)} -> {out_flat}")
    print(f"Stats written -> {out_stats}")

if __name__ == "__main__":
    main()
