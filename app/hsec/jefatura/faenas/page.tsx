'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { card, btn, input, label } from '@/components/programa/ui'
import { LUGARES } from '@/lib/capacitaciones'
import { DIAS } from '@/lib/semanal'

// Un solo lugar para armar cada faena: quién la atiende, qué cliente (informes semanales) y qué grupo del programa de capacitaciones.
export default function FaenasAsignaciones() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const puede = usuario?.rol === 'admin' || !!usuario?.esJefeHsec
  const [ubics, setUbics] = useState<any[]>([])
  const [prevs, setPrevs] = useState<any[]>([])
  const [asig, setAsig] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [fc, setFc] = useState<any[]>([])
  const [lugares, setLugares] = useState<any[]>([])
  const [descs, setDescs] = useState<any[]>([])
  const [sem, setSem] = useState<any[]>([])
  const [otras, setOtras] = useState(false)
  const [sel, setSel] = useState<Record<string, string>>({})
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState('')
  const [nuevoCli, setNuevoCli] = useState<{ ub: string, nombre: string, dia: string, plazo: string, hora: string } | null>(null)

  const cargar = useCallback(async () => {
    const [u, p, a, c, f, l, d, s] = await Promise.all([
      supabase.from('ubicaciones').select('id,nombre,tipo,activa').order('nombre'),
      supabase.from('usuarios').select('id,nombre').eq('es_prevencionista', true).order('nombre'),
      supabase.from('pr_epp_ubicaciones').select('*'),
      supabase.from('pr_clientes_informe').select('id,nombre').eq('activo', true).order('nombre'),
      supabase.from('pr_faena_cliente').select('*'),
      supabase.from('pr_cap_ubic_lugar').select('*'),
      supabase.from('pr_descriptores').select('id,usuario_id,ubicacion_id'),
      supabase.from('pr_semanal_asignaciones').select('*'),
    ])
    setUbics((u.data || []).filter((x: any) => x.activa !== false)); setPrevs(p.data || []); setAsig(a.data || []); setClientes(c.data || [])
    setFc(f.data || []); setLugares(l.data || []); setDescs(d.data || []); setSem(s.data || []); setCargando(false)
  }, [])
  useEffect(() => { if (usuario && puede) cargar() }, [usuario, puede, cargar])

  const err = (e: any) => { if (e) { alert(e.message); return true } return false }
  const nombreU = (id: string) => prevs.find(p => p.id === id)?.nombre || '—'

  const setLugar = async (ub: string, lugar: string) => {
    const { error } = lugar ? await supabase.from('pr_cap_ubic_lugar').upsert({ ubicacion_id: ub, lugar }) : await supabase.from('pr_cap_ubic_lugar').delete().eq('ubicacion_id', ub)
    if (!err(error)) await cargar()
  }
  const asegurarSemanal = async (usuarioId: string, ub: string, cliente: string) => {
    await supabase.from('pr_semanal_asignaciones').upsert({ usuario_id: usuarioId, cliente_id: cliente, ubicacion_id: ub }, { onConflict: 'usuario_id,cliente_id' })
  }
  const setCliente = async (ub: string, cliente: string) => {
    if (cliente) {
      let e = (await supabase.from('pr_faena_cliente').upsert({ ubicacion_id: ub, cliente_id: cliente })).error
      if (err(e)) return
      // quita asignaciones semanales antiguas de esta faena con otro cliente y deja a todos los prevencionistas con el nuevo
      e = (await supabase.from('pr_semanal_asignaciones').delete().eq('ubicacion_id', ub).neq('cliente_id', cliente)).error
      if (err(e)) return
      for (const a of asig.filter(x => x.ubicacion_id === ub)) await asegurarSemanal(a.usuario_id, ub, cliente)
    } else {
      if (err((await supabase.from('pr_faena_cliente').delete().eq('ubicacion_id', ub)).error)) return
      if (err((await supabase.from('pr_semanal_asignaciones').delete().eq('ubicacion_id', ub)).error)) return
    }
    await cargar()
  }
  const crearCliente = async () => {
    if (!nuevoCli) return
    if (!nuevoCli.nombre.trim()) { alert('Escribe el nombre del cliente.'); return }
    const nombre = nuevoCli.nombre.trim()
    let { data, error } = await supabase.from('pr_clientes_informe').insert({ nombre, dia_cierre: Number(nuevoCli.dia), dias_plazo: Number(nuevoCli.plazo) || 0, hora_limite: nuevoCli.hora || '23:59' }).select('id').maybeSingle()
    if (error?.code === '23505') { // ya existe: se reutiliza
      const ex = await supabase.from('pr_clientes_informe').select('id').eq('nombre', nombre).maybeSingle()
      data = ex.data as any; error = null
    }
    if (err(error) || !data) return
    const ub = nuevoCli.ub
    setNuevoCli(null)
    await setCliente(ub, data.id)
  }
  const agregar = async (ub: string) => {
    const uid = sel[ub]; if (!uid || !usuario) return
    if (err((await supabase.from('pr_epp_ubicaciones').upsert({ usuario_id: uid, ubicacion_id: ub }, { onConflict: 'usuario_id,ubicacion_id' })).error)) return
    // descriptor de cargo (SSO ítem 1): si aún no tiene, se crea apuntando a esta faena
    if (!descs.some(d => d.usuario_id === uid)) {
      const { data: doc } = await supabase.from('pr_documentos').select('revision').eq('clave', 'descriptor_apr').maybeSingle()
      if (err((await supabase.from('pr_descriptores').insert({ usuario_id: uid, ubicacion_id: ub, revision: doc?.revision || null, asignado_por: usuario.id })).error)) return
    }
    const cli = fc.find(x => x.ubicacion_id === ub)?.cliente_id
    if (cli) await asegurarSemanal(uid, ub, cli)
    setSel({ ...sel, [ub]: '' }); setMsg(''); await cargar()
  }
  const quitar = async (ub: string, uid: string) => {
    if (!confirm(`¿Quitar a ${nombreU(uid)} de esta faena? Su descriptor firmado y el historial se conservan.`)) return
    if (err((await supabase.from('pr_epp_ubicaciones').delete().eq('usuario_id', uid).eq('ubicacion_id', ub)).error)) return
    if (err((await supabase.from('pr_semanal_asignaciones').delete().eq('usuario_id', uid).eq('ubicacion_id', ub)).error)) return
    await cargar()
  }

  const lista = ubics.filter(u => otras || u.tipo === 'faena' || asig.some(a => a.ubicacion_id === u.id) || lugares.some(l => l.ubicacion_id === u.id))
  const sinFaena = prevs.filter(p => !asig.some(a => a.usuario_id === p.id))

  const cab = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', background: '#fff', borderRadius: '16px', padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
      <Link href="/hsec/jefatura" style={{ fontSize: '13px', color: AZUL, textDecoration: 'none' }}>← Panel de Jefatura</Link>
      <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Faenas y asignaciones</h1>
    </div>
  )
  if (cargandoUsuario) return <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif' }}><p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p></div></main>
  return (
    <main style={fondoPagina}>
      <div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '900px', margin: '0 auto' }}>
        {cab}
        {!puede ? <p style={{ fontSize: '13px', color: '#999' }}>No tienes acceso a esta sección.</p> : cargando ? <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p> : (
          <>
            <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: '#667085' }}>Todo se configura aquí, por faena. Al asignar un prevencionista queda habilitado para SSO Faena, informes diarios, charlas, stock de EPP y los informes semanales del cliente de esa faena.</p>
            {sinFaena.length > 0 && <div style={{ ...card, background: '#fff8e5', borderColor: '#f0d98a', marginBottom: '12px', fontSize: '12.5px', color: '#7a5600' }}>⚠️ Prevencionistas sin faena: {sinFaena.map(p => p.nombre).join(' · ')}</div>}
            {lista.length === 0 && <p style={{ fontSize: '13px', color: '#999' }}>No hay faenas.</p>}
            <div style={{ display: 'grid', gap: '12px' }}>
              {lista.map(u => {
                const mias = asig.filter(a => a.ubicacion_id === u.id)
                const disp = prevs.filter(p => !mias.some(a => a.usuario_id === p.id))
                const cli = fc.find(x => x.ubicacion_id === u.id)?.cliente_id || ''
                return (
                  <div key={u.id} style={card}>
                    <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: '15px', color: '#16213E' }}>{u.nombre}{u.tipo !== 'faena' && <span style={{ fontWeight: 400, fontSize: '11px', color: '#98a2b3' }}> · {u.tipo}</span>}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '10px', marginBottom: '12px' }}>
                      <div><label style={label}>Cliente (informes semanales)</label>
                        <select value={cli} onChange={e => e.target.value === '__nuevo' ? setNuevoCli({ ub: u.id, nombre: '', dia: '7', plazo: '1', hora: '23:59' }) : setCliente(u.id, e.target.value)} style={input}><option value="">Sin cliente</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}<option value="__nuevo">➕ Crear cliente nuevo…</option></select></div>
                      <div><label style={label}>Grupo del programa de capacitaciones</label>
                        <select value={lugares.find(l => l.ubicacion_id === u.id)?.lugar || ''} onChange={e => setLugar(u.id, e.target.value)} style={input}><option value="">Sin clasificar</option>{Object.entries(LUGARES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                    </div>
                    {nuevoCli?.ub === u.id && (
                      <div style={{ border: '1px solid #cfe0f5', background: '#f4f8fd', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
                        <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '13px' }}>Nuevo cliente para informes semanales</p>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          <div style={{ flex: '1 1 160px' }}><label style={label}>Nombre (ej. SQM, ENGIE)</label><input value={nuevoCli.nombre} onChange={e => setNuevoCli({ ...nuevoCli, nombre: e.target.value })} style={input} autoFocus /></div>
                          <div style={{ flex: '0 1 140px' }}><label style={label}>La semana cierra el</label><select value={nuevoCli.dia} onChange={e => setNuevoCli({ ...nuevoCli, dia: e.target.value })} style={input}>{DIAS.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></div>
                          <div style={{ flex: '0 1 100px' }}><label style={label}>Plazo (días)</label><input type="number" min="0" max="30" value={nuevoCli.plazo} onChange={e => setNuevoCli({ ...nuevoCli, plazo: e.target.value })} style={input} /></div>
                          <div style={{ flex: '0 1 100px' }}><label style={label}>Hora límite</label><input type="time" value={nuevoCli.hora} onChange={e => setNuevoCli({ ...nuevoCli, hora: e.target.value })} style={input} /></div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                          <button onClick={crearCliente} style={{ ...btn(), padding: '8px 14px', fontSize: '12.5px' }}>Crear y asignar a esta faena</button>
                          <button onClick={() => setNuevoCli(null)} style={{ ...btn(false), padding: '8px 14px', fontSize: '12.5px' }}>Cancelar</button>
                        </div>
                        <p style={{ margin: '8px 0 0', fontSize: '11.5px', color: '#667085' }}>El formato del cliente (Word/Excel) se sube después en «Informes semanales por cliente».</p>
                      </div>
                    )}
                    <label style={label}>Prevencionistas de esta faena</label>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      {mias.length === 0 && <span style={{ fontSize: '12.5px', color: '#98a2b3' }}>Ninguno todavía.</span>}
                      {mias.map(a => (
                        <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', padding: '4px 6px 4px 10px', borderRadius: '20px', background: '#e8f0fb', color: AZUL, fontWeight: 600 }}>
                          {nombreU(a.usuario_id)}<button onClick={() => quitar(u.id, a.usuario_id)} title="Quitar" style={{ border: 'none', background: 'none', color: '#9b1c1c', cursor: 'pointer', fontSize: '15px', lineHeight: 1 }}>×</button>
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <select value={sel[u.id] || ''} onChange={e => setSel({ ...sel, [u.id]: e.target.value })} style={{ ...input, flex: '1 1 200px', width: 'auto' }}><option value="">Agregar prevencionista…</option>{disp.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
                      <button onClick={() => agregar(u.id)} disabled={!sel[u.id]} style={{ ...btn(), padding: '8px 14px', fontSize: '12.5px', opacity: sel[u.id] ? 1 : 0.5 }}>Agregar</button>
                    </div>
                  </div>
                )
              })}
            </div>
            <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12.5px', color: '#667085', marginTop: '12px' }}><input type="checkbox" checked={otras} onChange={e => setOtras(e.target.checked)} />Mostrar también bodegas y otras ubicaciones (ej. oficina central)</label>
            {msg && <p style={{ fontSize: '12.5px', color: '#c5221f' }}>{msg}</p>}
          </>
        )}
      </div>
    </main>
  )
}
