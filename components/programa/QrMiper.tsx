'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { btn } from '@/components/programa/ui'

// QR público de la MIPER de un contrato: cualquier persona con el QR ve la MIPER aprobada, sin usuario
export default function QrMiper({ contrato, cliente, onCerrar, onCambio }: { contrato: any, cliente: string, onCerrar: () => void, onCambio: () => void }) {
  const [token, setToken] = useState<string>(contrato.miper_token || '')
  const [img, setImg] = useState(''); const [msg, setMsg] = useState('')
  const url = typeof window !== 'undefined' && token ? `${window.location.origin}/miper/${token}` : ''
  useEffect(() => { if (!url) return; import('qrcode').then(Q => Q.toDataURL(url, { width: 640, margin: 1, errorCorrectionLevel: 'M' })).then(setImg) }, [url])
  const regenerar = async () => {
    if (!confirm('Se creará un QR nuevo y el anterior dejará de funcionar. Tendrás que reimprimir el afiche. ¿Continuar?')) return
    const nuevo = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '')
    const { error } = await supabase.from('pr_contratos').update({ miper_token: nuevo }).eq('id', contrato.id)
    if (error) { setMsg('No se pudo regenerar: ' + error.message); return }
    setToken(nuevo); setMsg('QR regenerado ✓'); onCambio()
  }
  const copiar = async () => { try { await navigator.clipboard.writeText(url); setMsg('Enlace copiado ✓') } catch { setMsg('No se pudo copiar.') } }
  const afiche = async () => {
    const { jsPDF } = await import('jspdf')
    const { cargarLogo } = await import('@/lib/generarGuiaTraslado')
    const logo = await cargarLogo()
    const d = new jsPDF({ unit: 'mm', format: 'a4' }); const W = 210
    if (logo) { const w = 55, h = Math.min(22, w * logo.ratio); d.addImage(logo.data, 'JPEG', 15, 12, w, h) }
    d.setFont('helvetica', 'bold'); d.setFontSize(30); d.text('MIPER', W / 2, 52, { align: 'center' })
    d.setFontSize(14); d.text('Matriz de Identificación de Peligros y Evaluación de Riesgos', W / 2, 60, { align: 'center' })
    d.addImage(img, 'PNG', 50, 68, 110, 110)
    d.setFontSize(20); d.text('Escanea para ver la MIPER vigente', W / 2, 190, { align: 'center' })
    d.setFont('helvetica', 'normal'); d.setFontSize(13)
    const linea = d.splitTextToSize([cliente, contrato.referencia, contrato.nombre && 'N° ' + contrato.nombre].filter(Boolean).join(' · '), 170)
    d.text(linea, W / 2, 202, { align: 'center' })
    d.setFontSize(10); d.setTextColor(110); d.text('No necesitas usuario ni clave. Siempre muestra la última revisión aprobada.', W / 2, 232, { align: 'center' })
    d.save(`QR_MIPER_${contrato.nombre}.pdf`)
  }
  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '14px', padding: '18px', width: '100%', maxWidth: '380px', textAlign: 'center', maxHeight: '92vh', overflowY: 'auto' }}>
        <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: '15px' }}>QR de la MIPER</p>
        <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#667085' }}>{[cliente, contrato.referencia, contrato.nombre].filter(Boolean).join(' · ')}</p>
        {img ? <img src={img} alt="QR MIPER" style={{ width: '230px', height: '230px' }} /> : <p style={{ color: '#98a2b3', fontSize: '13px' }}>Generando…</p>}
        <p style={{ margin: '8px 0', fontSize: '11px', color: '#667085', wordBreak: 'break-all' }}>{url}</p>
        <p style={{ margin: '0 0 10px', fontSize: '11.5px', color: '#475467' }}>Cualquiera que escanee el QR ve las matrices <strong>aprobadas</strong> de este contrato, sin usuario ni clave. Al aprobar una revisión nueva, el mismo QR la muestra.</p>
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={afiche} disabled={!img} style={btn()}>⬇ Afiche PDF</button>
          <button onClick={copiar} style={btn(false)}>Copiar enlace</button>
          <button onClick={regenerar} style={btn(false, true)}>Regenerar QR</button>
        </div>
        {msg && <p style={{ fontSize: '12px', color: '#475467', margin: '8px 0 0' }}>{msg}</p>}
        <button onClick={onCerrar} style={{ ...btn(false), marginTop: '10px' }}>Cerrar</button>
      </div>
    </div>
  )
}
