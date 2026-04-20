"""
WikiDAC - Script de migration Airtable → Supabase
Exécuter : python migration.py
"""

import csv
import io
import os
import re
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL et SUPABASE_SERVICE_KEY doivent être définis dans .env")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ─── Chemins vers tes CSV ────────────────────────────────────────────────────
# Mets ces fichiers dans le même dossier que migration.py
CSV_TERRITORIAL   = "bdd_territoriales_csv.csv"
CSV_CONNAISSANCES = "bdd_base_de_connaissances.csv"
CSV_PROCEDURES    = "bdd_procedures_internes.csv"

# ─── Utilitaires ────────────────────────────────────────────────────────────

def lire_csv(chemin):
    with open(chemin, encoding="utf-8-sig") as f:
        contenu = f.read()
    return list(csv.reader(io.StringIO(contenu), delimiter=";"))

def nettoyer(valeur):
    """Nettoie une cellule : strip, normalise les espaces."""
    return re.sub(r"\s+", " ", valeur.strip()) if valeur else ""

def splitter_cellule(valeur):
    """Découpe une cellule multi-valeurs séparées par des sauts de ligne."""
    return [nettoyer(v) for v in valeur.split("\n") if nettoyer(v)]

def upsert(table, data):
    """Insère ou met à jour silencieusement."""
    if data:
        supabase.table(table).upsert(data).execute()

# ─── Colonnes du CSV territorial ────────────────────────────────────────────
# 0  commune_nom
# 2  CRT
# 3  PAT
# 5  MDS
# 6  HAD
# 7  CLIC/MAIA
# 8  GHEF
# 9  MSP
# 10 EHPAD
# 11 Résidence autonomie
# 12 USLD
# 13 CLIC local
# 14 EPG
# 15 CCAS
# 16 EMPP/EMRR
# 17 EHPAD Hors Les Murs
# 18 SAD
# 21 SAAD PA
# 22 SAAD PH

CATEGORIES_COLONNES = {
    "CRT":                  [2],
    "PAT":                  [3],
    "MDS":                  [5],
    "HAD":                  [6],
    "CLIC/MAIA":            [7, 13],
    "GHEF":                 [8],
    "MSP":                  [9],
    "EHPAD":                [10],
    "Résidence autonomie":  [11],
    "USLD":                 [12],
    "EPG":                  [14],
    "CCAS":                 [15],
    "EMPP/EMRR":            [16],
    "EHPAD Hors Les Murs":  [17],
    "SAD":                  [18],
    "SAAD PA":              [21],
    "SAAD PH":              [22],
}

# ────────────────────────────────────────────────────────────────────────────
# ÉTAPE 1 — Migrer le module territorial
# ────────────────────────────────────────────────────────────────────────────

def migrer_territorial():
    print("\n── Module territorial ──")
    rows = lire_csv(CSV_TERRITORIAL)

    # 1a — Insérer les catégories de services
    print("  Insertion des catégories...")
    categories_data = [{"nom": cat} for cat in CATEGORIES_COLONNES.keys()]
    upsert("service_categories", categories_data)

    # Récupérer les IDs des catégories
    res = supabase.table("service_categories").select("id, nom").execute()
    cat_id = {r["nom"]: r["id"] for r in res.data}

    # 1b — Collecter tous les services uniques par catégorie
    print("  Collecte des services uniques...")
    services_par_cat = {cat: set() for cat in CATEGORIES_COLONNES}

    for row in rows:
        if len(row) < 23:
            continue
        for cat, cols in CATEGORIES_COLONNES.items():
            for col in cols:
                if col < len(row):
                    for service in splitter_cellule(row[col]):
                        if service:
                            services_par_cat[cat].add(service)

    # 1c — Insérer les services
    print("  Insertion des services...")
    services_data = []
    for cat, noms in services_par_cat.items():
        for nom in noms:
            services_data.append({"nom": nom, "category_id": cat_id[cat]})
    upsert("services", services_data)

    # Récupérer les IDs des services
    res = supabase.table("services").select("id, nom").execute()
    svc_id = {r["nom"]: r["id"] for r in res.data}

    # 1d — Insérer les communes
    print("  Insertion des communes...")
    communes_data = []
    for row in rows:
        if len(row) < 2:
            continue
        nom = nettoyer(row[1]) or nettoyer(row[0])
        if nom:
            communes_data.append({
                "nom": nom.title(),
                "nom_recherche": nom.upper()
            })
    upsert("communes", communes_data)

    # Récupérer les IDs des communes
    res = supabase.table("communes").select("id, nom_recherche").execute()
    com_id = {r["nom_recherche"]: r["id"] for r in res.data}

    # 1e — Construire les liaisons commune ↔ service
    print("  Insertion des liaisons commune ↔ service...")
    liaisons = []
    for row in rows:
        if len(row) < 2:
            continue
        nom_com = (nettoyer(row[1]) or nettoyer(row[0])).upper()
        if nom_com not in com_id:
            continue
        c_id = com_id[nom_com]

        for cat, cols in CATEGORIES_COLONNES.items():
            for col in cols:
                if col < len(row):
                    for service in splitter_cellule(row[col]):
                        if service and service in svc_id:
                            liaisons.append({
                                "commune_id": c_id,
                                "service_id": svc_id[service]
                            })

    # Dédoublonner
    liaisons_uniques = list({(l["commune_id"], l["service_id"]): l for l in liaisons}.values())
    # Insérer par lots de 500
    for i in range(0, len(liaisons_uniques), 500):
        upsert("commune_services", liaisons_uniques[i:i+500])

    print(f"  ✓ {len(rows)} communes, {sum(len(v) for v in services_par_cat.values())} services, {len(liaisons_uniques)} liaisons")

# ────────────────────────────────────────────────────────────────────────────
# ÉTAPE 2 — Migrer la base de connaissances
# ────────────────────────────────────────────────────────────────────────────

def migrer_connaissances():
    print("\n── Base de connaissances ──")
    rows = lire_csv(CSV_CONNAISSANCES)

    # Colonnes :
    # 0 title  1 ordre  2 tags  3 vide  4 auteur(texte)
    # 5 short_description  6 long_description  7 date
    # 8 category  9 fichier PDF

    kb_data = []
    for row in rows:
        if len(row) < 9 or not nettoyer(row[0]):
            continue

        tags = splitter_cellule(row[2]) if len(row) > 2 else []

        kb_data.append({
            "title":             nettoyer(row[0]),
            "tags":              tags,
            "short_description": nettoyer(row[5]) if len(row) > 5 else None,
            "long_description":  nettoyer(row[6]) if len(row) > 6 else None,
            "category":          nettoyer(row[8]) if len(row) > 8 else None,
        })

    upsert("knowledge_base", kb_data)
    print(f"  ✓ {len(kb_data)} entrées insérées")
    print("  ℹ Les PDF (col 9) sont à importer manuellement dans Supabase Storage")

# ────────────────────────────────────────────────────────────────────────────
# ÉTAPE 3 — Migrer les procédures internes
# ────────────────────────────────────────────────────────────────────────────

def migrer_procedures():
    print("\n── Procédures internes ──")
    rows = lire_csv(CSV_PROCEDURES)

    # Colonnes :
    # 0 title  1 ordre  2 tags  3 auteur initiales
    # 4 description  5 vide  6 date  7 type  8 fichier PDF

    proc_data = []
    for row in rows:
        if len(row) < 8 or not nettoyer(row[0]):
            continue

        tags = splitter_cellule(row[2]) if len(row) > 2 else []

        # Extraire la référence depuis les tags (format S77N-XX-00)
        reference = None
        for tag in tags:
            if re.match(r"S77N-", tag, re.IGNORECASE):
                reference = tag
                break

        proc_data.append({
            "title":     nettoyer(row[0]),
            "tags":      tags,
            "reference": reference,
            "type":      nettoyer(row[7]) if len(row) > 7 else None,
            "content":   nettoyer(row[4]) if len(row) > 4 else None,
        })

    upsert("procedures", proc_data)
    print(f"  ✓ {len(proc_data)} procédures insérées")
    print("  ℹ Les PDF (col 8) sont à importer manuellement dans Supabase Storage")

# ────────────────────────────────────────────────────────────────────────────
# MAIN
# ────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("WikiDAC — Migration Airtable → Supabase")
    print("=" * 45)

    migrer_territorial()
    migrer_connaissances()
    migrer_procedures()

    print("\n✓ Migration terminée.")
    print("  Vérifie tes tables dans Supabase Table Editor.")