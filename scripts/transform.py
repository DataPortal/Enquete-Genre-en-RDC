import json
from pathlib import Path
from collections import Counter

from scripts.mappings import (
    YES_NO, SEXE, FONCTION, EXPERIENCE, NIVEAU, VRAI_FAUX, FREQ, MINISTERE,
    OBSTACLES, ACTIONS, SGTGTG,
    map_one, map_multi
)

MULTI_FIELDS = [
    "sec4/obstacles",
    "sec4/actions",
    "sec5/sgtgtg_connus",
]

KEY_FIELDS = [
    "consent",
    "sec1/ministere",
    "sec1/sexe",
    "sec1/fonction",
    "sec1/annees_experience_ministere",
    "sec1/formation_genre",
    "sec2/compr_genre",
    "sec2/diff_sexe_genre",
    "sec2/genre_biologique",
    "sec2/politiques_genre_connaissance",
    "sec3/cellule_genre",
    "sec3/plan_action_genre",
    "sec3/indicateurs_genre",
    "sec3/outils_guide_genre",
    "sec3/frequence_formations_genre",
    "sec4/importance_genre_secteur",
    "sec5/gtg_connaissance",
]

def flatten_and_label(rec: dict) -> dict:
    flat = {}

    # meta
    flat["_id"] = rec.get("_id")
    flat["_uuid"] = rec.get("_uuid")
    flat["_submission_time"] = rec.get("_submission_time")
    flat["_status"] = rec.get("_status")

    # keep all sec* + consent fields
    for k, v in rec.items():
        if k.startswith("sec") or k == "consent":
            flat[k] = v

    # ---- Apply label mappings (single fields)
    flat["consent"] = map_one(flat.get("consent"), YES_NO)

    flat["sec1/ministere"] = map_one(flat.get("sec1/ministere"), MINISTERE)
    flat["sec1/sexe"] = map_one(flat.get("sec1/sexe"), SEXE)
    flat["sec1/fonction"] = map_one(flat.get("sec1/fonction"), FONCTION)
    flat["sec1/annees_experience_ministere"] = map_one(flat.get("sec1/annees_experience_ministere"), EXPERIENCE)
    flat["sec1/formation_genre"] = map_one(flat.get("sec1/formation_genre"), YES_NO)

    flat["sec2/compr_genre"] = map_one(flat.get("sec2/compr_genre"), NIVEAU)
    flat["sec2/diff_sexe_genre"] = map_one(flat.get("sec2/diff_sexe_genre"), YES_NO)
    flat["sec2/genre_biologique"] = map_one(flat.get("sec2/genre_biologique"), VRAI_FAUX)
    flat["sec2/politiques_genre_connaissance"] = map_one(flat.get("sec2/politiques_genre_connaissance"), YES_NO)

    flat["sec3/cellule_genre"] = map_one(flat.get("sec3/cellule_genre"), YES_NO)
    flat["sec3/plan_action_genre"] = map_one(flat.get("sec3/plan_action_genre"), YES_NO)
    flat["sec3/indicateurs_genre"] = map_one(flat.get("sec3/indicateurs_genre"), YES_NO)
    flat["sec3/outils_guide_genre"] = map_one(flat.get("sec3/outils_guide_genre"), YES_NO)
    flat["sec3/frequence_formations_genre"] = map_one(flat.get("sec3/frequence_formations_genre"), FREQ)

    flat["sec4/importance_genre_secteur"] = map_one(flat.get("sec4/importance_genre_secteur"), YES_NO)

    flat["sec5/gtg_connaissance"] = map_one(flat.get("sec5/gtg_connaissance"), YES_NO)

    # ---- Apply label mappings (multi fields) -> store as " • " string for table
    obs = map_multi(flat.get("sec4/obstacles"), OBSTACLES)
    acts = map_multi(flat.get("sec4/actions"), ACTIONS)
    sgt = map_multi(flat.get("sec5/sgtgtg_connus"), SGTGTG)

    flat["sec4/obstacles"] = " • ".join(obs) if obs else ""
    flat["sec4/actions"] = " • ".join(acts) if acts else ""
    flat["sec5/sgtgtg_connus"] = " • ".join(sgt) if sgt else ""

    return flat

def count_single(flat_rows, field):
    c = Counter()
    for r in flat_rows:
        val = r.get(field)
        if val is None or str(val).strip() == "":
            c["_missing"] += 1
        else:
            c[str(val)] += 1
    return dict(c)

def count_multi(flat_rows, field):
    c = Counter()
    for r in flat_rows:
        raw = r.get(field) or ""
        items = [x.strip() for x in str(raw).split("•") if x.strip()]
        for it in items:
            c[it] += 1
    return dict(c)

def main():
    in_path = Path("docs/data/submissions.json")
    out_flat = Path("docs/data/submissions_flat.json")
    out_stats = Path("docs/data/stats.json")

    payload = json.loads(in_path.read_text(encoding="utf-8"))
    results = payload.get("results", [])

    flat_rows = [flatten_and_label(r) for r in results]
    out_flat.write_text(json.dumps(flat_rows, ensure_ascii=False, indent=2), encoding="utf-8")

    stats = {"n": len(flat_rows), "counters": {}, "multi": {}}

    for field in KEY_FIELDS:
        stats["counters"][field] = count_single(flat_rows, field)

    for field in MULTI_FIELDS:
        stats["multi"][field] = count_multi(flat_rows, field)

    out_stats.write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Flattened (labels) -> {out_flat} ({len(flat_rows)} rows)")
    print(f"Stats (labels)     -> {out_stats}")

if __name__ == "__main__":
    main()
