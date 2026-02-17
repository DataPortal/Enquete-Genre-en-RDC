import json
from pathlib import Path
from datetime import datetime

# -----------------------
# Configuration (règles)
# -----------------------

SCORE_RULES = [
    ("cellule_genre", lambda r: (r.get("sec3/cellule_genre") == "oui"), "Cellule genre existante"),
    ("plan_action", lambda r: (r.get("sec3/plan_action_genre") == "oui"), "Plan d’action genre disponible"),
    ("indicateurs", lambda r: (r.get("sec3/indicateurs_genre") == "oui"), "Indicateurs genre définis"),
    ("outils_guide", lambda r: (r.get("sec3/outils_guide_genre") == "oui"), "Outils/guide genre disponibles"),
    ("formation", lambda r: (r.get("sec1/formation_genre") == "oui"), "Formation genre suivie"),
    ("politiques", lambda r: (r.get("sec2/politiques_genre_connaissance") == "oui"), "Politiques genre connues"),
    ("gtg", lambda r: (r.get("sec5/gtg_connaissance") == "oui"), "GTG connu"),
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

# Recos standard (templates)
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
        "Mettre en place un tableau de bord interne (même simple) pour le monitoring.",
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
        "Diffuser une fiche synthèse des politiques nationales (ex: PNE et autres) + session d’appropriation.",
        "Créer un répertoire (drive) des référentiels et rendre l’accès systématique.",
    ],
    "gtg": [
        "Organiser un onboarding coordination : rôle du GTG, canaux, sous-groupes, modalités de participation.",
        "Relier les priorités sectorielles aux sous-groupes pertinents (ex: VBG, ESSJF, etc.).",
    ],
}

# Compréhension genre -> reco additionnelle si faible
COMPREHENSION_EXTRA = {
    "faible": [
        "Renforcer la compréhension du concept genre (différence sexe/genre, stéréotypes, inclusion), via exercices pratiques.",
        "Inclure des cas d’usage sectoriels et des exemples de mesures correctives.",
    ]
}

def parse_multi(value):
    """Split multiselect like 'obs2 obs3 obs4' into list."""
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if not isinstance(value, str):
        return []
    v = value.strip()
    return v.split() if v else []

def maturity_level(score: int) -> str:
    if score <= 2:
        return "Faible"
    if score <= 5:
        return "Moyen"
    return "Élevé"

def priority_from_gaps(gaps):
    # simple: if >=4 gaps => Haute, if 2-3 => Moyenne, else Basse
    n = len(gaps)
    if n >= 4:
        return "Haute"
    if n >= 2:
        return "Moyenne"
    return "Basse"

def safe_str(v):
    return "" if v is None else str(v)

def build_recos(record, gaps_keys):
    recos = []

    # Standard recos per gap
    for g in gaps_keys:
        recos.extend(RECO_TEMPLATES.get(g, []))

    # Personalised: comprehension faible
    compr = record.get("sec2/compr_genre")
    if compr in COMPREHENSION_EXTRA:
        recos.extend(COMPREHENSION_EXTRA[compr])

    # Personalised: policies list present
    pol_list = record.get("sec2/politiques_genre_liste")
    if safe_str(pol_list).strip():
        recos.append(f"Capitaliser sur la/les politique(s) citée(s) ({pol_list}) pour ancrer les actions et harmoniser les référentiels.")

    # Personalised: GTG subgroups mentioned
    sgt = parse_multi(record.get("sec5/sgtgtg_connus"))
    if sgt:
        recos.append(f"Activer la participation/liaison avec les sous-groupes cités ({', '.join(sgt)}) pour accélérer coordination et partage d’outils.")

    # Personalised: obstacles/actions codes
    obs = parse_multi(record.get("sec4/obstacles"))
    acts = parse_multi(record.get("sec4/actions"))
    if obs:
        recos.append(f"Prioriser le traitement des obstacles déclarés ({', '.join(obs)}).")
    if acts:
        recos.append(f"Consolider et planifier les actions proposées ({', '.join(acts)}), avec responsabilités et échéances.")

    # Deduplicate while preserving order
    seen = set()
    out = []
    for x in recos:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out

def analyze_one(record):
    # Compute score
    score = 0
    achieved = []
    missing = []

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
            missing.append(key)

    gaps = [GAP_LABELS.get(k, k) for k in missing]
    level = maturity_level(score)
    priority = priority_from_gaps(missing)

    # Build recommendations
    recos = build_recos(record, missing)

    # Essential identity fields
    out = {
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
        # Keep some raw fields for filtering
        "formation_genre": record.get("sec1/formation_genre"),
        "compr_genre": record.get("sec2/compr_genre"),
        "politiques_connues": record.get("sec2/politiques_genre_connaissance"),
        "cellule_genre": record.get("sec3/cellule_genre"),
        "gtg_connaissance": record.get("sec5/gtg_connaissance"),
        "obstacles": record.get("sec4/obstacles"),
        "actions": record.get("sec4/actions"),
        "reco_verbatim": record.get("sec6/recommandations"),
    }
    return out

def summarize(analysis_rows):
    # distribution scores + priorities
    score_counts = {}
    priority_counts = {}
    level_counts = {}
    for r in analysis_rows:
        score_counts[str(r["score_maturite_0_7"])] = score_counts.get(str(r["score_maturite_0_7"]), 0) + 1
        priority_counts[r["priorite_actions"]] = priority_counts.get(r["priorite_actions"], 0) + 1
        level_counts[r["niveau_maturite"]] = level_counts.get(r["niveau_maturite"], 0) + 1

    return {
        "n": len(analysis_rows),
        "score_distribution": score_counts,
        "priority_distribution": priority_counts,
        "level_distribution": level_counts,
    }

def main():
    in_flat = Path("docs/data/submissions_flat.json")
    out_path = Path("docs/data/analysis_recos.json")

    if not in_flat.exists():
        raise SystemExit("Missing input: docs/data/submissions_flat.json (run transform.py first)")

    flat = json.loads(in_flat.read_text(encoding="utf-8"))
    analysis_rows = [analyze_one(r) for r in flat]

    payload = {
        "generated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "summary": summarize(analysis_rows),
        "results": analysis_rows,
    }

    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote analysis -> {out_path} ({len(analysis_rows)} rows)")

if __name__ == "__main__":
    main()
