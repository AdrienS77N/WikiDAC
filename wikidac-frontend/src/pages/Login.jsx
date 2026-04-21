import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const [isInvite, setIsInvite] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [settingPassword, setSettingPassword] = useState(false)
  const [settingOk, setSettingOk] = useState(false)

  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=invite') || hash.includes('type=recovery')) {
      setIsInvite(true)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email, password)
    } catch (err) {
      setError('Email ou mot de passe incorrect.')
    } finally {
      setLoading(false)
    }
  }

  const handleSetPassword = async (e) => {
    e.preventDefault()
    if (newPassword !== newPassword2) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (newPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    setSettingPassword(true)
    setError(null)
    const { error: err } = await supabase.auth.updateUser({ password: newPassword })
    if (err) {
      setError("Erreur lors de la définition du mot de passe.")
    } else {
      setSettingOk(true)
      setTimeout(() => { window.location.href = '/' }, 2000)
    }
    setSettingPassword(false)
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <img src="/logo.png" alt="DAC Santé 77 Nord" style={styles.logoImg} />
        </div>

        {isInvite ? (
          settingOk ? (
            <p style={styles.success}>Mot de passe enregistré ! Redirection...</p>
          ) : (
            <form onSubmit={handleSetPassword} style={styles.form}>
              <p style={styles.hint}>Bienvenue ! Définissez votre mot de passe pour accéder à WikiDAC.</p>
              <div style={styles.field}>
                <label style={styles.label}>Nouveau mot de passe</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  style={styles.input}
                  placeholder="8 caractères minimum"
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Confirmer le mot de passe</label>
                <input
                  type="password"
                  value={newPassword2}
                  onChange={e => setNewPassword2(e.target.value)}
                  required
                  style={styles.input}
                  placeholder="••••••••"
                />
              </div>
              {error && <p style={styles.error}>{error}</p>}
              <button type="submit" style={styles.button} disabled={settingPassword}>
                {settingPassword ? 'Enregistrement...' : 'Définir mon mot de passe'}
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={styles.input}
                placeholder="prenom.nom@dac77nord.fr"
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={styles.input}
                placeholder="••••••••"
              />
            </div>
            {error && <p style={styles.error}>{error}</p>}
            <button type="submit" style={styles.button} disabled={loading}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f4f6f9',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '48px 40px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
  },
  logo: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '36px',
  },
  logoImg: {
    width: '220px',
    height: 'auto',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
  },
  hint: {
    fontSize: '13px',
    color: '#6b7280',
    margin: 0,
  },
  input: {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  error: {
    color: '#dc2626',
    fontSize: '13px',
    margin: 0,
  },
  success: {
    color: '#16a34a',
    fontSize: '14px',
    textAlign: 'center',
  },
  button: {
    padding: '11px',
    backgroundColor: '#1a56db',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    marginTop: '4px',
  },
}
