"""
WikiDAC — Correction catégorie CLIC/MAIA → ESA + SSIAD
Lancer : python fix_esa_ssiad.py
"""
import sys
sys.stdout.reconfigure(encoding="utf-8")

import csv, io, os, re
from dotenv import load_dotenv
from supabase import create_client

load_dotenv("wikidac-backend/.env")
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))

# ── Lire le CSV pour extraire les noms exacts par colonne ────────────────────
with open("bdd_territoriales_csv.csv", encoding="utf-8-sig") as f:
    rows = list(csv.reader(f, delimiter=";"))

def extraire_col(rows, col):
    vals = set()
    for row in rows:
        for v in (row[col] if len(row) > col else "").split("\n"):
            v = v.strip()
            if v: vals.add(v)
    return vals

noms_esa   = extraire_col(rows, 7)   # col 7 = ESA
noms_ssiad = extraire_col(rows, 13)  # col 13 = SSIAD

print("ESA   :", sorted(noms_esa))
print("SSIAD :", sorted(noms_ssiad))
print()

def normaliser(s):
    return re.sub(r"\s+", " ", s.strip().lower())

noms_esa_norm   = {normaliser(n): n for n in noms_esa}
noms_ssiad_norm = {normaliser(n): n for n in noms_ssiad}

# ── 1. Récupérer la catégorie CLIC/MAIA ─────────────────────────────────────
res = supabase.table("service_categories").select("id, nom").execute()
cats = {r["nom"]: r["id"] for r in res.data}

if "CLIC/MAIA" not in cats:
    print("Catégorie CLIC/MAIA introuvable — vérifier le nom exact en base.")
    print("Catégories existantes :", list(cats.keys()))
    sys.exit(1)

clic_maia_id = cats["CLIC/MAIA"]
print(f"CLIC/MAIA id = {clic_maia_id}")

# ── 2. Renommer CLIC/MAIA → SSIAD ───────────────────────────────────────────
supabase.table("service_categories").update({"nom": "SSIAD"}).eq("id", clic_maia_id).execute()
print("✓ CLIC/MAIA renommé en SSIAD")
ssiad_id = clic_maia_id

# ── 3. Créer la catégorie ESA ────────────────────────────────────────────────
res = supabase.table("service_categories").insert({"nom": "ESA"}).execute()
esa_id = res.data[0]["id"]
print(f"✓ Catégorie ESA créée (id={esa_id})")

# ── 4. Récupérer les services actuellement sous SSIAD (ex CLIC/MAIA) ─────────
res = supabase.table("services").select("id, nom").eq("category_id", ssiad_id).execute()
services_ssiad = res.data
print(f"\n{len(services_ssiad)} services à reclasser :")

esa_count = ssiad_count = doublon_count = 0

for svc in services_ssiad:
    nom_norm = normaliser(svc["nom"])
    in_esa   = nom_norm in noms_esa_norm
    in_ssiad = nom_norm in noms_ssiad_norm

    if in_esa and not in_ssiad:
        # Uniquement ESA → déplacer
        supabase.table("services").update({"category_id": esa_id}).eq("id", svc["id"]).execute()
        print(f"  → ESA   : {svc['nom']}")
        esa_count += 1

    elif in_esa and in_ssiad:
        # Les deux → garder sous SSIAD ET créer un doublon sous ESA
        res2 = supabase.table("services").insert({"nom": svc["nom"], "category_id": esa_id}).execute()
        new_id = res2.data[0]["id"]

        # Dupliquer les liaisons commune_services pour le nouveau service ESA
        liaisons = supabase.table("commune_services").select("commune_id").eq("service_id", svc["id"]).execute()
        if liaisons.data:
            new_liaisons = [{"commune_id": l["commune_id"], "service_id": new_id} for l in liaisons.data]
            for i in range(0, len(new_liaisons), 500):
                supabase.table("commune_services").upsert(new_liaisons[i:i+500]).execute()

        print(f"  → SSIAD+ESA : {svc['nom']} (service ESA dupliqué, {len(liaisons.data)} communes)")
        doublon_count += 1

    else:
        # Uniquement SSIAD → ne rien faire
        print(f"  ~ SSIAD : {svc['nom']}")
        ssiad_count += 1

print(f"\n✓ {esa_count} services déplacés en ESA")
print(f"✓ {doublon_count} services dupliqués (ESA + SSIAD)")
print(f"✓ {ssiad_count} services conservés en SSIAD")
print("\nCorrection terminée.")
