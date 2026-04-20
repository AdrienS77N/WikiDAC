import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

const API = import.meta.env.VITE_API_URL

const MODULES = [
  {
    to: '/territorial',
    icon: '🗺️',
    label: 'Ressources territoriales',
    desc: 'Services disponibles par commune sur le Nord 77',
    color: '#1a56db',
    bg: '#eff6ff',
  },
  {
    to: '/connaissances',
    icon: '📚',
    label: 'Base de connaissances',
    desc: 'Fiches ressources, guides et documents partagés',
    color: '#059669',
    bg: '#ecfdf5',
  },
  {
    to: '/procedures',
    icon: '📋',
    label: 'Procédures internes',
    desc: 'Notes de service, guides et protocoles internes',
    color: '#d97706',
    bg: '#fffbeb',
  },
  {
    to: '/liens',
    icon: '🔗',
    label: 'Liens utiles',
    desc: 'Ressources web et outils externes référencés',
    color: '#7c3aed',
    bg: '#f5f3ff',
  },
]

function fmt(n) {
  return n != null ? n.toLocaleString('fr-FR') : '—'
}

function dateFr(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    axios.get(`${API}/stats`).then(r => setStats(r.data)).catch(() => {})
  }, [])

  const prenom = user?.email?.split('@')[0] ?? ''
  const prenomFormate = prenom.charAt(0).toUpperCase() + prenom.slice(1)

  return (
    <div style={s.page}>

      {/* Bandeau de bienvenue */}
      <div style={s.hero}>
        <div style={s.heroInner}>
          <p style={s.heroGreet}>Bonjour, {prenomFormate} 👋</p>
          <h1 style={s.heroTitle}>WikiDAC — Santé 77 Nord</h1>
          <p style={s.heroSub}>
            Intranet de l'équipe DAC & EMSPT · Nord Seine-et-Marne
          </p>
        </div>
        <div style={s.heroDeco}>
          <img src="/logo.png" alt="Logo" style={s.heroLogo} />
        </div>
      </div>

      {/* Compteurs */}
      <div style={s.statsRow}>
        {[
          { label: 'Communes', value: stats?.communes, icon: '🏘️', sub: 'Nord 77' },
          { label: 'Services', value: stats?.services, icon: '🏥', sub: `${fmt(stats?.categories)} catégories` },
          { label: 'Fiches', value: stats?.connaissances, icon: '📄', sub: 'Base de connaissances' },
          { label: 'Procédures', value: stats?.procedures, icon: '📋', sub: 'Documents internes' },
          { label: 'Liens', value: stats?.liens, icon: '🔗', sub: 'Ressources web' },
          { label: 'Fichiers', value: stats?.fichiers, icon: '📎', sub: 'Pièces jointes' },
        ].map(({ label, value, icon, sub }) => (
          <div key={label} style={s.statCard}>
            <span style={s.statIcon}>{icon}</span>
            <span style={s.statValue}>{fmt(value)}</span>
            <span style={s.statLabel}>{label}</span>
            <span style={s.statSub}>{sub}</span>
          </div>
        ))}
      </div>

      <div style={s.bottom}>
        {/* Accès rapide */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>Accès rapide</h2>
          <div style={s.modulesGrid}>
            {MODULES.map(m => (
              <button key={m.to} onClick={() => navigate(m.to)} style={{ ...s.moduleCard, '--accent': m.color, '--bg': m.bg }}>
                <div style={{ ...s.moduleIconWrap, backgroundColor: m.bg }}>
                  <span style={s.moduleIcon}>{m.icon}</span>
                </div>
                <div style={s.moduleText}>
                  <span style={{ ...s.moduleLabel, color: m.color }}>{m.label}</span>
                  <span style={s.moduleDesc}>{m.desc}</span>
                </div>
                <span style={{ ...s.moduleArrow, color: m.color }}>→</span>
              </button>
            ))}
          </div>
        </div>

        {/* Fiches récentes */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>Fiches récemment mises à jour</h2>
          <div style={s.recentList}>
            {!stats ? (
              <p style={s.muted}>Chargement...</p>
            ) : stats.recentes?.length === 0 ? (
              <p style={s.muted}>Aucune fiche.</p>
            ) : stats.recentes?.map(f => (
              <button
                key={f.id}
                onClick={() => navigate('/connaissances')}
                style={s.recentItem}
              >
                <div style={s.recentLeft}>
                  <span style={s.recentTitle}>{f.title}</span>
                  {f.category && <span style={s.recentBadge}>{f.category}</span>}
                </div>
                <span style={s.recentDate}>{dateFr(f.updated_at)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: { padding: '36px 40px', maxWidth: '1100px' },

  // Hero
  hero: {
    background: 'linear-gradient(135deg, #1a56db 0%, #1e40af 100%)',
    borderRadius: '16px',
    padding: '32px 40px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '28px',
    overflow: 'hidden',
    position: 'relative',
  },
  heroInner: { zIndex: 1 },
  heroGreet: { color: '#bfdbfe', fontSize: '14px', margin: '0 0 6px', fontWeight: '500' },
  heroTitle: { color: '#fff', fontSize: '26px', fontWeight: '700', margin: '0 0 8px', letterSpacing: '-0.3px' },
  heroSub: { color: '#93c5fd', fontSize: '14px', margin: 0 },
  heroDeco: { opacity: 0.15, zIndex: 0 },
  heroLogo: { width: '180px', filter: 'brightness(0) invert(1)' },

  // Stats
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '14px',
    marginBottom: '28px',
  },
  statCard: {
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '18px 16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    textAlign: 'center',
  },
  statIcon: { fontSize: '22px', marginBottom: '4px' },
  statValue: { fontSize: '26px', fontWeight: '700', color: '#111827', lineHeight: 1 },
  statLabel: { fontSize: '13px', fontWeight: '600', color: '#374151', marginTop: '4px' },
  statSub: { fontSize: '11px', color: '#9ca3af' },

  // Bottom grid
  bottom: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' },
  section: {},
  sectionTitle: { fontSize: '15px', fontWeight: '600', color: '#374151', margin: '0 0 14px' },

  // Modules
  modulesGrid: { display: 'flex', flexDirection: 'column', gap: '10px' },
  moduleCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px 16px',
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'box-shadow 0.15s, border-color 0.15s',
    width: '100%',
  },
  moduleIconWrap: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  moduleIcon: { fontSize: '22px' },
  moduleText: { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' },
  moduleLabel: { fontSize: '14px', fontWeight: '600' },
  moduleDesc: { fontSize: '12px', color: '#6b7280' },
  moduleArrow: { fontSize: '18px', fontWeight: '300' },

  // Recent
  recentList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  recentItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '12px 14px',
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  },
  recentLeft: { display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 },
  recentTitle: { fontSize: '13px', fontWeight: '500', color: '#111827' },
  recentBadge: {
    display: 'inline-block',
    fontSize: '11px',
    padding: '1px 7px',
    backgroundColor: '#e0e7ff',
    color: '#3730a3',
    borderRadius: '999px',
    width: 'fit-content',
  },
  recentDate: { fontSize: '12px', color: '#9ca3af', whiteSpace: 'nowrap', flexShrink: 0 },

  muted: { color: '#6b7280', fontSize: '14px' },
}
