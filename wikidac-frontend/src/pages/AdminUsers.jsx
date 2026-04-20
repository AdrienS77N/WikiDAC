import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

const API = import.meta.env.VITE_API_URL
const ROLES = ['reader', 'admin']
const ROLE_LABELS = { reader: 'Salarié(e)', editor: 'Éditeur', admin: 'Admin' }
const ROLE_COLORS = {
  reader:  { bg: '#f3f4f6', color: '#374151' },
  editor:  { bg: '#e0e7ff', color: '#3730a3' },
  admin:   { bg: '#fef3c7', color: '#92400e' },
}

function dateFr(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth()
  const [users, setUsers]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting]       = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [updatingRole, setUpdatingRole] = useState(null)

  const [form, setForm]         = useState({ email: '', full_name: '', role: 'reader' })
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState(null)
  const [inviteOk, setInviteOk]       = useState(false)

  const [bulkEmails, setBulkEmails]   = useState('')
  const [bulkInviting, setBulkInviting] = useState(false)
  const [bulkResult, setBulkResult]   = useState(null)

  useEffect(() => { fetchUsers() }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${API}/admin/users`)
      setUsers(res.data)
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async (e) => {
    e.preventDefault()
    setInviting(true)
    setInviteError(null)
    setInviteOk(false)
    try {
      await axios.post(`${API}/admin/users/invite`, form)
      setInviteOk(true)
      setForm({ email: '', full_name: '', role: 'reader' })
      await fetchUsers()
    } catch (err) {
      setInviteError(err.response?.data?.detail ?? "Erreur lors de l'invitation.")
    } finally {
      setInviting(false)
    }
  }

  const handleBulkInvite = async (e) => {
    e.preventDefault()
    const emails = bulkEmails.split(/[\n,;]+/).map(e => e.trim()).filter(e => e.includes('@'))
    if (!emails.length) return
    setBulkInviting(true)
    setBulkResult(null)
    let ok = 0, errors = []
    for (const email of emails) {
      try {
        await axios.post(`${API}/admin/users/invite`, { email, role: 'reader' })
        ok++
      } catch (err) {
        errors.push(email)
      }
    }
    await fetchUsers()
    setBulkResult({ ok, errors })
    if (!errors.length) setBulkEmails('')
    setBulkInviting(false)
  }

  const handleRoleChange = async (userId, newRole) => {
    setUpdatingRole(userId)
    try {
      await axios.put(`${API}/admin/users/${userId}/role`, { role: newRole })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    } finally {
      setUpdatingRole(null)
    }
  }

  const handleDelete = async (userId) => {
    if (userId === currentUser?.id) {
      setDeleteError("Vous ne pouvez pas supprimer votre propre compte.")
      setConfirmDelete(null)
      return
    }
    setDeleting(true)
    setDeleteError(null)
    try {
      await axios.delete(`${API}/admin/users/${userId}`)
      setUsers(prev => prev.filter(u => u.id !== userId))
      setConfirmDelete(null)
    } catch {
      setDeleteError("Erreur lors de la suppression.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={s.page}>
      <h1 style={s.title}>Admin — Utilisateurs</h1>
      <p style={s.subtitle}>Gérez les accès à WikiDAC</p>
      {deleteError && <p style={s.error}>{deleteError}</p>}

      {/* Inviter un utilisateur */}
      <div style={s.inviteCard}>
        <h2 style={s.cardTitle}>Inviter un utilisateur</h2>
        <form onSubmit={handleInvite} style={s.inviteForm}>
          <input
            type="email" required placeholder="Email *"
            value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
            style={s.input}
          />
          <input
            type="text" placeholder="Nom complet"
            value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
            style={s.input}
          />
          <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={s.select}>
            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <button type="submit" style={s.btnPrimary} disabled={inviting}>
            {inviting ? 'Envoi...' : 'Envoyer l\'invitation'}
          </button>
        </form>
        {inviteError && <p style={s.error}>{inviteError}</p>}
        {inviteOk && <p style={s.success}>Invitation envoyée !</p>}
      </div>

      {/* Invitation en masse */}
      <div style={s.inviteCard}>
        <h2 style={s.cardTitle}>Inviter plusieurs salariés</h2>
        <p style={s.hint}>Collez les adresses email (une par ligne, ou séparées par des virgules). Ils seront invités avec le rôle Salarié(e).</p>
        <form onSubmit={handleBulkInvite} style={s.bulkForm}>
          <textarea
            value={bulkEmails}
            onChange={e => setBulkEmails(e.target.value)}
            placeholder={'prenom.nom@structure.fr\nprenom2.nom2@structure.fr\n...'}
            style={s.textarea}
            rows={5}
          />
          <button type="submit" style={s.btnPrimary} disabled={bulkInviting || !bulkEmails.trim()}>
            {bulkInviting ? 'Envoi en cours...' : 'Envoyer les invitations'}
          </button>
        </form>
        {bulkResult && (
          <div style={{ marginTop: '10px' }}>
            {bulkResult.ok > 0 && <p style={s.success}>✓ {bulkResult.ok} invitation{bulkResult.ok > 1 ? 's' : ''} envoyée{bulkResult.ok > 1 ? 's' : ''}</p>}
            {bulkResult.errors.length > 0 && <p style={s.error}>✗ Échec pour : {bulkResult.errors.join(', ')}</p>}
          </div>
        )}
      </div>

      {/* Liste des utilisateurs */}
      <div style={s.tableCard}>
        <h2 style={s.cardTitle}>{users.length} utilisateur{users.length > 1 ? 's' : ''}</h2>
        {loading ? (
          <p style={s.muted}>Chargement...</p>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                {['Nom', 'Email', 'Rôle', 'Inscrit le', ''].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={s.tr}>
                  <td style={s.td}>{u.full_name || <span style={s.muted}>—</span>}</td>
                  <td style={s.td}>{u.email}</td>
                  <td style={s.td}>
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      disabled={updatingRole === u.id}
                      style={{
                        ...s.roleSelect,
                        backgroundColor: ROLE_COLORS[u.role]?.bg,
                        color: ROLE_COLORS[u.role]?.color,
                      }}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </td>
                  <td style={s.td}>{dateFr(u.created_at)}</td>
                  <td style={s.tdActions}>
                    {confirmDelete === u.id ? (
                      <div style={s.confirmBox}>
                        <span style={s.confirmText}>Supprimer ?</span>
                        <button onClick={() => handleDelete(u.id)} disabled={deleting} style={s.btnConfirm}>
                          {deleting ? '...' : 'Oui'}
                        </button>
                        <button onClick={() => setConfirmDelete(null)} style={s.btnCancel}>Non</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDelete(u.id)} style={s.btnDelete}>
                        Supprimer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const s = {
  page: { padding: '36px 40px', maxWidth: '900px' },
  title: { fontSize: '22px', fontWeight: '600', color: '#111827', margin: '0 0 4px' },
  subtitle: { fontSize: '14px', color: '#6b7280', margin: '0 0 28px' },

  inviteCard: { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', marginBottom: '24px' },
  cardTitle: { fontSize: '15px', fontWeight: '600', color: '#374151', margin: '0 0 16px' },
  inviteForm: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' },
  input: { padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', minWidth: '180px', flex: 1 },
  select: { padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', backgroundColor: '#fff' },
  btnPrimary: { padding: '9px 18px', backgroundColor: '#1a56db', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap' },
  error: { color: '#dc2626', fontSize: '13px', margin: '10px 0 0' },
  success: { color: '#16a34a', fontSize: '13px', margin: '10px 0 0' },

  tableCard: { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { fontSize: '14px', color: '#374151', padding: '12px 12px' },
  tdActions: { padding: '12px 12px', textAlign: 'right' },
  roleSelect: { fontSize: '12px', padding: '3px 8px', border: 'none', borderRadius: '999px', fontWeight: '600', cursor: 'pointer' },
  confirmBox: { display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' },
  confirmText: { fontSize: '12px', color: '#dc2626' },
  btnConfirm: { fontSize: '12px', padding: '4px 10px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  btnCancel: { fontSize: '12px', padding: '4px 10px', backgroundColor: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' },
  btnDelete: { fontSize: '12px', padding: '4px 10px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer' },
  hint: { fontSize: '13px', color: '#6b7280', margin: '0 0 12px' },
  bulkForm: { display: 'flex', flexDirection: 'column', gap: '10px' },
  textarea: { padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical' },
  muted: { color: '#9ca3af', fontSize: '14px' },
}
