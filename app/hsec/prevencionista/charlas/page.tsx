'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { formatearRut } from '@/lib/rut'
import { misUbicacionesIds, TIPOS_CHARLA, fechaCL } from '@/lib/prevencion'

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e6ed', borderRadius: '14px', padding: '14px 16px' }
const input: React.CSSProperties = { width: '100%', padding: '9px 10px', border: '1px solid #d0d5dd', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', background: '#fff' }
const label: React.CSSProperties = { fontSize: '11px', color: '#667085', display: 'block', marginBottom: '3px', fontWeight: 600 }
const btn = (primario = true, peligro = false): React.CSSProperties => ({
  padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  border: primario ? 'none' : `1px solid ${peligro ? '#e5b4b4' : '#d0d5dd'}`,
  background: primario ? AZUL : '#fff', color: primario ? '#fff' : (peligro ? '#9b1c1c' : '#344054'),
})
const hoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)

type Asistente = { nombre: string, rut: string }

export default function Prevencionista() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  const puede = esAdmin || !!usuario?.esJefeHsec || !!usuario?.esPrevencionista
  const veTodas = esAdmin || !!usuario?.esJefeHsec

  const [charlas, setCharlas] = useState<any[]>([])
  const [asistentes, setAsistentes] = useState<any[]>([])
  const [faenas, setFaenas] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [abierta, setAbierta] = useState<string | null>(null)

  const [nueva, setNueva] = useState(false)
  const [fecha, setFecha] = useState(hoy())
  const [tipo, setTipo] = useState('charla_5min')
  const [tema, setTema] = useState('')
  const [faena, setFaena] = useState('')
  const [relator, setRelator] = useState('')
  const [duracion, setDuracion] = useState('')
  const [obs, setObs] = useState('')
  const [lista, setLista] = useState<Asistente[]>([])
  const [aNombre, setANombre] = useState('')
  const [aRut, setARut] = useState('')
  const [pegar, setPegar] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')

  const cargar = useCallback(async () => {
    const [c, a, f, u] = await Promise.all([
      supabase.from('pr_charlas').select('*').order('fecha', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('pr_charla_asistentes').select('*').order('nombre'),
      supabase.from('ubicaciones').select('id,nombre,activa').eq('tipo', 'faena').order('nombre'),
      supabase.from('usuarios').select('id,nombre'),
    ])
    setCharlas(c.data || []); setAsistentes(a.data || [])
    const propias = veTodas || !usuario ? null : await misUbicacionesIds(usuario.id)
    setFaenas((f.data || []).filter((x: any) => x.activa !== false && (!propias || propias.has(x.id)))); setUsuarios(u.data || [])
    setCargando(false)
  }, [usuario, veTodas])
  useEffect(() => { if (usuario && puede) cargar() }, [usuario, puede, cargar])

  const nombreFaena = (id?: string | null) => faenas.find(f => f.id === id)?.nombre || '—'
  const nombreUsuario = (id: string) => usuarios.find(u => u.id === id)?.nombre || '—'
  const asistDe = (id: string) => asistentes.filter(a => a.charla_id === id)

  const abrirForm = () => {
    setNueva(true); setMsg(''); setFecha(hoy()); setTipo('charla_5min'); setTema(''); setFaena(''); setRelator(usuario?.nombre || '')
    setDuracion(''); setObs(''); setLista([]); setANombre(''); setARut(''); setPegar('')
  }
  const agregarAsistente = () => {
    if (!aNombre.trim()) return
    setLista(l => [...l, { nombre: aNombre.trim(), rut: aRut }]); setANombre(''); setARut('')
  }
  const procesarPegado = () => {
    const nuevos: Asistente[] = pegar.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const partes = l.split(/[,;\t]/).map(x => x.trim())
      const rutIdx = partes.findIndex(p => /^[\d.]+-?[\dkK]$/.test(p) && p.replace(/\D/g, '').length >= 7)
      const rut = rutIdx >= 0 ? formatearRut(partes[rutIdx]) : ''
      const nombre = partes.filter((_, i) => i !== rutIdx).join(' ').trim()
      return { nombre, rut }
    }).filter(a => a.nombre)
    setLista(l => [...l, ...nuevos]); setPegar('')
  }
  const guardar = async () => {
    if (!usuario) return
    if (!tema.trim()) { setMsg('Escribe el tema de la charla.'); return }
    if (!faena) { setMsg('Elige la faena / centro de costo.'); return }
    if (lista.length === 0 && !confirm('No agregaste asistentes. ¿Guardar igual?')) return
    setGuardando(true); setMsg('')
    const { data, error } = await supabase.from('pr_charlas').insert({
      fecha, tipo, tema: tema.trim(), ubicacion_id: faena, relator: relator.trim() || null,
      duracion_min: duracion ? Number(duracion) : null, observaciones: obs.trim() || null, creado_por: usuario.id,
    }).select().single()
    if (error || !data) { setGuardando(false); setMsg('No se pudo guardar: ' + (error?.message || '')); return }
    if (lista.length) {
      const { error: e2 } = await supabase.from('pr_charla_asistentes').insert(lista.map(a => ({ charla_id: data.id, nombre: a.nombre, rut: a.rut || null })))
      if (e2) { setGuardando(false); setMsg('La charla se guardó, pero fallaron los asistentes: ' + e2.message); await cargar(); return }
    }
    setGuardando(false); setNueva(false); await cargar(); setAbierta(data.id)
  }
  const eliminar = async (c: any) => {
    if (!confirm(`¿Eliminar la charla "${c.tema}" y su lista de asistentes?`)) return
    const { error } = await supabase.from('pr_charlas').delete().eq('id', c.id)
    if (error) { alert(error.message); return }
    setAbierta(null); await cargar()
  }

  if (cargandoUsuario) return <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif' }}><p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p></div></main>

  return (
    <main style={fondoPagina}>
      <div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', background: '#fff', borderRadius: '16px', padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
          <Link href="/hsec/prevencionista" style={{ fontSize: '13px', color: AZUL, textDecoration: 'none' }}>← Espacio del Prevencionista</Link>
          <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Charlas y capacitaciones</h1>
        </div>

        {!puede ? <p style={{ fontSize: '13px', color: '#999' }}>No tienes acceso a esta sección. Pídele al administrador que te la habilite en Usuarios.</p> : cargando ? <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p> : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '10px', flexWrap: 'wrap' }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#16213E' }}>🗣️ Charlas y capacitaciones <span style={{ fontWeight: 400, color: '#667085' }}>({charlas.length}{veTodas ? ' en total' : ''})</span></p>
              {!nueva && <button onClick={abrirForm} style={btn()}>+ Nueva charla</button>}
            </div>

            {nueva && (
              <div style={{ ...card, marginBottom: '14px' }}>
                <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: '14px' }}>Nueva charla o capacitación</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '10px', marginBottom: '10px' }}>
                  <div><label style={label}>Fecha</label><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={input} /></div>
                  <div><label style={label}>Tipo</label>
                    <select value={tipo} onChange={e => setTipo(e.target.value)} style={input}>{Object.entries(TIPOS_CHARLA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                  <div><label style={label}>Faena / centro de costo</label>
                    <select value={faena} onChange={e => setFaena(e.target.value)} style={input}><option value="">Seleccionar…</option>{faenas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}</select></div>
                  <div><label style={label}>Duración (minutos)</label><input type="number" min="0" value={duracion} onChange={e => setDuracion(e.target.value)} style={input} placeholder="5" /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '10px', marginBottom: '10px' }}>
                  <div><label style={label}>Tema</label><input value={tema} onChange={e => setTema(e.target.value)} style={input} placeholder="Ej: Trabajo en altura, uso de arnés" /></div>
                  <div><label style={label}>Relator</label><input value={relator} onChange={e => setRelator(e.target.value)} style={input} /></div>
                </div>
                <div style={{ marginBottom: '12px' }}><label style={label}>Observaciones (opcional)</label><input value={obs} onChange={e => setObs(e.target.value)} style={input} /></div>

                <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '13px' }}>Asistentes ({lista.length})</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <input value={aNombre} onChange={e => setANombre(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') agregarAsistente() }} placeholder="Nombre" style={{ ...input, flex: '2 1 180px', width: 'auto' }} />
                  <input value={aRut} onChange={e => setARut(formatearRut(e.target.value))} onKeyDown={e => { if (e.key === 'Enter') agregarAsistente() }} placeholder="RUT" maxLength={12} style={{ ...input, flex: '1 1 130px', width: 'auto' }} />
                  <button onClick={agregarAsistente} style={btn(false)}>Agregar</button>
                </div>
                <details style={{ marginBottom: '8px' }}>
                  <summary style={{ fontSize: '12px', color: AZUL, cursor: 'pointer' }}>Pegar una lista (un asistente por línea, desde Excel o WhatsApp)</summary>
                  <textarea value={pegar} onChange={e => setPegar(e.target.value)} rows={4} placeholder={'Juan Pérez, 12.345.678-9\nPedro Soto, 9.876.543-2'} style={{ ...input, marginTop: '6px', fontFamily: 'inherit' }} />
                  <button onClick={procesarPegado} disabled={!pegar.trim()} style={{ ...btn(false), marginTop: '6px' }}>Agregar lista</button>
                </details>
                {lista.length > 0 && (
                  <div style={{ border: '1px solid #eef1f6', borderRadius: '8px', marginBottom: '10px', maxHeight: '220px', overflowY: 'auto' }}>
                    {lista.map((a, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontSize: '13px', borderTop: i ? '1px solid #eef1f6' : undefined }}>
                        <span>{a.nombre}{a.rut ? <span style={{ color: '#667085' }}> · {a.rut}</span> : null}</span>
                        <button onClick={() => setLista(l => l.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', color: '#c5221f', cursor: 'pointer', fontSize: '15px' }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                {msg && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '0 0 8px' }}>{msg}</p>}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={guardar} disabled={guardando} style={btn()}>{guardando ? 'Guardando...' : 'Guardar charla'}</button>
                  <button onClick={() => setNueva(false)} style={btn(false)}>Cancelar</button>
                </div>
              </div>
            )}

            {charlas.length === 0 && !nueva && <p style={{ fontSize: '13px', color: '#999' }}>Aún no hay charlas registradas.</p>}
            <div style={{ display: 'grid', gap: '8px' }}>
              {charlas.map(c => {
                const as = asistDe(c.id)
                const open = abierta === c.id
                const puedeBorrar = veTodas || c.creado_por === usuario?.id
                return (
                  <div key={c.id} style={card}>
                    <div onClick={() => setAbierta(open ? null : c.id)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: '14px', color: '#16213E' }}>{c.tema}</p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#667085' }}>
                          {fechaCL(c.fecha)} · {TIPOS_CHARLA[c.tipo] || c.tipo} · {nombreFaena(c.ubicacion_id)}{veTodas ? ` · ${nombreUsuario(c.creado_por)}` : ''}
                        </p>
                      </div>
                      <span style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '20px', background: '#E8F0FE', color: AZUL, whiteSpace: 'nowrap' }}>{as.length} asistente{as.length === 1 ? '' : 's'}</span>
                    </div>
                    {open && (
                      <div style={{ marginTop: '10px', borderTop: '1px solid #eef1f6', paddingTop: '10px', fontSize: '13px' }}>
                        <p style={{ margin: '0 0 4px', color: '#475467' }}>Relator: <strong>{c.relator || '—'}</strong>{c.duracion_min ? ` · ${c.duracion_min} min` : ''}</p>
                        {c.observaciones && <p style={{ margin: '0 0 6px', color: '#475467' }}>Observaciones: {c.observaciones}</p>}
                        {as.length > 0 && (
                          <ul style={{ margin: '6px 0 0', paddingLeft: '18px', columns: as.length > 8 ? 2 : 1 }}>
                            {as.map(a => <li key={a.id} style={{ marginBottom: '2px' }}>{a.nombre}{a.rut ? <span style={{ color: '#667085' }}> · {a.rut}</span> : null}</li>)}
                          </ul>
                        )}
                        {puedeBorrar && <button onClick={() => eliminar(c)} style={{ ...btn(false, true), marginTop: '10px', padding: '6px 12px', fontSize: '12px' }}>Eliminar charla</button>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
