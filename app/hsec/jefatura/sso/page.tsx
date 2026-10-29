'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { DOC_DESCRIPTOR } from '@/lib/prevencion'

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e6ed', borderRadius: '14px', padding: '14px 16px' }
const input: React.CSSProperties = { width: '100%', padding: '9px 10px', border: '1px solid #d0d5dd', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', background: '#fff' }
const label: React.CSSProperties = { fontSize: '11px', color: '#667085', display: 'block', marginBottom: '3px', fontWeight: 600 }
const btn = (primario = true, peligro = false): React.CSSProperties => ({
  padding: '8px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
  border: primario ? 'none' : `1px solid ${peligro ? '#e5b4b4' : '#d0d5dd'}`,
  background: primario ? AZUL : '#fff', color: primario ? '#fff' : (peligro ? '#9b1c1c' : '#344054'),
})
const fechaHoraCL = (f?: string | null) => f ? new Date(f).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : ''
const ESTADOS: Record<string, [string, string, string]> = {
  pendiente: ['Pendiente de firma', '#fde8e8', '#9b1c1c'],
  firmado: ['Firmado · por verificar', '#fef7e0', '#986a00'],
  verificado: ['Verificado', '#d7efe0', '#14532d'],
}

export default function JefaturaSso() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  const puede = esAdmin || !!usuario?.esJefeHsec

  const [doc, setDoc] = useState<any | null>(null)
  const [descs, setDescs] = useState<any[]>([])
  const [prevs, setPrevs] = useState<any[]>([])
  const [faenas, setFaenas] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState('')

  const [codigo, setCodigo] = useState('')
  const [revision, setRevision] = useState('')
  const [fechaDoc, setFechaDoc] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [subiendo, setSubiendo] = useState(false)

  const [aUsuario, setAUsuario] = useState('')
  const [aFaena, setAFaena] = useState('')

  const cargar = useCallback(async () => {
    const [d, ds, pv, f] = await Promise.all([
      supabase.from('pr_documentos').select('*').eq('clave', DOC_DESCRIPTOR).maybeSingle(),
      supabase.from('pr_descriptores').select('*').order('created_at'),
      supabase.from('usuarios').select('id,nombre').eq('es_prevencionista', true).order('nombre'),
      supabase.from('ubicaciones').select('id,nombre,activa').eq('tipo', 'faena').order('nombre'),
    ])
    setDoc(d.data || null); setDescs(ds.data || []); setPrevs(pv.data || [])
    setFaenas((f.data || []).filter((x: any) => x.activa !== false))
    if (d.data) { setCodigo(d.data.codigo || ''); setRevision(d.data.revision || ''); setFechaDoc(d.data.fecha_doc || '') }
    setCargando(false)
  }, [])
  useEffect(() => { if (usuario && puede) cargar() }, [usuario, puede, cargar])

  const nombreUsuario = (id: string) => prevs.find(u => u.id === id)?.nombre || '—'
  const nombreFaena = (id?: string | null) => faenas.find(f => f.id === id)?.nombre || '—'

  const subirDocumento = async () => {
    if (!usuario) return
    if (!archivo && !doc?.path) { setMsg('Selecciona el PDF del descriptor.'); return }
    setSubiendo(true); setMsg('')
    let path = doc?.path || null
    if (archivo) {
      path = `${DOC_DESCRIPTOR}/${Date.now()}.pdf`
      const { error } = await supabase.storage.from('hsec-documentos').upload(path, archivo, { contentType: 'application/pdf' })
      if (error) { setSubiendo(false); setMsg('No se pudo subir el archivo: ' + error.message); return }
    }
    const { error } = await supabase.from('pr_documentos').upsert({
      clave: DOC_DESCRIPTOR, nombre: 'Descriptor de cargo · Asesor(a) en Prevención de Riesgos', codigo: codigo.trim() || null,
      revision: revision.trim() || null, fecha_doc: fechaDoc.trim() || null, path, subido_por: usuario.id, updated_at: new Date().toISOString(),
    })
    setSubiendo(false)
    if (error) { setMsg('No se pudo guardar: ' + error.message); return }
    setArchivo(null); setMsg('Documento guardado.'); await cargar()
  }
  const verDocumento = async () => {
    if (!doc?.path) return
    const { data, error } = await supabase.storage.from('hsec-documentos').createSignedUrl(doc.path, 600)
    if (error || !data) { alert('No se pudo abrir el documento.'); return }
    window.open(data.signedUrl, '_blank')
  }
  const asignar = async () => {
    if (!usuario || !aUsuario || !aFaena) { setMsg('Elige el prevencionista y la faena.'); return }
    const { error } = await supabase.from('pr_descriptores').insert({ usuario_id: aUsuario, ubicacion_id: aFaena, revision: doc?.revision || null, asignado_por: usuario.id })
    if (error) { setMsg(error.code === '23505' ? 'Esa persona ya tiene un descriptor asignado.' : 'No se pudo asignar: ' + error.message); return }
    setAUsuario(''); setAFaena(''); setMsg(''); await cargar()
  }
  const cambiarEstado = async (d: any, estado: 'pendiente' | 'verificado') => {
    if (estado === 'pendiente' && !confirm(`¿Devolver el descriptor de ${nombreUsuario(d.usuario_id)}? Su firma se borra y tendrá que firmar de nuevo.`)) return
    const { error } = await supabase.from('pr_descriptores').update({ estado }).eq('id', d.id)
    if (error) { alert(error.message); return }
    await cargar()
  }
  const quitar = async (d: any) => {
    if (!confirm(`¿Quitar la asignación de ${nombreUsuario(d.usuario_id)}?`)) return
    const { error } = await supabase.from('pr_descriptores').delete().eq('id', d.id)
    if (error) { alert(error.message); return }
    await cargar()
  }

  const sinAsignar = prevs.filter(p => !descs.some(d => d.usuario_id === p.id))

  if (cargandoUsuario) return <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif' }}><p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p></div></main>

  return (
    <main style={fondoPagina}>
      <div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', background: '#fff', borderRadius: '16px', padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
          <Link href="/hsec/jefatura" style={{ fontSize: '13px', color: AZUL, textDecoration: 'none' }}>← Panel de Jefatura</Link>
          <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>SSO Faena · Descriptores de cargo</h1>
        </div>

        {!puede ? <p style={{ fontSize: '13px', color: '#999' }}>No tienes acceso a esta sección.</p> : cargando ? <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p> : (
          <>
            <div style={{ ...card, marginBottom: '12px' }}>
              <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '14px' }}>1. Documento del descriptor</p>
              <p style={{ margin: '0 0 10px', fontSize: '12.5px', color: '#667085' }}>
                {doc?.path ? <>Documento cargado{doc.codigo ? ` (${doc.codigo}${doc.revision ? ` Rev. ${doc.revision}` : ''})` : ''}. <button onClick={verDocumento} style={{ border: 'none', background: 'none', color: AZUL, cursor: 'pointer', padding: 0, fontSize: '12.5px', textDecoration: 'underline' }}>Abrir PDF</button></> : 'Aún no has cargado el PDF del descriptor de cargo.'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '10px', marginBottom: '10px' }}>
                <div><label style={label}>Código</label><input value={codigo} onChange={e => setCodigo(e.target.value)} style={input} placeholder="DC-APR" /></div>
                <div><label style={label}>Revisión</label><input value={revision} onChange={e => setRevision(e.target.value)} style={input} placeholder="01" /></div>
                <div><label style={label}>Fecha del documento</label><input value={fechaDoc} onChange={e => setFechaDoc(e.target.value)} style={input} placeholder="15-09-2026" /></div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="file" accept="application/pdf" onChange={e => setArchivo(e.target.files?.[0] || null)} style={{ fontSize: '12.5px' }} />
                <button onClick={subirDocumento} disabled={subiendo} style={btn()}>{subiendo ? 'Guardando...' : doc?.path ? 'Reemplazar / actualizar' : 'Subir documento'}</button>
              </div>
            </div>

            <div style={{ ...card, marginBottom: '12px' }}>
              <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '14px' }}>2. Asignar prevencionista a una faena</p>
              {prevs.length === 0 ? (
                <p style={{ margin: 0, fontSize: '12.5px', color: '#986a00' }}>Todavía no hay usuarios con la facultad «Prevencionista». Márcala en Usuarios.</p>
              ) : (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <select value={aUsuario} onChange={e => setAUsuario(e.target.value)} style={{ ...input, flex: '1 1 200px', width: 'auto' }}>
                    <option value="">Prevencionista…</option>{sinAsignar.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  <select value={aFaena} onChange={e => setAFaena(e.target.value)} style={{ ...input, flex: '1 1 200px', width: 'auto' }}>
                    <option value="">Faena…</option>{faenas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                  </select>
                  <button onClick={asignar} style={btn()}>Asignar</button>
                </div>
              )}
              {msg && <p style={{ fontSize: '12.5px', color: msg === 'Documento guardado.' ? '#137333' : '#c5221f', margin: '8px 0 0' }}>{msg}</p>}
            </div>

            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '14px', color: '#16213E' }}>3. Firmas y verificación</p>
            {descs.length === 0 ? <p style={{ fontSize: '13px', color: '#999' }}>Aún no hay prevencionistas asignados.</p> : (
              <div style={{ display: 'grid', gap: '8px' }}>
                {descs.map(d => {
                  const [txt, bg, col] = ESTADOS[d.estado] || ESTADOS.pendiente
                  return (
                    <div key={d.id} style={card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div>
                          <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: '14px', color: '#16213E' }}>{nombreUsuario(d.usuario_id)}</p>
                          <p style={{ margin: 0, fontSize: '12px', color: '#667085' }}>Faena: {nombreFaena(d.ubicacion_id)}{d.revision ? ` · Rev. ${d.revision}` : ''}</p>
                        </div>
                        <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: bg, color: col, fontWeight: 600 }}>{txt}</span>
                      </div>
                      {d.firma && (
                        <div style={{ marginTop: '10px' }}>
                          <img src={d.firma} alt="Firma" style={{ maxHeight: '80px', border: '1px solid #e2e6ed', borderRadius: '6px', background: '#fff' }} />
                          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#667085' }}>Firmado el {fechaHoraCL(d.firmado_at)}{d.verificado_at ? ` · verificado el ${fechaHoraCL(d.verificado_at)}` : ''}</p>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                        {d.estado === 'firmado' && <button onClick={() => cambiarEstado(d, 'verificado')} style={btn()}>✓ Verificar firma</button>}
                        {d.estado !== 'pendiente' && <button onClick={() => cambiarEstado(d, 'pendiente')} style={btn(false)}>Devolver para nueva firma</button>}
                        <button onClick={() => quitar(d)} style={btn(false, true)}>Quitar asignación</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
