'use client'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { card, btn, input, label } from '@/components/programa/ui'
import { tallasDe } from '@/lib/epp'
import Marco from '@/components/operaciones/Marco'
import CalendarioTurnos from '@/components/operaciones/CalendarioTurnos'
import { etiquetaContrato, TIPOS_PERSONAL, hoyISO, sumarDias, fechaCorta, diasEntre, TIPOS_CONTRATO, msgError, descargarXlsx, type Asig, type Turno, type Vuelo } from '@/lib/operaciones'

const vacio = { contrato_id: '', desde: hoyISO(), regimen: '', tipo_contrato: '', vence: '', sueldo: '', condiciones: '' }
export default function Ficha() {
  const { id } = useParams() as { id: string }
  const [t, setT] = useState<any | null>(null)
  const [d, setD] = useState<any>({})
  const [asigs, setAsigs] = useState<Asig[]>([])
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [vuelos, setVuelos] = useState<Vuelo[]>([])
  const [contratos, setContratos] = useState<any[]>([])
  const [msg, setMsg] = useState(''); const [msgA, setMsgA] = useState(''); const [msgT, setMsgT] = useState('')
  const [fa, setFa] = useState({ ...vacio }); const [verFormA, setVerFormA] = useState(false)
  const [ed, setEd] = useState<{ id: string, tipo_contrato: string, vence: string, regimen: string, sueldo: string, condiciones: string, hasta: string } | null>(null)
  const [ft, setFt] = useState({ sube: hoyISO(), baja: '' })
  const hoy = hoyISO()

  const cargar = useCallback(async () => {
    const [a, b, c, ct, vu] = await Promise.all([
      supabase.from('op_trabajadores').select('*').eq('id', id).single(),
      supabase.from('op_asignaciones').select('*').eq('trabajador_id', id).order('desde', { ascending: false }),
      supabase.from('op_turnos').select('*').eq('trabajador_id', id).order('sube', { ascending: false }),
      supabase.from('pr_contratos').select('id,nombre,empresa,referencia').order('nombre'),
      supabase.from('op_vuelos').select('*').eq('trabajador_id', id).order('fecha'),
    ])
    setVuelos((vu.data || []) as Vuelo[])
    setT(a.data); setD(a.data || {}); setAsigs((b.data || []) as Asig[]); setTurnos((c.data || []) as Turno[]); setContratos(ct.data || [])
  }, [id])
  useEffect(() => { cargar() }, [cargar])
  const nCont = (cid?: string) => etiquetaContrato(contratos.find(x => x.id === cid))

  const guardarDatos = async () => {
    const { error } = await supabase.from('op_trabajadores').update({ nombre: d.nombre, rut: d.rut || null, fecha_nacimiento: d.fecha_nacimiento || null, cargo: d.cargo || null, tipo_personal: d.tipo_personal || 'directo', ciudad: d.ciudad || null, talla_calzado: d.talla_calzado || null, talla_ropa: d.talla_ropa || null, notas: d.notas || null, activo: d.activo }).eq('id', id)
    setMsg(error ? msgError(error) : 'Guardado ✓'); if (!error) cargar()
  }
  const asignar = async () => {
    setMsgA('')
    if (!fa.contrato_id || !fa.desde) { setMsgA('Elige el contrato y la fecha de inicio.'); return }
    const abierta = asigs.find(a => a.desde < fa.desde && (!a.hasta || a.hasta >= fa.desde))
    const aviso = abierta ? `${t.nombre} se moverá de «${nCont(abierta.contrato_id)}» a «${nCont(fa.contrato_id)}» desde el ${fechaCorta(fa.desde)}. El contrato anterior termina el ${fechaCorta(sumarDias(fa.desde, -1))}. ¿Confirmas?` : `Asignar a ${t.nombre} al contrato «${nCont(fa.contrato_id)}» desde el ${fechaCorta(fa.desde)}. ¿Confirmas?`
    if (!confirm(aviso)) return
    if (abierta) { const { error } = await supabase.from('op_asignaciones').update({ hasta: sumarDias(fa.desde, -1) }).eq('id', abierta.id); if (error) { setMsgA(msgError(error)); return } }
    const { error } = await supabase.from('op_asignaciones').insert({ trabajador_id: id, contrato_id: fa.contrato_id, desde: fa.desde, regimen: fa.regimen || null, tipo_contrato: fa.tipo_contrato || null, vence: fa.vence || null, sueldo: fa.sueldo ? Number(fa.sueldo) : null, condiciones: fa.condiciones || null })
    if (error) { if (abierta) await supabase.from('op_asignaciones').update({ hasta: abierta.hasta }).eq('id', abierta.id); setMsgA(msgError(error)); return }
    setFa({ ...vacio }); setVerFormA(false); cargar()
  }
  const guardarEd = async () => {
    if (!ed) return
    const { error } = await supabase.from('op_asignaciones').update({ tipo_contrato: ed.tipo_contrato || null, vence: ed.vence || null, regimen: ed.regimen || null, sueldo: ed.sueldo ? Number(ed.sueldo) : null, condiciones: ed.condiciones || null, hasta: ed.hasta || null }).eq('id', ed.id)
    if (error) { setMsgA(msgError(error)); return } setEd(null); setMsgA(''); cargar()
  }
  const borrarAsig = async (a: Asig) => { if (!confirm('¿Eliminar esta asignación de contrato?')) return; const { error } = await supabase.from('op_asignaciones').delete().eq('id', a.id); if (error) setMsgA(msgError(error)); else cargar() }
  const agregarTurno = async () => {
    setMsgT('')
    if (!ft.sube) { setMsgT('Indica la fecha de subida.'); return }
    if (ft.baja && ft.baja < ft.sube) { setMsgT('La bajada no puede ser antes de la subida.'); return }
    const { error } = await supabase.from('op_turnos').insert({ trabajador_id: id, sube: ft.sube, baja: ft.baja || null })
    if (error) { setMsgT(msgError(error)); return } setFt({ sube: hoy, baja: '' }); cargar()
  }
  const cambiarBaja = async (tu: Turno, baja: string | null) => {
    const { error } = await supabase.from('op_turnos').update({ baja }).eq('id', tu.id)
    if (error) setMsgT(msgError(error)); else { setMsgT(''); cargar() }
  }
  const borrarTurno = async (tu: Turno) => { if (!confirm('¿Eliminar este turno?')) return; const { error } = await supabase.from('op_turnos').delete().eq('id', tu.id); if (error) setMsgT(msgError(error)); else cargar() }
  const descargar = () => descargarXlsx(`Turnos_${(t.nombre || 'trabajador').replace(/\s+/g, '_')}.xlsx`, async (X) => {
    const libro = new X.Workbook(); libro.creator = 'Sistema INDELI'
    const h = libro.addWorksheet('Turnos')
    h.addRow([`Trabajador: ${t.nombre}`, `RUT: ${t.rut || ''}`, `Cargo: ${t.cargo || ''}`]); h.addRow([])
    const cab = h.addRow(['Contrato', 'Subida', 'Bajada', 'Días en turno']); cab.font = { bold: true }
    ;[...turnos].sort((a, b) => a.sube.localeCompare(b.sube)).forEach(tu => {
      const a = asigs.find(x => x.desde <= tu.sube && (!x.hasta || x.hasta >= tu.sube))
      h.addRow([nCont(a?.contrato_id), fechaCorta(tu.sube), tu.baja ? fechaCorta(tu.baja) : 'en faena', tu.baja ? diasEntre(tu.sube, tu.baja) + 1 : ''])
    })
    h.columns = [{ width: 38 }, { width: 14 }, { width: 14 }, { width: 14 }]
    const c = libro.addWorksheet('Contratos'); const cc = c.addRow(['Contrato', 'Desde', 'Hasta', 'Tipo', 'Vence', 'Régimen']); cc.font = { bold: true }
    ;[...asigs].sort((a, b) => a.desde.localeCompare(b.desde)).forEach(a => c.addRow([nCont(a.contrato_id), fechaCorta(a.desde), a.hasta ? fechaCorta(a.hasta) : 'vigente', a.tipo_contrato ? TIPOS_CONTRATO[a.tipo_contrato] : '', a.vence ? fechaCorta(a.vence) : '', a.regimen || '']))
    c.columns = [{ width: 38 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 14 }]
    const vh = libro.addWorksheet('Vuelos'); vh.addRow(['Fecha', 'Tipo', 'Medio', 'Aerolínea', 'Hora', 'Reserva', 'Notas']).font = { bold: true }
    vuelos.forEach(v => vh.addRow([fechaCorta(v.fecha), v.tipo || '', v.medio, v.aerolinea || '', v.hora || '', v.reserva || '', v.notas || '']))
    vh.columns = [{ width: 12 }, { width: 10 }, { width: 8 }, { width: 12 }, { width: 18 }, { width: 10 }, { width: 24 }]
    return libro
  })

  const set = (k: string, v: any) => setD({ ...d, [k]: v })
  const tallasC = tallasDe({ usa_talla: true, tipo_talla: 'calzado' }), tallasR = tallasDe({ usa_talla: true, tipo_talla: 'ropa' })
  if (!t) return <Marco titulo="Ficha del trabajador" volver="/operaciones/trabajadores" volverTxt="← Trabajadores"><p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p></Marco>
  const sel = (v: string, f: (x: string) => void, opts: string[]) => <select value={v || ''} onChange={e => f(e.target.value)} style={input}><option value="">—</option>{v && !opts.includes(v) && <option>{v}</option>}{opts.map(o => <option key={o}>{o}</option>)}</select>
  const actual = asigs.find(a => a.desde <= hoy && (!a.hasta || a.hasta >= hoy))
  const enTurno = turnos.find(x => x.sube <= hoy && (!x.baja || x.baja >= hoy))

  return (
    <Marco titulo={t.nombre} volver="/operaciones/trabajadores" volverTxt="← Trabajadores" ancho={960}>
      <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: '#667085' }}>Hoy: <strong>{actual ? nCont(actual.contrato_id) : 'sin contrato'}</strong> · <strong>{!actual ? '—' : enTurno ? 'en faena' : 'en descanso'}</strong>{!t.activo && ' · FINIQUITADO'}</p>

      <div style={{ ...card, marginBottom: '12px' }}>
        <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: '14px' }}>Datos</p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px' }}><label style={label}>Nombre</label><input value={d.nombre || ''} onChange={e => set('nombre', e.target.value)} style={input} /></div>
          <div style={{ flex: '0 1 150px' }}><label style={label}>RUT</label><input value={d.rut || ''} onChange={e => set('rut', e.target.value)} style={input} /></div>
          <div style={{ flex: '0 1 150px' }}><label style={label}>Nacimiento</label><input type="date" value={d.fecha_nacimiento || ''} onChange={e => set('fecha_nacimiento', e.target.value)} style={input} /></div>
          <div style={{ flex: '0 1 140px' }}><label style={label}>Tipo de personal</label><select value={d.tipo_personal || 'directo'} onChange={e => set('tipo_personal', e.target.value)} style={input}><option value="indirecto">Indirecto</option><option value="directo">Directo</option></select></div>
          <div style={{ flex: '1 1 180px' }}><label style={label}>Cargo</label><input value={d.cargo || ''} onChange={e => set('cargo', e.target.value)} style={input} /></div>
          <div style={{ flex: '1 1 150px' }}><label style={label}>Ciudad</label><input value={d.ciudad || ''} onChange={e => set('ciudad', e.target.value)} style={input} /></div>
          <div style={{ flex: '0 1 110px' }}><label style={label}>Talla calzado</label>{sel(d.talla_calzado, v => set('talla_calzado', v), tallasC)}</div>
          <div style={{ flex: '0 1 110px' }}><label style={label}>Talla ropa</label>{sel(d.talla_ropa, v => set('talla_ropa', v), tallasR)}</div>
        </div>
        <div style={{ marginTop: '10px' }}><label style={label}>Notas</label><input value={d.notas || ''} onChange={e => set('notas', e.target.value)} style={input} /></div>
        <label style={{ fontSize: '12.5px', display: 'flex', gap: '6px', alignItems: 'center', margin: '10px 0' }}><input type="checkbox" checked={d.activo !== false} onChange={e => set('activo', e.target.checked)} />Trabajador activo (desmarcar si fue finiquitado)</label>
        <button onClick={guardarDatos} style={btn()}>Guardar datos</button>{msg && <span style={{ marginLeft: '10px', fontSize: '12.5px', color: msg.endsWith('✓') ? '#1e8e4e' : '#c5221f' }}>{msg}</span>}
      </div>

      <div style={{ ...card, marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '14px' }}>Contratos <span style={{ fontWeight: 400, fontSize: '12px', color: '#98a2b3' }}>· un trabajador solo puede estar en un contrato por día</span></p>
          <button onClick={() => setVerFormA(!verFormA)} style={{ ...btn(false), padding: '6px 12px', fontSize: '12px' }}>{verFormA ? 'Cancelar' : '+ Asignar / mover de contrato'}</button>
        </div>
        {verFormA && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e6ed', borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ flex: '2 1 240px' }}><label style={label}>Contrato *</label><select value={fa.contrato_id} onChange={e => setFa({ ...fa, contrato_id: e.target.value })} style={input}><option value="">— elegir —</option>{contratos.map(c => <option key={c.id} value={c.id}>{nCont(c.id)}</option>)}</select></div>
              <div style={{ flex: '0 1 150px' }}><label style={label}>Desde *</label><input type="date" value={fa.desde} onChange={e => setFa({ ...fa, desde: e.target.value })} style={input} /></div>
              <div style={{ flex: '0 1 110px' }}><label style={label}>Régimen</label><input value={fa.regimen} onChange={e => setFa({ ...fa, regimen: e.target.value })} placeholder="14x14" style={input} /></div>
              <div style={{ flex: '1 1 150px' }}><label style={label}>Tipo de contrato</label><select value={fa.tipo_contrato} onChange={e => setFa({ ...fa, tipo_contrato: e.target.value })} style={input}><option value="">—</option>{Object.entries(TIPOS_CONTRATO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div style={{ flex: '0 1 150px' }}><label style={label}>Vence (plazo fijo)</label><input type="date" value={fa.vence} onChange={e => setFa({ ...fa, vence: e.target.value })} style={input} /></div>
              <div style={{ flex: '0 1 140px' }}><label style={label}>Sueldo</label><input type="number" value={fa.sueldo} onChange={e => setFa({ ...fa, sueldo: e.target.value })} style={input} /></div>
            </div>
            <div style={{ marginTop: '10px' }}><label style={label}>Condiciones / trato</label><input value={fa.condiciones} onChange={e => setFa({ ...fa, condiciones: e.target.value })} style={input} /></div>
            <button onClick={asignar} style={{ ...btn(), marginTop: '10px' }}>Guardar asignación</button>
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#667085' }}>Si ya tiene un contrato vigente, ese contrato termina el día anterior a la fecha «Desde».</p>
          </div>
        )}
        {msgA && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '0 0 8px' }}>{msgA}</p>}
        {asigs.length === 0 ? <p style={{ margin: 0, fontSize: '12.5px', color: '#999' }}>Sin contratos asignados.</p> : asigs.map(a => (
          <div key={a.id} style={{ borderTop: '1px solid #eef1f6', padding: '8px 0', fontSize: '13px' }}>
            {ed && ed.id === a.id ? (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 140px' }}><label style={label}>Tipo</label><select value={ed.tipo_contrato} onChange={e => setEd({ ...ed, tipo_contrato: e.target.value })} style={input}><option value="">—</option>{Object.entries(TIPOS_CONTRATO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div style={{ flex: '0 1 140px' }}><label style={label}>Vence</label><input type="date" value={ed.vence} onChange={e => setEd({ ...ed, vence: e.target.value })} style={input} /></div>
                <div style={{ flex: '0 1 140px' }}><label style={label}>Hasta (termino)</label><input type="date" value={ed.hasta} onChange={e => setEd({ ...ed, hasta: e.target.value })} style={input} /></div>
                <div style={{ flex: '0 1 100px' }}><label style={label}>Régimen</label><input value={ed.regimen} onChange={e => setEd({ ...ed, regimen: e.target.value })} style={input} /></div>
                <div style={{ flex: '0 1 120px' }}><label style={label}>Sueldo</label><input type="number" value={ed.sueldo} onChange={e => setEd({ ...ed, sueldo: e.target.value })} style={input} /></div>
                <div style={{ flex: '2 1 220px' }}><label style={label}>Condiciones</label><input value={ed.condiciones} onChange={e => setEd({ ...ed, condiciones: e.target.value })} style={input} /></div>
                <button onClick={guardarEd} style={{ ...btn(), padding: '8px 14px' }}>Guardar</button><button onClick={() => setEd(null)} style={{ ...btn(false), padding: '8px 14px' }}>Cancelar</button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 300px' }}>
                  <strong>{nCont(a.contrato_id)}</strong> {a === actual && <span style={{ fontSize: '10.5px', padding: '2px 8px', borderRadius: '20px', background: '#e6f4ea', color: '#1e8e4e', fontWeight: 700 }}>vigente hoy</span>}
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#667085' }}>{fechaCorta(a.desde)} → {a.hasta ? fechaCorta(a.hasta) : 'sin término'}{a.regimen ? ` · ${a.regimen}` : ''}{a.tipo_contrato ? ` · ${TIPOS_CONTRATO[a.tipo_contrato]}${a.vence ? ' hasta ' + fechaCorta(a.vence) : ''}` : ''}{a.sueldo ? ` · sueldo $${Number(a.sueldo).toLocaleString('es-CL')}` : ''}</p>
                  {a.condiciones && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#667085' }}>{a.condiciones}</p>}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => setEd({ id: a.id, tipo_contrato: a.tipo_contrato || '', vence: a.vence || '', regimen: a.regimen || '', sueldo: a.sueldo ? String(a.sueldo) : '', condiciones: a.condiciones || '', hasta: a.hasta || '' })} style={{ ...btn(false), padding: '4px 10px', fontSize: '11.5px' }}>Editar</button>
                  <button onClick={() => borrarAsig(a)} style={{ ...btn(false, true), padding: '4px 10px', fontSize: '11.5px' }}>Eliminar</button>
                </div>
              </div>
            )}
          </div>))}
      </div>

      <div style={{ ...card, marginBottom: '12px' }}>
        <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '14px' }}>Calendario de turnos y vuelos <span style={{ fontWeight: 400, fontSize: '12px', color: '#98a2b3' }}>· solo visualización; se configura en <a href="/operaciones/turnos" style={{ color: '#1B4F9C' }}>Turnos</a></span></p>
        <CalendarioTurnos trabId={id} turnos={turnos} asigs={asigs} vuelos={vuelos} onCambio={cargar} soloLectura />
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '14px' }}>Turnos <span style={{ fontWeight: 400, fontSize: '12px', color: '#98a2b3' }}>· subida → bajada (en faena)</span></p>
          <button onClick={descargar} style={{ ...btn(false), padding: '6px 12px', fontSize: '12px' }}>⬇ Descargar Excel</button>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '10px' }}>
          <div><label style={label}>Sube</label><input type="date" value={ft.sube} onChange={e => setFt({ ...ft, sube: e.target.value })} style={{ ...input, width: '150px' }} /></div>
          <div><label style={label}>Baja (vacío = aún en faena)</label><input type="date" value={ft.baja} onChange={e => setFt({ ...ft, baja: e.target.value })} style={{ ...input, width: '150px' }} /></div>
          <button onClick={agregarTurno} style={btn()}>Agregar turno</button>
        </div>
        {msgT && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '0 0 8px' }}>{msgT}</p>}
        {turnos.length === 0 ? <p style={{ margin: 0, fontSize: '12.5px', color: '#999' }}>Sin turnos registrados.</p> : turnos.map(tu => (
          <div key={tu.id} style={{ borderTop: '1px solid #eef1f6', padding: '6px 0', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', fontSize: '13px' }}>
            <span style={{ flex: '1 1 200px' }}><strong>{fechaCorta(tu.sube)}</strong> → <strong>{tu.baja ? fechaCorta(tu.baja) : 'en faena'}</strong> <span style={{ color: '#98a2b3', fontSize: '12px' }}>{tu.baja ? `· ${diasEntre(tu.sube, tu.baja) + 1} días` : ''}</span></span>
            <input type="date" defaultValue={tu.baja || ''} key={tu.id + (tu.baja || '')} onBlur={e => { const v = e.target.value || null; if (v !== tu.baja) cambiarBaja(tu, v) }} title="Cambiar fecha de bajada" style={{ ...input, width: '150px', padding: '4px 8px' }} />
            {tu.baja && <button onClick={() => cambiarBaja(tu, sumarDias(tu.baja as string, 1))} style={{ ...btn(false), padding: '4px 10px', fontSize: '11.5px' }}>+1 día</button>}
            <button onClick={() => borrarTurno(tu)} style={{ ...btn(false, true), padding: '4px 10px', fontSize: '11.5px' }}>Eliminar</button>
          </div>))}
      </div>
    </Marco>
  )
}
