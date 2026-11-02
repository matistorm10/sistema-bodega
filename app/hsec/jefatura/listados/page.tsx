'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { card, btn, input, label } from '@/components/programa/ui'

export default function ListadosInforme() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const puede = usuario?.rol === 'admin' || !!usuario?.esJefeHsec
  const [lista, setLista] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [nuevo, setNuevo] = useState('')
  const [ed, setEd] = useState<{ id: string, nombre: string } | null>(null)
  const [msg, setMsg] = useState('')

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('pr_actividad_catalogo').select('*').order('orden').order('nombre')
    setLista(data || []); setCargando(false)
  }, [])
  useEffect(() => { if (usuario && puede) cargar() }, [usuario, puede, cargar])

  const agregar = async () => {
    const nombres = nuevo.split('\n').map(x => x.trim()).filter(Boolean)
    if (nombres.length === 0) return
    const base = Math.max(0, ...lista.map(x => x.orden || 0))
    const { error } = await supabase.from('pr_actividad_catalogo').insert(nombres.map((nombre, i) => ({ nombre, orden: base + i + 1 })))
    if (error) { setMsg(error.code === '23505' ? 'Alguna de esas actividades ya existe.' : error.message); return }
    setMsg(''); setNuevo(''); await cargar()
  }
  const guardar = async () => {
    if (!ed || !ed.nombre.trim()) return
    const { error } = await supabase.from('pr_actividad_catalogo').update({ nombre: ed.nombre.trim() }).eq('id', ed.id)
    if (error) { setMsg(error.code === '23505' ? 'Ya existe una actividad con ese nombre.' : error.message); return }
    setMsg(''); setEd(null); await cargar()
  }
  const eliminar = async (a: any) => {
    if (!confirm(`¿Quitar «${a.nombre}» del listado? Los informes ya hechos no cambian.`)) return
    const { error } = await supabase.from('pr_actividad_catalogo').delete().eq('id', a.id)
    if (error) { alert(error.message); return }
    await cargar()
  }

  return (
    <main style={fondoPagina}>
      <div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '760px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', background: '#fff', borderRadius: '16px', padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
          <Link href="/hsec/jefatura" style={{ fontSize: '13px', color: AZUL, textDecoration: 'none' }}>← Panel de Jefatura</Link>
          <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Listados del informe diario</h1>
        </div>
        {cargandoUsuario || cargando ? <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p> : !puede ? <p style={{ fontSize: '13px', color: '#999' }}>No tienes acceso a esta sección.</p> : (
          <>
            <div style={{ ...card, marginBottom: '12px' }}>
              <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '14px' }}>Actividades preventivas realizadas</p>
              <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#667085' }}>Es la lista desplegable del punto 2 del informe diario. El APR elige de aquí (o escribe «Otra» si no está).</p>
              <label style={label}>Agregar (una por línea)</label>
              <textarea rows={2} value={nuevo} onChange={e => setNuevo(e.target.value)} placeholder="Ej: Charla de seguridad en altura" style={{ ...input, resize: 'vertical', marginBottom: '8px' }} />
              <button onClick={agregar} style={btn()}>+ Agregar al listado</button>
              {msg && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '8px 0 0' }}>{msg}</p>}
            </div>
            <div style={card}>
              {lista.length === 0 && <p style={{ margin: 0, fontSize: '12.5px', color: '#98a2b3' }}>El listado está vacío.</p>}
              {lista.map(a => (
                <div key={a.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f3f5f9' }}>
                  {ed && ed.id === a.id ? (
                    <><input value={ed.nombre} onChange={e => { const v = e.target.value; setEd(x => x && { ...x, nombre: v }) }} onKeyDown={e => { if (e.key === 'Enter') guardar() }} style={{ ...input, flex: 1 }} autoFocus /><button onClick={guardar} style={{ ...btn(), padding: '5px 12px', fontSize: '12px' }}>Guardar</button><button onClick={() => setEd(null)} style={{ ...btn(false), padding: '5px 12px', fontSize: '12px' }}>Cancelar</button></>
                  ) : (
                    <><span style={{ flex: 1, fontSize: '13.5px' }}>{a.nombre}</span><button onClick={() => setEd({ id: a.id, nombre: a.nombre })} style={{ ...btn(false), padding: '4px 10px', fontSize: '12px' }}>✏️ Editar</button><button onClick={() => eliminar(a)} style={{ ...btn(false, true), padding: '4px 10px', fontSize: '12px' }}>Quitar</button></>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
