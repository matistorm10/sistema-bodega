'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { card, btn, input, label } from '@/components/programa/ui'

const abrir = async (path: string) => {
  const { data, error } = await supabase.storage.from('hsec-documentos').createSignedUrl(path, 600)
  if (error || !data) { alert('No se pudo abrir el archivo.'); return }
  window.open(data.signedUrl, '_blank')
}
const ESTADOS = ['Vigente', 'En revisión', 'Vencido']
const COL_EST: Record<string, [string, string]> = { 'Vigente': ['#e7f6ec', '#14532d'], 'En revisión': ['#fef7e0', '#986a00'], 'Vencido': ['#fde8e8', '#9b1c1c'] }

export default function JefaturaContratos() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const puede = usuario?.rol === 'admin' || !!usuario?.esJefeHsec
  const [contratos, setContratos] = useState<any[]>([])
  const [docs, setDocs] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState('')
  const [nuevo, setNuevo] = useState({ nombre: '', cliente_id: '', empresa: '' })
  const [edit, setEdit] = useState<{ id: string, nombre: string, empresa: string, cliente_id: string } | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [sub, setSub] = useState<Record<string, { categoria: string, estado: string }>>({})
  const [subiendo, setSubiendo] = useState('')

  const cargar = useCallback(async () => {
    const [c, d, cl] = await Promise.all([
      supabase.from('pr_contratos').select('*').order('nombre'),
      supabase.from('pr_contrato_docs').select('*').order('categoria').order('nombre'),
      supabase.from('pr_clientes_informe').select('id,nombre').eq('activo', true).order('nombre'),
    ])
    setContratos(c.data || []); setDocs(d.data || []); setClientes(cl.data || []); setCargando(false)
  }, [])
  useEffect(() => { if (usuario && puede) cargar() }, [usuario, puede, cargar])

  const crear = async () => {
    if (!nuevo.nombre.trim() || !nuevo.empresa.trim()) { setMsg('Escribe el nombre del contrato y la empresa mandante.'); return }
    const { error } = await supabase.from('pr_contratos').insert({ nombre: nuevo.nombre.trim(), empresa: nuevo.empresa.trim(), cliente_id: nuevo.cliente_id || null, created_by: usuario?.id })
    if (error) { setMsg('No se pudo crear: ' + error.message); return }
    setMsg(''); setNuevo({ nombre: '', cliente_id: '', empresa: '' }); await cargar()
  }
  const guardarEdit = async () => {
    if (!edit || !edit.nombre.trim() || !edit.empresa.trim()) return
    const { error } = await supabase.from('pr_contratos').update({ nombre: edit.nombre.trim(), empresa: edit.empresa.trim(), cliente_id: edit.cliente_id || null }).eq('id', edit.id)
    if (error) { alert(error.message); return }
    setEdit(null); await cargar()
  }
  const archivar = async (c: any) => {
    const { error } = await supabase.from('pr_contratos').update({ activo: !c.activo }).eq('id', c.id)
    if (error) { alert(error.message); return }
    await cargar()
  }
  const subir = async (c: any, archivos: FileList | null) => {
    if (!archivos || archivos.length === 0) return
    const s = sub[c.id] || { categoria: 'PTS', estado: 'Vigente' }
    setSubiendo(c.id)
    for (const f of Array.from(archivos)) {
      const path = `contratos/${c.id}/${Date.now()}_${f.name.replace(/[^\w.\-]+/g, '_')}`
      const up = await supabase.storage.from('hsec-documentos').upload(path, f, { contentType: f.type || undefined })
      if (up.error) { alert('No se pudo subir ' + f.name + ': ' + up.error.message); continue }
      const { error } = await supabase.from('pr_contrato_docs').insert({ contrato_id: c.id, categoria: s.categoria, nombre: f.name.replace(/\.[^.]+$/, ''), path, estado: s.estado, created_by: usuario?.id })
      if (error) alert('Se subió pero no se registró: ' + error.message)
    }
    setSubiendo(''); await cargar()
  }
  const cambiarDoc = async (id: string, campos: any) => {
    const { error } = await supabase.from('pr_contrato_docs').update(campos).eq('id', id)
    if (error) { alert(error.message); return }
    await cargar()
  }
  const quitarDoc = async (d: any) => {
    if (!confirm(`¿Quitar «${d.nombre}» del contrato? Los prevencionistas ya no lo verán.`)) return
    const { error } = await supabase.from('pr_contrato_docs').delete().eq('id', d.id)
    if (error) { alert(error.message); return }
    await cargar()
  }

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
              <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#667085' }}>El prevencionista elige el contrato en su informe diario; la empresa mandante se completa sola. Aquí cargas los PTS, matrices y demás documentos de cada contrato.</p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 200px' }}><label style={label}>Contrato</label><input value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Ej: Contrato 4500012345" style={input} /></div>
                <div style={{ flex: '1 1 160px' }}><label style={label}>Cliente</label><select value={nuevo.cliente_id} onChange={e => setNuevo({ ...nuevo, cliente_id: e.target.value })} style={input}><option value="">Sin cliente</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
                <div style={{ flex: '1 1 200px' }}><label style={label}>Empresa mandante</label><input value={nuevo.empresa} onChange={e => setNuevo({ ...nuevo, empresa: e.target.value })} placeholder="Ej: SQM Salar S.A." style={input} /></div>
                <button onClick={crear} style={btn()}>Agregar</button>
              </div>
              {msg && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '8px 0 0' }}>{msg}</p>}
            </div>

            {contratos.length === 0 && <p style={{ fontSize: '13px', color: '#999' }}>Aún no hay contratos.</p>}
            <div style={{ display: 'grid', gap: '10px' }}>
              {contratos.map(c => {
                const mios = docs.filter(d => d.contrato_id === c.id)
                const s = sub[c.id] || { categoria: 'PTS', estado: 'Vigente' }
                const open = abierto === c.id
                const cli = clientes.find(x => x.id === c.cliente_id)?.nombre
                return (
                  <div key={c.id} style={{ ...card, opacity: c.activo ? 1 : 0.6 }}>
                    {edit && edit.id === c.id ? (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div style={{ flex: '1 1 160px' }}><label style={label}>Contrato</label><input value={edit.nombre} onChange={e => { const v = e.target.value; setEdit(x => x && { ...x, nombre: v }) }} style={input} /></div>
                        <div style={{ flex: '1 1 140px' }}><label style={label}>Cliente</label><select value={edit.cliente_id} onChange={e => { const v = e.target.value; setEdit(x => x && { ...x, cliente_id: v }) }} style={input}><option value="">Sin cliente</option>{clientes.map(cl => <option key={cl.id} value={cl.id}>{cl.nombre}</option>)}</select></div>
                        <div style={{ flex: '1 1 160px' }}><label style={label}>Empresa mandante</label><input value={edit.empresa} onChange={e => { const v = e.target.value; setEdit(x => x && { ...x, empresa: v }) }} style={input} /></div>
                        <button onClick={guardarEdit} style={btn()}>Guardar</button><button onClick={() => setEdit(null)} style={btn(false)}>Cancelar</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div onClick={() => setAbierto(open ? null : c.id)} style={{ cursor: 'pointer', flex: '1 1 240px' }}>
                          <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: '14.5px', color: '#16213E' }}>{c.nombre}{!c.activo && <span style={{ fontWeight: 400, fontSize: '11px', color: '#98a2b3' }}> · archivado</span>}</p>
                          <p style={{ margin: 0, fontSize: '12px', color: '#667085' }}>{c.empresa}{cli ? ` · Cliente ${cli}` : ''} · {mios.length} documento{mios.length === 1 ? '' : 's'} {open ? '▲' : '▼'}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => setEdit({ id: c.id, nombre: c.nombre, empresa: c.empresa, cliente_id: c.cliente_id || '' })} style={{ ...btn(false), padding: '5px 10px', fontSize: '12px' }}>✏️ Editar</button>
                          <button onClick={() => archivar(c)} style={{ ...btn(false), padding: '5px 10px', fontSize: '12px' }}>{c.activo ? 'Archivar' : 'Reactivar'}</button>
                        </div>
                      </div>
                    )}
                    {open && (
                      <div style={{ marginTop: '12px', borderTop: '1px solid #eef1f6', paddingTop: '10px' }}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '10px' }}>
                          <div style={{ flex: '0 1 130px' }}><label style={label}>Tipo</label><select value={s.categoria} onChange={e => setSub({ ...sub, [c.id]: { ...s, categoria: e.target.value } })} style={input}><option value="PTS">PTS</option><option value="Matriz">Matriz</option><option value="Otro">Otro documento</option></select></div>
                          <div style={{ flex: '0 1 140px' }}><label style={label}>Estatus</label><select value={s.estado} onChange={e => setSub({ ...sub, [c.id]: { ...s, estado: e.target.value } })} style={input}>{ESTADOS.map(x => <option key={x}>{x}</option>)}</select></div>
                          <label style={{ ...btn(), display: 'inline-block', opacity: subiendo === c.id ? 0.5 : 1 }}>{subiendo === c.id ? 'Subiendo...' : '⬆ Subir documentos'}
                            <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" disabled={subiendo === c.id} onChange={e => { subir(c, e.target.files); e.target.value = '' }} style={{ display: 'none' }} />
                          </label>
                        </div>
                        {mios.length === 0 && <p style={{ fontSize: '12.5px', color: '#98a2b3', margin: 0 }}>Sin documentos todavía. Puedes subir varios a la vez (PDF recomendado).</p>}
                        {mios.map(d => (
                          <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '7px 0', borderBottom: '1px solid #f3f5f9', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '13px', flex: '1 1 220px' }}><strong style={{ color: AZUL, fontSize: '11px', marginRight: '6px' }}>{d.categoria}</strong>{d.nombre}</span>
                            <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <select value={d.estado} onChange={e => cambiarDoc(d.id, { estado: e.target.value })} style={{ ...input, width: 'auto', padding: '4px 8px', fontSize: '12px', background: COL_EST[d.estado][0], color: COL_EST[d.estado][1], fontWeight: 600 }}>{ESTADOS.map(x => <option key={x}>{x}</option>)}</select>
                              <button onClick={() => abrir(d.path)} style={{ ...btn(false), padding: '4px 10px', fontSize: '12px' }}>Abrir</button>
                              <button onClick={() => quitarDoc(d)} style={{ ...btn(false, true), padding: '4px 10px', fontSize: '12px' }}>Quitar</button>
                            </span>
                          </div>
                        ))}
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
