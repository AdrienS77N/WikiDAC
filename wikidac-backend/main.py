"""
WikiDAC - Backend FastAPI
Lancer : uvicorn main:app --reload
"""

import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client
from pydantic import BaseModel
from typing import Optional, List

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL et SUPABASE_SERVICE_KEY manquants dans .env")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="WikiDAC API", version="0.1.0")

# CORS — autorise le frontend React (port 5173 par défaut avec Vite)
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# SANTÉ
# ─────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "app": "WikiDAC API"}


@app.get("/stats")
def get_stats():
    """Retourne les compteurs globaux pour le dashboard."""
    communes     = supabase.table("communes").select("id", count="exact").execute()
    services     = supabase.table("services").select("id", count="exact").execute()
    categories   = supabase.table("service_categories").select("id", count="exact").execute()
    connaissances = supabase.table("knowledge_base").select("id", count="exact").execute()
    procedures   = supabase.table("procedures").select("id", count="exact").execute()
    liens        = supabase.table("links").select("id", count="exact").execute()
    fichiers_kb  = supabase.table("knowledge_files").select("id", count="exact").execute()
    fichiers_proc = supabase.table("procedure_files").select("id", count="exact").execute()

    recentes = supabase.table("knowledge_base") \
        .select("id, title, category, updated_at") \
        .order("updated_at", desc=True).limit(5).execute()

    return {
        "communes":      communes.count,
        "services":      services.count,
        "categories":    categories.count,
        "connaissances": connaissances.count,
        "procedures":    procedures.count,
        "liens":         liens.count,
        "fichiers":      (fichiers_kb.count or 0) + (fichiers_proc.count or 0),
        "recentes":      recentes.data,
    }


# ─────────────────────────────────────────────
# MODULE TERRITORIAL
# ─────────────────────────────────────────────

@app.get("/communes")
def get_communes(search: str = Query(default=None)):
    """
    Retourne toutes les communes.
    Paramètre optionnel : ?search=meaux
    """
    query = supabase.table("communes").select("id, nom, nom_recherche")
    if search:
        query = query.ilike("nom_recherche", f"%{search.upper()}%")
    res = query.order("nom").execute()
    return res.data


@app.get("/communes/{commune_id}/services")
def get_services_par_commune(commune_id: str):
    """
    Retourne tous les services disponibles pour une commune,
    groupés par catégorie.
    """
    # Récupérer les services via la table de liaison
    res = supabase.table("commune_services") \
        .select("service_id, services(id, nom, service_categories(id, nom))") \
        .eq("commune_id", commune_id) \
        .execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="Commune non trouvée ou aucun service")

    # Grouper par catégorie
    groupes = {}
    for row in res.data:
        svc = row["services"]
        cat = svc["service_categories"]["nom"]
        if cat not in groupes:
            groupes[cat] = []
        groupes[cat].append({"id": svc["id"], "nom": svc["nom"]})

    return groupes


@app.get("/services/categories")
def get_categories():
    """Retourne toutes les catégories de services."""
    res = supabase.table("service_categories").select("*").order("nom").execute()
    return res.data


# ─────────────────────────────────────────────
# BASE DE CONNAISSANCES
# ─────────────────────────────────────────────

@app.get("/connaissances")
def get_connaissances(
    search: str = Query(default=None),
    tag: str = Query(default=None),
    category: str = Query(default=None),
):
    query = supabase.table("knowledge_base") \
        .select("id, title, tags, short_description, category, updated_at")

    if search:
        query = query.or_(
            f"title.ilike.%{search}%,"
            f"short_description.ilike.%{search}%,"
            f"long_description.ilike.%{search}%,"
            f"category.ilike.%{search}%,"
            f"tags.cs.{{\"{search}\"}}"
        )
    if category:
        query = query.ilike("category", f"%{category}%")
    if tag:
        query = query.contains("tags", [tag])

    res = query.order("title").execute()
    return res.data


@app.get("/connaissances/{kb_id}")
def get_connaissance(kb_id: str):
    """Retourne le détail complet d'une entrée."""
    res = supabase.table("knowledge_base") \
        .select("*, knowledge_files(id, file_name, storage_path)") \
        .eq("id", kb_id) \
        .single() \
        .execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="Entrée non trouvée")
    return res.data


# ─────────────────────────────────────────────
# PROCÉDURES INTERNES
# ─────────────────────────────────────────────

@app.get("/procedures")
def get_procedures(
    search: str = Query(default=None),
    type: str = Query(default=None),
):
    """
    Retourne les procédures internes.
    Filtres optionnels : ?search=parking  ?type=Note de service
    """
    query = supabase.table("procedures") \
        .select("id, title, reference, type, version, updated_at")

    if search:
        query = query.ilike("title", f"%{search}%")
    if type:
        query = query.ilike("type", f"%{type}%")

    res = query.order("title").execute()
    return res.data


@app.get("/procedures/{proc_id}")
def get_procedure(proc_id: str):
    """Retourne le détail complet d'une procédure."""
    res = supabase.table("procedures") \
        .select("*, procedure_files(id, file_name, storage_path)") \
        .eq("id", proc_id) \
        .single() \
        .execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="Procédure non trouvée")
    return res.data


# ─────────────────────────────────────────────
# LIENS UTILES
# ─────────────────────────────────────────────

@app.get("/liens")
def get_liens(tag: str = Query(default=None)):
    """
    Retourne les liens utiles.
    Filtre optionnel : ?tag=CPAM
    """
    query = supabase.table("links").select("*")
    if tag:
        query = query.contains("tags", [tag])
    res = query.order("title").execute()
    return res.data


@app.delete("/liens/{lien_id}")
def delete_lien(lien_id: str):
    supabase.table("links").delete().eq("id", lien_id).execute()
    return {"ok": True}


class KnowledgeCreate(BaseModel):
    title: str
    tags: Optional[List[str]] = []
    short_description: Optional[str] = None
    long_description: Optional[str] = None
    category: Optional[str] = None

class KnowledgeUpdate(BaseModel):
    title: Optional[str] = None
    tags: Optional[List[str]] = None
    short_description: Optional[str] = None
    long_description: Optional[str] = None
    category: Optional[str] = None


@app.post("/connaissances")
def create_connaissance(data: KnowledgeCreate):
    """Crée une nouvelle entrée dans la base de connaissances."""
    res = supabase.table("knowledge_base").insert(data.model_dump()).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Erreur lors de la création")
    return res.data[0]


@app.delete("/connaissances/{kb_id}")
def delete_connaissance(kb_id: str):
    supabase.table("knowledge_files").delete().eq("knowledge_id", kb_id).execute()
    supabase.table("knowledge_base").delete().eq("id", kb_id).execute()
    return {"ok": True}


@app.put("/connaissances/{kb_id}")
def update_connaissance(kb_id: str, data: KnowledgeUpdate):
    """Met à jour une entrée existante (auteur ou admin uniquement)."""
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    if not payload:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")
    res = supabase.table("knowledge_base").update(payload).eq("id", kb_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Entrée non trouvée")
    return res.data[0]

class FileCreate(BaseModel):
    file_name: str
    storage_path: str

@app.post("/connaissances/{kb_id}/files")
def add_knowledge_file(kb_id: str, data: FileCreate):
    """Enregistre un fichier uploadé dans Supabase Storage."""
    res = supabase.table("knowledge_files").insert({
        "knowledge_id": kb_id,
        "file_name": data.file_name,
        "storage_path": data.storage_path
    }).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Erreur lors de l'enregistrement du fichier")
    return res.data[0]

# ─────────────────────────────────────────────
# ADMIN — UTILISATEURS
# ─────────────────────────────────────────────

class UserInvite(BaseModel):
    email: str
    full_name: Optional[str] = None
    role: str = "reader"

class UserRoleUpdate(BaseModel):
    role: str

@app.get("/admin/users")
def admin_get_users():
    res = supabase.table("users").select("*").order("created_at").execute()
    return res.data

@app.post("/admin/users/invite")
def admin_invite_user(data: UserInvite):
    try:
        res = supabase.auth.admin.invite_user_by_email(data.email)
        user_id = res.user.id
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    supabase.table("users").upsert({
        "id": user_id,
        "email": data.email,
        "full_name": data.full_name or "",
        "role": data.role,
    }).execute()
    return {"ok": True, "id": user_id}

@app.put("/admin/users/{user_id}/role")
def admin_update_role(user_id: str, data: UserRoleUpdate):
    if data.role not in ("admin", "editor", "reader"):
        raise HTTPException(status_code=400, detail="Rôle invalide")
    supabase.table("users").update({"role": data.role}).eq("id", user_id).execute()
    return {"ok": True}

@app.delete("/admin/users/{user_id}")
def admin_delete_user(user_id: str):
    try:
        supabase.auth.admin.delete_user(user_id)
    except Exception:
        pass
    supabase.table("users").delete().eq("id", user_id).execute()
    return {"ok": True}


# ─────────────────────────────────────────────
# ADMIN — MODULE TERRITORIAL
# ─────────────────────────────────────────────

class ServiceCreate(BaseModel):
    nom: str
    category_id: str

@app.get("/admin/communes/{commune_id}/services")
def admin_get_services_commune(commune_id: str):
    """Retourne tous les services avec un flag 'linked' pour une commune."""
    all_services = supabase.table("services") \
        .select("id, nom, category_id, service_categories(id, nom)") \
        .order("nom").execute()

    linked_res = supabase.table("commune_services") \
        .select("service_id").eq("commune_id", commune_id).execute()
    linked_ids = {r["service_id"] for r in linked_res.data}

    result = []
    for s in all_services.data:
        result.append({
            "id": s["id"],
            "nom": s["nom"],
            "category_id": s["category_id"],
            "category_nom": s["service_categories"]["nom"],
            "linked": s["id"] in linked_ids,
        })
    return result

@app.post("/admin/commune_services")
def admin_add_commune_service(data: dict):
    commune_id = data.get("commune_id")
    service_id = data.get("service_id")
    if not commune_id or not service_id:
        raise HTTPException(status_code=400, detail="commune_id et service_id requis")
    supabase.table("commune_services").upsert({
        "commune_id": commune_id,
        "service_id": service_id,
    }).execute()
    return {"ok": True}

@app.delete("/admin/commune_services/{commune_id}/{service_id}")
def admin_remove_commune_service(commune_id: str, service_id: str):
    supabase.table("commune_services") \
        .delete().eq("commune_id", commune_id).eq("service_id", service_id).execute()
    return {"ok": True}

@app.post("/admin/services")
def admin_create_service(data: ServiceCreate):
    res = supabase.table("services").insert({
        "nom": data.nom,
        "category_id": data.category_id,
    }).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Erreur lors de la création du service")
    return res.data[0]


class LinkCreate(BaseModel):
    title: str
    url: str
    tags: Optional[List[str]] = []

@app.post("/liens")
def create_lien(data: LinkCreate):
    res = supabase.table("links").insert(data.model_dump()).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Erreur lors de la création")
    return res.data[0]

class ProcedureCreate(BaseModel):
    title: str
    tags: Optional[List[str]] = []
    reference: Optional[str] = None
    type: Optional[str] = None
    content: Optional[str] = None

@app.post("/procedures")
def create_procedure(data: ProcedureCreate):
    res = supabase.table("procedures").insert(data.model_dump()).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Erreur lors de la création")
    return res.data[0]

class ProcedureUpdate(BaseModel):
    title: Optional[str] = None
    tags: Optional[List[str]] = None
    reference: Optional[str] = None
    type: Optional[str] = None
    content: Optional[str] = None

@app.put("/procedures/{proc_id}")
def update_procedure(proc_id: str, data: ProcedureUpdate):
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    if not payload:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")
    res = supabase.table("procedures").update(payload).eq("id", proc_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Procédure non trouvée")
    return res.data[0]


@app.delete("/procedures/{proc_id}")
def delete_procedure(proc_id: str):
    supabase.table("procedure_files").delete().eq("procedure_id", proc_id).execute()
    supabase.table("procedures").delete().eq("id", proc_id).execute()
    return {"ok": True}


@app.post("/procedures/{proc_id}/files")
def add_procedure_file(proc_id: str, data: FileCreate):
    res = supabase.table("procedure_files").insert({
        "procedure_id": proc_id,
        "file_name": data.file_name,
        "storage_path": data.storage_path
    }).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Erreur lors de l'enregistrement du fichier")
    return res.data[0]