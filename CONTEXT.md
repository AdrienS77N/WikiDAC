# Contexte projet — WikiDAC

## Description
Intranet de l'association Santé 77 Nord (DAC + EMSPT, Nord Seine-et-Marne).
Remplace un outil no-code Airtable + Softr.
Potentiellement commercialisable via ECMA Conseil aux autres DAC en France.

## Stack technique
- **Frontend** : React + Vite, React Router, Axios, @supabase/supabase-js
- **Backend** : FastAPI (Python), Uvicorn
- **Base de données** : Supabase (PostgreSQL)
- **Auth** : Supabase Auth (email + mot de passe, invitation manuelle)
- **Stockage fichiers** : Supabase Storage (buckets : knowledge-files, procedure-files)

## Structure des dossiers
```
wikidac-frontend/
  src/
    App.jsx                  # Routing principal + ProtectedRoute
    supabaseClient.js        # Client Supabase (anon key)
    context/
      AuthContext.jsx        # Auth + récupération du rôle depuis table users
    components/
      Layout.jsx             # Sidebar + navigation + déconnexion
    pages/
      Login.jsx
      Territorial.jsx        # Ressources territoriales par commune
      Connaissances.jsx      # Base de connaissances (wiki)
      Procedures.jsx         # Procédures internes (admin only)
      Liens.jsx              # Liens utiles (admin only)

wikidac-backend/
  main.py                    # FastAPI — tous les endpoints
  .env                       # SUPABASE_URL + SUPABASE_SERVICE_KEY
```

## Variables d'environnement

### Frontend (.env dans wikidac-frontend/)
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=http://localhost:8000
VITE_ADMIN_EMAIL=admin@wikidac.fr
```

### Backend (.env dans wikidac-backend/)
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
```

## Lancer le projet
```bash
# Backend (terminal 1)
cd wikidac-backend
python -m uvicorn main:app --reload

# Frontend (terminal 2)
cd wikidac-frontend
npm run dev
```

## Schéma base de données (12 tables Supabase)

### Utilisateurs
- `users` : id, email, full_name, role (admin/editor/reader), created_at

### Module territorial
- `communes` : id, nom, nom_recherche
- `service_categories` : id, nom, description
- `services` : id, nom, category_id → service_categories
- `commune_services` : commune_id, service_id (liaison many-to-many)

### Base de connaissances
- `knowledge_base` : id, title, tags[], short_description, long_description, author_id, category, updated_at
- `knowledge_files` : id, knowledge_id, file_name, storage_path
- `knowledge_commune_services` : knowledge_id, commune_id (croisement)
- `knowledge_procedures` : knowledge_id, procedure_id (croisement)

### Procédures internes
- `procedures` : id, title, tags[], reference, type, content, author_id, version, updated_at
- `procedure_files` : id, procedure_id, file_name, storage_path

### Liens utiles
- `links` : id, title, url, tags[], added_by, created_at

## Endpoints API (FastAPI)

### Territorial
- GET /communes?search=
- GET /communes/{id}/services
- GET /services/categories

### Connaissances
- GET /connaissances?search=&tag=&category=
- GET /connaissances/{id}
- POST /connaissances
- PUT /connaissances/{id}
- POST /connaissances/{id}/files

### Procédures
- GET /procedures?search=&type=
- GET /procedures/{id}
- POST /procedures
- POST /procedures/{id}/files

### Liens
- GET /liens?tag=
- POST /liens

## Règles métier
- **Ressources territoriales** : lecture seule pour tous, modification admin uniquement
- **Base de connaissances** : lecture tous, création tous, suppression admin uniquement
  - Bouton "Suggérer une modification" → ouvre Outlook avec mailto: vers VITE_ADMIN_EMAIL
- **Procédures internes** : lecture tous, création/modification admin uniquement
- **Liens utiles** : lecture tous, création admin uniquement

## Rôles utilisateurs
- `admin` : accès complet, boutons de création/modification visibles
- `editor` : prévu pour plus tard
- `reader` : lecture seule, pas de boutons de création

## Données migrées depuis Airtable
- 239 communes du Nord 77
- 338 services dédoublonnés et catégorisés (17 catégories)
- 5986 liaisons commune ↔ service
- 67 entrées base de connaissances
- 12 procédures internes

## Prochaines étapes prévues
1. Mise en production (Vercel pour frontend, Railway pour backend)
2. Interface admin (gestion utilisateurs, suppressions)
3. Intégration Teams (onglet web app)
4. Multi-tenant pour commercialisation via ECMA Conseil
