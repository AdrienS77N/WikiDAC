import { useState, useEffect } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL

export default function AdminTerritorial() {
  const [allCommunes, setAllCommunes] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [services, setServices] = useState([])
  const [categories, setCategories] = useState([])
  const [loadingServices, setLoadingServices] = useState(false)
  const [saving, setSaving] = useState(null)

  // Nouveau service
  const [newServiceNom, setNewServiceNom] = useState('')
  const [newServiceCat, setNewServiceCat] = useState('')
  const [addingService, setAddingService] = useState(false)
  const [openCats, setOpenCats] = useState({})

  useEffect(() => {
    axios.get(`${API}/communes`).then(res => setAllCommunes(res.data))
    axios.get(`${API}/services/categories`).then(res => {
      setCategories(res.data)
      if (res.data.length > 0) setNewServiceCat(res.data[0].id)
    })
  }, [])

  const filtered = allCommunes.filter(c =>
    c.nom_recherche.includes(search.toUpperCase())
  )

  const selectCommune = async (commune) => {
    setSelected(commune)
    setLoadingServices(true)
    setOpenCats({})
    try {
      const res = await axios.get(`${API}/admin/communes/${commune.id}/services`)
      setServices(res.data)
      // Ouvrir automatiquement les catégories qui ont des services liés
      const linked = {}
      res.data.forEach(s => { if (s.linked) linked[s.category_nom] = true })
      setOpenCats(linked)
    } finally {
      setLoadingServices(false)
    }
  }

  const toggleCat = (cat) => setOpenCats(prev => ({ ...prev, [cat]: !prev[cat] }))

  const toggleService = async (service) => {
    setSaving(service.id)
    try {
      if (service.linked) {
        await axios.delete(`${API}/admin/commune_services/${selected.id}/${service.id}`)
      } else {
        await axios.post(`${API}/admin/commune_services`, {
          commune_id: selected.id,
          service_id: service.id,
        })
      }
      setServices(prev => prev.map(s =>
        s.id === service.id ? { ...s, linked: !s.linked } : s
      ))

    } finally {
      setSaving(null)
    }
  }

  const creerService = async (e) => {
    e.preventDefault()
    if (!newServiceNom.trim() || !newServiceCat) return
    setAddingService(true)
    try {
      const res = await axios.post(`${API}/admin/services`, {
        nom: newServiceNom.trim(),
        category_id: newServiceCat,
      })
      const cat = categories.find(c => c.id === newServiceCat)
      const newSvc = {
        id: res.data.id,
        nom: res.data.nom,
        category_id: newServiceCat,
        category_nom: cat?.nom ?? '',
        linked: false,
      }
      setServices(prev => [...prev, newSvc].sort((a, b) => a.nom.localeCompare(b.nom)))
      setNewServiceNom('')
    } finally {
      setAddingService(false)
    }
  }

  // Grouper par catégorie
  const grouped = services.reduce((acc, s) => {
    if (!acc[s.category_nom]) acc[s.category_nom] = []
    acc[s.category_nom].push(s)
    return acc
  }, {})

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Admin — Ressources territoriales</h1>
      <p style={styles.subtitle}>Gérez les services disponibles par commune</p>

      <input
        value={search}
        onChange={e => { setSearch(e.target.value); setSelected(null); setServices([]) }}
        placeholder="Tapez le nom d'une commune..."
        style={styles.input}
        autoFocus
      />

      <div style={styles.columns}>
        <div style={styles.communeList}>
          {filtered.length === 0 && search.length > 0 && (
            <p style={styles.muted}>Aucune commune trouvée.</p>
          )}
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => selectCommune(c)}
              style={{
                ...styles.communeItem,
                ...(selected?.id === c.id ? styles.communeItemActive : {}),
              }}
            >
              {c.nom}
            </button>
          ))}
        </div>

        {selected && (
          <div style={styles.panel}>
            <h2 style={styles.communeTitle}>{selected.nom}</h2>

            {loadingServices ? (
              <p style={styles.muted}>Chargement...</p>
            ) : (
              <>
                {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, svcs]) => {
                  const linkedCount = svcs.filter(s => s.linked).length
                  const isOpen = !!openCats[cat]
                  return (
                  <div key={cat} style={styles.category}>
                    <button onClick={() => toggleCat(cat)} style={styles.catHeader}>
                      <span style={styles.catChevron}>{isOpen ? '▾' : '▸'}</span>
                      <span style={styles.catTitle}>{cat}</span>
                      <span style={styles.catCount}>
                        {linkedCount > 0
                          ? <span style={styles.catBadgeLinked}>{linkedCount} actif{linkedCount > 1 ? 's' : ''}</span>
                          : <span style={styles.catBadgeEmpty}>{svcs.length}</span>
                        }
                      </span>
                    </button>
                    {isOpen && <div style={styles.serviceGrid}>
                      {svcs.map(s => (
                        <div key={s.id} style={{
                          ...styles.serviceRow,
                          opacity: saving === s.id ? 0.5 : 1,
                          backgroundColor: s.linked ? '#f0fdf4' : 'transparent',
                        }}>
                          <input
                            type="checkbox"
                            checked={s.linked}
                            disabled={saving === s.id}
                            onChange={() => toggleService(s)}
                            style={styles.checkbox}
                          />
                          <span style={styles.serviceNom}>{s.nom}</span>
                          {s.linked && (
                            <button
                              onClick={() => toggleService(s)}
                              disabled={saving === s.id}
                              style={styles.deleteBtn}
                              title="Retirer ce service de la commune"
                            >
                              Retirer
                            </button>
                          )}
                        </div>
                      ))}
                    </div>}
                  </div>
                )})}

                <div style={styles.addForm}>
                  <h3 style={styles.addTitle}>Ajouter un nouveau service</h3>
                  <form onSubmit={creerService} style={styles.form}>
                    <input
                      value={newServiceNom}
                      onChange={e => setNewServiceNom(e.target.value)}
                      placeholder="Nom du service..."
                      style={styles.formInput}
                      required
                    />
                    <select
                      value={newServiceCat}
                      onChange={e => setNewServiceCat(e.target.value)}
                      style={styles.formSelect}
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.nom}</option>
                      ))}
                    </select>
                    <button type="submit" style={styles.addBtn} disabled={addingService}>
                      {addingService ? 'Création...' : '+ Créer et ajouter'}
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: { padding: '36px 40px' },
  title: { fontSize: '22px', fontWeight: '600', color: '#111827', margin: '0 0 4px' },
  subtitle: { fontSize: '14px', color: '#6b7280', margin: '0 0 20px' },
  input: {
    width: '100%', maxWidth: '360px', padding: '10px 14px',
    border: '1px solid #d1d5db', borderRadius: '8px',
    fontSize: '14px', marginBottom: '20px', display: 'block',
  },
  columns: { display: 'flex', gap: '24px', alignItems: 'flex-start' },
  communeList: {
    display: 'flex', flexDirection: 'column', gap: '4px',
    minWidth: '200px', maxWidth: '220px',
    maxHeight: '70vh', overflowY: 'auto',
  },
  communeItem: {
    textAlign: 'left', padding: '9px 14px', border: '1px solid #e5e7eb',
    borderRadius: '8px', backgroundColor: '#fff', fontSize: '14px',
    cursor: 'pointer', color: '#374151',
  },
  communeItemActive: {
    backgroundColor: '#eff6ff', borderColor: '#1a56db', color: '#1a56db', fontWeight: '500',
  },
  panel: {
    flex: 1, backgroundColor: '#fff', borderRadius: '12px',
    border: '1px solid #e5e7eb', padding: '24px', maxHeight: '80vh', overflowY: 'auto',
  },
  communeTitle: { fontSize: '18px', fontWeight: '600', color: '#111827', margin: '0 0 20px' },
  category: { marginBottom: '6px' },
  catHeader: {
    width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 12px', backgroundColor: '#f8fafc',
    border: '1px solid #e5e7eb', borderRadius: '8px',
    cursor: 'pointer', textAlign: 'left',
  },
  catChevron: { fontSize: '12px', color: '#6b7280', width: '12px' },
  catTitle: {
    fontSize: '13px', fontWeight: '600', color: '#1a56db',
    textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1,
  },
  catCount: {},
  catBadgeLinked: {
    fontSize: '11px', padding: '2px 8px', borderRadius: '999px',
    backgroundColor: '#dcfce7', color: '#16a34a', fontWeight: '600',
  },
  catBadgeEmpty: {
    fontSize: '11px', padding: '2px 8px', borderRadius: '999px',
    backgroundColor: '#f3f4f6', color: '#9ca3af',
  },
  serviceGrid: {
    display: 'flex', flexDirection: 'column', gap: '2px',
    padding: '6px 8px', borderLeft: '2px solid #e0e7ff', marginLeft: '12px', marginBottom: '4px',
  },
  serviceRow: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '6px 10px', borderRadius: '6px', cursor: 'pointer',
    transition: 'background 0.1s',
  },
  checkbox: { cursor: 'pointer', width: '16px', height: '16px', accentColor: '#1a56db' },
  serviceNom: { fontSize: '14px', color: '#374151', flex: 1 },
  deleteBtn: {
    fontSize: '12px', padding: '2px 10px',
    backgroundColor: '#fee2e2', color: '#dc2626',
    border: '1px solid #fca5a5', borderRadius: '6px',
    cursor: 'pointer', flexShrink: 0,
  },
  muted: { color: '#6b7280', fontSize: '14px' },
  addForm: {
    marginTop: '32px', paddingTop: '24px',
    borderTop: '1px solid #e5e7eb',
  },
  addTitle: { fontSize: '14px', fontWeight: '600', color: '#374151', margin: '0 0 12px' },
  form: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' },
  formInput: {
    flex: 1, minWidth: '200px', padding: '9px 14px',
    border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px',
  },
  formSelect: {
    padding: '9px 14px', border: '1px solid #d1d5db',
    borderRadius: '8px', fontSize: '14px', backgroundColor: '#fff',
  },
  addBtn: {
    padding: '9px 18px', backgroundColor: '#1a56db', color: '#fff',
    border: 'none', borderRadius: '8px', fontSize: '14px',
    fontWeight: '500', cursor: 'pointer',
  },
}
