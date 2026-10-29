'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import FirmaCanvas from '@/components/programa/FirmaCanvas'
import { ITEMS_SSO, DOC_DESCRIPTOR } from '@/lib/prevencion'

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e6ed', borderRadius: '14px', padding: '14px 16px' }
const btn = (primario = true): React.CSSProperties => ({
  padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  border: primario ? 'none' : '1px solid #d0d5dd', background: primario ? AZUL : '#fff', color: primario ? '#fff' : '#344054',
})
const fechaHoraCL = (f?: string | null) => f ? new Date(f).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : ''

export default function SsoFaena() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  const puede = esAdmin || !!usuario?.esJefeHsec || !!usuario?.esPrevencionista

  const [desc, setDesc] = useState<any | null>(null)
  const [doc, setDoc] = useState<any | null>(null)
  const [faena, setFaena] = useState('')
  const [cargando, setCargando] = useState(true)
  const [acepto, setAcepto] = useState(false)
  const [firma, setFirma] = useState<string | null>(null)
  const [firmaGuardada, setFirmaGuardada] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')
  const [canvasKey, setCanvasKey] = useState(0)

  const cargar = useCallback(async () => {
    if (!usuario) return
    const [d, dc, fg] = await Promise.all([
      supabase.from('pr_descriptores').select('*').eq('usuario_id', usuario.id).maybeSingle(),
      supabase.from('pr_documentos').select('*').eq('clave', DOC_DESCRIPTOR).maybeSingle(),
      supabase.from('firmas_usuario').select('imagen').eq('usuario_id', usuario.id).maybeSingle(),
    ])
    setDesc(d.data || null); setDoc(dc.data || null); setFirmaGuardada(fg.data?.imagen || null)
    if (d.data?.ubicacion_id) {
      const f = await supabase.from('ubicaciones').select('nombre').eq('id', d.data.ubicacion_id).maybeSingle()
      setFaena(f.data?.nombre || '')
    }
    setCargando(false)
  }, [usuario])
  useEffect(() => { if (usuario && puede) cargar() }, [usuario, puede, cargar])

  const verDocumento = async () => {
    if (!doc?.path) return
    const { data, error } = await supabase.storage.from('hsec-documentos').createSignedUrl(doc.path, 600)
    if (error || !data) { alert('No se pudo abrir el documento.'); return }
    window.open(data.signedUrl, '_blank')
  }
  const firmar = async () => {
    if (!desc || !firma) return
    setGuardando(true); setMsg('')
    const { error } = await supabase.from('pr_descriptores').update({ firma, estado: 'firmado' }).eq('id', desc.id)
    setGuardando(false)
    if (error) { setMsg('No se pudo guardar la firma: ' + error.message); return }
    setFirma(null); setAcepto(false); await cargar()
  }

  const verificado = desc?.estado === 'verificado'
  const estadoTxt = !desc ? 'Sin asignar' : desc.estado === 'pendiente' ? 'Pendiente de firma' : desc.estado === 'firmado' ? 'Firmado · esperando verificación de la jefatura' : 'Verificado'
  const estadoCol = !desc ? ['#f1f3f7', '#555'] : desc.estado === 'pendiente' ? ['#fde8e8', '#9b1c1c'] : desc.estado === 'firmado' ? ['#fef7e0', '#986a00'] : ['#d7efe0', '#14532d']

  if (cargandoUsuario) return <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif' }}><p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p></div></main>

  return (
    <main style={fondoPagina}>
      <div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '820px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', background: '#fff', borderRadius: '16px', padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
          <Link href="/hsec/prevencionista" style={{ fontSize: '13px', color: AZUL, textDecoration: 'none' }}>← Espacio del Prevencionista</Link>
          <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>SSO Faena</h1>
        </div>

        {!puede ? <p style={{ fontSize: '13px', color: '#999' }}>No tienes acceso a esta sección.</p> : cargando ? <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p> : (
          <>
            {/* Ítem 1 */}
            <div style={{ ...card, marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: '#16213E' }}>1. Descriptor de cargo</p>
                <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: estadoCol[0], color: estadoCol[1], fontWeight: 600 }}>{estadoTxt}</span>
              </div>

              {!desc ? (
                <p style={{ fontSize: '13px', color: '#667085', margin: '10px 0 0' }}>Aún no tienes un descriptor asignado. La jefatura debe asignarte a una faena para que puedas firmarlo.</p>
              ) : (
                <>
                  <p style={{ fontSize: '12.5px', color: '#667085', margin: '8px 0 10px' }}>
                    Faena asignada: <strong style={{ color: '#344054' }}>{faena || '—'}</strong>
                    {doc?.codigo ? <> · Documento {doc.codigo}{doc.revision ? ` Rev. ${doc.revision}` : ''}{doc.fecha_doc ? ` (${doc.fecha_doc})` : ''}</> : null}
                  </p>
                  {doc?.path ? (
                    <button onClick={verDocumento} style={btn(false)}>📄 Abrir descriptor de cargo (PDF)</button>
                  ) : (
                    <p style={{ fontSize: '12.5px', color: '#986a00', margin: 0 }}>La jefatura aún no ha cargado el documento del descriptor.</p>
                  )}

                  {desc.estado === 'pendiente' && doc?.path && (
                    <div style={{ marginTop: '14px', borderTop: '1px solid #eef1f6', paddingTop: '12px' }}>
                      <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13px', marginBottom: '10px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={acepto} onChange={e => setAcepto(e.target.checked)} style={{ marginTop: '2px' }} />
                        <span>Leí mi descriptor de cargo y asumo las responsabilidades que ahí se indican.</span>
                      </label>
                      {acepto && (
                        <>
                          <p style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 600, color: '#667085' }}>Firma aquí con el dedo o el mouse</p>
                          <FirmaCanvas key={canvasKey} onChange={setFirma} />
                          {firmaGuardada && (
                            <button type="button" onClick={() => { setFirma(firmaGuardada); setMsg('') }} style={{ ...btn(false), marginTop: '8px', fontSize: '12px', padding: '6px 12px' }}>Usar mi firma guardada</button>
                          )}
                          {firma && firmaGuardada === firma && (
                            <div style={{ marginTop: '8px' }}>
                              <img src={firma} alt="Firma" style={{ maxHeight: '70px', border: '1px solid #e2e6ed', borderRadius: '6px', background: '#fff' }} />
                              <button type="button" onClick={() => { setFirma(null); setCanvasKey(k => k + 1) }} style={{ ...btn(false), marginLeft: '8px', fontSize: '12px', padding: '6px 12px' }}>Quitar</button>
                            </div>
                          )}
                          {msg && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '8px 0 0' }}>{msg}</p>}
                          <div style={{ marginTop: '12px' }}>
                            <button onClick={firmar} disabled={!firma || guardando} style={{ ...btn(), opacity: !firma || guardando ? 0.5 : 1 }}>{guardando ? 'Guardando...' : 'Firmar descriptor'}</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {desc.estado !== 'pendiente' && (
                    <div style={{ marginTop: '12px', borderTop: '1px solid #eef1f6', paddingTop: '10px' }}>
                      {desc.firma && <img src={desc.firma} alt="Tu firma" style={{ maxHeight: '80px', border: '1px solid #e2e6ed', borderRadius: '6px', background: '#fff' }} />}
                      <p style={{ fontSize: '12px', color: '#667085', margin: '6px 0 0' }}>
                        Firmado el {fechaHoraCL(desc.firmado_at)}
                        {verificado ? ` · verificado por la jefatura el ${fechaHoraCL(desc.verificado_at)}` : ' · la jefatura debe verificar tu firma'}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Resto de los ítems */}
            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '13px', color: '#667085' }}>
              {verificado ? 'Ítems habilitados (en construcción)' : '🔒 Se habilitan cuando la jefatura verifica tu descriptor firmado'}
            </p>
            <div style={{ display: 'grid', gap: '8px' }}>
              {ITEMS_SSO.filter(i => i.n !== '1').map(i => (
                <div key={i.n} style={{ ...card, opacity: verificado ? 1 : 0.55, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                  <div>
                    <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: '13.5px', color: '#16213E' }}>{i.n}. {i.titulo}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#667085' }}>{i.detalle}</p>
                  </div>
                  {(i.n === '2' || i.n === '3' || i.n === '4' || i.n === '5' || i.n === '6') && verificado
                    ? <Link href={i.n === '2' ? '/hsec/programa' : i.n === '3' ? '/hsec/prevencionista/informe-diario' : i.n === '4' ? '/hsec/prevencionista/semanales' : i.n === '5' ? '/hsec/prevencionista/capacitaciones' : '/hsec/prevencionista/epp'} style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px', background: AZUL, color: '#fff', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>Abrir</Link>
                    : <span style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '20px', background: '#fef7e0', color: '#986a00', whiteSpace: 'nowrap' }}>{verificado ? 'Próximamente' : 'Bloqueado'}</span>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
