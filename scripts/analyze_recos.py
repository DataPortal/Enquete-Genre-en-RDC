import json
from pathlib import Path
from datetime import datetime

# Import local (car on exécute: python scripts/analyze_recos.py)
from mappings import YES_NO, YES_NO_NP  # noqa: F401  (si tu veux les utiliser plus tard)

def pct(counter: dict, key: str):
    if not counter:
        return None
    total = sum(v for k, v in counter.items() if k != "_missing")
    if total == 0:
        return None
    return round((counter.get(key, 0) / total) * 100)

def top_items(d: dict, n=6):
    items = [(k, v) for k, v in (d or {}).items() if k and k != "_missing"]
    items.sort(key=lambda x: x[1], reverse=True)
    return items[:n]

def main():
    stats_path = Path("docs/data/stats.json")
    out_path = Path("docs/data/recommendations_global.json")

    stats = json.loads(stats_path.read_text(encoding="utf-8"))
    c = stats.get("counters", {})
    m = stats.get("multi", {})
    n = stats.get("n", 0)

    # Signaux clés (% Oui)
    cellule_oui = pct(c.get("sec3/cellule_genre", {}), "Oui")
    plan_oui = pct(c.get("sec3/plan_action_genre", {}), "Oui")
    plan_partial = pct(c.get("sec3/plan_action_genre", {}), "Partiellement / Je ne sais pas")
    ind_oui = pct(c.get("sec3/indicateurs_genre", {}), "Oui")
    ind_partial = pct(c.get("sec3/indicateurs_genre", {}), "Partiellement / Je ne sais pas")
    outils_oui = pct(c.get("sec3/outils_guide_genre", {}), "Oui")
    formation_oui = pct(c.get("sec1/formation_genre", {}), "Oui")
    politiques_oui = pct(c.get("sec2/politiques_genre_connaissance", {}), "Oui")
    gtg_oui = pct(c.get("sec5/gtg_connaissance", {}), "Oui")

    top_obstacles = top_items(m.get("sec4/obstacles_display", {}), 8)
    top_actions = top_items(m.get("sec4/actions_display", {}), 8)

    # Recos globales (règles simples, lisibles)
    recos = []

    # Institutionnalisation
    if cellule_oui is None or cellule_oui < 60:
        recos.append(
            "Institutionnaliser une Cellule Genre dans chaque ministère (mandat, ToR, points focaux, reporting mensuel) "
            "et clarifier les responsabilités de coordination."
        )

    # Plan / stratégie
    if plan_oui is None or plan_oui < 55:
        if (plan_partial or 0) >= 20:
            recos.append(
                "Transformer les plans/stratégies genre partiels en documents formalisés (objectifs, activités, coûts, échéances) "
                "et intégrer un mécanisme de suivi trimestriel."
            )
        else:
            recos.append(
                "Élaborer/actualiser un plan ou une stratégie genre (12 mois) aligné sur les cadres nationaux/internationaux, "
                "avec budget estimatif et calendrier de mise en œuvre."
            )

    # Indicateurs
    if ind_oui is None or ind_oui < 55:
        if (ind_partial or 0) >= 20:
            recos.append(
                "Standardiser l’intégration d’indicateurs sensibles au genre (minimum commun) et renforcer la désagrégation par sexe "
                "dans les outils de reporting sectoriels."
            )
        else:
            recos.append(
                "Définir un set minimal d’indicateurs sensibles au genre (process/output/outcome) et rendre obligatoire la désagrégation par sexe "
                "dans les rapports et tableaux de bord."
            )

    # Outils / guide
    if outils_oui is None or outils_oui < 60:
        recos.append(
            "Déployer un kit d’outils opérationnels (checklist mainstreaming, fiche projet, grille d’analyse, modèle rapport) "
            "accessible à tous (drive/portail) et accompagné d’un court guide d’utilisation."
        )

    # Formation
    if formation_oui is None or formation_oui < 60:
        recos.append(
            "Mettre en œuvre un plan de renforcement des capacités (sessions courtes + coaching sur cas réels) "
            "différencié par profils (SG, directeurs, chefs de division, agents)."
        )

    # Politiques genre
    if politiques_oui is None or politiques_oui < 60:
        recos.append(
            "Renforcer l’appropriation des politiques genre (CEDAW, Beijing, Rés. 1325, cadres nationaux) via fiches synthèse "
            "et ateliers ciblés par ministère/secteur."
        )

    # GTG / coordination
    if gtg_oui is None or gtg_oui < 60:
        recos.append(
            "Accroître la visibilité et la participation au Groupe Thématique du Genre (GTG) et à ses sous-groupes "
            "via onboarding, calendrier partagé et points de contact par ministère."
        )

    # Ancrage “evidence-based” sur obstacles/actions
    if top_obstacles:
        recos.append(
            "Mettre en place un plan de mitigation des obstacles les plus fréquents (Top obstacles), avec responsables, échéances "
            "et indicateurs de suivi."
        )
    if top_actions:
        recos.append(
            "Traduire les actions prioritaires (Top actions) en plan opérationnel commun : activités, responsables, ressources nécessaires "
            "et modalités de redevabilité."
        )

    payload = {
        "generated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "n": n,
        "signals": {
            "cellule_genre_oui_pct": cellule_oui,
            "plan_action_oui_pct": plan_oui,
            "plan_action_partial_pct": plan_partial,
            "indicateurs_oui_pct": ind_oui,
            "indicateurs_partial_pct": ind_partial,
            "outils_oui_pct": outils_oui,
            "formation_oui_pct": formation_oui,
            "politiques_connues_oui_pct": politiques_oui,
            "gtg_connu_oui_pct": gtg_oui,
        },
        "top_obstacles": [{"label": k, "count": v} for k, v in top_obstacles],
        "top_actions": [{"label": k, "count": v} for k, v in top_actions],
        "recommendations": recos,
    }

    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote -> {out_path}")

if __name__ == "__main__":
    main()
