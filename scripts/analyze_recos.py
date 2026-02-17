import json
from pathlib import Path
from datetime import datetime


def pct(counter: dict, key: str):
    """
    Percent of a category in a counter dict (excluding _missing).
    Returns int percentage or None.
    """
    if not counter:
        return None
    total = sum(v for k, v in counter.items() if k != "_missing")
    if total == 0:
        return None
    return round((counter.get(key, 0) / total) * 100)


def top_items(d: dict, n=8):
    """
    Returns top N items from a dict (label->count), excluding _missing.
    """
    items = [(k, v) for k, v in (d or {}).items() if k and k != "_missing"]
    items.sort(key=lambda x: x[1], reverse=True)
    return items[:n]


def safe_get_counter(stats: dict, key: str) -> dict:
    return (stats.get("counters") or {}).get(key) or {}


def safe_get_multi(stats: dict, key: str) -> dict:
    return (stats.get("multi") or {}).get(key) or {}


def build_recommendations(signals: dict, top_obstacles: list, top_actions: list):
    """
    Rule-based global recommendations. Returns list[str] in priority order.
    """
    recos = []

    cellule = signals.get("cellule_genre_oui_pct")
    plan_oui = signals.get("plan_action_oui_pct")
    plan_np = signals.get("plan_action_np_pct")
    ind_oui = signals.get("indicateurs_oui_pct")
    ind_np = signals.get("indicateurs_np_pct")
    outils = signals.get("outils_oui_pct")
    formation = signals.get("formation_oui_pct")
    politiques = signals.get("politiques_connues_oui_pct")
    gtg = signals.get("gtg_connu_oui_pct")

    # 1) Gouvernance / dispositif institutionnel
    if cellule is None or cellule < 60:
        recos.append(
            "Institutionnaliser une Cellule Genre dans chaque ministère (mandat, ToR, points focaux, mécanisme de reporting) "
            "et formaliser la chaîne de redevabilité."
        )

    # 2) Planification
    if plan_oui is None or plan_oui < 55:
        if (plan_np or 0) >= 20:
            recos.append(
                "Convertir les éléments partiels liés au plan/stratégie genre en document formalisé (objectifs, activités, coûts, "
                "échéancier, responsables) et instaurer une revue trimestrielle."
            )
        else:
            recos.append(
                "Élaborer/actualiser un plan ou une stratégie genre (12 mois) aligné(e) sur les cadres nationaux/internationaux, "
                "avec budget estimatif et calendrier de mise en œuvre."
            )

    # 3) Indicateurs & données
    if ind_oui is None or ind_oui < 55:
        if (ind_np or 0) >= 20:
            recos.append(
                "Standardiser l’intégration d’indicateurs sensibles au genre dans les programmes (minimum commun) et renforcer "
                "la désagrégation par sexe (collecte, analyse, reporting)."
            )
        else:
            recos.append(
                "Définir un set minimal d’indicateurs sensibles au genre (process/output/outcome) et rendre obligatoire la "
                "désagrégation par sexe dans les rapports et tableaux de bord sectoriels."
            )

    # 4) Outils opérationnels
    if outils is None or outils < 60:
        recos.append(
            "Déployer un kit d’outils opérationnels (checklist mainstreaming, fiche projet, grille d’analyse, modèle rapport) "
            "accessible à tous (drive/portail) et accompagné d’un guide court."
        )

    # 5) Capacités
    if formation is None or formation < 60:
        recos.append(
            "Mettre en œuvre un plan de renforcement des capacités (sessions courtes + coaching sur cas réels), différencié "
            "selon les profils (SG, directions, divisions, agents)."
        )

    # 6) Appropriation des politiques
    if politiques is None or politiques < 60:
        recos.append(
            "Renforcer l’appropriation des politiques genre (CEDAW, Beijing, Rés. 1325, cadres nationaux) via fiches synthèse, "
            "sessions d’appropriation et intégration dans les processus internes."
        )

    # 7) Coordination / GTG
    if gtg is None or gtg < 60:
        recos.append(
            "Accroître la visibilité et la participation au Groupe Thématique du Genre (GTG) et aux sous-groupes via onboarding, "
            "calendrier partagé et points de contact par ministère."
        )

    # 8) Evidence-based: obstacles & actions déclarés
    if top_obstacles:
        obs_list = ", ".join([x["label"] for x in top_obstacles[:5]])
        recos.append(
            f"Traiter en priorité les obstacles les plus fréquents identifiés par les répondants (Top : {obs_list}) avec un "
            "plan de mitigation (responsables, échéances, indicateurs)."
        )

    if top_actions:
        act_list = ", ".join([x["label"] for x in top_actions[:5]])
        recos.append(
            f"Opérationnaliser les actions prioritaires déclarées (Top : {act_list}) en plan d’actions inter-ministériel "
            "(qui fait quoi, quand, avec quels moyens)."
        )

    # Déduplication (au cas où)
    out = []
    seen = set()
    for r in recos:
        if r not in seen:
            seen.add(r)
            out.append(r)

    return out


def main():
    stats_path = Path("docs/data/stats.json")
    out_path = Path("docs/data/recommendations_global.json")

    if not stats_path.exists():
        raise FileNotFoundError(f"Missing file: {stats_path}. Run transform.py first.")

    stats = json.loads(stats_path.read_text(encoding="utf-8"))
    n = stats.get("n", 0)

    # Counters
    consent = safe_get_counter(stats, "consent")  # may not exist; ok
    formation_counter = safe_get_counter(stats, "sec1/formation_genre")
    cellule_counter = safe_get_counter(stats, "sec3/cellule_genre")
    plan_counter = safe_get_counter(stats, "sec3/plan_action_genre")
    indic_counter = safe_get_counter(stats, "sec3/indicateurs_genre")
    outils_counter = safe_get_counter(stats, "sec3/outils_guide_genre")
    pol_counter = safe_get_counter(stats, "sec2/politiques_genre_connaissance")
    gtg_counter = safe_get_counter(stats, "sec5/gtg_connaissance")

    # Multi
    obstacles_multi = safe_get_multi(stats, "sec4/obstacles_display")
    actions_multi = safe_get_multi(stats, "sec4/actions_display")

    # Signals
    signals = {
        "formation_oui_pct": pct(formation_counter, "Oui"),
        "cellule_genre_oui_pct": pct(cellule_counter, "Oui"),
        "plan_action_oui_pct": pct(plan_counter, "Oui"),
        "plan_action_np_pct": pct(plan_counter, "Partiellement / Je ne sais pas"),
        "indicateurs_oui_pct": pct(indic_counter, "Oui"),
        "indicateurs_np_pct": pct(indic_counter, "Partiellement / Je ne sais pas"),
        "outils_oui_pct": pct(outils_counter, "Oui"),
        "politiques_connues_oui_pct": pct(pol_counter, "Oui"),
        "gtg_connu_oui_pct": pct(gtg_counter, "Oui"),
    }

    top_obstacles = [{"label": k, "count": v} for k, v in top_items(obstacles_multi, 8)]
    top_actions = [{"label": k, "count": v} for k, v in top_items(actions_multi, 8)]

    recos = build_recommendations(signals, top_obstacles, top_actions)

    payload = {
        "generated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "n": n,
        "signals": signals,
        "top_obstacles": top_obstacles,
        "top_actions": top_actions,
        "recommendations": recos,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote -> {out_path}")


if __name__ == "__main__":
    main()
