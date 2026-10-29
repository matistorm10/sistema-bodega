'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { card, btn, input, Campo, Fila, Opciones, OP_C } from '@/components/programa/ui'
import { fechaCL, misUbicacionesIds } from '@/lib/prevencion'
import { DatosInforme, Fila as FilaT, informeNuevo, vacias, COLS, SUGERENCIAS_ACTIVIDAD } from '@/lib/informeDiario'
import { abrirVentanaPDF } from '@/lib/abrirPDF'
import { generarInformeDiario } from '@/lib/generarInformeDiario'

const hoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const OP_SN = [{ v: 'si', t: 'SÍ', col: '#1e8e4e' }, { v: 'no', t: 'NO', col: '#667085' }]
const OP_SN_ALERTA = [{ v: 'si', t: 'SÍ', col: '#c0392b' }, { v: 'no', t: 'NO', col: '#1e8e4e' }]
const Titulo = ({ t }: { t: string }) => <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: '14px', color: '#16213E' }}>{t}</p>

// Tabla editable por tarjetas (cómoda en celular)
function Lista({ filas, cols, onChange, vacia, addTxt }: { filas: FilaT[], cols: { k: string, t: string, ph?: string, lista?: string }[], onChange: (f: FilaT[]) => void, vacia: FilaT, addTxt: string }) {
  return (
    <>
      {filas.map((f, i) => (
        <div key={i} style={{ border: '1px solid #eef1f6', borderRadius: '10px', padding: '10px', marginBottom: '8px', background: '#fafbfd' }}>
          <Fila>{cols.map(c => <Campo key={c.k} titulo={c.t} ancho="140px"><input list={c.lista} value={f[c.k] || ''} placeholder={c.ph} onChange={e => onChange(filas.map((x, j) => j === i ? { ...x, [c.k]: e.target.value } : x))} style={input} /></Campo>)}</Fila>
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
  const verTodos = usuario?.rol === 'admin' || !!usuario?.esJefeHsec

  const cargar = useCallback(async () => {
    const [f, l, us] = await Promise.all([
      supabase.from('ubicaciones').select('id,nombre,activa').eq('tipo', 'faena').order('nombre'),
      supabase.from('pr_informes_diarios').select('*').order('fecha', { ascending: false }).limit(60),
      supabase.from('usuarios').select('id,nombre'),
    ])
    setUsuarios(us.data || [])
    const propias = verTodos || !usuario ? null : await misUbicacionesIds(usuario.id)
    setFaenas((f.data || []).filter((x: any) => x.activa !== false && (!propias || propias.has(x.id)))); setLista(l.data || []); setCargando(false)
  }, [usuario, verTodos])
  useEffect(() => { if (usuario && puede) cargar() }, [usuario, puede, cargar])

  const nuevo = () => setEdit({ fecha: hoy(), ubicacion_id: faenas.length === 1 ? faenas[0].id : '', estado: 'borrador', d: informeNuevo(usuario?.esPrevencionista ? 'Prevencionista de terreno' : '') })
  const abrir = async (r: any) => setEdit({ id: r.id, fecha: r.fecha, ubicacion_id: r.ubicacion_id || '', estado: r.estado, d: { ...informeNuevo(''), ...r.datos } })

  const guardar = async (cerrar: boolean) => {
    if (!usuario || !edit) return
    if (!edit.ubicacion_id) { setMsg('Elige la faena.'); return }
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
        supabase.from('firmas_usuario').select('imagen').eq('usuario_id', r.creado_por).maybeSingle(),
      ])
      await generarInformeDiario({ fecha: r.fecha, faena: faenas.find(x => x.id === r.ubicacion_id)?.nombre || '', elaboro: u?.nombre || usuario?.nombre || '', d: { ...informeNuevo(''), ...r.datos }, cerradoAt: r.cerrado_at, firma: r.cerrado_at ? fi?.imagen : null }, v)
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
    return wrap(
      <fieldset disabled={ro} style={{ border: 'none', padding: 0, margin: 0, display: 'grid', gap: '12px' }}>
        <datalist id="sug-act">{SUGERENCIAS_ACTIVIDAD.map(s => <option key={s} value={s} />)}</datalist>
        <div style={card}>
          <Fila>
            <Campo titulo="Faena / proyecto *"><select value={edit.ubicacion_id} onChange={e => setEdit({ ...edit, ubicacion_id: e.target.value })} disabled={!!edit.id} style={input}><option value="">— elegir —</option>{faenas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}</select></Campo>
            <Campo titulo="Fecha *"><input type="date" value={edit.fecha} onChange={e => setEdit({ ...edit, fecha: e.target.value })} disabled={!!edit.id} style={input} /></Campo>
            <Campo titulo="Turno / horario">{T('turno')}</Campo>
          </Fila>
          <Fila><Campo titulo="Contrato">{T('contrato')}</Campo><Campo titulo="Empresa mandante">{T('mandante')}</Campo><Campo titulo="Cargo">{T('cargo')}</Campo></Fila>
          <Fila>
            <Campo titulo="Dotación INDELI · Hombres" ancho="110px"><input type="number" min="0" value={d.dotH} onChange={e => set({ dotH: e.target.value })} style={input} /></Campo>
            <Campo titulo="Mujeres" ancho="110px"><input type="number" min="0" value={d.dotM} onChange={e => set({ dotM: e.target.value })} style={input} /></Campo>
            <Campo titulo="Total" ancho="110px"><input value={dot} readOnly style={{ ...input, background: '#f3f5f9' }} /></Campo>
          </Fila>
        </div>

        <div style={card}><Titulo t="1 · Resumen de la jornada" />
          <Fila><Campo titulo="Área / frente">{T('area')}</Campo><Campo titulo="Tarea principal">{T('tarea')}</Campo></Fila>
          <Fila><Campo titulo="Trabajos críticos">{T('criticos')}</Campo><Campo titulo="PTS / permiso">{T('pts')}</Campo></Fila>
        </div>

        <div style={card}><Titulo t="2 · Actividades preventivas realizadas" />
          <Lista filas={d.actividades} onChange={f => set({ actividades: f })} vacia={vacias(1, COLS.actividades)[0]} addTxt="Agregar actividad"
            cols={[{ k: 'actividad', t: 'Actividad', lista: 'sug-act' }, { k: 'cantidad', t: 'Cantidad' }, { k: 'area', t: 'Área / participantes' }, { k: 'resultado', t: 'Resultado u observación' }]} />
        </div>

        <div style={card}><Titulo t="3 · Condiciones de seguridad y salud ocupacional" />
          {d.condiciones.map((c, i) => (
            <div key={i} style={{ borderBottom: '1px solid #eef1f6', padding: '8px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#344054', flex: '1 1 200px' }}>{c.item}</span>
                <Opciones valor={c.estado === 'C' || c.estado === 'NC' || c.estado === 'NA' ? c.estado : null} opciones={OP_C} disabled={ro}
                  onChange={v => set({ condiciones: d.condiciones.map((x, j) => j === i ? { ...x, estado: v } : x) })} />
              </div>
              <input value={c.obs || ''} placeholder="Observación" disabled={ro} onChange={e => set({ condiciones: d.condiciones.map((x, j) => j === i ? { ...x, obs: e.target.value } : x) })} style={{ ...input, marginTop: '6px' }} />
            </div>
          ))}
          <div style={{ marginTop: '8px' }}><button type="button" onClick={() => set({ condiciones: [...d.condiciones, { item: '', estado: '', obs: '' }] })} style={{ ...btn(false), padding: '6px 12px', fontSize: '12.5px' }}>+ Agregar otra condición</button></div>
          {d.condiciones.slice(7).map((c, i) => <input key={i} value={c.item} placeholder="Nombre de la condición" disabled={ro} onChange={e => set({ condiciones: d.condiciones.map((x, j) => j === i + 7 ? { ...x, item: e.target.value } : x) })} style={{ ...input, marginTop: '6px' }} />)}
          <p style={{ fontSize: '11px', color: '#98a2b3', margin: '6px 0 0' }}>C = conforme · NC = no conforme · NA = no aplica</p>
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
            cols={[{ k: 'hora', t: 'Hora', ph: '08:30' }, { k: 'con', t: 'Con quién / área' }, { k: 'tema', t: 'Tema e instrucción o acuerdo' }]} />
        </div>

        <div style={card}><Titulo t="7 · Pendientes para el siguiente turno" />
          <Lista filas={d.pendientes} onChange={f => set({ pendientes: f })} vacia={vacias(1, COLS.pendientes)[0]} addTxt="Agregar pendiente"
            cols={[{ k: 'pendiente', t: 'Pendiente' }, { k: 'responsable', t: 'Responsable' }, { k: 'fecha', t: 'Fecha comprometida', ph: 'dd-mm-aaaa' }]} />
        </div>

        <div style={card}><Titulo t="8 · Cierre de la jornada" />
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <div><label style={{ fontSize: '11px', fontWeight: 600, color: '#667085', display: 'block', marginBottom: '3px' }}>Sin novedades</label><Opciones valor={d.sinNovedades} opciones={OP_SN} onChange={v => set({ sinNovedades: v })} disabled={ro} /></div>
            <div><label style={{ fontSize: '11px', fontWeight: 600, color: '#667085', display: 'block', marginBottom: '3px' }}>Reporte al cliente</label><Opciones valor={d.reporteCliente} opciones={OP_SN} onChange={v => set({ reporteCliente: v })} disabled={ro} /></div>
          </div>
          <Fila><Campo titulo="Hora de cierre"><input type="time" value={d.horaCierre} onChange={e => set({ horaCierre: e.target.value })} style={input} /></Campo><Campo titulo="Próximo turno">{T('proximoTurno')}</Campo><Campo titulo="Revisó / Supervisor (nombre)">{T('supervisor')}</Campo></Fila>
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
