'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { RBS } from '@/lib/rbs'
import { DS594, TOTAL_DS594 } from '@/lib/ds594'
import { ACTIVIDADES, ARCHIVO_INFO, ITEMS_ABC, ITEMS_CDR, COLS_EPP, COLS_BLOQUEO, CARGOS_PROGRAMA, pct, Resp, Cnc } from '@/lib/programa'
import { card, input, btn, Opciones, OP_SI, OP_C, Campo, Fila } from './ui'

const hoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const hora = () => new Date().toTimeString().slice(0, 5)
const vacios = (n: number, v: any = null) => Array.from({ length: n }, () => v)

type Props = {
  actividad: string, usuario: any, faenas: any[], inicial?: any, soloLectura?: boolean,
  onGuardar: (r: { fecha: string, ubicacion_id: string | null, datos: any, porcentaje: number | null }) => Promise<void>, onCancelar: () => void,
}

export default function FormActividad({ actividad, usuario, faenas, inicial, soloLectura, onGuardar, onCancelar }: Props) {
  const meta = ACTIVIDADES[actividad]
  const d0 = inicial?.datos || {}
  const [fecha, setFecha] = useState<string>(inicial?.fecha || hoy())
  const [faena, setFaena] = useState<string>(inicial?.ubicacion_id || '')
  const [h, setH] = useState<string>(d0.hora || hora())
  const [empresa, setEmpresa] = useState<string>(d0.empresa || 'INDELI Construcción y Montaje Ltda.')
  const [lugar, setLugar] = useState<string>(d0.lugar || '')
  const [tarea, setTarea] = useState<string>(d0.tarea || '')
  const [supervisor, setSupervisor] = useState<string>(d0.supervisor || '')
  const [duracion, setDuracion] = useState<string>(d0.duracion || '')
  const [colaborador, setColaborador] = useState<string>(d0.colaborador || '')
  const [items, setItems] = useState<(Resp | null)[]>(d0.items || [])
  const [rbsN, setRbsN] = useState<number>(d0.rbs || 1)
  const [textoA, setTextoA] = useState<string>(d0.compromisos || d0.fortalezas_txt || '')
  const [textoB, setTextoB] = useState<string>(d0.feedback || d0.oportunidades_txt || '')
  const [tema, setTema] = useState<string>(d0.tema || '')
  const [asistentes, setAsistentes] = useState<string>(d0.asistentes ?? '')
  // tarea crítica
  const [nSeguros, setNSeguros] = useState<string>(d0.n_seguros ?? '')
  const [nOport, setNOport] = useState<string>(d0.n_oport ?? '')
  const [fort, setFort] = useState<string[]>(d0.fortalezas || vacios(5, ''))
  const [oport, setOport] = useState<string[]>(d0.oportunidades || vacios(5, ''))
  const [comps, setComps] = useState<{ texto: string, responsable: string, plazo: string }[]>(d0.compromisos_lista || [{ texto: '', responsable: '', plazo: '' }])
  // ABC
  const [oLev, setOLev] = useState<string>(d0.oport_levantadas ?? '')
  const [oVen, setOVen] = useState<string>(d0.oport_vencidas ?? '')
  const [peligro, setPeligro] = useState<string>(d0.peligro || '')
  // matrices
  const cols = actividad === 'inspeccion_epp' ? COLS_EPP : COLS_BLOQUEO
  const [filas, setFilas] = useState<{ nombre: string, vals: (Cnc | null)[], obs: string }[]>(d0.filas || [{ nombre: '', vals: vacios(cols.length), obs: '' }])
  const [hall, setHall] = useState<{ trabajador: string, hallazgo: string, accion: string, responsable: string }[]>(d0.hallazgos || [])
  // DS 594
  const [det, setDet] = useState<Record<string, { justif: string, accion: string, fecha: string, responsable: string, status: string }>>(d0.det || {})
  const setDetalle = (n: string, campo: string, v: string) => setDet(p => { const base = p[n] || { justif: '', accion: '', fecha: '', responsable: '', status: 'Abierto' }; return { ...p, [n]: { ...base, [campo]: v } } })
  // respaldos
  const [respaldos, setRespaldos] = useState<string[]>(d0.respaldos || [])
  const [subiendo, setSubiendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')

  const rbsActual = RBS.find(r => r.n === rbsN)!
  const nItems = actividad === 'confirmacion_rol' ? ITEMS_CDR.length : actividad === 'confirmacion_abc' ? ITEMS_ABC.reduce((s, g) => s + g.items.length, 0) : actividad === 'cdp_rbs' ? rbsActual.items.length : actividad === 'verificacion_ds594' ? TOTAL_DS594 : 0
  const resp = (i: number) => (items[i] ?? null) as Resp | null
  const setItem = (i: number, v: Resp) => setItems(prev => { const c = [...prev]; while (c.length < nItems) c.push(null); c[i] = v; return c })

  const subir = async (files: FileList | null) => {
    if (!files || !files.length) return
    setSubiendo(true); setMsg('')
    const nuevos: string[] = []
    for (const f of Array.from(files)) {
      const ext = (f.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
      const path = `programa/${usuario.id}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`
      const { error } = await supabase.storage.from('hsec-documentos').upload(path, f, { contentType: f.type || undefined })
      if (error) { setMsg('No se pudo subir ' + f.name + ': ' + error.message); break }
      nuevos.push(path)
    }
    setRespaldos(r => [...r, ...nuevos]); setSubiendo(false)
  }
  const verArchivo = async (path: string) => {
    const { data, error } = await supabase.storage.from('hsec-documentos').createSignedUrl(path, 600)
    if (error || !data) { alert('No se pudo abrir el archivo.'); return }
    window.open(data.signedUrl, '_blank')
  }

  const guardar = async () => {
    setMsg('')
    if (!faena) { setMsg('Elige la faena / centro de costo.'); return }
    let datos: any = { respaldos }
    let porcentaje: number | null = null
    if (meta.tipo === 'archivo') {
      if (!tema.trim()) { setMsg('Escribe el tema.'); return }
      if (respaldos.length === 0) { setMsg('Sube el registro firmado (foto o PDF).'); return }
      datos = { ...datos, tema: tema.trim(), asistentes: asistentes === '' ? null : Number(asistentes) }
    } else if (actividad === 'confirmacion_rol') {
      if (!supervisor.trim() || !tarea.trim()) { setMsg('Completa la tarea confirmada y el supervisor.'); return }
      const si = items.filter(x => x === 'si').length, no = items.filter(x => x === 'no').length
      if (si + no + items.filter(x => x === 'na').length < nItems) { setMsg('Responde todos los ítems (SÍ / NO / N/A).'); return }
      porcentaje = pct(si, si + no)
      datos = { ...datos, tarea, supervisor, duracion, items, compromisos: textoA, feedback: textoB }
    } else if (actividad === 'confirmacion_abc') {
      if (items.filter(Boolean).length < nItems) { setMsg('Responde los 14 ítems (SÍ / NO / N/A).'); return }
      const si = items.filter(x => x === 'si').length, no = items.filter(x => x === 'no').length
      const entero = (v: string) => /^\d+$/.test(String(v).trim())
      if (!entero(oLev) || !entero(oVen)) { setMsg('Oportunidades levantadas y vencidas deben ser números enteros, 0 o mayores (sin decimales ni negativos).'); return }
      porcentaje = pct(si, si + no)
      datos = { ...datos, hora: h, empresa, items, oport_levantadas: Number(oLev), oport_vencidas: Number(oVen), peligro }
    } else if (actividad === 'cdp_rbs') {
      if (items.filter(Boolean).length < nItems) { setMsg('Responde todos los comportamientos (SÍ / NO / N/A).'); return }
      if (!tarea.trim()) { setMsg('Indica la tarea observada.'); return }
      const si = items.filter(x => x === 'si').length, no = items.filter(x => x === 'no').length
      porcentaje = pct(si, si + no)
      datos = { ...datos, rbs: rbsN, hora: h, observador: usuario.nombre, colaborador, lugar, tarea, items, fortalezas_txt: textoA, oportunidades_txt: textoB }
    } else if (actividad === 'verificacion_ds594') {
      if (!lugar.trim()) { setMsg('Indica el sector auditado.'); return }
      if (items.filter(Boolean).length < nItems) { setMsg(`Faltan ítems por responder (${items.filter(Boolean).length} de ${nItems}).`); return }
      const planas = DS594.flatMap(s => s.items)
      for (let i = 0; i < planas.length; i++) {
        if (items[i] === 'no') {
          const x = det[planas[i].n]
          if (!x?.justif?.trim() || !x?.accion?.trim()) { setMsg(`El ítem ${planas[i].n} es «NO»: completa la justificación y el plan de acción.`); return }
        }
      }
      const si = items.filter(x => x === 'si').length, no = items.filter(x => x === 'no').length
      porcentaje = pct(si, si + no)
      datos = { ...datos, lugar, items, det }
    } else if (actividad === 'cdp_tarea_critica') {
      if (!tarea.trim()) { setMsg('Indica la tarea observada.'); return }
      const s = fort.filter(x => x.trim()).length, o = oport.filter(x => x.trim()).length
      porcentaje = pct(s, s + o)
      if (comps.some(c => c.texto.trim() && c.plazo && c.plazo < hoy())) { setMsg('La fecha de un compromiso no puede ser anterior a hoy.'); return }
      datos = { ...datos, hora: h, empresa, lugar, tarea, n_seguros: String(fort.filter(x => x.trim()).length), n_oport: String(oport.filter(x => x.trim()).length), fortalezas: fort.filter(x => x.trim()), oportunidades: oport.filter(x => x.trim()), compromisos_lista: comps.filter(c => c.texto.trim()) }
    } else if (actividad === 'inspeccion_epp' || actividad === 'inspeccion_bloqueo') {
      const validas = filas.filter(f => f.nombre.trim())
      if (validas.length === 0) { setMsg('Agrega al menos un trabajador.'); return }
      let c = 0, nc = 0
      validas.forEach(f => f.vals.forEach(v => { if (v === 'C') c++; if (v === 'NC') nc++ }))
      porcentaje = pct(c, c + nc)
      datos = { ...datos, hora: h, tarea, supervisor, filas: validas, hallazgos: hall.filter(x => x.hallazgo.trim()) }
    }
    setGuardando(true)
    try { await onGuardar({ fecha, ubicacion_id: faena, datos, porcentaje }) } finally { setGuardando(false) }
  }

  const lect = !!soloLectura
  const num = (v: string, set: (s: string) => void) => <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={v} onChange={e => set(e.target.value.replace(/[^0-9]/g, ''))} onKeyDown={e => { if (e.key.length === 1 && !/[0-9]/.test(e.key) && !e.metaKey && !e.ctrlKey) e.preventDefault() }} disabled={lect} placeholder="0" style={input} />
  const txt = (v: string, set: (s: string) => void, ph?: string, tipo = 'text') => <input type={tipo} value={v} onChange={e => set(e.target.value)} disabled={lect} placeholder={ph} style={input} />
  const area = (v: string, set: (s: string) => void, ph?: string) => <textarea value={v} onChange={e => set(e.target.value)} disabled={lect} placeholder={ph} rows={3} style={{ ...input, resize: 'vertical' }} />

  const checklist = (textos: string[], offset = 0) => textos.map((t, i) => (
    <div key={offset + i} style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #eef1f6' }}>
      <span style={{ fontSize: '13px', color: '#344054', flex: 1 }}>{t}</span>
      <Opciones valor={resp(offset + i)} onChange={v => setItem(offset + i, v as Resp)} opciones={OP_SI} disabled={lect} />
    </div>
  ))

  const res = (() => {
    if (!nItems) return null
    const si = items.filter(x => x === 'si').length, no = items.filter(x => x === 'no').length
    return pct(si, si + no)
  })()

  return (
    <div style={{ ...card, marginBottom: '14px' }}>
      <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: '15px', color: '#16213E' }}>{meta.nombre}</p>
      <Fila>
        <Campo titulo="Fecha (hoy, automática)" ancho="140px"><input type="date" value={fecha} readOnly disabled style={{ ...input, background: '#f3f5f9', color: '#475467' }} /></Campo>
        <Campo titulo="Faena / centro de costo">
          <select value={faena} onChange={e => setFaena(e.target.value)} disabled={lect} style={input}><option value="">Seleccionar…</option>{faenas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}</select>
        </Campo>
        {meta.tipo === 'formulario' && actividad !== 'confirmacion_rol' && <Campo titulo="Hora" ancho="110px">{txt(h, setH, '', 'time')}</Campo>}
      </Fila>
      <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#667085' }}>Realizado por: <strong>{usuario.nombre}</strong>{usuario.cargoPrograma ? ` · ${CARGOS_PROGRAMA[usuario.cargoPrograma]}` : ''}</p>

      {meta.tipo === 'archivo' && (
        <>
          <p style={{ fontSize: '12.5px', color: '#986a00', background: '#fff8e5', borderRadius: '8px', padding: '8px 10px', margin: '0 0 10px' }}>{ARCHIVO_INFO[actividad]}</p>
          <Fila>
            <Campo titulo="Tema desarrollado" ancho="260px">{txt(tema, setTema, 'Ej: Trabajo en altura')}</Campo>
            <Campo titulo="N° de asistentes" ancho="120px">{txt(String(asistentes), setAsistentes, '', 'number')}</Campo>
          </Fila>
        </>
      )}

      {actividad === 'confirmacion_rol' && (
        <>
          <Fila>
            <Campo titulo="Tarea confirmada">{txt(tarea, setTarea)}</Campo>
            <Campo titulo="Supervisor confirmado">{txt(supervisor, setSupervisor)}</Campo>
            <Campo titulo="Duración" ancho="120px">{txt(duracion, setDuracion, 'Ej: 30 min')}</Campo>
          </Fila>
          {checklist(ITEMS_CDR)}
          <div style={{ marginTop: '10px' }}><Fila>
            <Campo titulo="Compromisos post análisis con los trabajadores" ancho="260px">{area(textoA, setTextoA)}</Campo>
            <Campo titulo="Detalle del feedback" ancho="260px">{area(textoB, setTextoB)}</Campo>
          </Fila></div>
        </>
      )}

      {actividad === 'confirmacion_abc' && (
        <>
          <Fila><Campo titulo="Empresa / contrato">{txt(empresa, setEmpresa)}</Campo></Fila>
          {(() => { let off = 0; return ITEMS_ABC.map(g => { const o = off; off += g.items.length; return (
            <div key={g.grupo} style={{ marginBottom: '8px' }}>
              <p style={{ margin: '8px 0 0', fontWeight: 700, fontSize: '13px', color: '#1B4F9C' }}>{g.grupo}</p>
              {checklist(g.items, o)}
            </div>) }) })()}
          <Fila>
            <Campo titulo="Oportunidades levantadas" ancho="140px">{num(String(oLev), setOLev)}</Campo>
            <Campo titulo="Oportunidades vencidas" ancho="140px">{num(String(oVen), setOVen)}</Campo>
          </Fila>
          <Fila><Campo titulo="Peligro (comportamiento, condición u omisión que pueda generar daño o lesión) · acción + característica">{area(peligro, setPeligro)}</Campo></Fila>
        </>
      )}

      {actividad === 'verificacion_ds594' && (() => {
        let off = 0
        return (
          <>
            <Fila><Campo titulo="Sector auditado">{txt(lugar, setLugar, 'Ej: Oficina y casino faena Pozo 2')}</Campo></Fila>
            <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#667085' }}>Check-list de autoevaluación de cumplimiento legal DS 594. Si respondes <strong>NO</strong>, indica la justificación y el plan de acción de mejora. Respondidos: <strong>{items.filter(Boolean).length} de {TOTAL_DS594}</strong>.</p>
            {DS594.map(sec => {
              const o = off; off += sec.items.length
              const resp0 = sec.items.filter((_, i) => items[o + i]).length
              let ultimaSub = ''
              return (
                <details key={sec.titulo} style={{ border: '1px solid #e2e6ed', borderRadius: '10px', marginBottom: '8px', padding: '2px 10px' }}>
                  <summary style={{ cursor: 'pointer', padding: '9px 0', fontWeight: 700, fontSize: '13px', color: '#16213E' }}>{sec.titulo} <span style={{ fontWeight: 400, color: resp0 === sec.items.length ? '#1e8e4e' : '#667085' }}>· {resp0}/{sec.items.length}</span></summary>
                  {sec.items.map((it, i) => {
                    const mostrarSub = it.sub && it.sub !== ultimaSub; if (it.sub) ultimaSub = it.sub
                    const r = resp(o + i)
                    const x = det[it.n]
                    return (
                      <div key={it.n}>
                        {mostrarSub && <p style={{ margin: '10px 0 0', fontWeight: 700, fontSize: '12.5px', color: '#1B4F9C' }}>{it.sub}</p>}
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #eef1f6' }}>
                          <span style={{ fontSize: '13px', color: '#344054', flex: 1 }}><strong>{it.n}</strong> {it.t}{it.norma ? <span style={{ color: '#98a2b3', fontSize: '11.5px' }}> · {it.norma}</span> : null}</span>
                          <Opciones valor={r} onChange={v => setItem(o + i, v as Resp)} opciones={OP_SI} disabled={lect} />
                        </div>
                        {r === 'no' && (
                          <div style={{ background: '#fff5f5', borderRadius: '8px', padding: '8px', margin: '0 0 8px', display: 'grid', gap: '6px' }}>
                            <input value={x?.justif || ''} onChange={e => setDetalle(it.n, 'justif', e.target.value)} disabled={lect} placeholder="Justificación" style={input} />
                            <input value={x?.accion || ''} onChange={e => setDetalle(it.n, 'accion', e.target.value)} disabled={lect} placeholder="Plan de acción de mejora" style={input} />
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <input type="date" value={x?.fecha || ''} onChange={e => setDetalle(it.n, 'fecha', e.target.value)} disabled={lect} style={{ ...input, flex: '1 1 130px', width: 'auto' }} />
                              <input value={x?.responsable || ''} onChange={e => setDetalle(it.n, 'responsable', e.target.value)} disabled={lect} placeholder="Responsable" style={{ ...input, flex: '1 1 130px', width: 'auto' }} />
                              <select value={x?.status || 'Abierto'} onChange={e => setDetalle(it.n, 'status', e.target.value)} disabled={lect} style={{ ...input, flex: '1 1 110px', width: 'auto' }}>
                                <option>Abierto</option><option>En curso</option><option>Cerrado</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </details>
              )
            })}
          </>
        )
      })()}

      {actividad === 'cdp_rbs' && (
        <>
          <Fila>
            <Campo titulo="Regla básica de seguridad (RBS)">
              <select value={rbsN} onChange={e => { setRbsN(Number(e.target.value)); setItems([]) }} disabled={lect} style={input}>
                {RBS.map(r => <option key={r.n} value={r.n}>RBS N°{r.n} · {r.titulo}</option>)}
              </select>
            </Campo>
            <Campo titulo="Colaborador observado">{txt(colaborador, setColaborador)}</Campo>
          </Fila>
          <Fila>
            <Campo titulo="Lugar / área de trabajo">{txt(lugar, setLugar)}</Campo>
            <Campo titulo="Tarea observada">{txt(tarea, setTarea)}</Campo>
          </Fila>
          <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '13px', color: '#1B4F9C' }}>Comportamientos a verificar</p>
          {checklist(rbsActual.items)}
          <div style={{ marginTop: '10px' }}><Fila>
            <Campo titulo="Fortalezas" ancho="260px">{area(textoA, setTextoA)}</Campo>
            <Campo titulo="Oportunidades" ancho="260px">{area(textoB, setTextoB)}</Campo>
          </Fila></div>
        </>
      )}

      {actividad === 'cdp_tarea_critica' && (
        <>
          <Fila>
            <Campo titulo="Empresa">{txt(empresa, setEmpresa)}</Campo>
            <Campo titulo="Lugar">{txt(lugar, setLugar)}</Campo>
          </Fila>
          <Fila><Campo titulo="Tarea observada (sobre un estándar PTS / HCR / ART / SOP)">{txt(tarea, setTarea)}</Campo></Fila>
          <Fila>
            <Campo titulo="N° comportamientos seguros (automático)" ancho="150px"><input value={fort.filter(x => x.trim()).length} readOnly disabled style={{ ...input, background: '#f3f5f9', color: '#475467', fontWeight: 700 }} /></Campo>
            <Campo titulo="N° oportunidades (automático)" ancho="150px"><input value={oport.filter(x => x.trim()).length} readOnly disabled style={{ ...input, background: '#f3f5f9', color: '#475467', fontWeight: 700 }} /></Campo>
          </Fila>
          <p style={{ margin: '4px 0 6px', fontWeight: 700, fontSize: '13px', color: '#1B4F9C' }}>Fortalezas del equipo de trabajo</p>
          {fort.map((v, i) => <div key={i} style={{ marginBottom: '6px', display: 'flex', gap: '6px' }}><input value={v} onChange={e => setFort(f => f.map((x, j) => j === i ? e.target.value : x))} disabled={lect} placeholder={`${i + 1}.-`} style={input} />{!lect && fort.length > 1 && <button type="button" onClick={() => setFort(f => f.filter((_, j) => j !== i))} title="Quitar fila" style={{ border: 'none', background: 'none', color: '#c5221f', cursor: 'pointer', fontSize: '16px' }}>×</button>}</div>)}
          {!lect && <button type="button" onClick={() => setFort(f => [...f, ''])} style={{ ...btn(false), padding: '5px 12px', fontSize: '12px' }}>+ Agregar fortaleza</button>}
          <p style={{ margin: '10px 0 6px', fontWeight: 700, fontSize: '13px', color: '#1B4F9C' }}>Oportunidades de mejora</p>
          {oport.map((v, i) => <div key={i} style={{ marginBottom: '6px', display: 'flex', gap: '6px' }}><input value={v} onChange={e => setOport(f => f.map((x, j) => j === i ? e.target.value : x))} disabled={lect} placeholder={`${i + 1}.-`} style={input} />{!lect && oport.length > 1 && <button type="button" onClick={() => setOport(f => f.filter((_, j) => j !== i))} title="Quitar fila" style={{ border: 'none', background: 'none', color: '#c5221f', cursor: 'pointer', fontSize: '16px' }}>×</button>}</div>)}
          {!lect && <button type="button" onClick={() => setOport(f => [...f, ''])} style={{ ...btn(false), padding: '5px 12px', fontSize: '12px' }}>+ Agregar oportunidad</button>}
          <p style={{ margin: '10px 0 6px', fontWeight: 700, fontSize: '13px', color: '#1B4F9C' }}>Compromisos adquiridos</p>
          {comps.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <input value={c.texto} onChange={e => setComps(l => l.map((x, j) => j === i ? { ...x, texto: e.target.value } : x))} disabled={lect} placeholder="Compromiso" style={{ ...input, flex: '3 1 200px', width: 'auto' }} />
              <input value={c.responsable} onChange={e => setComps(l => l.map((x, j) => j === i ? { ...x, responsable: e.target.value } : x))} disabled={lect} placeholder="Responsable" style={{ ...input, flex: '1 1 130px', width: 'auto' }} />
              <input type="date" min={hoy()} value={c.plazo} onChange={e => setComps(l => l.map((x, j) => j === i ? { ...x, plazo: e.target.value && e.target.value < hoy() ? hoy() : e.target.value } : x))} disabled={lect} style={{ ...input, flex: '1 1 130px', width: 'auto' }} />
            </div>
          ))}
          {!lect && <button type="button" onClick={() => setComps(l => [...l, { texto: '', responsable: '', plazo: '' }])} style={{ ...btn(false), padding: '6px 12px', fontSize: '12px' }}>+ Compromiso</button>}
        </>
      )}

      {(actividad === 'inspeccion_epp' || actividad === 'inspeccion_bloqueo') && (
        <>
          <Fila>
            <Campo titulo={actividad === 'inspeccion_epp' ? 'Tarea observada' : 'Tarea / equipo intervenido'}>{txt(tarea, setTarea)}</Campo>
            <Campo titulo="Supervisor">{txt(supervisor, setSupervisor)}</Campo>
          </Fila>
          <p style={{ margin: '4px 0 6px', fontSize: '12px', color: '#667085' }}>Por cada trabajador marca <strong>C</strong> (conforme), <strong>NC</strong> (no conforme) o <strong>NA</strong> (no aplica).</p>
          {filas.map((f, i) => (
            <div key={i} style={{ border: '1px solid #e2e6ed', borderRadius: '10px', padding: '10px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                <input value={f.nombre} onChange={e => setFilas(l => l.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))} disabled={lect} placeholder="Trabajador / cargo" style={input} />
                {!lect && filas.length > 1 && <button type="button" onClick={() => setFilas(l => l.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', color: '#c5221f', cursor: 'pointer', fontSize: '18px' }}>×</button>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: '6px 14px' }}>
                {cols.map((c, k) => (
                  <div key={c} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12.5px', color: '#344054' }}>{c}</span>
                    <Opciones valor={f.vals[k] ?? null} opciones={OP_C} disabled={lect} onChange={v => setFilas(l => l.map((x, j) => j === i ? { ...x, vals: x.vals.map((y, m) => m === k ? (v as Cnc) : y) } : x))} />
                  </div>
                ))}
              </div>
              {f.vals.includes('NC') && <input value={f.obs} onChange={e => setFilas(l => l.map((x, j) => j === i ? { ...x, obs: e.target.value } : x))} disabled={lect} placeholder="Observación (por qué es NC)" style={{ ...input, marginTop: '8px' }} />}
            </div>
          ))}
          {!lect && <button type="button" onClick={() => setFilas(l => [...l, { nombre: '', vals: vacios(cols.length), obs: '' }])} style={{ ...btn(false), padding: '6px 12px', fontSize: '12px' }}>+ Trabajador</button>}
          <p style={{ margin: '14px 0 6px', fontWeight: 700, fontSize: '13px', color: '#1B4F9C' }}>Hallazgos y acciones correctivas</p>
          {hall.map((x, i) => (
            <div key={i} style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <input value={x.trabajador} onChange={e => setHall(l => l.map((y, j) => j === i ? { ...y, trabajador: e.target.value } : y))} disabled={lect} placeholder="Trabajador" style={{ ...input, flex: '1 1 120px', width: 'auto' }} />
              <input value={x.hallazgo} onChange={e => setHall(l => l.map((y, j) => j === i ? { ...y, hallazgo: e.target.value } : y))} disabled={lect} placeholder="Hallazgo" style={{ ...input, flex: '2 1 160px', width: 'auto' }} />
              <input value={x.accion} onChange={e => setHall(l => l.map((y, j) => j === i ? { ...y, accion: e.target.value } : y))} disabled={lect} placeholder="Acción / compromiso" style={{ ...input, flex: '2 1 160px', width: 'auto' }} />
              <input value={x.responsable} onChange={e => setHall(l => l.map((y, j) => j === i ? { ...y, responsable: e.target.value } : y))} disabled={lect} placeholder="Responsable y plazo" style={{ ...input, flex: '1 1 130px', width: 'auto' }} />
            </div>
          ))}
          {!lect && <button type="button" onClick={() => setHall(l => [...l, { trabajador: '', hallazgo: '', accion: '', responsable: '' }])} style={{ ...btn(false), padding: '6px 12px', fontSize: '12px' }}>+ Hallazgo</button>}
        </>
      )}

      {/* Respaldos */}
      <div style={{ marginTop: '14px', borderTop: '1px solid #eef1f6', paddingTop: '10px' }}>
        <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '13px', color: '#16213E' }}>{meta.tipo === 'archivo' ? 'Registro firmado (foto o PDF)' : 'Fotos o respaldos (recomendado)'}</p>
        {respaldos.map((p, i) => (
          <div key={p} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12.5px', marginBottom: '4px' }}>
            <button type="button" onClick={() => verArchivo(p)} style={{ border: 'none', background: 'none', color: '#1B4F9C', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: '12.5px' }}>📎 Archivo {i + 1}</button>
            {!lect && <button type="button" onClick={() => setRespaldos(r => r.filter(x => x !== p))} style={{ border: 'none', background: 'none', color: '#c5221f', cursor: 'pointer' }}>quitar</button>}
          </div>
        ))}
        {!lect && <input type="file" multiple accept="image/*,application/pdf" onChange={e => { subir(e.target.files); e.target.value = '' }} style={{ fontSize: '12.5px' }} />}
        {subiendo && <p style={{ fontSize: '12px', color: '#667085', margin: '4px 0 0' }}>Subiendo…</p>}
      </div>

      {res !== null && <p style={{ margin: '12px 0 0', fontSize: '13px', fontWeight: 700, color: res >= 80 ? '#1e8e4e' : '#c0392b' }}>Cumplimiento de esta confirmación: {res}%</p>}
      {msg && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '10px 0 0' }}>{msg}</p>}
      <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
        {!lect && <button type="button" onClick={guardar} disabled={guardando || subiendo} style={btn()}>{guardando ? 'Guardando...' : 'Guardar actividad'}</button>}
        <button type="button" onClick={onCancelar} style={btn(false)}>{lect ? 'Cerrar' : 'Cancelar'}</button>
      </div>
    </div>
  )
}
