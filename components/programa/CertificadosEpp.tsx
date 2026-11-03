'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL } from '@/lib/theme'
import { card, btn, input, label } from './ui'
import { vigencia } from '@/lib/auditoriaMandante'

const fcl = (f?: string | null) => f ? f.split('-').reverse().join('-') : ''
const VIG: Record<string, [string, string, string]> = { vigente: ['#e7f6ec', '#14532d', 'Vigente'], por_vencer: ['#fef7e0', '#986a00', 'Por vencer'], vencido: ['#fde8e8', '#9b1c1c', 'Vencido'], sin_fecha: ['#f1f3f7', '#667085', 'Sin vencimiento'] }

// Certificados de calidad de cada EPP: pueden ser varios por ítem (uno por proveedor) y cada uno con su vencimiento
export default function CertificadosEpp({ items, certs, usuarioId, esJefe, nombreDe, onCambio }: {
  items: any[], certs: any[], usuarioId: string, esJefe: boolean, nombreDe: (id: string) => string, onCambio: () => Promise<void> | void,
}) {
  const [abierto, setAbierto] = useState<string | null>(null)
  const [prov, setProv] = useState(''); const [vence, setVence] = useState('')
  const [subiendo, setSubiendo] = useState(''); const [msg, setMsg] = useState('')

  const ver = async (path: string) => {
    const { data, error } = await supabase.storage.from('hsec-documentos').createSignedUrl(path, 600)
    if (error || !data) { alert('No se pudo abrir el archivo'); return }
    window.open(data.signedUrl, '_blank')
  }
  const subir = async (it: any, f: File) => {
    if (f.size > 15 * 1024 * 1024) { setMsg('El archivo supera 15 MB.'); return }
    setSubiendo(it.id); setMsg('')
    const path = `epp/${it.id}/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const up = await supabase.storage.from('hsec-documentos').upload(path, f, { contentType: f.type || undefined })
    if (up.error) { setSubiendo(''); setMsg('No se pudo subir: ' + up.error.message); return }
    const { error } = await supabase.from('pr_epp_certificados').insert({ item_id: it.id, proveedor: prov.trim() || null, path, nombre: f.name, vence: vence || null, subido_por: usuarioId })
    setSubiendo('')
    if (error) { setMsg('No se pudo registrar: ' + error.message); return }
    setProv(''); setVence(''); await onCambio()
  }
  const cambiarVence = async (c: any, v: string) => {
    const { error } = await supabase.from('pr_epp_certificados').update({ vence: v || null }).eq('id', c.id)
    if (error) { setMsg(error.message); return }
    await onCambio()
  }
  const borrar = async (c: any) => {
    if (!confirm(`¿Eliminar el certificado «${c.nombre}»?`)) return
    const { error } = await supabase.from('pr_epp_certificados').delete().eq('id', c.id)
    if (error) { setMsg(error.message); return }
    await onCambio()
  }
  const aplica = async (it: any, v: boolean) => {
    const { error } = await supabase.from('pr_epp_catalogo').update({ requiere_certificado: v }).eq('id', it.id)
    if (error) { setMsg(error.message); return }
    await onCambio()
  }
  const estadoItem = (id: string) => {
    const cs = certs.filter(c => c.item_id === id)
    if (!cs.length) return { n: 0, t: 'Sin certificado', col: ['#fde8e8', '#9b1c1c'] }
    const vs = cs.map(c => vigencia(c.vence))
    if (vs.every(v => v === 'vencido')) return { n: cs.length, t: 'Todos vencidos', col: ['#fde8e8', '#9b1c1c'] }
    if (vs.includes('vencido')) return { n: cs.length, t: 'Alguno vencido', col: ['#fef7e0', '#986a00'] }
    if (vs.includes('por_vencer')) return { n: cs.length, t: 'Por vencer', col: ['#fef7e0', '#986a00'] }
    return { n: cs.length, t: 'Al día', col: ['#e7f6ec', '#14532d'] }
  }
  return (
    <div style={card}>
      <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '14px' }}>📎 Certificados de calidad por EPP</p>
      <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#667085' }}>{esJefe ? 'Sube el certificado de cada proveedor. Un mismo EPP puede tener varios archivos, cada uno con su fecha de vencimiento. Marca «No aplica» en los EPP que no requieren certificado.' : 'Aquí puedes ver y descargar los certificados de calidad. Solo el Jefe los carga y modifica.'}</p>
      {msg && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '0 0 6px' }}>{msg}</p>}
      {items.filter(it => esJefe || it.requiere_certificado !== false).map(it => {
        const cs = certs.filter(c => c.item_id === it.id).sort((a, b) => (a.vence || '9999').localeCompare(b.vence || '9999'))
        const e = it.requiere_certificado === false ? { n: 0, t: 'No aplica', col: ['#f1f3f7', '#667085'] } : estadoItem(it.id), open = abierto === it.id
        return (
          <div key={it.id} style={{ borderTop: '1px solid #eef1f6', padding: '7px 0' }}>
            <button type="button" onClick={() => setAbierto(open ? null : it.id)} style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', fontFamily: 'inherit' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>{it.nombre}</span>
              <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '20px', background: e.col[0], color: e.col[1] }}>{e.n ? `${e.n} archivo${e.n === 1 ? '' : 's'} · ` : ''}{e.t}</span>
                <span style={{ fontSize: '12px', color: AZUL }}>{open ? '▲' : '▼'}</span>
              </span>
            </button>
            {open && (
              <div style={{ marginTop: '8px' }}>
                {esJefe && <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12.5px', marginBottom: '8px' }}><input type="checkbox" checked={it.requiere_certificado !== false} onChange={ev => aplica(it, ev.target.checked)} /> Este EPP requiere certificado de calidad</label>}
                {cs.length === 0 && <p style={{ margin: '0 0 6px', fontSize: '12.5px', color: '#98a2b3' }}>Aún no hay certificados para este EPP.</p>}
                {cs.map(c => {
                  const [bg, fg, tx] = VIG[vigencia(c.vence)]
                  const puedeEd = esJefe
                  return (
                    <div key={c.id} style={{ background: '#fafbfd', border: '1px solid #eef1f6', borderRadius: '8px', padding: '6px 9px', marginBottom: '5px', fontSize: '12.5px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => ver(c.path)} style={{ border: 'none', background: 'none', color: AZUL, cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: '12.5px', textAlign: 'left' }}>📎 {c.nombre}</button>
                      {c.proveedor && <span style={{ fontWeight: 600 }}>{c.proveedor}</span>}
                      <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: bg, color: fg }}>{c.vence ? `${tx} · ${fcl(c.vence)}` : tx}</span>
                      <span style={{ fontSize: '11px', color: '#98a2b3' }}>{nombreDe(c.subido_por)} · {new Date(c.subido_at).toLocaleDateString('es-CL')}</span>
                      <span style={{ marginLeft: 'auto', display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {puedeEd && <input type="date" value={c.vence || ''} title="Cambiar vencimiento" onChange={ev => cambiarVence(c, ev.target.value)} style={{ ...input, width: 'auto', padding: '2px 6px', fontSize: '11.5px' }} />}
                        {puedeEd && <button type="button" onClick={() => borrar(c)} title="Eliminar" style={{ ...btn(false, true), padding: '3px 8px', fontSize: '11.5px' }}>🗑</button>}
                      </span>
                    </div>
                  )
                })}
                {esJefe && it.requiere_certificado !== false && <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'flex-end', marginTop: '6px' }}>
                  <div style={{ flex: '1 1 150px' }}><label style={label}>Proveedor</label><input value={prov} onChange={e => setProv(e.target.value)} placeholder="Ej: Proveedor A" style={input} /></div>
                  <div><label style={label}>Vence</label><input type="date" value={vence} onChange={e => setVence(e.target.value)} style={{ ...input, width: 'auto' }} /></div>
                  <label style={{ ...btn(), display: 'inline-block', cursor: 'pointer' }}>{subiendo === it.id ? 'Subiendo...' : '＋ Subir certificado'}
                    <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} disabled={subiendo === it.id} onChange={ev => { const f = ev.target.files?.[0]; if (f) subir(it, f); ev.target.value = '' }} />
                  </label>
                </div>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
