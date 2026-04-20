import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

const API = import.meta.env.VITE_API_URL

export default function Liens() {
  const { isAdmin } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [form, setForm] = useState({ title: '', url: '', tags: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchItems() }, [])

  const fetchItems = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${API}/liens`)
      setItems(res.data)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    setDeleting(true)
    try {
      await axios.delete(`${API}/liens/${id}`)
      setItems(prev => prev.filter(i => i.id !== id))
      setConfirmDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    try {
      const payload = {
        ...form,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      }
      await axios.post(`${API}/liens`, payload)
      setForm({ title: '', url: '', tags: '' })
      setView('list')
      await fetchItems()
    } catch {
      setSaveError("Erreur lors de la création. Réessayez.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Liens utiles</h1>
          <p style={styles.subtitle}>Ressources en ligne de référence</p>
        </div>
        {isAdmin && (
          <button onClick={() => setView(view === 'create' ? 'list' : 'create')} style={styles.btnPrimary}>
            {view === 'create' ? 'Annuler' : '+ Nouveau lien'}
          </button>
        )}
      </div>

      {/* Formulaire admin */}
      {view === 'create' && isAdmin && (
        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>Nouveau lien</h2>
          <form onSubmit={handleCreate} style={styles.form}>
            <div style={styles.formGrid}>
              <div style={styles.formRow}>
                <label style={styles.label}>Titre *</label>
                <input
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  required style={styles.input}
                  placeholder="Ex : Ameli.fr - Professionnels de santé"
                />
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>URL *</label>
                <input
                  value={form.url}
                  onChange={e => setForm({ ...form, url: e.target.value })}
                  required style={styles.input}
                  type="url"
                  placeholder="https://..."
                />
              </div>
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>
                Mots-clés <span style={styles.hint}>(séparés par des virgules)</span>
              </label>
              <input
                value={form.tags}
                onChange={e => setForm({ ...form, tags: e.target.value })}
                style={styles.input}
                placeholder="Ex : Assurance maladie, CPAM, Remboursement"
              />
            </div>
            {saveError && <p style={styles.error}>{saveError}</p>}
            <div style={styles.formActions}>
              <button type="button" onClick={() => setView('list')} style={styles.btnSecondary}>
                Annuler
              </button>
              <button type="submit" style={styles.btnPrimary} disabled={saving}>
                {saving ? 'Enregistrement...' : 'Ajouter le lien'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grille de liens */}
      {loading ? (
        <p style={styles.muted}>Chargement...</p>
      ) : items.length === 0 ? (
        <p style={styles.muted}>Aucun lien enregistré pour l'instant.</p>
      ) : (
        <div style={styles.grid}>
          {items.map(item => (
            <div key={item.id} style={styles.card}>
              <a href={item.url} target="_blank" rel="noopener noreferrer" style={styles.cardLink}>
                <span style={styles.cardTitle}>{item.title}</span>
                <span style={styles.cardUrl}>{item.url}</span>
                {item.tags?.length > 0 && (
                  <div style={styles.tags}>
                    {item.tags.map(t => <span key={t} style={styles.tag}>{t}</span>)}
                  </div>
                )}
              </a>
              {isAdmin && (
                <div style={styles.cardActions}>
                  {confirmDelete === item.id ? (
                    <>
                      <span style={styles.confirmText}>Supprimer ?</span>
                      <button onClick={() => handleDelete(item.id)} disabled={deleting} style={styles.btnConfirm}>
                        {deleting ? '...' : 'Oui'}
                      </button>
                      <button onClick={() => setConfirmDelete(null)} style={styles.btnCancel}>Non</button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmDelete(item.id)} style={styles.btnDelete}>
                      Supprimer
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const styles = {
  page: { padding: '32px 32px', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', paddingRight: '8px' },
  title: { fontSize: '22px', fontWeight: '600', color: '#111827', margin: '0 0 4px' },
  subtitle: { fontSize: '14px', color: '#6b7280', margin: 0 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' },
  card: { display: 'flex', flexDirection: 'column', backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', overflow: 'hidden' },
  cardLink: { display: 'flex', flexDirection: 'column', gap: '6px', padding: '18px 20px', textDecoration: 'none', flex: 1 },
  cardTitle: { fontSize: '14px', fontWeight: '500', color: '#111827' },
  cardUrl: { fontSize: '12px', color: '#1a56db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardActions: { display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', padding: '8px 12px', borderTop: '1px solid #f3f4f6', backgroundColor: '#fafafa' },
  confirmText: { fontSize: '12px', color: '#dc2626' },
  btnConfirm: { fontSize: '12px', padding: '3px 10px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  btnCancel: { fontSize: '12px', padding: '3px 10px', backgroundColor: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' },
  btnDelete: { fontSize: '12px', padding: '3px 10px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer' },
  tags: { display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' },
  tag: { fontSize: '11px', padding: '2px 8px', backgroundColor: '#f3f4f6', color: '#6b7280', borderRadius: '999px' },
  formCard: { backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '32px', width: '100%', maxWidth: '860px', marginBottom: '24px' },
  formTitle: { fontSize: '18px', fontWeight: '600', color: '#111827', margin: '0 0 20px' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  formRow: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', fontWeight: '500', color: '#374151' },
  hint: { fontWeight: '400', color: '#9ca3af' },
  input: { padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '7px', fontSize: '14px', outline: 'none' },
  formActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' },
  btnPrimary: { padding: '9px 18px', backgroundColor: '#1a56db', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' },
  btnSecondary: { padding: '9px 18px', backgroundColor: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' },
  error: { color: '#dc2626', fontSize: '13px', margin: 0 },
  muted: { color: '#6b7280', fontSize: '14px' },
}
