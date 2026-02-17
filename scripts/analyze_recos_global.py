import json
from pathlib import Path
from datetime import datetime

def pct(counter, key):
    total = sum(v for k,v in counter.items() if k != "_missing")
    if total == 0: return None
    return round((counter.get(key, 0) / total) * 100)

def top_items(d, n=5):
    items = [(k,v) for k,v in (d or {}).items() if k and k != "_missing"]
    items.sort(key=lambda x: x[1], reverse=True)
    return items[:n]

def main():
    stats_path = Path("docs/data/stats.json")
    out_path = Path("docs/data/recommendations_global.json")

    stats = json.loads(stats_path.read_text(encoding="utf-8"))
    c = stats.get("counters", {})
    m = stats.get("multi", {})
    n = stats.get("n", 0)

    # Key global signals
    cellule_oui = pct(c.get("sec3/cellule_genre", {}), "Oui")
    plan_oui = pct(c.get("sec3/plan_action_genre", {}), "Oui")
    ind_oui = pct(c.get("sec3/indicateurs_genre", {}), "Oui")
    outils_oui = pct(c.get("sec3/outils_guide_genre", {}), "Oui")
    formation_oui = pct(c.get("sec1/formation_genre", {}), "Oui")
    politiques_oui = pct(c.get("sec2/politiques_genre_connaissance", {}), "Oui")
    gtg_oui = pct(c.get("sec5/gtg_connaissance", {}), "Oui")

    top_obstacles = top_items(m.get("sec4/obstacles_display", {}), 6)
    top_actions = top_items(m.get("sec4/actions_display", {}), 6)

    # Build global recommendations (rule-based, readable)
    recos = []
    if cellule_oui is None or cellule_oui < 60:
        recos.append("Institutionnaliser une Cellule Genre dans les ministères (mandat, ToR, reporting mensuel, points focaux).")
    if plan_oui is None or plan_oui < 50:
        recos.append("Formaliser un plan/stratégie genre (12 mois) aligné sur les politiques et priorités nationales, avec budget estimatif.")
    if ind_oui is None or ind_oui < 50:
        recos.append("Définir un set minimal d’indicateurs sensibles au genre + exigence de désagrégation par sexe dans les rapports.")
    if outils_oui is None or outils_oui < 60:
        recos.append("Déployer un kit d’outils (checklist mainstreaming, fiche projet, grille analyse, modèle rapport) accessible à tous.")
    if formation_oui is None or formation_oui < 60:
        recos.append("Mettre en œuvre un plan de formation (sessions courtes + coaching pratique) adapté aux profils (SG, directeurs, chefs de division).")
    if politiques_oui is None or politiques_oui < 60:
        recos.append("Renforcer l’appropriation des politiques genre (CEDAW, 1325, cadres nationaux) via fiches synthèse et ateliers ciblés.")
    if gtg_oui is None or gtg_oui < 60:
        recos.append("Accroître la visibilité/participation au GTG et aux sous-groupes (VBG, ESSJF, RPEAF, PPLF) via onboarding et calendrier partagé.")

    # Force alignment with declared top obstacles/actions
    if top_obstacles:
        recos.append("Cibler prioritairement les obstacles les plus fréquents (voir Top obstacles) avec un plan de mitigation par responsable.")
    if top_actions:
        recos.append("Décliner les actions prioritaires (voir Top actions) en plan opérationnel : activités, responsables, échéances, indicateurs.")

    payload = {
        "generated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "n": n,
        "signals": {
            "cellule_genre_oui_pct": cellule_oui,
            "plan_action_oui_pct": plan_oui,
            "indicateurs_oui_pct": ind_oui,
            "outils_oui_pct": outils_oui,
            "formation_oui_pct": formation_oui,
            "politiques_connues_oui_pct": politiques_oui,
            "gtg_connu_oui_pct": gtg_oui,
        },
        "top_obstacles": [{"label": k, "count": v} for k,v in top_obstacles],
        "top_actions": [{"label": k, "count": v} for k,v in top_actions],
        "recommendations": recos,
    }

    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote global recos -> {out_path}")

if __name__ == "__main__":
    main()
