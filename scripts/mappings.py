# scripts/mappings.py

# Generic yes/no mappings
YES_NO = {
    "oui": "Oui",
    "non": "Non",
    "np": "Partiellement / Je ne sais pas",
}

SEXE = {
    "feminin": "Féminin",
    "masculin": "Masculin",
}

FONCTION = {
    "ministre": "Ministre",
    "ministre_provincial": "Ministre provincial",
    "sg": "Secrétaire Général·e",
    "directeur": "Directeur(trice)",
    "chef_division": "Chef de Division",
    "chef_bureau": "Chef de Bureau",
    "attache_agent": "Attaché·e / Agent·e",
    "autre": "Autre",
}

EXPERIENCE = {
    "0_1": "Moins de 1 an",
    "1_3": "1 à 3 ans",
    "4_6": "4 à 6 ans",
    "7_10": "7 à 10 ans",
    "11_15": "11 à 15 ans",
    "16_plus": "Plus de 15 ans",
}

NIVEAU = {
    "bonne": "Bonne",
    "moyenne": "Moyenne",
    "faible": "Faible",
}

VRAI_FAUX = {
    "vrai": "Vrai",
    "faux": "Faux",
}

FREQ = {
    "mensuelle": "Mensuelle",
    "trimestrielle": "Trimestrielle",
    "semestrielle": "Semestrielle",
    "annuelle": "Annuelle",
    "occasionnelle": "Ad hoc / Occasionnelle",
    "jamais": "Jamais / Non organisé",
}

MINISTERE = {
    "genre_famille": "Ministère du Genre, Famille et Enfant",
    "plan": "Ministère du Plan",
    "finances": "Ministère des Finances",
    "budget": "Ministère du Budget",
    "economie_nationale": "Ministère de l’Économie Nationale",
    "affaires_etrangeres": "Ministère des Affaires Étrangères, Coopération Internationale et Francophonie",
    "interieur_securite": "Ministère de l’Intérieur, Sécurité et Affaires Coutumières",
    "defense": "Ministère de la Défense Nationale et Anciens Combattants",
    "justice": "Ministère de la Justice et Garde des Sceaux",
    "travail_prevoyance": "Ministère du Travail, Emploi et Prévoyance Sociale",
    "fonction_publique": "Ministère de la Fonction Publique, Modernisation de l’Administration et Innovation du Service Public",
    "sante_publique": "Ministère de la Santé Publique, Hygiène et Prévention",
    "education_epst": "Ministère de l’Éducation Nationale et Nouvelle Citoyenneté (EPST)",
    "enseignement_superieur": "Ministère de l’Enseignement Supérieur et Universitaire",
    "agriculture": "Ministère de l’Agriculture",
    "peche_elevage": "Ministère de la Pêche et de l’Élevage",
    "developpement_rural": "Ministère du Développement Rural",
    "environnement_ddd": "Ministère de l’Environnement et Développement Durable",
    "ressources_hydrauliques": "Ministère des Ressources Hydrauliques et Électricité",
    "hydrocarbures": "Ministère des Hydrocarbures",
    "mines": "Ministère des Mines",
    "industrie": "Ministère de l’Industrie",
    "commerce_exterieur": "Ministère du Commerce Extérieur",
    "transports_vcd": "Ministère des Transports, Voies de Communication et Désenclavement",
    "ports_voies_navigables": "Ministère des Ports, Voies Navigables et Désenclavement",
    "urbanisme_habitat": "Ministère de l’Urbanisme et Habitat",
    "amenagement_territoire": "Ministère de l’Aménagement du Territoire",
    "foncier": "Ministère des Affaires Foncières",
    "ptntic": "Ministère des Postes, Télécommunications et Nouvelles Technologies de l’Information et de la Communication",
    "communication_medias": "Ministère de la Communication et Médias",
    "jeunesse": "Ministère de la Jeunesse et Éveil Patriotique",
    "sports_loisirs": "Ministère des Sports et Loisirs",
    "culture_arts_patrimoine": "Ministère de la Culture, Arts et Patrimoine",
    "tourisme": "Ministère du Tourisme",
    "relations_parlement": "Ministère des Relations avec le Parlement",
    "droits_humains": "Ministère des Droits Humains",
    "affaires_sociales": "Ministère des Affaires Sociales, Actions Humanitaires et Solidarité Nationale",
    "autre": "Autre (à préciser)",
}

OBSTACLES = {
    "obs1": "Manque de financement dédié au genre",
    "obs2": "Manque de ressources humaines qualifiées",
    "obs3": "Faible engagement de la hiérarchie",
    "obs4": "Absence de données désagrégées par sexe",
    "obs5": "Absence de politique ou stratégie claire",
    "obs6": "Manque de coordination interinstitutionnelle",
    "obs7": "Priorités sectorielles non sensibles au genre",
    "obs8": "Autre (à préciser)",
}

ACTIONS = {
    "act1": "Renforcer les capacités du personnel",
    "act2": "Nommer et former les points focaux genre",
    "act3": "Intégrer le genre dans la planification et le budget",
    "act4": "Produire des données désagrégées par sexe",
    "act5": "Allouer un budget spécifique au genre",
    "act6": "Créer un cadre de concertation interinstitutionnel",
    "act7": "Autre (à préciser)",
}

SGTGTG = {
    "vbg": "Violences Basées sur le Genre (VBG)",
    "essjf": "Égalité des Sexes et Habilitation du Statut Juridique de la Femme (ESSJF)",
    "rpeaf": "Renforcement du Pouvoir Économique et Autonomisation de la Femme (RPEAF)",
    "pplf": "Participation Politique de la Femme et Leadership Féminin (PPLF)",
}

def map_one(value, mapping: dict):
    if value is None:
        return None
    if isinstance(value, str):
        v = value.strip()
        if not v:
            return value
        return mapping.get(v, value)
    return value

def map_multi(value, mapping: dict):
    # multiselect like: "obs2 obs3 obs4"
    if value is None:
        return []
    if isinstance(value, list):
        items = value
    elif isinstance(value, str):
        items = value.strip().split() if value.strip() else []
    else:
        items = []
    return [mapping.get(x, x) for x in items]
