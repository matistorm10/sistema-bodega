'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'
import { useUsuarioActual } from '@/lib/useUsuarioActual'
import { misUbicacionesIds } from '@/lib/prevencion'
import FormActividad from '@/components/programa/FormActividad'
import { card, btn, Barra } from '@/components/programa/ui'
import MiFirma from '@/components/programa/MiFirma'
import { descargarProgramaMensual } from '@/lib/generarProgramaMensual'
import { ACTIVIDADES, ORDEN_ACTIVIDADES, CARGOS_PROGRAMA, mesActual, nombreMes, mesesRecientes, pct, estadoPlazo, mesAnterior } from '@/lib/programa'

const fechaCL = (f?: string | null) => f ? f.slice(0, 10).split('-').reverse().join('-') : ''
const ESTADOS: Record<string, [string, string, string]> = {
  abierto: ['En curso', '#f1f3f7', '#555'],
  enviado: ['Enviado · esperando aprobación', '#fef7e0', '#986a00'],
  aprobado: ['Aprobado por la jefatura', '#d7efe0', '#14532d'],
  devuelto: ['Devuelto para corregir', '#fde8e8', '#9b1c1c'],
}

export default function Programa() {
  const { usuario, cargando: cargandoUsuario } = useUsuarioActual()
  const cargo = usuario?.cargoPrograma || null

  const [mes, setMes] = useState(mesActual())
  const [metas, setMetas] = useState<any[]>([])
  const [acts, setActs] = useState<any[]>([])
  const [mensual, setMensual] = useState<any | null>(null)
  const [faenas, setFaenas] = useState<any[]>([])
  const [descVerificado, setDescVerificado] = useState<boolean | null>(null)
  const [cargando, setCargando] = useState(true)
  const [form, setForm] = useState<{ actividad: string, registro?: any } | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [inicial, setInicial] = useState(false)

  const cargar = useCallback(async () => {
    if (!usuario || !cargo) { setCargando(false); return }
    const [m, a, mm, f, d] = await Promise.all([
      supabase.from('pr_prog_metas').select('*').eq('cargo', cargo),
      supabase.from('pr_prog_actividades').select('*').eq('usuario_id', usuario.id).eq('mes', mes).order('fecha', { ascending: false }),
      supabase.from('pr_prog_mensual').select('*').eq('usuario_id', usuario.id).eq('mes', mes).maybeSingle(),
      supabase.from('ubicaciones').select('id,nombre,activa').eq('tipo', 'faena').order('nombre'),
      usuario.esPrevencionista ? supabase.from('pr_descriptores').select('estado').eq('usuario_id', usuario.id).maybeSingle() : Promise.resolve({ data: null } as any),
    ])
    setMetas(m.data || []); setActs(a.data || []); setMensual(mm.data || null)
    const propias = usuario.esPrevencionista && usuario.rol !== 'admin' && !usuario.esJefeHsec ? await misUbicacionesIds(usuario.id) : null
    setFaenas((f.data || []).filter((x: any) => x.activa !== false && (!propias || propias.has(x.id))))
    setDescVerificado(usuario.esPrevencionista ? d.data?.estado === 'verificado' : true)
    setCargando(false)
  }, [usuario, cargo, mes])
  useEffect(() => { if (usuario) cargar() }, [usuario, cargar])

  // Los primeros días del mes, si el mes anterior aún no se informa, se abre ese mes primero.
  useEffect(() => {
    if (!usuario || !cargo || inicial) return
    setInicial(true)
    if (new Date().getDate() > 5) return
    const prev = mesAnterior(mesActual())
    supabase.from('pr_prog_mensual').select('estado').eq('usuario_id', usuario.id).eq('mes', prev).maybeSingle().then(({ data }) => {
      if (!data || data.estado === 'abierto' || data.estado === 'devuelto') setMes(prev)
    })
  }, [usuario, cargo, inicial])

  const estado = mensual?.estado || 'abierto'
  const plazo = estadoPlazo(mes, estado, mensual?.enviado_at)
  const cerrado = estado === 'enviado' || estado === 'aprobado'
  const filas = useMemo(() => ORDEN_ACTIVIDADES.filter(k => metas.some(m => m.actividad === k)).map(k => {
    const meta = metas.find(m => m.actividad === k)!.meta as number
    const reg = acts.filter(a => a.actividad === k)
    return { k, meta, real: reg.length, reg, p: pct(Math.min(reg.length, meta), meta) ?? 0 }
  }), [metas, acts])
  const totalMeta = filas.reduce((s, f) => s + f.meta, 0)
  const totalReal = filas.reduce((s, f) => s + Math.min(f.real, f.meta), 0)
  const cumplimiento = pct(totalReal, totalMeta) ?? 0

  const guardar = async (r: { fecha: string, ubicacion_id: string | null, datos: any, porcentaje: number | null }) => {
    if (!usuario || !form) return
    const cuerpo = { ...r, actividad: form.actividad, usuario_id: usuario.id }
    const { error } = form.registro
      ? await supabase.from('pr_prog_actividades').update({ fecha: r.fecha, ubicacion_id: r.ubicacion_id, datos: r.datos, porcentaje: r.porcentaje }).eq('id', form.registro.id)
      : await supabase.from('pr_prog_actividades').insert(cuerpo)
    if (error) { setMsg(error.message.includes('Ya existe un registro') ? 'Ya registraste esta actividad hoy. Solo se permite un registro por día; puedes editar el de hoy.' : error.message.includes('fecha') ? 'La fecha debe ser la de hoy y no se puede cambiar.' : 'No se pudo guardar: ' + error.message); return }
    // si la fecha cae en otro mes, cambia a ese mes para que la persona vea el registro
    if (r.fecha.slice(0, 7) !== mes) setMes(r.fecha.slice(0, 7))
    setForm(null); setMsg(''); await cargar()
  }
  const eliminar = async (a: any) => {
    if (!confirm('¿Eliminar este registro?')) return
    const { error } = await supabase.from('pr_prog_actividades').delete().eq('id', a.id)
    if (error) { alert(error.message); return }
    await cargar()
  }
  const enviar = async () => {
    if (!usuario) return
    if (cumplimiento < 100 && !confirm(`El programa va en ${cumplimiento}%. Solo se puede eximir actividades por ausencias justificadas (vacaciones, permisos, etc.). ¿Enviarlo igual a la jefatura?`)) return
    const { error } = mensual
      ? await supabase.from('pr_prog_mensual').update({ estado: 'enviado' }).eq('id', mensual.id)
      : await supabase.from('pr_prog_mensual').insert({ usuario_id: usuario.id, mes, estado: 'enviado' })
    if (error) { setMsg('No se pudo enviar: ' + error.message); return }
    setMsg(''); await cargar()
  }

  const cab = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', background: '#fff', borderRadius: '16px', padding: '14px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)' }}>
      <Link href="/hsec" style={{ fontSize: '13px', color: AZUL, textDecoration: 'none' }}>← Prevención de Riesgo</Link>
      <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Programa de liderazgo percibido</h1>
    </div>
  )
  if (cargandoUsuario) return <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif' }}><p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p></div></main>

  const aviso = (t: string) => <main style={fondoPagina}><div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '820px', margin: '0 auto' }}>{cab}<p style={{ fontSize: '13px', color: '#667085' }}>{t}</p></div></main>
  if (!cargo) return aviso('Tu usuario no participa del programa de liderazgo percibido. Pídele al administrador que te asigne un cargo en Usuarios.')
  if (descVerificado === false) return aviso('Antes de comenzar el programa, debes firmar tu descriptor de cargo y la jefatura debe verificarlo (SSO Faena · ítem 1).')

  const [estTxt, estBg, estCol] = ESTADOS[estado]

  return (
    <main style={fondoPagina}>
      <div style={{ padding: '1.5rem', fontFamily: 'system-ui,sans-serif', maxWidth: '820px', margin: '0 auto' }}>
        {cab}
        {cargando ? <p style={{ fontSize: '13px', color: '#999' }}>Cargando...</p> : form ? (
          <FormActividad actividad={form.actividad} usuario={usuario} faenas={faenas} inicial={form.registro} soloLectura={cerrado}
            onGuardar={guardar} onCancelar={() => { setForm(null); setMsg('') }} />
        ) : (
          <>
            <MiFirma usuarioId={usuario!.id} />
            <div style={{ ...card, marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: '15px', color: '#16213E' }}>{usuario!.nombre}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#667085' }}>{CARGOS_PROGRAMA[cargo]}</p>
                </div>
                <select value={mes} onChange={e => setMes(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #d0d5dd', borderRadius: '8px', fontSize: '13px', background: '#fff' }}>
                  {Array.from(new Set([mes, ...mesesRecientes(12)])).sort().reverse().map(m => <option key={m} value={m}>{nombreMes(m)}</option>)}
                </select>
              </div>
              <div style={{ marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                  <span style={{ color: '#475467' }}>Cumplimiento del mes</span><strong style={{ color: cumplimiento >= 100 ? '#1e8e4e' : '#16213E' }}>{cumplimiento}%</strong>
                </div>
                <Barra valor={cumplimiento} />
              </div>
              <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: estBg, color: estCol, fontWeight: 600 }}>{estTxt}</span>
                <button onClick={() => descargarProgramaMensual({ persona: { id: usuario!.id, nombre: usuario!.nombre, cargo: cargo! }, mes, metas, acts, mensual, faenas })} style={{ ...btn(false), padding: '7px 14px', fontSize: '12.5px' }}>📄 Descargar PDF del mes</button>
                {!cerrado && <button onClick={enviar} style={{ ...btn(), padding: '7px 14px', fontSize: '12.5px' }}>Enviar programa a aprobación</button>}
              </div>
              <p style={{ margin: '10px 0 0', fontSize: '12.5px', padding: '7px 10px', borderRadius: '8px',
                background: plazo.tipo === 'atraso' ? '#fde8e8' : plazo.tipo === 'ok' ? '#e7f6ec' : '#fff8e5',
                color: plazo.tipo === 'atraso' ? '#9b1c1c' : plazo.tipo === 'ok' ? '#14532d' : '#7a5600' }}>
                {plazo.tipo === 'atraso' ? '⚠️' : plazo.tipo === 'ok' ? '✅' : '🗓️'} {plazo.texto}
              </p>
              {mensual?.comentario && <p style={{ margin: '10px 0 0', fontSize: '12.5px', color: '#344054', background: '#f6f8fb', borderRadius: '8px', padding: '8px 10px' }}><strong>Comentario de la jefatura:</strong> {mensual.comentario}</p>}
              {msg && <p style={{ fontSize: '12.5px', color: '#c5221f', margin: '8px 0 0' }}>{msg}</p>}
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
              {filas.map(f => {
                const meta = ACTIVIDADES[f.k]
                const open = abierta === f.k
                return (
                  <div key={f.k} style={card}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <div onClick={() => setAbierta(open ? null : f.k)} style={{ cursor: 'pointer', flex: '1 1 220px', minWidth: 0 }}>
                        <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: '13.5px', color: '#16213E' }}>{meta.nombre}</p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#667085' }}>{f.real} de {f.meta} · {f.p}% {f.reg.length > 0 ? (open ? '· ocultar registros ▲' : '· ver registros ▼') : ''}</p>
                      </div>
                      <div style={{ width: '90px' }}><Barra valor={f.p} /></div>
                      {meta.tipo === 'pendiente'
                        ? <span style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '20px', background: '#fef7e0', color: '#986a00' }}>Formato pendiente</span>
                        : !cerrado && <button onClick={() => setForm({ actividad: f.k })} style={{ ...btn(), padding: '7px 14px', fontSize: '12.5px' }}>+ Registrar</button>}
                    </div>
                    {open && f.reg.length > 0 && (
                      <div style={{ marginTop: '10px', borderTop: '1px solid #eef1f6' }}>
                        {f.reg.map((a: any) => (
                          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: '1px solid #f3f5f9', fontSize: '12.5px' }}>
                            <span>{fechaCL(a.fecha)} · {faenas.find(x => x.id === a.ubicacion_id)?.nombre || '—'}{a.datos?.tarea ? ` · ${a.datos.tarea}` : a.datos?.tema ? ` · ${a.datos.tema}` : a.datos?.rbs ? ` · RBS N°${a.datos.rbs}` : ''}{a.porcentaje !== null ? ` · ${a.porcentaje}%` : ''}</span>
                            <span style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={() => setForm({ actividad: f.k, registro: a })} style={{ ...btn(false), padding: '4px 10px', fontSize: '12px' }}>{cerrado ? 'Ver' : 'Abrir'}</button>
                              {!cerrado && <button onClick={() => eliminar(a)} style={{ ...btn(false, true), padding: '4px 10px', fontSize: '12px' }}>Eliminar</button>}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <p style={{ fontSize: '11.5px', color: '#98a2b3', margin: '12px 0 0' }}>Solo puede eximirse o entregarse menos actividades por motivos válidos de ausencia (la empresa no desarrolla trabajos, vacaciones, permisos u otra ausencia). El APR informa el cumplimiento a la administración el primer día del mes siguiente.</p>
          </>
        )}
      </div>
    </main>
  )
}
