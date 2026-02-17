import json
from pathlib import Path
from datetime import datetime
from collections import Counter

from scripts.mappings import (
    YES_NO, NIVEAU,
    map_one
)

SCORE_RULES = [
    ("cellule_genre", lambda r: (r.get("sec3/cellule_genre") == "Oui"), "Cellule genre existante"),
    ("plan_action",   lambda r: (r.get("sec3/plan_action_genre") == "Oui"), "Plan d’action genre disponible"),
    ("indicateurs",   lambda r: (r.get("sec3/indicateurs_genre") == "Oui"), "Indicateurs genre définis"),
    ("outils_guide",  lambda r: (r.get("sec3/outils_guide_genre") == "Oui"), "Outils/guide genre disponibles"),
    ("formation",     lambda r: (r.get("sec1/formation_genre") == "Oui"), "Formation genre suivie"),
    ("politiques",    lambda r: (r.get("sec2/politiques_genre_connaissance") == "Oui"), "Politiques genre connues"),
    ("gtg",           lambda r: (r.get("sec5/gtg_connaissance") == "Oui"), "GTG connu"),
]

GAP_LABELS = {
    "cellule_genre": "Absence de cellule genre / dispositif institutionnel",
    "plan_action": "Absence de plan d’action genre",
    "indicateurs": "Absence d’indicateurs genre",
    "outils_guide": "Absence d’outils/guide genre",
    "formation": "Besoin de formation genre",
    "politiques": "Faible connaissance des politiques genre",
    "gtg": "Faible connaissance de la coordination (GTG)",
}

RECO_TEMPLATES = {
    "cellule_genre": [
        "Mettre en place/officialiser une cellule genre (note de service), clarifier mandat et responsabilités.",
        "Désigner des points focaux (ToR) et définir un circuit de reporting (mensuel).",
    ],
    "plan_action": [
        "Élaborer un plan d’action genre 12 mois avec activités, responsabilités, échéances, coûts.",
        "Aligner le plan sur les priorités nationales et les engagements sectoriels.",
    ],
    "indicateurs": [
        "Définir un set minimal d’indicateurs (process/output/outcome) et un calendrier de suivi.",
        "Mettre en place un tableau de bord interne pour le monitoring.",
    ],
    "outils_guide": [
        "Produire un mini-guide opérationnel (checklist mainstreaming + exemples) et le diffuser.",
        "Standardiser des outils : fiche projet sensible au genre, grille d’analyse, modèle rapport.",
    ],
    "formation": [
        "Organiser une formation courte (2–4h) sur concepts genre, politiques nationales, et application sectorielle.",
        "Prévoir un recyclage annuel + coaching pratique sur dossiers/projets réels.",
    ],
    "politiques": [
        "Diffuser une fiche synthèse des politiques nationales + session d’appropriation.",
        "Créer un répertoire (drive) des référentiels et rendre l’accès systématique.",
    ],
    "gtg": [
        "Organiser un onboarding coordination : rôle du GTG, canaux, sous-groupes, modalités de participation.",
        "Relier les priorités sectorielles aux sous-groupes pertinents (VBG, ESSJF, RPEAF, PPLF).",
    ],
}

COMPREHENSION_EXTRA = {
    "Faible": [
        "Renforcer la compréhension du concept genre via exercices pratiques et cas d’usage sectoriels.",
        "Inclure des exemples de mesures correctives (données, planification, budget, suivi).",
    ]
}

def maturity_level(score: int) -> str:
    if score <= 2:
        return "Faible"
    if score <= 5:
        return "Moyen"
    return "Élevé"

def priority_from_gaps(gaps_keys):
    n = len(gaps_keys)
    if n >= 4:
        return "Haute"
    if n >= 2:
        return "Moyenne"
    return "Basse"

def split_bullets(s):
    # our transform stores multi as "a • b • c"
    if not s:
        return []
    return [x.strip() for x in str(s).split("•") if x.strip()]

def build_recos(record, missing_keys):
    recos = []
    for g in missing_keys:
        recos.extend(RECO_TEMPLATES.get(g, []))

    compr = record.get("sec2/compr_genre")
    if compr in COMPREHENSION_EXTRA:
        recos.extend(COMPREHENSION_EXTRA[compr])

    pol_list = (record.get("sec2/politiques_genre_liste") or "").strip()
    if pol_list:
        recos.append(f"Capitaliser sur la/les politique(s) citée(s) ({pol_list}) pour ancrer les actions et harmoniser les référentiels.")

    sgt = split_bullets(record.get("sec5/sgtgtg_connus"))
    if sgt:
        recos.append(f"Activer la participation/liaison avec les sous-groupes cités ({', '.join(sgt)}).")

    obs = split_bullets(record.get("sec4/obstacles"))
    acts = split_bullets(record.get("sec4/actions"))
    if obs:
        recos.append(f"Prioriser le traitement des obstacles : {', '.join(obs)}.")
    if acts:
        recos.append(f"Planifier et opérationnaliser les actions proposées : {', '.join(acts)} (responsables + échéances).")

    # dedupe
    seen = set()
    out = []
    for x in recos:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out

def analyze_one(record):
    score = 0
    achieved = []
    missing_keys = []

    for key, fn, label in SCORE_RULES:
        ok = False
        try:
            ok = bool(fn(record))
        except Exception:
            ok = False

        if ok:
            score += 1
            achieved.append(label)
        else:
            missing_keys.append(key)

    gaps = [GAP_LABELS.get(k, k) for k in missing_keys]
    level = maturity_level(score)
    priority = priority_from_gaps(missing_keys)

    recos = build_recos(record, missing_keys)

    return {
        "_id": record.get("_id"),
        "_uuid": record.get("_uuid"),
        "_submission_time": record.get("_submission_time"),
        "ministere": record.get("sec1/ministere"),
        "fonction": record.get("sec1/fonction"),
        "sexe": record.get("sec1/sexe"),
        "experience": record.get("sec1/annees_experience_ministere"),
        "score_maturite_0_7": score,
        "niveau_maturite": level,
        "priorite_actions": priority,
        "gaps_cles": gaps,
        "forces": achieved,
        "recommandations": recos,
        "reco_verbatim": record.get("sec6/recommandations"),
        "obstacles": record.get("sec4/obstacles"),
        "actions": record.get("sec4/actions"),
        "sgtgtg_connus": record.get("sec5/sgtgtg_connus"),
    }

def summarize(rows):
    score_counts = Counter()
    priority_counts = Counter()
    level_counts = Counter()
    gap_counts = Counter()

    for r in rows:
        score_counts[str(r["score_maturite_0_7"])] += 1
        priority_counts[r["priorite_actions"]] += 1
        level_counts[r["niveau_maturite"]] += 1
        for g in (r.get("gaps_cles") or []):
            gap_counts[g] += 1

    return {
        "n": len(rows),
        "score_distribution": dict(score_counts),
        "priority_distribution": dict(priority_counts),
        "level_distribution": dict(level_counts),
        "top_gaps": dict(gap_counts.most_common(10)),
    }

def main():
    in_flat = Path("docs/data/submissions_flat.json")
    out_path = Path("docs/data/analysis_recos.json")

    flat = json.loads(in_flat.read_text(encoding="utf-8"))
    rows = [analyze_one(r) for r in flat]

    payload = {
        "generated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "summary": summarize(rows),
        "results": rows,
    }

    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote analysis -> {out_path} ({len(rows)} rows)")

if __name__ == "__main__":
    main()
