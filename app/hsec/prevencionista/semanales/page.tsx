'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { card, btn } from '@/components/programa/ui'
import { DIAS, hhmm, periodos, inicioPeriodo, limiteEntrega, estadoSemanal, fechaLarga, COLOR_SEM } from '@/lib/semanal'

const abrir = async (path: string) => {
  const { data, error } = await supabase.storage.from('hsec-documentos').createSignedUrl(path, 600)
  if (error || !data) { alert('No se pudo abrir el archivo.'); return }
  window.open(data.signedUrl, '_blank')
}

export default function Semanales() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const puede = !!usuario && (usuario.rol === 'admin' || !!usuario.esJefeHsec || !!usuario.esPrevencionista)
  const [asigs, setAsigs] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [informes, setInformes] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState('')

  const cargar = useCallback(async () => {
    if (!usuario) return
    const [a, i] = await Promise.all([
      supabase.from('pr_semanal_asignaciones').select('*').eq('usuario_id', usuario.id),
      supabase.from('pr_informes_semanales').select('*').eq('usuario_id', usuario.id),
    ])
    const ids = (a.data || []).map((x: any) => x.cliente_id)
    const c = ids.length ? await supabase.from('pr_clientes_informe').select('*').in('id', ids).eq('activo', true) : { data: [] as any[] }
    setAsigs(a.data || []); setInformes(i.data || []); setClientes(c.data || []); setCargando(false)
  }, [usuario])
  useEffect(() => { if (usuario && puede) cargar() }, [usuario, puede, cargar])

  const subir = async (c: any, fin: string, archivo: File) => {
    if (!usuario) return
    const k = c.id + fin
    setSubiendo(k)
    const ext = (archivo.name.split('.').pop() || 'bin').toLowerCase()
    const path = `semanal/${usuario.id}/${c.id}_${fin}_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('hsec-documentos').upload(path, archivo, { contentType: archivo.type || undefined })
    if (error) { setSubiendo(''); alert('No se pudo subir: ' + error.message); return }
    const previo = informes.find(i => i.cliente_id === c.id && i.periodo_fin === fin)
    const cuerpo = { path, archivo_nombre: archivo.name }
    const { error: e2 } = previo
      ? await supabase.from('pr_informes_semanales').update(cuerpo).eq('id', previo.id)
      : await supabase.from('pr_informes_semanales').insert({ ...cuerpo, cliente_id: c.id, usuario_id: usuario.id, periodo_fin: fin })
    setSubiendo('')
    if (e2) { alert('No se pudo registrar: ' + e2.message); return }
    await cargar()
  }

  const cab = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', background: '#fff', borderRadius: '16px', padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
      <Link href="/hsec/prevencionista/sso" style={{ fontSize: '13px', color: AZUL, textDecoration: 'none' }}>← SSO Faena</Link>
      <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Informes semanales</h1>
    </div>
  )
  if (cargandoUsuario) return <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif' }}><p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p></div></main>
  return (
    <main style={fondoPagina}>
      <div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '820px', margin: '0 auto' }}>
        {cab}
        {!puede ? <p style={{ fontSize: '13px', color: '#999' }}>No tienes acceso a esta sección.</p> : cargando ? <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p> : clientes.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#667085' }}>Todavía no tienes un cliente asignado. La jefatura te asignará uno (por ejemplo SQM o ENGIE) y aquí verás su formato y su calendario.</p>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {clientes.map(c => (
              <div key={c.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: '15px', color: '#16213E' }}>{c.nombre}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#667085' }}>La semana cierra el {DIAS[c.dia_cierre].toLowerCase()} · se entrega {c.dias_plazo === 0 ? 'ese mismo día' : `${c.dias_plazo} día${c.dias_plazo === 1 ? '' : 's'} después`} hasta las {hhmm(c.hora_limite)}</p>
                  </div>
                  {c.formato_path
                    ? <button onClick={() => abrir(c.formato_path)} style={{ ...btn(false), padding: '7px 12px', fontSize: '12.5px' }}>📄 Descargar formato</button>
                    : <span style={{ fontSize: '12px', color: '#986a00' }}>La jefatura aún no sube el formato.</span>}
                </div>
                <div style={{ marginTop: '10px' }}>
                  {periodos(c.dia_cierre, 5).map(fin => {
                    const inf = informes.find(i => i.cliente_id === c.id && i.periodo_fin === fin)
                    const e = estadoSemanal(fin, c.dias_plazo, !!inf, c.hora_limite)
                    const [bg, col, ic] = COLOR_SEM[e.tipo]
                    return (
                      <div key={fin} style={{ borderTop: '1px solid #eef1f6', padding: '9px 0', display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 200px' }}>
                          <p style={{ margin: '0 0 3px', fontSize: '13px', fontWeight: 600 }}>Semana {fechaLarga(inicioPeriodo(fin))} al {fechaLarga(fin)}</p>
                          <span style={{ fontSize: '11px', padding: '2px 9px', borderRadius: '20px', background: bg, color: col, fontWeight: 600 }}>{ic} {e.texto}</span>
                          {inf && <span style={{ fontSize: '11.5px', color: '#667085', marginLeft: '8px' }}>{inf.archivo_nombre}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {inf && <button onClick={() => abrir(inf.path)} style={{ ...btn(false), padding: '5px 10px', fontSize: '12px' }}>Ver</button>}
                          <label style={{ ...btn(!inf), padding: '5px 12px', fontSize: '12px', display: 'inline-block' }}>
                            {subiendo === c.id + fin ? 'Subiendo...' : inf ? 'Reemplazar' : 'Subir informe'}
                            <input type="file" style={{ display: 'none' }} onChange={ev => { const f = ev.target.files?.[0]; if (f) subir(c, fin, f); ev.target.value = '' }} />
                          </label>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
