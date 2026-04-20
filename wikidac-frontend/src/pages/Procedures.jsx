import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

const API = import.meta.env.VITE_API_URL

export default function Procedures() {
  const { isAdmin } = useAuth()
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')

  const [form, setForm] = useState({
    title: '', tags: '', reference: '', type: '', content: ''
  })
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => { fetchItems() }, [])

  const fetchItems = async (q = '') => {
    setLoading(true)
    try {
      const res = await axios.get(`${API}/procedures`, { params: q ? { search: q } : {} })
      setItems(res.data)
    } finally {
      setLoading(false)
    }
  }

  const selectItem = async (item) => {
    const res = await axios.get(`${API}/procedures/${item.id}`)
    setSelected(res.data)
    setView('list')
    setConfirmDelete(false)
  }

  const openEdit = () => {
    setForm({
      title: selected.title ?? '',
      tags: (selected.tags ?? []).join(', '),
      reference: selected.reference ?? '',
      type: selected.type ?? '',
      content: selected.content ?? '',
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
      await axios.put(`${API}/procedures/${selected.id}`, payload)

      for (const file of files) {
        const path = `${selected.id}/${Date.now()}_${file.name}`
        const { error: uploadError } = await supabase.storage
          .from('procedure-files').upload(path, file)
        if (uploadError) { console.error('Erreur upload:', uploadError); continue }
        await axios.post(`${API}/procedures/${selected.id}/files`, {
          file_name: file.name, storage_path: path
        })
      }

      const res = await axios.get(`${API}/procedures/${selected.id}`)
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
      await axios.delete(`${API}/procedures/${selected.id}`)
      setSelected(null)
      setConfirmDelete(false)
      await fetchItems(search)
    } finally {
      setDeleting(false)
    }
  }

  const handleFileChange = (e) => {
    setFiles(prev => [...prev, ...Array.from(e.target.files)])
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
      const res = await axios.post(`${API}/procedures`, payload)
      const newId = res.data.id

      for (const file of files) {
        const path = `${newId}/${Date.now()}_${file.name}`
        const { error: uploadError } = await supabase.storage
          .from('procedure-files')
          .upload(path, file)
        if (uploadError) { console.error('Erreur upload:', uploadError); continue }
        await axios.post(`${API}/procedures/${newId}/files`, {
          file_name: file.name,
          storage_path: path
        })
      }

      setForm({ title: '', tags: '', reference: '', type: '', content: '' })
      setFiles([])
      setView('list')
      await fetchItems(search)
    } catch (err) {
      setSaveError("Erreur lors de la création. Réessayez.")
    } finally {
      setSaving(false)
    }
  }

  const getFileUrl = (path) => {
    const { data } = supabase.storage.from('procedure-files').getPublicUrl(path)
    return data.publicUrl
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Procédures internes</h1>
          <p style={styles.subtitle}>Documents de référence de l'association</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setView('create'); setSelected(null) }} style={styles.btnPrimary}>
            + Nouvelle procédure
          </button>
        )}
      </div>

      {/* Formulaire d'édition */}
      {view === 'edit' && selected && isAdmin && (
        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>Modifier — {selected.title}</h2>
          <form onSubmit={handleEdit} style={styles.form}>
            <div style={styles.formGrid}>
              <div style={styles.formRow}>
                <label style={styles.label}>Titre *</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required style={styles.input} />
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>Type</label>
                <input value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={styles.input} />
              </div>
            </div>
            <div style={styles.formGrid}>
              <div style={styles.formRow}>
                <label style={styles.label}>Référence</label>
                <input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} style={styles.input} />
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>Mots-clés <span style={styles.hint}>(séparés par des virgules)</span></label>
                <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} style={styles.input} />
              </div>
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>Contenu</label>
              <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} style={styles.textarea} rows={5} />
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

      {/* Formulaire admin */}
      {view === 'create' && isAdmin && (
        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>Nouvelle procédure</h2>
          <form onSubmit={handleCreate} style={styles.form}>

            <div style={styles.formGrid}>
              <div style={styles.formRow}>
                <label style={styles.label}>Titre *</label>
                <input
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  required style={styles.input}
                  placeholder="Ex : Organisation du stationnement"
                />
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>Type</label>
                <input
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value })}
                  style={styles.input}
                  placeholder="Ex : Note de service, Guide d'utilisation"
                />
              </div>
            </div>

            <div style={styles.formGrid}>
              <div style={styles.formRow}>
                <label style={styles.label}>Référence</label>
                <input
                  value={form.reference}
                  onChange={e => setForm({ ...form, reference: e.target.value })}
                  style={styles.input}
                  placeholder="Ex : S77N-NS-02"
                />
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>
                  Mots-clés <span style={styles.hint}>(séparés par des virgules)</span>
                </label>
                <input
                  value={form.tags}
                  onChange={e => setForm({ ...form, tags: e.target.value })}
                  style={styles.input}
                  placeholder="Ex : Stationnement, Parking, Véhicule"
                />
              </div>
            </div>

            <div style={styles.formRow}>
              <label style={styles.label}>Contenu</label>
              <textarea
                value={form.content}
                onChange={e => setForm({ ...form, content: e.target.value })}
                style={styles.textarea} rows={5}
                placeholder="Description, consignes, contacts..."
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
                {saving ? 'Enregistrement...' : 'Créer la procédure'}
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
            placeholder="Rechercher une procédure..."
            style={styles.searchInput}
          />

          <div style={styles.columns}>
            <div style={styles.list}>
              {loading ? <p style={styles.muted}>Chargement...</p> : items.map(item => (
                <button key={item.id} onClick={() => selectItem(item)} style={{
                  ...styles.item,
                  ...(selected?.id === item.id ? styles.itemActive : {}),
                }}>
                  <span style={styles.itemTitle}>{item.title}</span>
                  <div style={styles.meta}>
                    {item.reference && <span style={styles.ref}>{item.reference}</span>}
                    {item.type && <span style={styles.type}>{item.type}</span>}
                  </div>
                </button>
              ))}
            </div>

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
                <div style={styles.detailMeta}>
                  {selected.reference && <span style={styles.ref}>{selected.reference}</span>}
                  {selected.type && <span style={styles.type}>{selected.type}</span>}
                  {selected.version && <span style={styles.version}>v{selected.version}</span>}
                </div>

                {selected.content && (
                  <>
                    <h3 style={styles.sectionTitle}>Contenu</h3>
                    <p style={styles.content}>{selected.content}</p>
                  </>
                )}

                {selected.procedure_files?.length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    <h3 style={styles.sectionTitle}>Pièces jointes</h3>
                    <div style={styles.attachments}>
                      {selected.procedure_files.map(f => (
                        <a key={f.id} href={getFileUrl(f.storage_path)} target="_blank" rel="noopener noreferrer" style={styles.attachment}>
                          📄 {f.file_name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {selected.updated_at && (
                  <p style={styles.date}>
                    Mis à jour le {new Date(selected.updated_at).toLocaleDateString('fr-FR')}
                  </p>
                )}
              </div>
            ) : (
              <div style={styles.detailEmpty}>
                <p style={styles.detailEmptyText}>← Sélectionnez une procédure pour voir son contenu</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

const styles = {
  page: { padding: '32px 32px', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', paddingRight: '8px' },
  title: { fontSize: '22px', fontWeight: '600', color: '#111827', margin: '0 0 4px' },
  subtitle: { fontSize: '14px', color: '#6b7280', margin: 0 },
  searchInput: { width: '100%', maxWidth: '440px', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', marginBottom: '20px', display: 'block' },
  columns: { display: 'flex', gap: '20px', alignItems: 'flex-start' },
  list: { display: 'flex', flexDirection: 'column', gap: '6px', width: '30%', minWidth: '240px', maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' },
  item: { textAlign: 'left', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', width: '100%' },
  itemActive: { backgroundColor: '#eff6ff', borderColor: '#1a56db' },
  itemTitle: { fontSize: '14px', fontWeight: '500', color: '#111827', display: 'block', marginBottom: '6px' },
  meta: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  ref: { fontSize: '11px', padding: '2px 8px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '999px', fontFamily: 'monospace' },
  type: { fontSize: '11px', padding: '2px 8px', backgroundColor: '#e0e7ff', color: '#3730a3', borderRadius: '999px' },
  version: { fontSize: '11px', padding: '2px 8px', backgroundColor: '#f3f4f6', color: '#6b7280', borderRadius: '999px' },
  detail: { flex: 1, backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '28px', maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' },
  detailEmpty: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  detailEmptyText: { fontSize: '14px', color: '#9ca3af' },
  detailTitle: { fontSize: '20px', fontWeight: '600', color: '#111827', margin: '0 0 10px' },
  detailMeta: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' },
  sectionTitle: { fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '20px 0 8px' },
  content: { fontSize: '14px', color: '#374151', lineHeight: '1.7', whiteSpace: 'pre-wrap' },
  attachments: { display: 'flex', flexDirection: 'column', gap: '6px' },
  attachment: { fontSize: '13px', color: '#1a56db', textDecoration: 'none', padding: '6px 10px', backgroundColor: '#eff6ff', borderRadius: '6px', display: 'inline-block' },
  date: { fontSize: '12px', color: '#9ca3af', marginTop: '20px' },
  formCard: { backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '32px', width: '100%', maxWidth: '860px', marginBottom: '24px' },
  formTitle: { fontSize: '18px', fontWeight: '600', color: '#111827', margin: '0 0 20px' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  formRow: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', fontWeight: '500', color: '#374151' },
  hint: { fontWeight: '400', color: '#9ca3af' },
  input: { padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '7px', fontSize: '14px', outline: 'none' },
  textarea: { padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '7px', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' },
  dropZone: { border: '2px dashed #d1d5db', borderRadius: '8px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', backgroundColor: '#f9fafb' },
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
