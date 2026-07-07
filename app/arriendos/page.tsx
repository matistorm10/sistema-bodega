'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function Arriendos() {
  const [todos, setTodos] = useState<any[]>([])
  const [ubicaciones, setUbicaciones] = useState<any[]>([])
  const [ubSel, setUbSel] = useState('') // '' = todas las ubicaciones

  useEffect(() => {
    supabase.from('ubicaciones').select('*').order('tipo').order('nombre').then(({data}) => setUbicaciones(data||[]))
    supabase
      .from('arriendos')
      .select('*, tipos(nombre), ubicacion:ubicacion_id(nombre)')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('Error arriendos:', error.message)
        setTodos(data || [])
      })
  }, [])

  const bodegas = ubicaciones.filter(u => u.tipo === 'bodega')
  const faenas = ubicaciones.filter(u => u.tipo === 'faena')

  const filtrados = ubSel ? todos.filter(a => a.ubicacion_id === ubSel) : todos
  const activos = filtrados.filter(a => a.estado === 'activo')
  const cerrados = filtrados.filter(a => a.estado !== 'activo')

  const hoy = new Date().toISOString().split('T')[0]
  const dias = (fi: string) => Math.max(1, Math.round((new Date(hoy).getTime() - new Date(fi).getTime()) / 86400000))
  const costo = (a: any) => dias(a.fecha_inicio) * a.valor_dia
  const totalActivos = activos.reduce((s, a) => s + costo(a), 0)
  const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')

  return (
    <main style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'600px',margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'1.5rem'}}>
        <Link href="/" style={{fontSize:'13px',color:'#1a73e8',textDecoration:'none'}}>← Inicio</Link>
        <h1 style={{fontSize:'20px',fontWeight:'600',margin:'0'}}>Arriendos</h1>
      </div>

      <div style={{marginBottom:'1.25rem'}}>
        <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Filtrar por ubicación</label>
        <select value={ubSel} onChange={e=>setUbSel(e.target.value)} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px'}}>
          <option value=''>Todas las ubicaciones</option>
          <optgroup label='Bodegas'>{bodegas.map(b=><option key={b.id} value={b.id}>{b.nombre}</option>)}</optgroup>
          <optgroup label='Faenas'>{faenas.map(f=><option key={f.id} value={f.id}>{f.nombre}</option>)}</optgroup>
        </select>
      </div>

      <div style={{background:'#fef9e7',border:'0.5px solid #f9e79f',borderRadius:'12px',padding:'14px 16px',marginBottom:'1.25rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontSize:'13px',color:'#856404',fontWeight:'500'}}>Costo acumulado activos{ubSel ? ' (en esta ubicación)' : ''}</span>
        <span style={{fontSize:'20px',fontWeight:'700',color:'#856404'}}>{fmt(totalActivos)}</span>
      </div>

      <p style={{fontSize:'14px',fontWeight:'600',margin:'0 0 8px'}}>Activos ({activos.length})</p>
      {activos.length === 0 && <p style={{fontSize:'13px',color:'#999',marginBottom:'1rem'}}>Sin equipos arrendados activos{ubSel ? ' en esta ubicación' : ''}.</p>}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'1.5rem'}}>
        {activos.map(a => (
          <div key={a.id} style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'12px'}}>
            <p style={{fontWeight:'700',fontSize:'14px',margin:'0 0 2px'}}>{a.tipos?.nombre || '—'}</p>
            <p style={{fontSize:'12px',color:'#555',margin:'0 0 6px'}}>{a.descripcion}</p>
            <p style={{fontSize:'11px',color:'#888',margin:'0 0 2px'}}>📍 {a.ubicacion?.nombre || '—'}</p>
            <p style={{fontSize:'11px',color:'#888',margin:'0 0 6px'}}>Retiro: {a.fecha_inicio}</p>
            <div style={{borderTop:'0.5px solid #eee',paddingTop:'6px',display:'flex',justifyContent:'space-between',fontSize:'12px'}}>
              <span style={{color:'#666'}}>{dias(a.fecha_inicio)} días</span>
              <span style={{fontWeight:'600'}}>{fmt(costo(a))}</span>
            </div>
          </div>
        ))}
      </div>

      <p style={{fontSize:'14px',fontWeight:'600',margin:'0 0 8px'}}>Historial ({cerrados.length})</p>
      {cerrados.length === 0 && <p style={{fontSize:'13px',color:'#999'}}>Sin arriendos cerrados{ubSel ? ' en esta ubicación' : ''}.</p>}
      {cerrados.map(a => (
        <div key={a.id} style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'8px',padding:'10px 12px',marginBottom:'6px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <p style={{fontSize:'13px',fontWeight:'600',margin:'0 0 1px'}}>{a.tipos?.nombre || '—'}</p>
            <p style={{fontSize:'12px',color:'#666',margin:'0'}}>{a.descripcion} · 📍 {a.ubicacion?.nombre || '—'} · {a.fecha_inicio} → {a.fecha_devolucion}</p>
          </div>
          <span style={{fontSize:'13px',fontWeight:'600',color:'#333'}}>{fmt(costo(a))}</span>
        </div>
      ))}

      <Link href="/movimientos" style={{display:'block',marginTop:'1.5rem',padding:'12px',background:'#1a73e8',color:'#fff',borderRadius:'8px',textAlign:'center',textDecoration:'none',fontSize:'14px',fontWeight:'600'}}>
        + Registrar arriendo
      </Link>
    </main>
  )
}