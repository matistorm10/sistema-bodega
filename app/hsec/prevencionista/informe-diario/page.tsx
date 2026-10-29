'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { card, btn, input, Campo, Fila, Opciones, OP_C } from '@/components/programa/ui'
import { fechaCL, misUbicacionesIds } from '@/lib/prevencion'
import { DatosInforme, Fila as FilaT, informeNuevo, vacias, COLS, SUGERENCIAS_ACTIVIDAD, CARGO_APR } from '@/lib/informeDiario'
import { estadoPlan, COLOR_PLAN } from '@/lib/estadoPlan'
import { abrirVentanaPDF } from '@/lib/abrirPDF'
import { generarInformeDiario } from '@/lib/generarInformeDiario'

const iso = (ms: number) => new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const hoy = () => iso(Date.now())
const hace3 = () => iso(Date.now() - 3 * 86400000)
const OP_SN = [{ v: 'si', t: 'SÍ', col: '#1e8e4e' }, { v: 'no', t: 'NO', col: '#667085' }]
const OP_SN_ALERTA = [{ v: 'si', t: 'SÍ', col: '#c0392b' }, { v: 'no', t: 'NO', col: '#1e8e4e' }]
const Titulo = ({ t }: { t: string }) => <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: '14px', color: '#16213E' }}>{t}</p>

// Tabla editable por tarjetas (cómoda en celular)
function Lista({ filas, cols, onChange, vacia, addTxt }: { filas: FilaT[], cols: { k: string, t: string, ph?: string, lista?: string, tipo?: 'time' | 'date' | 'num' }[], onChange: (f: FilaT[]) => void, vacia: FilaT, addTxt: string }) {
  return (
    <>
      {filas.map((f, i) => (
        <div key={i} style={{ border: '1px solid #eef1f6', borderRadius: '10px', padding: '10px', marginBottom: '8px', background: '#fafbfd' }}>
          <Fila>{cols.map(c => <Campo key={c.k} titulo={c.t} ancho="140px"><input list={c.lista} type={c.tipo === 'time' ? 'time' : c.tipo === 'date' ? 'date' : 'text'} min={c.tipo === 'date' ? hoy() : undefined} inputMode={c.tipo === 'num' ? 'numeric' : undefined} value={f[c.k] || ''} placeholder={c.ph}
            onChange={e => { let v = e.target.value; if (c.tipo === 'num') v = v.replace(/[^0-9]/g, ''); if (c.tipo === 'date' && v && v < hoy()) v = hoy(); onChange(filas.map((x, j) => j === i ? { ...x, [c.k]: v } : x)) }} style={input} /></Campo>)}</Fila>
          <button type="button" onClick={() => onChange(filas.filter((_, j) => j !== i))} style={{ ...btn(false, true), padding: '4px 10px', fontSize: '11.5px' }}>Quitar fila</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...filas, { ...vacia }])} style={{ ...btn(false), padding: '6px 12px', fontSize: '12.5px' }}>+ {addTxt}</button>
    </>
  )
}

export default function InformeDiario() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const puede = usuario?.rol === 'admin' || !!usuario?.esJefeHsec || !!usuario?.esPrevencionista
  const [faenas, setFaenas] = useState<any[]>([])
  const [lista, setLista] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [edit, setEdit] = useState<{ id?: string, fecha: string, ubicacion_id: string, estado: string, d: DatosInforme } | null>(null)
  const [msg, setMsg] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [contratos, setContratos] = useState<any[]>([])
  const [faenaCli, setFaenaCli] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [ptsDocs, setPtsDocs] = useState<any[]>([])
  const verTodos = usuario?.rol === 'admin' || !!usuario?.esJefeHsec

  const cargar = useCallback(async () => {
    const [f, l, us, ct, fc, cl] = await Promise.all([
      supabase.from('ubicaciones').select('id,nombre,activa').eq('tipo', 'faena').order('nombre'),
      supabase.from('pr_informes_diarios').select('*').order('fecha', { ascending: false }).limit(60),
      supabase.from('usuarios').select('id,nombre'),
      supabase.from('pr_contratos').select('*').eq('activo', true).order('nombre'),
      supabase.from('pr_faena_cliente').select('*'),
      supabase.from('pr_clientes_informe').select('id,nombre'),
    ])
    setClientes(cl.data || [])
    setUsuarios(us.data || []); setContratos(ct.data || []); setFaenaCli(fc.data || [])
    const propias = verTodos || !usuario ? null : await misUbicacionesIds(usuario.id)
    setFaenas((f.data || []).filter((x: any) => x.activa !== false && (!propias || propias.has(x.id)))); setLista(l.data || []); setCargando(false)
  }, [usuario, verTodos])
  useEffect(() => { if (usuario && puede) cargar() }, [usuario, puede, cargar])

  const contratoId = edit?.d.contratoId
  useEffect(() => {
    if (!contratoId) { setPtsDocs([]); return }
    supabase.from('pr_contrato_documentos').select('id,nombre,estado,path,rev').eq('contrato_id', contratoId).eq('categoria', 'PTS').eq('estado', 'Aprobado').order('nombre').then(({ data }) => setPtsDocs(data || []))
  }, [contratoId])
  const nuevo = () => setEdit({ fecha: hoy(), ubicacion_id: faenas.length === 1 ? faenas[0].id : '', estado: 'borrador', d: informeNuevo(CARGO_APR) })
  const abrir = async (r: any) => setEdit({ id: r.id, fecha: r.fecha, ubicacion_id: r.ubicacion_id || '', estado: r.estado, d: { ...informeNuevo(CARGO_APR), ...r.datos, cargo: CARGO_APR, criticosL: (r.datos?.criticosL && r.datos.criticosL.length) ? r.datos.criticosL : (r.datos?.criticos ? [r.datos.criticos] : ['']) } })

  const guardar = async (cerrar: boolean) => {
    if (!usuario || !edit) return
    if (!edit.ubicacion_id) { setMsg('Elige la faena.'); return }
    if (!edit.id && (edit.fecha > hoy() || edit.fecha < hace3())) { setMsg('La fecha debe ser hoy o hasta 3 días antes.'); return }
    if (cerrar) {
      if (!edit.d.contratoId) { setMsg('Elige el contrato.'); return }
      if (!edit.d.horaIni || !edit.d.horaFin) { setMsg('Indica el horario (inicio y término).'); return }
      const falta = edit.d.condiciones.find(c => c.estado === 'NC' && (!c.accion?.trim() || !c.responsable?.trim() || (c.status !== 'Ejecutado' && !c.fecha)))
      if (falta) { setMsg(`Condición «${falta.item || 'sin nombre'}»: al ser No conforme completa acción, responsable y fecha del plan de acción.`); return }
      const sinNombre = edit.d.condiciones.find(c => !c.item.trim() && (c.estado || c.obs))
      if (sinNombre) { setMsg('Hay una condición agregada sin nombre.'); return }
    }
    if (cerrar && !confirm('Al cerrar el informe ya no podrás editarlo. ¿Cerrarlo?')) return
    setGuardando(true); setMsg('')
    const cuerpo: any = { fecha: edit.fecha, ubicacion_id: edit.ubicacion_id, datos: edit.d, updated_at: new Date().toISOString() }
    if (cerrar) { cuerpo.estado = 'cerrado'; cuerpo.cerrado_at = new Date().toISOString() }
    const { data, error } = edit.id
      ? await supabase.from('pr_informes_diarios').update(cuerpo).eq('id', edit.id).select().maybeSingle()
      : await supabase.from('pr_informes_diarios').insert({ ...cuerpo, creado_por: usuario.id }).select().maybeSingle()
    setGuardando(false)
    if (error) { setMsg(error.code === '23505' ? 'Ya existe un informe tuyo para esa faena y fecha. Ábrelo desde la lista.' : 'No se pudo guardar: ' + error.message); return }
    if (cerrar) { setEdit(null); await cargar() } else { setEdit({ ...edit, id: data?.id }); setMsg('Borrador guardado ✓'); await cargar() }
  }
  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar este informe?')) return
    const { error } = await supabase.from('pr_informes_diarios').delete().eq('id', id)
    if (error) { alert(error.message); return }
    if (edit?.id === id) setEdit(null)
    await cargar()
  }
  const pdf = async (r: { fecha: string, ubicacion_id: string | null, datos: DatosInforme, cerrado_at?: string | null, creado_por: string }) => {
    const v = abrirVentanaPDF()
    try {
      const [{ data: u }, { data: fi }] = await Promise.all([
        supabase.from('usuarios').select('nombre').eq('id', r.creado_por).maybeSingle(),
        supabase.from('firmas_usuario').select('imagen,consentimiento_at').eq('usuario_id', r.creado_por).maybeSingle(),
      ])
      await generarInformeDiario({ fecha: r.fecha, faena: faenas.find(x => x.id === r.ubicacion_id)?.nombre || '', elaboro: u?.nombre || usuario?.nombre || '', d: { ...informeNuevo(''), ...r.datos }, cerradoAt: r.cerrado_at, firma: r.cerrado_at && fi?.consentimiento_at ? fi.imagen : null }, v)
    } catch (e: any) { v?.close(); alert('No se pudo generar el PDF: ' + (e?.message || e)) }
  }

  const cab = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', background: '#fff', borderRadius: '16px', padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
      <Link href="/hsec/prevencionista/sso" style={{ fontSize: '13px', color: AZUL, textDecoration: 'none' }}>← SSO Faena</Link>
      <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Informe diario SSO</h1>
    </div>
  )
  if (cargandoUsuario) return <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif' }}><p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p></div></main>
  const wrap = (c: React.ReactNode) => <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '820px', margin: '0 auto' }}>{cab}{c}</div></main>
  if (!puede) return wrap(<p style={{ fontSize: '13px', color: '#999' }}>No tienes acceso a esta sección.</p>)
  if (cargando) return wrap(<p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p>)

  if (edit) {
    const d = edit.d, ro = edit.estado === 'cerrado' && usuario?.rol !== 'admin' && !usuario?.esJefeHsec
    const set = (p: Partial<DatosInforme>) => setEdit({ ...edit, d: { ...d, ...p } })
    const T = (k: keyof DatosInforme) => <input value={(d[k] as string) || ''} onChange={e => set({ [k]: e.target.value } as any)} disabled={ro} style={input} />
    const dot = (Number(d.dotH) || 0) + (Number(d.dotM) || 0)
    const cliF = faenaCli.find(x => x.ubicacion_id === edit.ubicacion_id)?.cliente_id
    const contratosFaena = contratos.filter(c => !cliF || !c.cliente_id || c.cliente_id === cliF)
    const setCond = (i: number, p: Record<string, string>) => set({ condiciones: d.condiciones.map((x, j) => j === i ? { ...x, ...p } : x) })
    return wrap(
      <fieldset disabled={ro} style={{ border: 'none', padding: 0, margin: 0, display: 'grid', gap: '12px' }}>
        <datalist id="sug-act">{SUGERENCIAS_ACTIVIDAD.map(s => <option key={s} value={s} />)}</datalist>
        <div style={card}>
          <Fila>
            <Campo titulo="Faena / proyecto *"><select value={edit.ubicacion_id} onChange={e => setEdit({ ...edit, ubicacion_id: e.target.value })} disabled={!!edit.id} style={input}><option value="">— elegir —</option>{faenas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}</select></Campo>
            <Campo titulo="Fecha * (hoy o hasta 3 días antes)"><input type="date" min={hace3()} max={hoy()} value={edit.fecha} onChange={e => { const v = e.target.value; setEdit({ ...edit, fecha: v > hoy() ? hoy() : v && v < hace3() ? hace3() : v }) }} disabled={!!edit.id} style={input} /></Campo>
            <Campo titulo="Horario *" ancho="220px">
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input type="time" value={d.horaIni} onChange={e => set({ horaIni: e.target.value })} disabled={ro} style={input} /><span style={{ fontSize: '12px', color: '#667085' }}>a</span><input type="time" value={d.horaFin} onChange={e => set({ horaFin: e.target.value })} disabled={ro} style={input} />
              </div>
            </Campo>
          </Fila>
          <Fila>
            <Campo titulo="Contrato *">
              <select value={d.contratoId} disabled={ro} onChange={e => { const c = contratos.find(x => x.id === e.target.value); set({ contratoId: e.target.value, contrato: c?.nombre || '', mandante: clientes.find(x => x.id === c?.cliente_id)?.nombre || '', ptsSel: [] }) }} style={input}>
                <option value="">— elegir contrato —</option>{contratosFaena.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              {contratosFaena.length === 0 && <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#986a00' }}>La jefatura aún no ha creado contratos{edit.ubicacion_id ? ' para el cliente de esta faena' : ''}.</p>}
            </Campo>
            <Campo titulo="Cliente / mandante (automático)"><input value={d.mandante} readOnly style={{ ...input, background: '#f3f5f9', color: '#475467' }} /></Campo>
            <Campo titulo="Cargo"><input value={CARGO_APR} readOnly style={{ ...input, background: '#f3f5f9', color: '#475467' }} /></Campo>
          </Fila>
          <Fila>
            <Campo titulo="Dotación INDELI · Hombres" ancho="110px"><input type="number" min="0" value={d.dotH} onChange={e => set({ dotH: e.target.value })} style={input} /></Campo>
            <Campo titulo="Mujeres" ancho="110px"><input type="number" min="0" value={d.dotM} onChange={e => set({ dotM: e.target.value })} style={input} /></Campo>
            <Campo titulo="Total" ancho="110px"><input value={dot} readOnly style={{ ...input, background: '#f3f5f9' }} /></Campo>
          </Fila>
        </div>

        <div style={card}><Titulo t="1 · Resumen de la jornada" />
          <Fila><Campo titulo="Área / frente">{T('area')}</Campo><Campo titulo="Tarea principal">{T('tarea')}</Campo></Fila>
          <Campo titulo="Trabajos críticos (puedes agregar más de uno)">
            {(d.criticosL.length ? d.criticosL : ['']).map((t, i, arr) => (
              <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                <input value={t} placeholder={`Trabajo crítico ${i + 1}`} disabled={ro} onChange={e => set({ criticosL: arr.map((x, j) => j === i ? e.target.value : x) })} style={input} />
                {arr.length > 1 && !ro && <button type="button" onClick={() => set({ criticosL: arr.filter((_, j) => j !== i) })} style={{ ...btn(false, true), padding: '4px 10px', fontSize: '12px' }}>Quitar</button>}
              </div>
            ))}
            {!ro && <button type="button" onClick={() => set({ criticosL: [...(d.criticosL.length ? d.criticosL : ['']), ''] })} style={{ ...btn(false), padding: '5px 10px', fontSize: '12px' }}>+ Agregar trabajo crítico</button>}
          </Campo>
          <div style={{ marginTop: '10px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#667085', display: 'block', marginBottom: '3px' }}>PTS aprobados del contrato</label>
            {!d.contratoId ? <p style={{ margin: 0, fontSize: '12px', color: '#98a2b3' }}>Elige primero el contrato.</p>
              : ptsDocs.length === 0 ? <p style={{ margin: 0, fontSize: '12px', color: '#986a00' }}>Este contrato aún no tiene PTS aprobados.</p>
              : <div style={{ display: 'grid', gap: '4px' }}>{ptsDocs.map(p => (
                  <label key={p.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" disabled={ro} checked={d.ptsSel.includes(p.nombre)} onChange={e => set({ ptsSel: e.target.checked ? [...d.ptsSel, p.nombre] : d.ptsSel.filter(x => x !== p.nombre) })} />
                    <span>{p.nombre} <span style={{ color: '#98a2b3', fontSize: '11px' }}>Rev. {p.rev}</span></span>
                  </label>))}</div>}
            <Link href="/hsec/prevencionista/contratos" style={{ fontSize: '12px', color: AZUL }}>Ver todos los documentos del contrato →</Link>
          </div>
        </div>

        <div style={card}><Titulo t="2 · Actividades preventivas realizadas" />
          <Lista filas={d.actividades} onChange={f => set({ actividades: f })} vacia={vacias(1, COLS.actividades)[0]} addTxt="Agregar actividad"
            cols={[{ k: 'actividad', t: 'Actividad', lista: 'sug-act' }, { k: 'cantidad', t: 'Cantidad' }, { k: 'area', t: 'Área / participantes' }, { k: 'resultado', t: 'Resultado u observación' }]} />
        </div>

        <div style={card}><Titulo t="3 · Condiciones de seguridad y salud ocupacional" />
          {d.condiciones.map((c, i) => {
            const propia = i >= 7
            const e = estadoPlan(c.status, c.fecha)
            return (
              <div key={i} style={{ borderBottom: '1px solid #eef1f6', padding: '8px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {propia
                    ? <input value={c.item} placeholder="Nombre de la condición (ej: Iluminación del área)" disabled={ro} onChange={ev => setCond(i, { item: ev.target.value })} style={{ ...input, flex: '1 1 200px', width: 'auto', fontWeight: 600 }} />
                    : <span style={{ fontSize: '13px', fontWeight: 600, color: '#344054', flex: '1 1 200px' }}>{c.item}</span>}
                  <Opciones valor={c.estado === 'C' || c.estado === 'NC' || c.estado === 'NA' ? c.estado : null} opciones={OP_C} disabled={ro} onChange={v => setCond(i, { estado: v })} />
                  {propia && !ro && <button type="button" onClick={() => set({ condiciones: d.condiciones.filter((_, j) => j !== i) })} style={{ ...btn(false, true), padding: '4px 10px', fontSize: '12px' }}>Quitar</button>}
                </div>
                <input value={c.obs || ''} placeholder="Observación" disabled={ro} onChange={ev => setCond(i, { obs: ev.target.value })} style={{ ...input, marginTop: '6px' }} />
                {c.estado === 'NC' && (
                  <div style={{ background: '#fff5f5', borderRadius: '8px', padding: '8px', marginTop: '6px', display: 'grid', gap: '6px' }}>
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#9b1c1c' }}>No cumple: plan de acción</p>
                    <input value={c.accion || ''} placeholder="Acción a realizar" disabled={ro} onChange={ev => setCond(i, { accion: ev.target.value })} style={input} />
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {c.status !== 'Ejecutado' && <input type="date" min={hoy()} value={c.fecha || ''} disabled={ro} onChange={ev => setCond(i, { fecha: ev.target.value && ev.target.value < hoy() ? hoy() : ev.target.value })} title="Fecha comprometida (desde hoy)" style={{ ...input, flex: '1 1 130px', width: 'auto' }} />}
                      <input value={c.responsable || ''} placeholder="Responsable" disabled={ro} onChange={ev => setCond(i, { responsable: ev.target.value })} style={{ ...input, flex: '1 1 130px', width: 'auto' }} />
                      <select value={c.status === 'Ejecutado' ? 'Ejecutado' : 'En ejecución'} disabled={ro} onChange={ev => setCond(i, { status: ev.target.value })} style={{ ...input, flex: '1 1 110px', width: 'auto' }}><option>En ejecución</option><option>Ejecutado</option></select>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: COLOR_PLAN[e][0], color: COLOR_PLAN[e][1] }}>{e}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {!ro && <div style={{ marginTop: '8px' }}><button type="button" onClick={() => set({ condiciones: [...d.condiciones, { item: '', estado: '', obs: '', accion: '', responsable: '', fecha: '', status: 'En ejecución' }] })} style={{ ...btn(false), padding: '6px 12px', fontSize: '12.5px' }}>+ Agregar otra condición</button></div>}
          <p style={{ fontSize: '11px', color: '#98a2b3', margin: '6px 0 0' }}>C = conforme · NC = no cumple (genera plan de acción) · NA = no aplica</p>
        </div>

        <div style={card}><Titulo t="4 · Incidentes y atención de salud" />
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <div><label style={{ fontSize: '11px', fontWeight: 600, color: '#667085', display: 'block', marginBottom: '3px' }}>Incidentes</label><Opciones valor={d.incidentes} opciones={OP_SN_ALERTA} onChange={v => set({ incidentes: v })} disabled={ro} /></div>
            <div><label style={{ fontSize: '11px', fontWeight: 600, color: '#667085', display: 'block', marginBottom: '3px' }}>Atenciones</label><Opciones valor={d.atenciones} opciones={OP_SN_ALERTA} onChange={v => set({ atenciones: v })} disabled={ro} /></div>
          </div>
          <Campo titulo="Descripción breve / folio de registro"><textarea value={d.descIncidente} onChange={e => set({ descIncidente: e.target.value })} rows={2} style={{ ...input, resize: 'vertical' }} /></Campo>
        </div>

        <div style={card}><Titulo t="5 · Oportunidades de mejora" />
          <Lista filas={d.mejoras} onChange={f => set({ mejoras: f })} vacia={vacias(1, COLS.mejoras)[0]} addTxt="Agregar oportunidad"
            cols={[{ k: 'oportunidad', t: 'Oportunidad de mejora' }, { k: 'accion', t: 'Acción inmediata' }, { k: 'compromiso', t: 'Compromiso' }, { k: 'responsable', t: 'Responsable' }, { k: 'plazo', t: 'Plazo / estado' }]} />
        </div>

        <div style={card}><Titulo t="6 · Coordinaciones y comunicaciones relevantes" />
          <Lista filas={d.coordinaciones} onChange={f => set({ coordinaciones: f })} vacia={vacias(1, COLS.coordinaciones)[0]} addTxt="Agregar coordinación"
            cols={[{ k: 'hora', t: 'Hora', tipo: 'time' }, { k: 'duracion', t: 'Duración (horas:minutos)', tipo: 'time' }, { k: 'con', t: 'Con quién / área' }, { k: 'tema', t: 'Tema e instrucción o acuerdo' }]} />
        </div>

        <div style={card}><Titulo t="7 · Pendientes para el siguiente turno" />
          <Lista filas={d.pendientes} onChange={f => set({ pendientes: f })} vacia={vacias(1, COLS.pendientes)[0]} addTxt="Agregar pendiente"
            cols={[{ k: 'pendiente', t: 'Pendiente' }, { k: 'responsable', t: 'Responsable' }, { k: 'fecha', t: 'Fecha comprometida (desde hoy)', tipo: 'date' }]} />
        </div>

        <div style={card}><Titulo t="8 · Cierre de la jornada" />
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <div><label style={{ fontSize: '11px', fontWeight: 600, color: '#667085', display: 'block', marginBottom: '3px' }}>Sin novedades</label><Opciones valor={d.sinNovedades} opciones={OP_SN} onChange={v => set({ sinNovedades: v })} disabled={ro} /></div>
            <div><label style={{ fontSize: '11px', fontWeight: 600, color: '#667085', display: 'block', marginBottom: '3px' }}>Reporte al cliente</label><Opciones valor={d.reporteCliente} opciones={OP_SN} onChange={v => set({ reporteCliente: v })} disabled={ro} /></div>
          </div>
          <Fila><Campo titulo="Hora de cierre"><input type="time" value={d.horaCierre} onChange={e => set({ horaCierre: e.target.value })} style={input} /></Campo><Campo titulo="Próximo turno">{T('proximoTurno')}</Campo><Campo titulo="Revisó"><input value={usuario?.nombre ? `${usuario.nombre} (APR de terreno)` : 'APR de terreno'} readOnly style={{ ...input, background: '#f3f5f9', color: '#475467' }} /></Campo></Fila>
          <Campo titulo="Observaciones generales"><textarea value={d.observaciones} onChange={e => set({ observaciones: e.target.value })} rows={3} style={{ ...input, resize: 'vertical' }} /></Campo>
        </div>

        {msg && <p style={{ fontSize: '12.5px', color: msg.endsWith('✓') ? '#1e8e4e' : '#c5221f', margin: 0 }}>{msg}</p>}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {!ro && <button type="button" onClick={() => guardar(false)} disabled={guardando} style={btn(false)}>Guardar borrador</button>}
          {!ro && <button type="button" onClick={() => guardar(true)} disabled={guardando} style={btn()}>Cerrar y firmar informe</button>}
          {edit.id && <button type="button" onClick={() => pdf({ fecha: edit.fecha, ubicacion_id: edit.ubicacion_id, datos: d, cerrado_at: edit.estado === 'cerrado' ? lista.find(x => x.id === edit.id)?.cerrado_at : null, creado_por: lista.find(x => x.id === edit.id)?.creado_por || usuario!.id })} style={btn(false)}>📄 Ver PDF</button>}
          <button type="button" onClick={() => { setEdit(null); setMsg('') }} style={btn(false)}>Volver</button>
        </div>
      </fieldset>
    )
  }

  return wrap(
    <>
      <div style={{ ...card, marginBottom: '12px' }}>
        <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#667085' }}>Un informe por faena y por día. Puedes guardarlo como borrador durante la jornada y cerrarlo al terminar (se firma con tu firma guardada).</p>
        <button onClick={nuevo} style={btn()}>+ Nuevo informe del día</button>
      </div>
      {lista.length === 0 && <p style={{ fontSize: '13px', color: '#999' }}>Aún no hay informes.</p>}
      <div style={{ display: 'grid', gap: '8px' }}>
        {lista.map(r => (
          <div key={r.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: '14px' }}>{fechaCL(r.fecha)} · {faenas.find(x => x.id === r.ubicacion_id)?.nombre || '—'}{verTodos ? <span style={{ fontWeight: 400, color: '#667085' }}> · {usuarios.find(u => u.id === r.creado_por)?.nombre || '—'}</span> : null}</p>
              <span style={{ fontSize: '11px', padding: '2px 9px', borderRadius: '20px', fontWeight: 600, background: r.estado === 'cerrado' ? '#d7efe0' : '#fef7e0', color: r.estado === 'cerrado' ? '#14532d' : '#986a00' }}>{r.estado === 'cerrado' ? 'Cerrado' : 'Borrador'}</span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => abrir(r)} style={{ ...btn(false), padding: '6px 12px', fontSize: '12.5px' }}>{r.estado === 'cerrado' ? 'Ver' : 'Continuar'}</button>
              <button onClick={() => pdf(r)} style={{ ...btn(false), padding: '6px 12px', fontSize: '12.5px' }}>PDF</button>
              <button onClick={() => eliminar(r.id)} style={{ ...btn(false, true), padding: '6px 12px', fontSize: '12.5px' }}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
