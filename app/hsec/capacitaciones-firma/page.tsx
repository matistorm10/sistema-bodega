'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { card, btn } from '@/components/programa/ui'
import FirmaCanvas from '@/components/programa/FirmaCanvas'
import { useVersionesCap, FIRMAS_CAP, firmaDe, siguienteFirma, rolQuePuedeFirmar, VersionCap } from '@/lib/capVersiones'
import { ventana12, etiquetaMes, desdeCiclo, LUGARES } from '@/lib/capacitaciones'
import { generarCalendarioCapacitaciones } from '@/lib/generarCalendarioCap'
import { abrirVentanaPDF } from '@/lib/abrirPDF'

const fh = (f?: string | null) => f ? new Date(f).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : ''

export default function FirmaCalendario() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const esJefe = usuario?.rol === 'admin' || !!usuario?.esJefeHsec
  const miRol = rolQuePuedeFirmar(usuario)
  const puede = esJefe || !!usuario?.cargoPrograma
  const { versiones, pendiente, vigente, cargado, recargar } = useVersionesCap(!!usuario && puede)
  const [prog, setProg] = useState<any[]>([])
  const [config, setConfig] = useState<any[]>([])
  const [miFirma, setMiFirma] = useState<string | null | undefined>(undefined)
  const [dibujada, setDibujada] = useState<string | null>(null)
  const [cambiar, setCambiar] = useState(false)
  const [acepta, setAcepta] = useState(false)
  const [msg, setMsg] = useState(''); const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(async () => {
    if (!usuario) return
    const [p, c, f] = await Promise.all([
      supabase.from('pr_cap_programa').select('*').eq('activo', true).order('n'),
      supabase.from('pr_cap_config').select('*'),
      supabase.from('firmas_usuario').select('imagen').eq('usuario_id', usuario.id).maybeSingle(),
    ])
    setProg(p.data || []); setConfig(c.data || []); setMiFirma(f.data?.imagen || null)
  }, [usuario])
  useEffect(() => { if (usuario && puede) cargar() }, [usuario, puede, cargar])

  const bajar = async (v: VersionCap) => {
    const ven = abrirVentanaPDF()
    try { await generarCalendarioCapacitaciones({ prog: v.snapshot || [], desde: v.desde || desdeCiclo(config, prog), version: v }, ven) } catch (e: any) { ven?.close(); alert('No se pudo generar el PDF: ' + (e?.message || e)) }
  }
  const abrirFirma = async () => {
    setMsg(''); const { error } = await supabase.rpc('cap_abrir_version')
    if (error) { setMsg(error.message); return }
    await recargar()
  }
  const firmar = async (rol: string) => {
    if (!usuario) return
    setEnviando(true); setMsg('')
    const usarGuardada = !!miFirma && !cambiar
    const ahora = new Date().toISOString()
    const { error: e1 } = usarGuardada
      ? await supabase.from('firmas_usuario').update({ consentimiento_at: ahora }).eq('usuario_id', usuario.id)
      : await supabase.from('firmas_usuario').upsert({ usuario_id: usuario.id, imagen: dibujada, consentimiento_at: ahora, updated_at: ahora })
    if (e1) { setEnviando(false); setMsg('No se pudo guardar tu firma: ' + e1.message); return }
    const { error } = await supabase.rpc('firmar_calendario_cap', { p_rol: rol })
    setEnviando(false)
    if (error) { setMsg(error.message); return }
    setAcepta(false); setCambiar(false); setDibujada(null); await recargar(); await cargar()
  }

  const cab = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', background: '#fff', borderRadius: '16px', padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
      <Link href="/hsec" style={{ fontSize: '13px', color: AZUL, textDecoration: 'none' }}>← Prevención de Riesgo</Link>
      <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Firmas del calendario de capacitaciones</h1>
    </div>
  )
  if (cargandoUsuario) return <main style={fondoPagina}><div style={{ padding: '1.5rem' }}><p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p></div></main>
  const cols = ventana12(desdeCiclo(config, prog))
  const sig = pendiente ? siguienteFirma(pendiente) : null
  const meToca = !!pendiente && !!sig && miRol === sig
  const usarGuardada = !!miFirma && !cambiar
  const anteriores = versiones.filter(v => v.estado === 'vigente' && (!!pendiente || v.id !== vigente?.id))
  const yaFirme = !!pendiente && !!usuario && [pendiente.elabora_por, pendiente.revisa_por, pendiente.aprueba_por].includes(usuario.id)

  const caja = (v: VersionCap) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '8px' }}>
      {FIRMAS_CAP.map(f => {
        const s = firmaDe(v, f.k); const turno = v.estado === 'pendiente' && siguienteFirma(v) === f.k
        return (
          <div key={f.k} style={{ border: `1px solid ${s.at ? '#b9e2c8' : turno ? '#f0d98a' : '#e2e6ed'}`, background: s.at ? '#f3fbf6' : turno ? '#fffaf0' : '#fff', borderRadius: '10px', padding: '8px 10px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#667085' }}>{f.t.toUpperCase()} · {f.cargo}</p>
            <div style={{ height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.firma ? <img src={s.firma} alt="" style={{ maxHeight: '44px', maxWidth: '100%' }} /> : <span style={{ fontSize: '11.5px', color: turno ? '#986a00' : '#98a2b3' }}>{turno ? '⏳ Falta esta firma' : 'Pendiente'}</span>}</div>
            <p style={{ margin: 0, fontSize: '12px', fontWeight: 600 }}>{s.nombre || '—'}</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#98a2b3' }}>{fh(s.at)}</p>
          </div>
        )
      })}
    </div>
  )

  return (
    <main style={fondoPagina}>
      <div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '900px', margin: '0 auto' }}>
        {cab}
        {!puede ? <p style={{ fontSize: '13px', color: '#999' }}>No tienes acceso a esta sección.</p> : !cargado ? <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p> : (<>
          <div style={{ ...card, background: '#f4f8fd', borderColor: '#cfe0f5', marginBottom: '12px', fontSize: '12.5px', color: '#344054', lineHeight: 1.5 }}>
            Cada vez que se modifica el calendario debe firmarse en este orden: <b>1. Elabora</b> el Jefe de Prevención · <b>2. Revisa</b> el Administrador de Faena · <b>3. Aprueba</b> el Gerente General. Mientras falten firmas no se pueden registrar nuevas capacitaciones ni descargar el PDF. Si el Jefe vuelve a modificar el calendario, las firmas se reinician.
          </div>
          {msg && <p style={{ fontSize: '12.5px', color: '#c5221f' }}>{msg}</p>}

          {pendiente ? (
            <div style={{ ...card, marginBottom: '12px', borderColor: '#f0d98a' }}>
              <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '14px', color: '#7a5600' }}>⏳ Versión {pendiente.numero} del calendario · en firma</p>
              {caja(pendiente)}
              {meToca && (
                <div style={{ marginTop: '12px', borderTop: '1px solid #eef1f6', paddingTop: '10px' }}>
                  <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '13.5px' }}>Te toca firmar como: {FIRMAS_CAP.find(f => f.k === sig)?.t} ({FIRMAS_CAP.find(f => f.k === sig)?.cargo})</p>
                  <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#667085' }}>Revisa el calendario de abajo. Al firmar confirmas que lo leíste{sig === 'aprueba' ? ' y lo apruebas' : sig === 'revisa' ? ' y lo revisaste' : ' y lo elaboraste'}.</p>
                  {miFirma === undefined ? null : (
                    <div style={{ marginBottom: '8px' }}>
                      {usarGuardada ? (<>
                        <div style={{ display: 'inline-block', border: '1px solid #e2e6ed', borderRadius: '8px', padding: '6px 12px', background: '#fff' }}><img src={miFirma!} alt="Mi firma" style={{ maxHeight: '54px' }} /></div>{' '}
                        <button onClick={() => setCambiar(true)} style={{ border: 'none', background: 'none', color: AZUL, cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>Usar otra firma</button>
                      </>) : (<>
                        <FirmaCanvas onChange={setDibujada} />
                        {miFirma && <button onClick={() => { setCambiar(false); setDibujada(null) }} style={{ border: 'none', background: 'none', color: AZUL, cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>Usar mi firma guardada</button>}
                      </>)}
                    </div>
                  )}
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', fontSize: '12px', marginBottom: '8px' }}><input type="checkbox" checked={acepta} onChange={e => setAcepta(e.target.checked)} style={{ marginTop: '2px' }} /><span>Autorizo que mi firma se estampe en el calendario de capacitaciones de la empresa.</span></label>
                  <button onClick={() => firmar(sig!)} disabled={enviando || !acepta || (!usarGuardada && !dibujada)} style={{ ...btn(), opacity: enviando || !acepta || (!usarGuardada && !dibujada) ? 0.5 : 1 }}>{enviando ? 'Firmando...' : 'Firmar'}</button>
                </div>
              )}
              {!meToca && sig && <p style={{ margin: '10px 0 0', fontSize: '12.5px', color: '#667085' }}>{yaFirme ? 'Ya firmaste. ' : ''}Falta la firma de: <b>{FIRMAS_CAP.find(f => f.k === sig)?.cargo}</b>.</p>}
            </div>
          ) : (
            <div style={{ ...card, marginBottom: '12px', borderColor: '#b9e2c8' }}>
              <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '14px', color: '#14532d' }}>✅ Calendario vigente: versión {vigente?.numero}{vigente?.aprueba_at ? ` · aprobado el ${fh(vigente.aprueba_at)}` : ' · calendario inicial, sin firmas'}</p>
              {vigente && vigente.aprueba_at && caja(vigente)}
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                {vigente && <button onClick={() => bajar(vigente)} style={btn(false)}>📄 Descargar PDF</button>}
                {esJefe && <button onClick={abrirFirma} style={btn()}>Enviar el calendario a firma</button>}
              </div>
            </div>
          )}

          {pendiente && (
            <div style={{ ...card, overflowX: 'auto', marginBottom: '12px' }}>
              <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '13.5px' }}>Calendario a firmar</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', minWidth: '760px' }}>
                <thead><tr style={{ textAlign: 'left', color: '#667085' }}><th style={{ padding: '4px' }}>N°</th><th style={{ padding: '4px' }}>Temática</th><th style={{ padding: '4px' }}>Aplica a</th>{cols.map(k => <th key={k} style={{ padding: '4px 2px', textAlign: 'center', whiteSpace: 'nowrap' }}>{etiquetaMes(k)}</th>)}</tr></thead>
                <tbody>{prog.filter(p => Object.keys(p.meses || {}).some(k => cols.includes(k))).map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid #eef1f6' }}>
                    <td style={{ padding: '4px' }}>{p.n}</td><td style={{ padding: '4px', minWidth: '200px' }}>{p.tematica}</td>
                    <td style={{ padding: '4px', color: '#667085' }}>{(p.lugares || []).length >= 4 ? 'Todos' : (p.lugares || []).map((l: string) => LUGARES[l] || l).join(', ')}</td>
                    {cols.map(k => <td key={k} style={{ padding: '2px' }}><div style={{ height: '16px', borderRadius: '4px', background: p.meses?.[k] ? AZUL : '#f1f3f7' }} /></td>)}
                  </tr>))}</tbody>
              </table>
            </div>
          )}

          {anteriores.length > 0 && (
            <details style={card}>
              <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '13.5px' }}>Versiones anteriores</summary>
              {anteriores.map(v => (
                <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', padding: '6px 0', borderTop: '1px solid #f0f2f6', fontSize: '12.5px' }}>
                  <span>Versión {v.numero} · {v.aprueba_at ? `aprobada ${fh(v.aprueba_at)}` : 'calendario inicial (sin firmas)'}</span>
                  <button onClick={() => bajar(v)} style={{ ...btn(false), padding: '4px 10px', fontSize: '12px' }}>📄 PDF</button>
                </div>
              ))}
            </details>
          )}
        </>)}
      </div>
    </main>
  )
}
