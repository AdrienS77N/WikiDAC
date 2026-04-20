import { useState, useEffect } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL

export default function Territorial() {
  const [allCommunes, setAllCommunes] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [services, setServices] = useState({})
  const [loadingServices, setLoadingServices] = useState(false)

  useEffect(() => {
    axios.get(`${API}/communes`).then(res => setAllCommunes(res.data))
  }, [])

  const filtered = allCommunes.filter(c =>
    c.nom_recherche.includes(search.toUpperCase())
  )

  const selectCommune = async (commune) => {
    setSelected(commune)
    setLoadingServices(true)
    try {
      const res = await axios.get(`${API}/communes/${commune.id}/services`)
      setServices(res.data)
    } catch {
      setServices({})
    } finally {
      setLoadingServices(false)
    }
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Ressources territoriales</h1>
      <p style={styles.subtitle}>Recherchez une commune pour voir les services disponibles</p>

      <input
        value={search}
        onChange={e => { setSearch(e.target.value); setSelected(null); setServices({}) }}
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
          <div style={styles.servicesPanel}>
            <h2 style={styles.communeTitle}>{selected.nom}</h2>
            {loadingServices ? (
              <p style={styles.muted}>Chargement...</p>
            ) : Object.keys(services).length === 0 ? (
              <p style={styles.muted}>Aucun service trouvé.</p>
            ) : (
              Object.entries(services).map(([cat, svcs]) => (
                <div key={cat} style={styles.category}>
                  <h3 style={styles.catTitle}>{cat}</h3>
                  <ul style={styles.serviceList}>
                    {svcs.map(s => (
                      <li key={s.id} style={styles.serviceItem}>{s.nom}</li>
                    ))}
                  </ul>
                </div>
              ))
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
  servicesPanel: {
    flex: 1, backgroundColor: '#fff', borderRadius: '12px',
    border: '1px solid #e5e7eb', padding: '24px',
  },
  communeTitle: { fontSize: '18px', fontWeight: '600', color: '#111827', margin: '0 0 20px' },
  category: { marginBottom: '20px' },
  catTitle: {
    fontSize: '12px', fontWeight: '600', color: '#1a56db',
    textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px',
  },
  serviceList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' },
  serviceItem: {
    fontSize: '14px', color: '#374151', padding: '6px 10px',
    backgroundColor: '#f9fafb', borderRadius: '6px',
  },
  muted: { color: '#6b7280', fontSize: '14px' },
}
