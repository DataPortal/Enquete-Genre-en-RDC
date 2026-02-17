import json
from pathlib import Path
from collections import Counter

from mappings import (
    YES_NO, YES_NO_NP, SEXE, FONCTION, EXPERIENCE, NIVEAU, VRAI_FAUX, FREQ, MINISTERE,
    OBSTACLES, ACTIONS, SGTGTG,
    map_one, map_multi
)

def bullets(items):
    return " • ".join([x for x in items if str(x).strip()]) if items else ""

def split_bullets(s):
    if not s: return []
    return [x.strip() for x in str(s).split("•") if x.strip()]

def count_single(rows, field):
    c = Counter()
    for r in rows:
        v = r.get(field)
        if v is None or str(v).strip() == "":
            c["_missing"] += 1
        else:
            c[str(v)] += 1
    return dict(c)

def count_multi(rows, field):
    c = Counter()
    for r in rows:
        for it in split_bullets(r.get(field, "")):
            c[it] += 1
    return dict(c)

TABLE_SCHEMA = [
    ("Ministere", "sec1/ministere_display"),
    ("Sexe", "sec1/sexe"),
    ("Fonction", "sec1/fonction"),
    ("Expérience (ministère)", "sec1/annees_experience_ministere"),
    ("Formation genre", "sec1/formation_genre"),
    ("Détails formation (si oui)", "sec1/formation_genre_details"),

    ("Compréhension du genre", "sec2/compr_genre"),
    ("Différence sexe/genre", "sec2/diff_sexe_genre"),
    ("« Genre = biologique »", "sec2/genre_biologique"),
    ("Connaît politique genre", "sec2/politiques_genre_connaissance"),
    ("Politiques citées", "sec2/politiques_genre_liste"),
    ("Genre important en politiques publiques", "sec2/importance_genre_politiques_publiques"),
    ("Justification (politiques publiques)", "sec2/importance_justification"),

    ("Cellule genre", "sec3/cellule_genre"),
    ("Nombre points focaux", "sec3/nb_points_focaux"),
    ("Plan/stratégie genre", "sec3/plan_action_genre"),
    ("Indicateurs sensibles au genre", "sec3/indicateurs_genre"),
    ("Outils/guide genre", "sec3/outils_guide_genre"),
    ("Budget genre (%)", "sec3/budget_genre_annuel"),
    ("Fréquence formations genre", "sec3/frequence_formations_genre"),

    ("Genre important pour le secteur", "sec4/importance_genre_secteur"),
    ("Obstacles (libellés)", "sec4/obstacles_display"),
    ("Actions prioritaires (libellés)", "sec4/actions_display"),

    ("Connaissance GTG", "sec5/gtg_connaissance"),
    ("Sous-groupes GTG connus", "sec5/sgtgtg_connus_display"),

    ("Recommandations (verbatim)", "sec6/recommandations"),
]

DASHBOARD_QUESTIONS = [
    ("Profil", "Ministère", "sec1/ministere_display", "bar"),
    ("Profil", "Sexe du répondant", "sec1/sexe", "donut"),
    ("Profil", "Fonction actuelle", "sec1/fonction", "bar"),
    ("Profil", "Expérience au sein du ministère", "sec1/annees_experience_ministere", "bar"),
    ("Profil", "A déjà suivi une formation genre ?", "sec1/formation_genre", "donut"),

    ("Connaissances", "Compréhension du concept de genre", "sec2/compr_genre", "bar"),
    ("Connaissances", "Connaît la différence sexe/genre ?", "sec2/diff_sexe_genre", "donut"),
    ("Connaissances", "« Le genre est principalement biologique »", "sec2/genre_biologique", "donut"),
    ("Connaissances", "Connaît une politique genre ?", "sec2/politiques_genre_connaissance", "donut"),
    ("Connaissances", "Le genre est important en politiques publiques ?", "sec2/importance_genre_politiques_publiques", "donut"),

    ("Pratiques institutionnelles", "Présence d’une Cellule Genre", "sec3/cellule_genre", "donut"),
    ("Pratiques institutionnelles", "Plan/stratégie genre", "sec3/plan_action_genre", "donut"),
    ("Pratiques institutionnelles", "Indicateurs sensibles au genre", "sec3/indicateurs_genre", "donut"),
    ("Pratiques institutionnelles", "Accès à des outils/guides genre", "sec3/outils_guide_genre", "donut"),
    ("Pratiques institutionnelles", "Fréquence des formations genre", "sec3/frequence_formations_genre", "bar"),

    ("Perceptions & obstacles", "Le genre est important pour votre secteur ?", "sec4/importance_genre_secteur", "donut"),
    ("Perceptions & obstacles", "Obstacles à l’intégration du genre (Top)", "sec4/obstacles_display", "bar_multi"),
    ("Perceptions & obstacles", "Actions prioritaires (Top)", "sec4/actions_display", "bar_multi"),

    ("Coordination (GTG)", "A déjà entendu parler du GTG ?", "sec5/gtg_connaissance", "donut"),
    ("Coordination (GTG)", "Sous-groupes GTG connus (Top)", "sec5/sgtgtg_connus_display", "bar_multi"),
]

def flatten_and_label(rec: dict) -> dict:
    flat = {}
    flat["consent"] = map_one(rec.get("consent"), YES_NO)

    for k, v in rec.items():
        if k.startswith("sec"):
            flat[k] = v

    flat["sec1/ministere"] = map_one(flat.get("sec1/ministere"), MINISTERE)
    flat["sec1/ministere_autre"] = flat.get("sec1/ministere_autre", "")
    flat["sec1/sexe"] = map_one(flat.get("sec1/sexe"), SEXE)
    flat["sec1/fonction"] = map_one(flat.get("sec1/fonction"), FONCTION)
    flat["sec1/annees_experience_ministere"] = map_one(flat.get("sec1/annees_experience_ministere"), EXPERIENCE)
    flat["sec1/formation_genre"] = map_one(flat.get("sec1/formation_genre"), YES_NO)
    flat["sec1/formation_genre_details"] = flat.get("sec1/formation_genre_details", "")

    flat["sec2/compr_genre"] = map_one(flat.get("sec2/compr_genre"), NIVEAU)
    flat["sec2/diff_sexe_genre"] = map_one(flat.get("sec2/diff_sexe_genre"), YES_NO)
    flat["sec2/genre_biologique"] = map_one(flat.get("sec2/genre_biologique"), VRAI_FAUX)
    flat["sec2/politiques_genre_connaissance"] = map_one(flat.get("sec2/politiques_genre_connaissance"), YES_NO)
    flat["sec2/politiques_genre_liste"] = flat.get("sec2/politiques_genre_liste", "")
    flat["sec2/importance_genre_politiques_publiques"] = map_one(flat.get("sec2/importance_genre_politiques_publiques"), YES_NO)
    flat["sec2/importance_justification"] = flat.get("sec2/importance_justification", "")

    flat["sec3/cellule_genre"] = map_one(flat.get("sec3/cellule_genre"), YES_NO)
    flat["sec3/nb_points_focaux"] = flat.get("sec3/nb_points_focaux")
    flat["sec3/plan_action_genre"] = map_one(flat.get("sec3/plan_action_genre"), YES_NO_NP)
    flat["sec3/indicateurs_genre"] = map_one(flat.get("sec3/indicateurs_genre"), YES_NO_NP)
    flat["sec3/outils_guide_genre"] = map_one(flat.get("sec3/outils_guide_genre"), YES_NO)
    flat["sec3/budget_genre_annuel"] = flat.get("sec3/budget_genre_annuel")
    flat["sec3/frequence_formations_genre"] = map_one(flat.get("sec3/frequence_formations_genre"), FREQ)

    flat["sec4/importance_genre_secteur"] = map_one(flat.get("sec4/importance_genre_secteur"), YES_NO_NP)
    flat["sec4/obstacle_autre"] = flat.get("sec4/obstacle_autre", "")
    flat["sec4/action_autre"] = flat.get("sec4/action_autre", "")

    obs_labels = map_multi(flat.get("sec4/obstacles"), OBSTACLES)
    act_labels = map_multi(flat.get("sec4/actions"), ACTIONS)
    sgt_labels = map_multi(flat.get("sec5/sgtgtg_connus"), SGTGTG)

    if "Autre (à préciser)" in obs_labels and str(flat["sec4/obstacle_autre"]).strip():
        obs_labels = [x for x in obs_labels if x != "Autre (à préciser)"]
        obs_labels.append(f"Autre : {flat['sec4/obstacle_autre'].strip()}")

    if "Autre (à préciser)" in act_labels and str(flat["sec4/action_autre"]).strip():
        act_labels = [x for x in act_labels if x != "Autre (à préciser)"]
        act_labels.append(f"Autre : {flat['sec4/action_autre'].strip()}")

    flat["sec4/obstacles_display"] = bullets(obs_labels)
    flat["sec4/actions_display"] = bullets(act_labels)

    flat["sec5/gtg_connaissance"] = map_one(flat.get("sec5/gtg_connaissance"), YES_NO)
    flat["sec5/sgtgtg_connus_display"] = bullets(sgt_labels)

    flat["sec6/recommandations"] = flat.get("sec6/recommandations", "")

    if flat.get("sec1/ministere") == "Autre (à préciser)" and str(flat.get("sec1/ministere_autre", "")).strip():
        flat["sec1/ministere_display"] = f"{flat['sec1/ministere']} : {flat['sec1/ministere_autre'].strip()}"
    else:
        flat["sec1/ministere_display"] = flat.get("sec1/ministere", "")

    return flat

def make_table_rows(flat_rows):
    rows = []
    for r in flat_rows:
        row = {}
        for header, key in TABLE_SCHEMA:
            v = r.get(key)
            row[header] = "" if v is None else v
        rows.append(row)
    return rows

def main():
    in_path = Path("docs/data/submissions.json")
    out_flat = Path("docs/data/submissions_flat.json")
    out_table = Path("docs/data/submissions_table.json")
    out_stats = Path("docs/data/stats.json")
    out_questions = Path("docs/data/questions.json")

    payload = json.loads(in_path.read_text(encoding="utf-8"))
    results = payload.get("results", [])

    labeled = [flatten_and_label(r) for r in results]
    flat_rows = [r for r in labeled if r.get("consent") == "Oui"]

    out_flat.write_text(json.dumps(flat_rows, ensure_ascii=False, indent=2), encoding="utf-8")
    out_table.write_text(json.dumps(make_table_rows(flat_rows), ensure_ascii=False, indent=2), encoding="utf-8")

    stats = {"n": len(flat_rows), "counters": {}, "multi": {}}

    for section, title, field, chart in DASHBOARD_QUESTIONS:
        if chart == "bar_multi":
            continue
        stats["counters"][field] = count_single(flat_rows, field)

    stats["multi"]["sec4/obstacles_display"] = count_multi(flat_rows, "sec4/obstacles_display")
    stats["multi"]["sec4/actions_display"] = count_multi(flat_rows, "sec4/actions_display")
    stats["multi"]["sec5/sgtgtg_connus_display"] = count_multi(flat_rows, "sec5/sgtgtg_connus_display")

    out_stats.write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")

    q = [{"section": s, "title": t, "field": f, "chart": c} for (s,t,f,c) in DASHBOARD_QUESTIONS]
    out_questions.write_text(json.dumps(q, ensure_ascii=False, indent=2), encoding="utf-8")

    print("Wrote outputs OK")

if __name__ == "__main__":
    main()
