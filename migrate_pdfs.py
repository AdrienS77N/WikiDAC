"""
WikiDAC — Migration PDFs Airtable → Supabase Storage
Exécuter : python migrate_pdfs.py
"""

import csv
import io
import os
import re
import sys
import unicodedata
import requests

sys.stdout.reconfigure(encoding="utf-8")
from dotenv import load_dotenv
from supabase import create_client

load_dotenv("wikidac-backend/.env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

CSV_CONNAISSANCES = "bdd_base_de_connaissances.csv"
CSV_PROCEDURES    = "bdd_procedures_internes.csv"


def lire_csv(chemin):
    with open(chemin, encoding="utf-8-sig") as f:
        contenu = f.read()
    return list(csv.reader(io.StringIO(contenu), delimiter=";"))

def nettoyer(val):
    return re.sub(r"\s+", " ", val.strip()) if val else ""

def sanitize_filename(nom):
    """Remplace accents, espaces et caractères spéciaux pour Supabase Storage."""
    nom = unicodedata.normalize("NFD", nom)
    nom = nom.encode("ascii", "ignore").decode("ascii")
    nom = re.sub(r"[^\w.\-]", "_", nom)
    nom = re.sub(r"_+", "_", nom)
    return nom.strip("_")

def parser_pieces_jointes(cellule):
    """Extrait les (nom_fichier, url) depuis une cellule Airtable.
    Format : 'nom.pdf (https://...), nom2.pdf (https://...)'
    """
    resultats = []
    for match in re.finditer(r'([^,(]+\.(?:pdf|docx|doc|xlsx))\s*\((https?://[^)]+)\)', cellule, re.IGNORECASE):
        nom = match.group(1).strip()
        url = match.group(2).strip()
        resultats.append((nom, url))
    return resultats

def uploader_fichier(bucket, storage_path, url, nom_fichier):
    """Télécharge depuis Airtable et uploade dans Supabase Storage."""
    print(f"    ↓ Téléchargement : {nom_fichier}")
    resp = requests.get(url, timeout=30)
    if resp.status_code != 200:
        print(f"    ✗ Erreur téléchargement ({resp.status_code}) : {url}")
        return False

    try:
        supabase.storage.from_(bucket).upload(
            storage_path,
            resp.content,
            {"content-type": resp.headers.get("content-type", "application/octet-stream")}
        )
        print(f"    ✓ Uploadé : {storage_path}")
        return True
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            print(f"    ~ Déjà présent : {storage_path}")
            return True
        print(f"    ✗ Erreur upload : {e}")
        return False


# ─── Base de connaissances ───────────────────────────────────────────────────

def migrer_pdfs_connaissances():
    print("\n── PDFs Base de connaissances ──")

    # Charger toutes les entrées Supabase (id + title)
    res = supabase.table("knowledge_base").select("id, title").execute()
    kb_par_titre = {r["title"].strip().lower(): r["id"] for r in res.data}

    rows = lire_csv(CSV_CONNAISSANCES)
    total, erreurs = 0, 0

    for row in rows:
        if len(row) < 10 or not nettoyer(row[9]):
            continue

        titre = nettoyer(row[0])
        kb_id = kb_par_titre.get(titre.lower())
        if not kb_id:
            print(f"  ✗ Entrée non trouvée en base : {titre}")
            erreurs += 1
            continue

        pieces = parser_pieces_jointes(row[9])
        if not pieces:
            continue

        print(f"  → {titre} ({len(pieces)} fichier(s))")
        for nom_fichier, url in pieces:
            storage_path = f"{kb_id}/{sanitize_filename(nom_fichier)}"
            ok = uploader_fichier("knowledge-files", storage_path, url, nom_fichier)
            if ok:
                try:
                    supabase.table("knowledge_files").upsert({
                        "knowledge_id": kb_id,
                        "file_name": nom_fichier,
                        "storage_path": storage_path,
                    }).execute()
                    total += 1
                except Exception as e:
                    print(f"    ✗ Erreur insertion knowledge_files : {e}")
            else:
                erreurs += 1

    print(f"\n  ✓ {total} fichier(s) migrés, {erreurs} erreur(s)")


# ─── Procédures internes ─────────────────────────────────────────────────────

def migrer_pdfs_procedures():
    print("\n── PDFs Procédures internes ──")

    res = supabase.table("procedures").select("id, title").execute()
    proc_par_titre = {r["title"].strip().lower(): r["id"] for r in res.data}

    rows = lire_csv(CSV_PROCEDURES)
    total, erreurs = 0, 0

    for row in rows:
        if len(row) < 9 or not nettoyer(row[8]):
            continue

        titre = nettoyer(row[0])
        proc_id = proc_par_titre.get(titre.lower())
        if not proc_id:
            print(f"  ✗ Procédure non trouvée en base : {titre}")
            erreurs += 1
            continue

        pieces = parser_pieces_jointes(row[8])
        if not pieces:
            continue

        print(f"  → {titre} ({len(pieces)} fichier(s))")
        for nom_fichier, url in pieces:
            storage_path = f"{proc_id}/{sanitize_filename(nom_fichier)}"
            ok = uploader_fichier("procedure-files", storage_path, url, nom_fichier)
            if ok:
                try:
                    supabase.table("procedure_files").upsert({
                        "procedure_id": proc_id,
                        "file_name": nom_fichier,
                        "storage_path": storage_path,
                    }).execute()
                    total += 1
                except Exception as e:
                    print(f"    ✗ Erreur insertion procedure_files : {e}")
            else:
                erreurs += 1

    print(f"\n  ✓ {total} fichier(s) migrés, {erreurs} erreur(s)")


# ─── Main ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("WikiDAC - Migration PDFs Airtable -> Supabase")
    print("=" * 45)
    migrer_pdfs_connaissances()
    migrer_pdfs_procedures()
    print("\n✓ Migration terminée.")
