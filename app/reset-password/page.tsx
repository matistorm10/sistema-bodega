'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const AZUL = '#1B4F9C'
const AZUL_OSCURO = '#123A75'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [listo, setListo] = useState(false)
  const router = useRouter()

  // Supabase, al abrir el enlace del correo, crea una sesión temporal de recuperación automáticamente.
  // Esperamos un momento a que esa sesión quede lista antes de mostrar el formulario.
  useEffect(() => {
    supabase.auth.getSession().then(() => setListo(true))
  }, [])

  const guardar = async () => {
    setError('')
    if (!password || password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (password !== password2) { setError('Las contraseñas no coinciden.'); return }
    setCargando(true)
    const { error } = await supabase.auth.updateUser({ password })
    setCargando(false)
    if (error) { setError('No se pudo actualizar: ' + error.message); return }
    setExito(true)
    setTimeout(() => { router.push('/') }, 2000)
  }

  return (
    <main style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem', fontFamily: 'system-ui,sans-serif', background: '#EEF1F6',
      backgroundImage: `linear-gradient(rgba(27,79,156,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(27,79,156,0.055) 1px, transparent 1px)`,
      backgroundSize: '28px 28px',
    }}>
      <style>{`
        .rp-btn:hover:not(:disabled) { background: ${AZUL_OSCURO} !important; }
        .rp-input:focus { outline: none; border-color: ${AZUL} !important; box-shadow: 0 0 0 3px rgba(27,79,156,0.12); }
      `}</style>

      <div style={{ width:'100%', maxWidth:'380px', background:'#fff', borderRadius:'16px', boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 12px 32px rgba(16,24,40,0.08)', overflow:'hidden' }}>
        <div style={{ height:'5px', background:AZUL }} />
        <div style={{ padding:'2.25rem 2rem 2rem' }}>
          <h1 style={{ fontSize:'18px', fontWeight:'700', margin:'0 0 6px', color:'#16213E' }}>Nueva contraseña</h1>

          {!listo ? (
            <p style={{ fontSize:'13px', color:'#8a94a6' }}>Cargando...</p>
          ) : exito ? (
            <div style={{ background:'#e6f4ea', color:'#137333', padding:'12px 14px', borderRadius:'10px', fontSize:'13px' }}>
              Contraseña actualizada. Entrando al sistema...
            </div>
          ) : (
            <>
              <p style={{ fontSize:'13px', color:'#475467', margin:'0 0 18px' }}>Elige tu nueva contraseña para entrar al sistema.</p>
              <div style={{ marginBottom:'14px' }}>
                <label style={{ fontSize:'12px', fontWeight:'600', color:'#475467', display:'block', marginBottom:'6px' }}>Contraseña nueva</label>
                <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="rp-input"
                  style={{ width:'100%', padding:'11px 12px', borderRadius:'10px', border:'1px solid #d9dee6', fontSize:'14px', boxSizing:'border-box' }}/>
              </div>
              <div style={{ marginBottom:'20px' }}>
                <label style={{ fontSize:'12px', fontWeight:'600', color:'#475467', display:'block', marginBottom:'6px' }}>Repite la contraseña</label>
                <input type="password" value={password2} onChange={e=>setPassword2(e.target.value)} onKeyDown={e=>e.key==='Enter' && guardar()} className="rp-input"
                  style={{ width:'100%', padding:'11px 12px', borderRadius:'10px', border:'1px solid #d9dee6', fontSize:'14px', boxSizing:'border-box' }}/>
              </div>
              {error && <p style={{ fontSize:'13px', color:'#c5221f', margin:'0 0 14px', background:'#fce8e6', padding:'8px 12px', borderRadius:'8px' }}>{error}</p>}
              <button onClick={guardar} disabled={cargando} className="rp-btn"
                style={{ width:'100%', padding:'12px', borderRadius:'10px', border:'none', background:AZUL, color:'#fff', fontSize:'14px', fontWeight:'700', cursor:'pointer', opacity:cargando?0.65:1 }}>
                {cargando ? 'Guardando...' : 'Guardar contraseña'}
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
