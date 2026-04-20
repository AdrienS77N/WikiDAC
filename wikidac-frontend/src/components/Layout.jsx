import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const nav = [
  { to: '/',              label: '🏠  Accueil', end: true },
  { to: '/territorial',   label: '🗺️  Ressources territoriales' },
  { to: '/connaissances', label: '📚  Base de connaissances' },
  { to: '/procedures',    label: '📋  Procédures internes' },
  { to: '/liens',         label: '🔗  Liens utiles' },
]

const navAdmin = [
  { to: '/admin/territorial', label: '⚙️  Admin territorial' },
  { to: '/admin/users',       label: '👥  Utilisateurs' },
]

export default function Layout() {
  const { user, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <img src="/logo.png" alt="DAC Santé 77 Nord" style={styles.logo} />
        </div>

        <nav style={styles.nav}>
          {nav.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              style={({ isActive }) => ({
                ...styles.navLink,
                ...(isActive ? styles.navLinkActive : {}),
              })}
            >
              {label}
            </NavLink>
          ))}
          {isAdmin && (
            <>
              <div style={styles.navSeparator} />
              {navAdmin.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  style={({ isActive }) => ({
                    ...styles.navLink,
                    ...(isActive ? styles.navLinkActive : {}),
                  })}
                >
                  {label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div style={styles.footer}>
          <span style={styles.userEmail}>{user?.email}</span>
          <button onClick={handleSignOut} style={styles.signOut}>
            Déconnexion
          </button>
        </div>
      </aside>

      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

const styles = {
  shell: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#f4f6f9',
  },
  sidebar: {
    width: '260px',
    minWidth: '260px',
    backgroundColor: '#ffffff',
    borderRight: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 0',
  },
  brand: {
    display: 'flex',
    justifyContent: 'center',
    padding: '0 24px 24px',
    borderBottom: '1px solid #e5e7eb',
    marginBottom: '16px',
  },
  logo: {
    width: '180px',
    height: 'auto',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '0 12px',
    flex: 1,
  },
  navLink: {
    display: 'block',
    padding: '10px 12px',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#374151',
    textDecoration: 'none',
    transition: 'background 0.15s',
  },
  navLinkActive: {
    backgroundColor: '#eff6ff',
    color: '#1a56db',
    fontWeight: '500',
  },
  footer: {
    padding: '16px 24px 0',
    borderTop: '1px solid #e5e7eb',
    marginTop: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  userEmail: {
    fontSize: '12px',
    color: '#6b7280',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  navSeparator: {
    height: '1px',
    backgroundColor: '#e5e7eb',
    margin: '8px 0',
  },
  signOut: {
    fontSize: '13px',
    color: '#6b7280',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    padding: '0',
  },
  main: {
    flex: 1,
    minWidth: 0,
    overflow: 'auto',
},
}
