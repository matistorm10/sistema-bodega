'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const AZUL = '#1B4F9C'
const AZUL_OSCURO = '#123A75'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const router = useRouter()

  const entrar = async () => {
    if (!email || !password) { setError('Ingresa tu correo y contraseña.'); return }
    setCargando(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setCargando(false)
    if (error) { setError('Correo o contraseña incorrectos.'); return }
    router.push('/')
    router.refresh()
  }

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      fontFamily: 'system-ui,sans-serif',
      background: '#EEF1F6',
      backgroundImage: `
        linear-gradient(rgba(27,79,156,0.055) 1px, transparent 1px),
        linear-gradient(90deg, rgba(27,79,156,0.055) 1px, transparent 1px)
      `,
      backgroundSize: '28px 28px',
    }}>
      <style>{`
        .login-btn:hover:not(:disabled) { background: ${AZUL_OSCURO} !important; }
        .login-input:focus { outline: none; border-color: ${AZUL} !important; box-shadow: 0 0 0 3px rgba(27,79,156,0.12); }
      `}</style>

      <div style={{
        width: '100%',
        maxWidth: '380px',
        background: '#fff',
        borderRadius: '16px',
        boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 12px 32px rgba(16,24,40,0.08)',
        overflow: 'hidden',
      }}>
        <div style={{ height: '5px', background: AZUL }} />

        <div style={{ padding: '2.25rem 2rem 2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <img src="/logo-indeli.jpg" alt="Grupo Indeli" style={{ width: '100%', maxWidth: '220px', height: 'auto', borderRadius: '6px', border: '1px solid #e2e6ed' }} />
          </div>

          <p style={{
            fontSize: '11px', fontWeight: '700', color: AZUL, textAlign: 'center',
            textTransform: 'uppercase', letterSpacing: '1.5px', margin: '0 0 2rem',
          }}>
            Sistema de Inventario · Bodegas
          </p>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#475467', display: 'block', marginBottom: '6px' }}>Correo</label>
            <input
              type="email" value={email} onChange={e=>setEmail(e.target.value)}
              onKeyDown={e=>e.key==='Enter' && entrar()}
              className="login-input"
              style={{ width:'100%', padding:'11px 12px', borderRadius:'10px', border:'1px solid #d9dee6', fontSize:'14px', boxSizing:'border-box', transition:'border-color .15s, box-shadow .15s' }}
            />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#475467', display: 'block', marginBottom: '6px' }}>Contraseña</label>
            <input
              type="password" value={password} onChange={e=>setPassword(e.target.value)}
              onKeyDown={e=>e.key==='Enter' && entrar()}
              className="login-input"
              style={{ width:'100%', padding:'11px 12px', borderRadius:'10px', border:'1px solid #d9dee6', fontSize:'14px', boxSizing:'border-box', transition:'border-color .15s, box-shadow .15s' }}
            />
          </div>

          {error && <p style={{ fontSize:'13px', color:'#c5221f', margin:'0 0 14px', background:'#fce8e6', padding:'8px 12px', borderRadius:'8px' }}>{error}</p>}

          <button
            onClick={entrar} disabled={cargando} className="login-btn"
            style={{ width:'100%', padding:'12px', borderRadius:'10px', border:'none', background:AZUL, color:'#fff', fontSize:'14px', fontWeight:'700', cursor:'pointer', opacity:cargando?0.65:1, transition:'background .15s' }}
          >
            {cargando ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
      </div>
    </main>
  )
}
