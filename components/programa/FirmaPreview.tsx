'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { generarRegistroActividad, RegistroPDF } from '@/lib/generarRegistroActividad'
import FirmaCanvas from './FirmaCanvas'
import { card, btn } from './ui'

// Paso final de un registro: vista previa del PDF → consentimiento → firma. Al confirmar entrega la firma a usar.
export default function FirmaPreview({ registro, usuarioId, exigeDescriptor = true, onVolver, onConfirmar }: {
  registro: Omit<RegistroPDF, 'firma' | 'firmadoAt'>, usuarioId: string, exigeDescriptor?: boolean, onVolver: () => void,
  onConfirmar: (firma: string, firmaNueva: boolean) => Promise<void>,
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [firmaGuardada, setFirmaGuardada] = useState<string | null | undefined>(undefined)
  const [dibujada, setDibujada] = useState<string | null>(null)
  const [cambiar, setCambiar] = useState(false)
  const [acepta, setAcepta] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let u: string | null = null, vivo = true
    generarRegistroActividad(registro).then(b => { if (!vivo) return; u = URL.createObjectURL(b); setUrl(u) }).catch(e => setMsg('No se pudo generar la vista previa: ' + (e?.message || e)))
    return () => { vivo = false; if (u) URL.revokeObjectURL(u) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    supabase.from('firmas_usuario').select('imagen').eq('usuario_id', usuarioId).maybeSingle().then(({ data }) => setFirmaGuardada(data?.imagen || null))
  }, [usuarioId])

  const usarGuardada = !!firmaGuardada && !cambiar
  const firmaFinal = usarGuardada ? firmaGuardada! : dibujada
  const confirmar = async () => {
    if (!firmaFinal || !acepta) return
    setEnviando(true); setMsg('')
    try { await onConfirmar(firmaFinal, !usarGuardada) } catch (e: any) { setMsg(e?.message || String(e)) } finally { setEnviando(false) }
  }

  return (
    <div style={{ ...card, marginBottom: '14px' }}>
      <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '15px', color: '#16213E' }}>Revisa el documento antes de firmar</p>
      <p style={{ margin: '0 0 10px', fontSize: '12.5px', color: '#667085' }}>Esta es la vista previa del PDF. Si algo está mal, vuelve a editar. Al confirmar se firma y queda guardado.</p>
      {url ? (
        <>
          <iframe src={url} title="Vista previa" style={{ width: '100%', height: '520px', border: '1px solid #e2e6ed', borderRadius: '8px', background: '#f3f5f9' }} />
          <a href={url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', margin: '6px 0 10px', fontSize: '12.5px', color: '#1B4F9C' }}>↗ Abrir la vista previa en otra pestaña</a>
        </>
      ) : <p style={{ fontSize: '13px', color: '#999' }}>{msg || 'Generando vista previa...'}</p>}

      {firmaGuardada !== undefined && (
        <div style={{ borderTop: '1px solid #eef1f6', paddingTop: '10px' }}>
          {usarGuardada ? (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
              <img src={firmaGuardada!} alt="Tu firma" style={{ maxHeight: '56px', border: '1px solid #e2e6ed', borderRadius: '6px', background: '#fff', padding: '2px' }} />
              <span style={{ fontSize: '12px', color: '#667085' }}>Tu firma del descriptor de cargo</span>
            </div>
          ) : exigeDescriptor ? (
            <div style={{ marginBottom: '8px', background: '#fff8e5', border: '1px solid #f0d98a', borderRadius: '8px', padding: '10px 12px', fontSize: '12.5px', color: '#7a5600' }}>
              Aún no tienes firma registrada. Tu firma es la del descriptor de cargo: firma primero tu descriptor en <a href="/hsec/prevencionista/sso" style={{ color: '#1B4F9C', fontWeight: 600 }}>SSO Faena → Descriptor de cargo</a> y luego vuelve a firmar este documento.
            </div>
          ) : (
            <div style={{ marginBottom: '8px' }}>
              <p style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 600, color: '#667085' }}>Dibuja o sube tu firma:</p>
              <FirmaCanvas onChange={setDibujada} />
            </div>
          )}
          <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12.5px', background: '#f4f8fd', border: '1px solid #cfe0f5', borderRadius: '8px', padding: '9px 10px', cursor: 'pointer' }}>
            <input type="checkbox" checked={acepta} onChange={e => setAcepta(e.target.checked)} style={{ marginTop: '2px' }} />
            <span>Declaro que la información es correcta y <strong>autorizo que este documento sea firmado electrónicamente con mi firma</strong>. Quedará guardado en el sistema y la jefatura podrá verlo.</span>
          </label>
          {msg && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '8px 0 0' }}>{msg}</p>}
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            <button type="button" onClick={confirmar} disabled={!firmaFinal || !acepta || enviando} style={{ ...btn(), opacity: !firmaFinal || !acepta || enviando ? 0.5 : 1 }}>{enviando ? 'Firmando y guardando...' : '✍️ Confirmar y firmar'}</button>
            <button type="button" onClick={onVolver} disabled={enviando} style={btn(false)}>← Volver a editar</button>
          </div>
        </div>
      )}
    </div>
  )
}
