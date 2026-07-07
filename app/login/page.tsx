'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
    <main style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'400px',margin:'0 auto',paddingTop:'4rem'}}>
      <h1 style={{fontSize:'22px',fontWeight:'700',margin:'0 0 4px',textAlign:'center'}}>Sistema Bodega</h1>
      <p style={{fontSize:'13px',color:'#666',margin:'0 0 2rem',textAlign:'center'}}>INDELI Constructora</p>

      <div style={{marginBottom:'12px'}}>
        <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Correo</label>
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter' && entrar()} style={{width:'100%',padding:'10px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'14px',boxSizing:'border-box'}}/>
      </div>
      <div style={{marginBottom:'16px'}}>
        <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Contraseña</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter' && entrar()} style={{width:'100%',padding:'10px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'14px',boxSizing:'border-box'}}/>
      </div>
      {error && <p style={{fontSize:'13px',color:'#c5221f',margin:'0 0 12px'}}>{error}</p>}
      <button onClick={entrar} disabled={cargando} style={{width:'100%',padding:'12px',borderRadius:'8px',border:'none',background:'#1a73e8',color:'#fff',fontSize:'14px',fontWeight:'600',cursor:'pointer',opacity:cargando?0.6:1}}>
        {cargando ? 'Entrando...' : 'Entrar'}
      </button>
    </main>
  )
}
