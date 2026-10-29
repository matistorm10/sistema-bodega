'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { card, btn, input, label } from '@/components/programa/ui'
import { CATEGORIAS, ESTADOS_DOC, COLOR_DOC, diasDesde } from '@/lib/contratos'
import { fechaCL } from '@/lib/prevencion'

const abrir = async (path: string) => {
  const { data, error } = await supabase.storage.from('hsec-documentos').createSignedUrl(path, 600)
  if (error || !data) { alert('No se pudo abrir el archivo.'); return }
  window.open(data.signedUrl, '_blank')
}
const Chip = ({ e, n }: { e: string, n?: number }) => <span style={{ fontSize: '11px', padding: '2px 9px', borderRadius: '20px', fontWeight: 600, background: COLOR_DOC[e][0], color: COLOR_DOC[e][1], whiteSpace: 'nowrap' }}>{e}{n !== undefined ? `: ${n}` : ''}</span>

export default function JefaturaContratos() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const puede = usuario?.rol === 'admin' || !!usuario?.esJefeHsec
  const [contratos, setContratos] = useState<any[]>([])
  const [docs, setDocs] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [hist, setHist] = useState<Record<string, any[]>>({})
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState('')
  const [nuevo, setNuevo] = useState({ nombre: '', cliente_id: '' })
  const [edit, setEdit] = useState<{ id: string, nombre: string, cliente_id: string } | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [nombres, setNombres] = useState<Record<string, string>>({})
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [verHist, setVerHist] = useState<string | null>(null)
  const [renombrar, setRenombrar] = useState<{ id: string, nombre: string } | null>(null)
  const [ocupado, setOcupado] = useState('')

  const cargar = useCallback(async () => {
    const [c, d, cl] = await Promise.all([
      supabase.from('pr_contratos').select('*').order('nombre'),
      supabase.from('pr_contrato_documentos').select('*').order('nombre'),
      supabase.from('pr_clientes_informe').select('id,nombre').eq('activo', true).order('nombre'),
    ])
    setContratos(c.data || []); setDocs(d.data || []); setClientes(cl.data || []); setCargando(false)
  }, [])
  useEffect(() => { if (usuario && puede) cargar() }, [usuario, puede, cargar])

  const err = (e: any) => { if (e) { alert(e.message || String(e)); return true } return false }
  const crear = async () => {
    if (!nuevo.nombre.trim() || !nuevo.cliente_id) { setMsg('Escribe el contrato y elige el cliente.'); return }
    const { error } = await supabase.from('pr_contratos').insert({ nombre: nuevo.nombre.trim(), cliente_id: nuevo.cliente_id, created_by: usuario?.id })
    if (error) { setMsg('No se pudo crear: ' + error.message); return }
    setMsg(''); setNuevo({ nombre: '', cliente_id: '' }); await cargar()
  }
  const guardarEdit = async () => {
    if (!edit || !edit.nombre.trim() || !edit.cliente_id) return
    if (err((await supabase.from('pr_contratos').update({ nombre: edit.nombre.trim(), cliente_id: edit.cliente_id }).eq('id', edit.id)).error)) return
    setEdit(null); await cargar()
  }
  const archivar = async (c: any) => { if (!err((await supabase.from('pr_contratos').update({ activo: !c.activo }).eq('id', c.id)).error)) await cargar() }

  // Documentos
  const crearDocs = async (c: any, cat: string) => {
    const lista = (nombres[c.id + cat] || '').split('\n').map(x => x.trim()).filter(Boolean)
    if (lista.length === 0) return
    if (err((await supabase.from('pr_contrato_documentos').insert(lista.map(nombre => ({ contrato_id: c.id, categoria: cat, nombre, created_by: usuario?.id })))).error)) return
    setNombres({ ...nombres, [c.id + cat]: '' }); await cargar()
  }
  const subirArchivo = async (c: any, d: any, f: File) => {
    setOcupado(d.id)
    const path = `contratos/${c.id}/${d.id}_r${d.rev}_${Date.now()}_${f.name.replace(/[^\w.\-]+/g, '_')}`
    const up = await supabase.storage.from('hsec-documentos').upload(path, f, { contentType: f.type || undefined })
    if (up.error) { setOcupado(''); alert('No se pudo subir: ' + up.error.message); return }
    err((await supabase.from('pr_contrato_documentos').update({ path, archivo_nombre: f.name }).eq('id', d.id)).error)
    setOcupado(''); await cargar()
  }
  const crearDesdeArchivos = async (c: any, cat: string, files: FileList | null) => {
    if (!files || files.length === 0) return
    setOcupado(c.id + cat)
    for (const f of Array.from(files)) {
      const id = crypto.randomUUID()
      const path = `contratos/${c.id}/${id}_r1_${Date.now()}_${f.name.replace(/[^\w.\-]+/g, '_')}`
      const up = await supabase.storage.from('hsec-documentos').upload(path, f, { contentType: f.type || undefined })
      if (up.error) { alert('No se pudo subir ' + f.name + ': ' + up.error.message); continue }
      err((await supabase.from('pr_contrato_documentos').insert({ id, contrato_id: c.id, categoria: cat, nombre: f.name.replace(/\.[^.]+$/, ''), path, archivo_nombre: f.name, created_by: usuario?.id })).error)
    }
    setOcupado(''); await cargar()
  }
  const cambiar = async (ids: string[], estado: string, comentario?: string | null) => {
    if (ids.length === 0) return
    const campos: any = { estado }
    if (comentario !== undefined) campos.comentario = comentario
    if (err((await supabase.from('pr_contrato_documentos').update(campos).in('id', ids)).error)) return
    setSel(new Set()); await cargar()
  }
  const observar = (d: any) => { const c = prompt('Observación del mandante (qué debe corregirse):'); if (c && c.trim()) cambiar([d.id], 'Observado', c.trim()) }
  const renombrarDoc = async () => { if (!renombrar || !renombrar.nombre.trim()) return; if (!err((await supabase.from('pr_contrato_documentos').update({ nombre: renombrar.nombre.trim() }).eq('id', renombrar.id)).error)) { setRenombrar(null); await cargar() } }
  const quitar = async (d: any) => {
    if (!confirm(`¿Eliminar «${d.nombre}»? Se pierde también su historial.`)) return
    if (!err((await supabase.from('pr_contrato_documentos').delete().eq('id', d.id)).error)) await cargar()
  }
  const verHistorial = async (id: string) => {
    if (verHist === id) { setVerHist(null); return }
    const { data } = await supabase.from('pr_contrato_doc_hist').select('*').eq('documento_id', id).order('at', { ascending: false })
    setHist(h => ({ ...h, [id]: data || [] })); setVerHist(id)
  }
  const alternar = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const cab = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', background: '#fff', borderRadius: '16px', padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
      <Link href="/hsec/jefatura" style={{ fontSize: '13px', color: AZUL, textDecoration: 'none' }}>← Panel de Jefatura</Link>
      <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Contratos y documentos</h1>
    </div>
  )
  if (cargandoUsuario) return <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif' }}><p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p></div></main>
  return (
    <main style={fondoPagina}>
      <div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '900px', margin: '0 auto' }}>
        {cab}
        {!puede ? <p style={{ fontSize: '13px', color: '#999' }}>No tienes acceso a esta sección.</p> : cargando ? <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p> : (
          <>
            <div style={{ ...card, marginBottom: '12px' }}>
              <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '14px' }}>Nuevo contrato</p>
              <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#667085' }}>Al crearlo, dentro del contrato agregas sus documentos (PTS, matrices, planes de emergencia y otros) y les vas cambiando el estatus según avance la aprobación del cliente. Solo la jefatura puede hacerlo.</p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 220px' }}><label style={label}>Contrato</label><input value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Ej: Contrato 4500012345" style={input} /></div>
                <div style={{ flex: '1 1 180px' }}><label style={label}>Cliente</label><select value={nuevo.cliente_id} onChange={e => setNuevo({ ...nuevo, cliente_id: e.target.value })} style={input}><option value="">— elegir —</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
                <button onClick={crear} style={btn()}>Crear contrato</button>
              </div>
              {msg && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '8px 0 0' }}>{msg}</p>}
            </div>

            {contratos.length === 0 && <p style={{ fontSize: '13px', color: '#999' }}>Aún no hay contratos.</p>}
            <div style={{ display: 'grid', gap: '10px' }}>
              {contratos.map(c => {
                const mios = docs.filter(d => d.contrato_id === c.id)
                const open = abierto === c.id
                const cli = clientes.find(x => x.id === c.cliente_id)?.nombre
                return (
                  <div key={c.id} style={{ ...card, opacity: c.activo ? 1 : 0.6 }}>
                    {edit && edit.id === c.id ? (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div style={{ flex: '1 1 180px' }}><label style={label}>Contrato</label><input value={edit.nombre} onChange={e => { const v = e.target.value; setEdit(x => x && { ...x, nombre: v }) }} style={input} /></div>
                        <div style={{ flex: '1 1 160px' }}><label style={label}>Cliente</label><select value={edit.cliente_id} onChange={e => { const v = e.target.value; setEdit(x => x && { ...x, cliente_id: v }) }} style={input}>{clientes.map(cl => <option key={cl.id} value={cl.id}>{cl.nombre}</option>)}</select></div>
                        <button onClick={guardarEdit} style={btn()}>Guardar</button><button onClick={() => setEdit(null)} style={btn(false)}>Cancelar</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div onClick={() => setAbierto(open ? null : c.id)} style={{ cursor: 'pointer', flex: '1 1 260px' }}>
                          <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '14.5px', color: '#16213E' }}>{c.nombre}{!c.activo && <span style={{ fontWeight: 400, fontSize: '11px', color: '#98a2b3' }}> · archivado</span>} <span style={{ fontWeight: 400, fontSize: '12px', color: '#667085' }}>· {cli || 'Sin cliente'} {open ? '▲' : '▼'}</span></p>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {mios.length === 0 ? <span style={{ fontSize: '11.5px', color: '#98a2b3' }}>Sin documentos</span> : ESTADOS_DOC.map(e => { const n = mios.filter(d => d.estado === e).length; return n > 0 ? <Chip key={e} e={e} n={n} /> : null })}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => setEdit({ id: c.id, nombre: c.nombre, cliente_id: c.cliente_id || '' })} style={{ ...btn(false), padding: '5px 10px', fontSize: '12px' }}>✏️ Editar</button>
                          <button onClick={() => archivar(c)} style={{ ...btn(false), padding: '5px 10px', fontSize: '12px' }}>{c.activo ? 'Archivar' : 'Reactivar'}</button>
                        </div>
                      </div>
                    )}
                    {open && CATEGORIAS.map(([cat, titulo]) => {
                      const l = mios.filter(d => d.categoria === cat)
                      const marcados = l.filter(d => sel.has(d.id))
                      return (
                        <div key={cat} style={{ marginTop: '12px', borderTop: '1px solid #eef1f6', paddingTop: '10px' }}>
                          <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '13.5px', color: '#16213E' }}>{titulo} <span style={{ fontWeight: 400, color: '#98a2b3', fontSize: '12px' }}>· {l.length}{cat === 'PTS' ? ` · ${l.filter(d => d.estado === 'Aprobado').length} aprobados` : ''}</span></p>
                          {l.length === 0 && <p style={{ margin: '0 0 6px', fontSize: '12.5px', color: '#98a2b3' }}>Sin documentos.</p>}
                          {l.map(d => (
                            <div key={d.id} style={{ padding: '7px 0', borderTop: '1px solid #f3f5f9' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <input type="checkbox" checked={sel.has(d.id)} onChange={() => alternar(d.id)} />
                                {renombrar && renombrar.id === d.id ? (
                                  <><input value={renombrar.nombre} onChange={e => { const v = e.target.value; setRenombrar(x => x && { ...x, nombre: v }) }} onKeyDown={e => { if (e.key === 'Enter') renombrarDoc() }} style={{ ...input, flex: '1 1 200px', width: 'auto' }} autoFocus /><button onClick={renombrarDoc} style={{ ...btn(), padding: '4px 10px', fontSize: '12px' }}>OK</button><button onClick={() => setRenombrar(null)} style={{ ...btn(false), padding: '4px 10px', fontSize: '12px' }}>×</button></>
                                ) : (
                                  <span style={{ fontSize: '13px', flex: '1 1 200px', fontWeight: 600 }}>{d.nombre} <span style={{ fontWeight: 400, color: '#98a2b3', fontSize: '11px' }}>Rev. {d.rev}</span> <button onClick={() => setRenombrar({ id: d.id, nombre: d.nombre })} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px' }}>✏️</button></span>
                                )}
                                <Chip e={d.estado} />
                                {d.estado === 'Enviado a aprobación' && <span style={{ fontSize: '11px', color: diasDesde(d.fecha_envio) > 7 ? '#9b1c1c' : '#667085' }}>hace {diasDesde(d.fecha_envio)} día(s)</span>}
                              </div>
                              {d.comentario && (d.estado === 'Observado') && <p style={{ margin: '3px 0 0 24px', fontSize: '12px', color: '#9b1c1c' }}>Observación: {d.comentario}</p>}
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '6px 0 0 24px' }}>
                                {(d.estado === 'En creación' || d.estado === 'Observado' || d.estado === 'En modificación') && <button onClick={() => cambiar([d.id], 'Enviado a aprobación')} style={{ ...btn(), padding: '4px 10px', fontSize: '12px' }}>{d.estado === 'En creación' ? 'Enviar a aprobación' : 'Reenviar a aprobación'}</button>}
                                {d.estado === 'Enviado a aprobación' && <><button onClick={() => cambiar([d.id], 'Aprobado')} style={{ ...btn(), padding: '4px 10px', fontSize: '12px' }}>✓ Aprobado por el cliente</button><button onClick={() => observar(d)} style={{ ...btn(false, true), padding: '4px 10px', fontSize: '12px' }}>Observado</button></>}
                                {d.estado === 'Aprobado' && <button onClick={() => { if (confirm('Se abrirá una nueva revisión y el documento dejará de estar disponible para los APR hasta que se apruebe de nuevo. ¿Continuar?')) cambiar([d.id], 'En modificación', null) }} style={{ ...btn(false), padding: '4px 10px', fontSize: '12px' }}>Abrir para modificar</button>}
                                <label style={{ ...btn(false), padding: '4px 10px', fontSize: '12px', opacity: ocupado === d.id ? 0.5 : 1 }}>{ocupado === d.id ? 'Subiendo...' : d.path ? '⬆ Reemplazar archivo' : '⬆ Subir archivo'}
                                  <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) subirArchivo(c, d, f); e.target.value = '' }} />
                                </label>
                                {d.path && <button onClick={() => abrir(d.path)} style={{ ...btn(false), padding: '4px 10px', fontSize: '12px' }}>Abrir</button>}
                                <button onClick={() => verHistorial(d.id)} style={{ ...btn(false), padding: '4px 10px', fontSize: '12px' }}>Historial</button>
                                <button onClick={() => quitar(d)} style={{ ...btn(false, true), padding: '4px 10px', fontSize: '12px' }}>Eliminar</button>
                              </div>
                              {verHist === d.id && (
                                <div style={{ margin: '6px 0 0 24px', background: '#f6f8fb', borderRadius: '8px', padding: '8px 10px', fontSize: '12px', color: '#475467' }}>
                                  {(hist[d.id] || []).map(h => <div key={h.id}>{new Date(h.at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })} · Rev. {h.rev} · <strong>{h.estado}</strong>{h.nota ? ` · ${h.nota}` : ''}</div>)}
                                </div>
                              )}
                            </div>
                          ))}
                          {marcados.length > 0 && (
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', margin: '8px 0', padding: '8px', background: '#f4f8fd', borderRadius: '8px' }}>
                              <span style={{ fontSize: '12px', color: '#344054', fontWeight: 600 }}>{marcados.length} seleccionado(s):</span>
                              <button onClick={() => cambiar(marcados.filter(d => ['En creación', 'Observado', 'En modificación'].includes(d.estado)).map(d => d.id), 'Enviado a aprobación')} style={{ ...btn(), padding: '4px 10px', fontSize: '12px' }}>Enviar a aprobación</button>
                              <button onClick={() => cambiar(marcados.filter(d => d.estado === 'Enviado a aprobación').map(d => d.id), 'Aprobado')} style={{ ...btn(false), padding: '4px 10px', fontSize: '12px' }}>Marcar aprobados</button>
                              <button onClick={() => setSel(new Set())} style={{ ...btn(false), padding: '4px 10px', fontSize: '12px' }}>Limpiar selección</button>
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end', marginTop: '8px' }}>
                            <div style={{ flex: '1 1 260px' }}>
                              <textarea rows={2} value={nombres[c.id + cat] || ''} onChange={e => setNombres({ ...nombres, [c.id + cat]: e.target.value })} placeholder={cat === 'PTS' ? 'Nombres de los PTS (uno por línea). Quedan «En creación».' : 'Nombres de los documentos (uno por línea).'} style={{ ...input, resize: 'vertical' }} />
                            </div>
                            <button onClick={() => crearDocs(c, cat)} style={btn()}>+ Crear</button>
                            <label style={{ ...btn(false), opacity: ocupado === c.id + cat ? 0.5 : 1 }}>{ocupado === c.id + cat ? 'Subiendo...' : '⬆ Crear desde archivos'}
                              <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" style={{ display: 'none' }} onChange={e => { crearDesdeArchivos(c, cat, e.target.files); e.target.value = '' }} />
                            </label>
                          </div>
                        </div>
                      )
                    })}
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
