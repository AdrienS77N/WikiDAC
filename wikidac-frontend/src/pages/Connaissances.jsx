import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

const API = import.meta.env.VITE_API_URL
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL

export default function Connaissances() {
  const { isAdmin } = useAuth()
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [suggestion, setSuggestion] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [form, setForm] = useState({
    title: '', tags: '', short_description: '', long_description: '', category: ''
  })
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => { fetchItems() }, [])

  const fetchItems = async (q = '') => {
    setLoading(true)
    try {
      const res = await axios.get(`${API}/connaissances`, { params: q ? { search: q } : {} })
      setItems(res.data)
    } finally {
      setLoading(false)
    }
  }

  const selectItem = async (item) => {
    const res = await axios.get(`${API}/connaissances/${item.id}`)
    setSelected(res.data)
    setView('list')
    setSuggestion('')
    setConfirmDelete(false)
  }

  const openEdit = () => {
    setForm({
      title: selected.title ?? '',
      tags: (selected.tags ?? []).join(', '),
      short_description: selected.short_description ?? '',
      long_description: selected.long_description ?? '',
      category: selected.category ?? '',
    })
    setFiles([])
    setSaveError(null)
    setView('edit')
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    try {
      const payload = {
        ...form,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      }
      await axios.put(`${API}/connaissances/${selected.id}`, payload)

      for (const file of files) {
        const path = `${selected.id}/${Date.now()}_${file.name}`
        const { error: uploadError } = await supabase.storage
          .from('knowledge-files').upload(path, file)
        if (uploadError) { console.error('Erreur upload:', uploadError); continue }
        await axios.post(`${API}/connaissances/${selected.id}/files`, {
          file_name: file.name, storage_path: path
        })
      }

      const res = await axios.get(`${API}/connaissances/${selected.id}`)
      setSelected(res.data)
      setFiles([])
      setView('list')
      await fetchItems(search)
    } catch (err) {
      setSaveError("Erreur lors de la modification. Réessayez.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selected) return
    setDeleting(true)
    try {
      await axios.delete(`${API}/connaissances/${selected.id}`)
      setSelected(null)
      setConfirmDelete(false)
      await fetchItems(search)
    } finally {
      setDeleting(false)
    }
  }

  const handleFileChange = (e) => {
    const sel = Array.from(e.target.files)
    setFiles(prev => [...prev, ...sel])
  }

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
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
      const res = await axios.post(`${API}/connaissances`, payload)
      const newId = res.data.id

      for (const file of files) {
        const path = `${newId}/${Date.now()}_${file.name}`
        const { error: uploadError } = await supabase.storage
          .from('knowledge-files')
          .upload(path, file)
        if (uploadError) { console.error('Erreur upload:', uploadError); continue }
        await axios.post(`${API}/connaissances/${newId}/files`, {
          file_name: file.name,
          storage_path: path
        })
      }

      setForm({ title: '', tags: '', short_description: '', long_description: '', category: '' })
      setFiles([])
      setView('list')
      await fetchItems(search)
    } catch (err) {
      setSaveError("Erreur lors de la création. Réessayez.")
    } finally {
      setSaving(false)
    }
  }

  const handleSuggest = () => {
    if (!suggestion.trim() || !selected) return
    const subject = encodeURIComponent(`Suggestion sur la fiche : ${selected.title}`)
    const body = encodeURIComponent(
      `Bonjour,\n\nVoici une suggestion de modification pour la fiche "${selected.title}" :\n\n${suggestion}\n\nCordialement`
    )
    window.location.href = `mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`
    setSuggestion('')
    setView('list')
  }

  const getFileUrl = (path) => {
    const { data } = supabase.storage.from('knowledge-files').getPublicUrl(path)
    return data.publicUrl
  }

  return (
    <div style={styles.page}>

      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Base de connaissances</h1>
          <p style={styles.subtitle}>Ressources partagées de l'équipe</p>
        </div>
        <button
          onClick={() => { setView('create'); setSelected(null) }}
          style={styles.btnPrimary}
        >
          + Nouvelle fiche
        </button>
      </div>

      {/* Formulaire d'édition */}
      {view === 'edit' && selected && (
        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>Modifier — {selected.title}</h2>
          <form onSubmit={handleEdit} style={styles.form}>
            <div style={styles.formGrid}>
              <div style={styles.formRow}>
                <label style={styles.label}>Titre *</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required style={styles.input} />
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>Catégorie</label>
                <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={styles.input} />
              </div>
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>Mots-clés <span style={styles.hint}>(séparés par des virgules)</span></label>
              <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} style={styles.input} />
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>Description courte</label>
              <textarea value={form.short_description} onChange={e => setForm({ ...form, short_description: e.target.value })} style={styles.textarea} rows={2} />
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>Description détaillée</label>
              <textarea value={form.long_description} onChange={e => setForm({ ...form, long_description: e.target.value })} style={styles.textarea} rows={5} />
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>Ajouter des pièces jointes</label>
              <div style={styles.dropZone} onClick={() => fileInputRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]) }}>
                <span style={styles.dropIcon}>📎</span>
                <span style={styles.dropText}>Cliquez ou déposez vos fichiers ici</span>
                <input ref={fileInputRef} type="file" multiple onChange={handleFileChange} style={{ display: 'none' }} />
              </div>
              {files.length > 0 && (
                <div style={styles.fileList}>
                  {files.map((f, i) => (
                    <div key={i} style={styles.fileItem}>
                      <span style={styles.fileName}>📄 {f.name}</span>
                      <span style={styles.fileSize}>{(f.size / 1024).toFixed(0)} Ko</span>
                      <button type="button" onClick={() => removeFile(i)} style={styles.fileRemove}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {saveError && <p style={styles.error}>{saveError}</p>}
            <div style={styles.formActions}>
              <button type="button" onClick={() => { setView('list'); setFiles([]) }} style={styles.btnSecondary}>Annuler</button>
              <button type="submit" style={styles.btnPrimary} disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Formulaire de création */}
      {view === 'create' && (
        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>Nouvelle fiche</h2>
          <form onSubmit={handleCreate} style={styles.form}>

            <div style={styles.formGrid}>
              <div style={styles.formRow}>
                <label style={styles.label}>Titre *</label>
                <input
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  required style={styles.input}
                  placeholder="Ex : Cancer - Maintien et retour à l'emploi"
                />
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>Catégorie</label>
                <input
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  style={styles.input}
                  placeholder="Ex : Ressource spécialisée, Cancérologie"
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
                placeholder="Ex : Cancer, Emploi, INCa"
              />
            </div>

            <div style={styles.formRow}>
              <label style={styles.label}>Description courte</label>
              <textarea
                value={form.short_description}
                onChange={e => setForm({ ...form, short_description: e.target.value })}
                style={styles.textarea} rows={2}
                placeholder="Résumé en 1-2 phrases"
              />
            </div>

            <div style={styles.formRow}>
              <label style={styles.label}>Description détaillée</label>
              <textarea
                value={form.long_description}
                onChange={e => setForm({ ...form, long_description: e.target.value })}
                style={styles.textarea} rows={5}
                placeholder="Contenu détaillé, contacts, procédures..."
              />
            </div>

            <div style={styles.formRow}>
              <label style={styles.label}>Pièces jointes</label>
              <div
                style={styles.dropZone}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)])
                }}
              >
                <span style={styles.dropIcon}>📎</span>
                <span style={styles.dropText}>Cliquez ou déposez vos fichiers ici</span>
                <span style={styles.dropHint}>Tous types de fichiers acceptés</span>
                <input ref={fileInputRef} type="file" multiple onChange={handleFileChange} style={{ display: 'none' }} />
              </div>
              {files.length > 0 && (
                <div style={styles.fileList}>
                  {files.map((f, i) => (
                    <div key={i} style={styles.fileItem}>
                      <span style={styles.fileName}>📄 {f.name}</span>
                      <span style={styles.fileSize}>{(f.size / 1024).toFixed(0)} Ko</span>
                      <button type="button" onClick={() => removeFile(i)} style={styles.fileRemove}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {saveError && <p style={styles.error}>{saveError}</p>}

            <div style={styles.formActions}>
              <button type="button" onClick={() => { setView('list'); setFiles([]) }} style={styles.btnSecondary}>
                Annuler
              </button>
              <button type="submit" style={styles.btnPrimary} disabled={saving}>
                {saving ? 'Enregistrement...' : 'Créer la fiche'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Vue liste + détail */}
      {view !== 'create' && (
        <>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); fetchItems(e.target.value) }}
            placeholder="Rechercher dans les fiches, tags, descriptions..."
            style={styles.searchInput}
          />

          <div style={styles.columns}>
            {/* Liste — 30% */}
            <div style={styles.list}>
              {loading ? <p style={styles.muted}>Chargement...</p> : items.map(item => (
                <button key={item.id} onClick={() => selectItem(item)} style={{
                  ...styles.item,
                  ...(selected?.id === item.id ? styles.itemActive : {}),
                }}>
                  <span style={styles.itemTitle}>{item.title}</span>
                  {item.category && <span style={styles.badge}>{item.category}</span>}
                  {item.tags?.length > 0 && (
                    <div style={styles.tags}>
                      {item.tags.slice(0, 3).map(t => <span key={t} style={styles.tag}>{t}</span>)}
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Détail — 70% */}
            {selected ? (
              <div style={styles.detail}>
                <div style={styles.detailHeader}>
                  <h2 style={styles.detailTitle}>{selected.title}</h2>
                  {isAdmin && !confirmDelete && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={openEdit} style={styles.btnEdit}>Modifier</button>
                      <button onClick={() => setConfirmDelete(true)} style={styles.btnDelete}>Supprimer</button>
                    </div>
                  )}
                  {isAdmin && confirmDelete && (
                    <div style={styles.confirmBox}>
                      <span style={styles.confirmText}>Supprimer définitivement ?</span>
                      <button onClick={handleDelete} disabled={deleting} style={styles.btnConfirm}>
                        {deleting ? '...' : 'Confirmer'}
                      </button>
                      <button onClick={() => setConfirmDelete(false)} style={styles.btnCancelDelete}>
                        Annuler
                      </button>
                    </div>
                  )}
                </div>
                {selected.category && <span style={styles.badge}>{selected.category}</span>}

                {selected.short_description && (
                  <p style={styles.shortDesc}>{selected.short_description}</p>
                )}
                {selected.long_description && (
                  <>
                    <h3 style={styles.sectionTitle}>Description détaillée</h3>
                    <p style={styles.longDesc}>{selected.long_description}</p>
                  </>
                )}
                {selected.tags?.length > 0 && (
                  <div style={{ ...styles.tags, marginTop: '16px' }}>
                    {selected.tags.map(t => <span key={t} style={styles.tag}>{t}</span>)}
                  </div>
                )}
                {selected.knowledge_files?.length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    <h3 style={styles.sectionTitle}>Pièces jointes</h3>
                    <div style={styles.attachments}>
                      {selected.knowledge_files.map(f => (
                        <a key={f.id} href={getFileUrl(f.storage_path)} target="_blank" rel="noopener noreferrer" style={styles.attachment}>
                          📄 {f.file_name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div style={styles.suggestBox}>
                  <p style={styles.suggestLabel}>💡 Une information à ajouter ou corriger sur cette fiche ?</p>
                  {view === 'suggest' ? (
                    <>
                      <textarea
                        value={suggestion}
                        onChange={e => setSuggestion(e.target.value)}
                        placeholder="Décrivez votre suggestion..."
                        style={styles.textarea} rows={3} autoFocus
                      />
                      <div style={styles.formActions}>
                        <button onClick={() => setView('list')} style={styles.btnSecondary}>Annuler</button>
                        <button onClick={handleSuggest} style={styles.btnPrimary} disabled={!suggestion.trim()}>
                          Envoyer par email
                        </button>
                      </div>
                    </>
                  ) : (
                    <button onClick={() => setView('suggest')} style={styles.btnSuggest}>
                      Suggérer une modification
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={styles.detailEmpty}>
                <p style={styles.detailEmptyText}>← Sélectionnez une fiche pour voir son contenu</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

const styles = {
  page: { padding: '32px 32px', display: 'flex', flexDirection: 'column', height: '100%' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: '24px', paddingRight: '8px',
  },
  title: { fontSize: '22px', fontWeight: '600', color: '#111827', margin: '0 0 4px' },
  subtitle: { fontSize: '14px', color: '#6b7280', margin: 0 },
  searchInput: {
    width: '100%', maxWidth: '440px', padding: '10px 14px',
    border: '1px solid #d1d5db', borderRadius: '8px',
    fontSize: '14px', marginBottom: '20px', display: 'block',
  },
  columns: { display: 'flex', gap: '20px', alignItems: 'flex-start', flex: 1 },
  list: {
    display: 'flex', flexDirection: 'column', gap: '6px',
    width: '30%', minWidth: '240px', maxHeight: 'calc(100vh - 220px)', overflowY: 'auto',
  },
  item: {
    textAlign: 'left', padding: '12px 14px', border: '1px solid #e5e7eb',
    borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', width: '100%',
  },
  itemActive: { backgroundColor: '#eff6ff', borderColor: '#1a56db' },
  itemTitle: { fontSize: '14px', fontWeight: '500', color: '#111827', display: 'block', marginBottom: '4px' },
  badge: {
    display: 'inline-block', fontSize: '11px', padding: '2px 8px',
    backgroundColor: '#e0e7ff', color: '#3730a3', borderRadius: '999px', marginBottom: '6px',
  },
  tags: { display: 'flex', flexWrap: 'wrap', gap: '4px' },
  tag: { fontSize: '11px', padding: '2px 8px', backgroundColor: '#f3f4f6', color: '#6b7280', borderRadius: '999px' },
  detail: {
    flex: 1, backgroundColor: '#fff', borderRadius: '12px',
    border: '1px solid #e5e7eb', padding: '28px',
    maxHeight: 'calc(100vh - 220px)', overflowY: 'auto',
  },
  detailEmpty: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  detailEmptyText: { fontSize: '14px', color: '#9ca3af' },
  detailTitle: { fontSize: '20px', fontWeight: '600', color: '#111827', margin: '0 0 10px' },
  shortDesc: { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '12px 0' },
  sectionTitle: { fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '20px 0 8px' },
  longDesc: { fontSize: '14px', color: '#374151', lineHeight: '1.7', whiteSpace: 'pre-wrap' },
  attachments: { display: 'flex', flexDirection: 'column', gap: '6px' },
  attachment: {
    fontSize: '13px', color: '#1a56db', textDecoration: 'none',
    padding: '6px 10px', backgroundColor: '#eff6ff', borderRadius: '6px', display: 'inline-block',
  },
  suggestBox: {
    marginTop: '28px', padding: '16px 20px', backgroundColor: '#f9fafb',
    borderRadius: '10px', border: '1px solid #e5e7eb',
  },
  suggestLabel: { fontSize: '13px', color: '#6b7280', margin: '0 0 10px' },
  btnSuggest: {
    fontSize: '13px', padding: '7px 14px', backgroundColor: '#fff',
    border: '1px solid #d1d5db', borderRadius: '7px', cursor: 'pointer', color: '#374151',
  },
  formCard: {
    backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb',
    padding: '32px', width: '100%', maxWidth: '860px', marginBottom: '24px',
  },
  formTitle: { fontSize: '18px', fontWeight: '600', color: '#111827', margin: '0 0 20px' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  formRow: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', fontWeight: '500', color: '#374151' },
  hint: { fontWeight: '400', color: '#9ca3af' },
  input: { padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '7px', fontSize: '14px', outline: 'none' },
  textarea: { padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '7px', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' },
  dropZone: {
    border: '2px dashed #d1d5db', borderRadius: '8px', padding: '24px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
    cursor: 'pointer', backgroundColor: '#f9fafb',
  },
  dropIcon: { fontSize: '24px' },
  dropText: { fontSize: '14px', color: '#374151', fontWeight: '500' },
  dropHint: { fontSize: '12px', color: '#9ca3af' },
  fileList: { display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' },
  fileItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 12px', backgroundColor: '#f3f4f6', borderRadius: '6px' },
  fileName: { fontSize: '13px', color: '#374151', flex: 1 },
  fileSize: { fontSize: '12px', color: '#9ca3af' },
  fileRemove: { background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '14px', padding: '0 4px' },
  formActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' },
  detailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' },
  btnEdit: { fontSize: '12px', padding: '5px 12px', backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac', borderRadius: '6px', cursor: 'pointer', flexShrink: 0 },
  btnDelete: { fontSize: '12px', padding: '5px 12px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer', flexShrink: 0 },
  confirmBox: { display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 },
  confirmText: { fontSize: '12px', color: '#dc2626', whiteSpace: 'nowrap' },
  btnConfirm: { fontSize: '12px', padding: '5px 12px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  btnCancelDelete: { fontSize: '12px', padding: '5px 12px', backgroundColor: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' },
  btnPrimary: { padding: '9px 18px', backgroundColor: '#1a56db', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' },
  btnSecondary: { padding: '9px 18px', backgroundColor: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' },
  error: { color: '#dc2626', fontSize: '13px', margin: 0 },
  muted: { color: '#6b7280', fontSize: '14px' },
}
