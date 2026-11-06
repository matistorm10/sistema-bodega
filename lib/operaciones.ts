// Utilidades del módulo Operaciones (trabajadores, asignaciones a contrato y turnos)
export const hoyISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
export const sumarDias = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
export const fechaCorta = (iso?: string | null) => { if (!iso) return '—'; const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}-${m}-${y}` }
export const diasEntre = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)
export const TIPOS_CONTRATO: Record<string, string> = { pf1: 'Plazo fijo 1', pf2: 'Plazo fijo 2', indefinido: 'Indefinido' }
export const TIPOS_PERSONAL: Record<string, string> = { indirecto: 'Indirecto', directo: 'Directo', backoffice: 'Back Office' }
// Contrato "virtual" para el personal Back Office (casa matriz): aparece en Turnos sin ser un contrato real
export const BACKOFFICE_ID = '__backoffice__'
export const ordenPersonal = (t: any) => (t?.tipo_personal === 'indirecto' ? 0 : t?.tipo_personal === 'backoffice' ? 2 : 1)
// Indirectos primero, luego directos; dentro de cada grupo por nombre
export const cmpPersonal = (a: any, b: any) => ordenPersonal(a) - ordenPersonal(b) || String(a.nombre).localeCompare(String(b.nombre), 'es')
// Etiqueta de contrato: Cliente · Nombre del contrato · N°
export function etiquetaContrato(c?: { nombre?: string, cliente?: { nombre?: string } | { nombre?: string }[] | null, referencia?: string | null } | null, largo = 60): string {
  if (!c) return '—'
  if ((c as any).id === BACKOFFICE_ID) return 'Back Office'
  const ref = (c.referencia || '').trim(); const refC = ref.length > largo ? ref.slice(0, largo - 1).trimEnd() + '…' : ref
  const cli = Array.isArray(c.cliente) ? c.cliente[0]?.nombre : c.cliente?.nombre
  return [cli, refC, c.nombre && c.nombre !== ref ? 'N° ' + c.nombre : ''].filter(Boolean).join(' · ')
}
export type Vuelo = { id: string, trabajador_id: string, fecha: string, tipo: string | null, medio: string, aerolinea: string | null, hora: string | null, origen: string | null, destino: string | null, hora_salida: string | null, hora_llegada: string | null, reserva: string | null, notas: string | null, estado: string }
export const LUGARES = ['Santiago', 'Antofagasta', 'Calama', 'Iquique', 'Concepción', 'La Serena']
export const ESTADOS_VUELO: Record<string, string> = { por_comprar: 'Por comprar', comprado: 'Comprado' }
export const resumenVuelo = (v: Vuelo) => `${v.estado === 'por_comprar' ? 'POR COMPRAR · ' : ''}${v.tipo || 'vuelo'} ${v.medio === 'bus' ? 'bus' : v.aerolinea || ''} ${v.origen && v.destino ? v.origen + '→' + v.destino : ''} ${v.hora_salida ? v.hora_salida + (v.hora_llegada ? '-' + v.hora_llegada : '') : v.hora || ''}`.replace(/\s+/g, ' ').trim()
export const ESTATUS_CONTRATO: Record<string, string> = { carta_aviso: 'Carta de aviso enviada', proceso_finiquito: 'Proceso de finiquito' }
export type Cupo = { id: string, contrato_id: string, cargo: string, trabajador_id: string | null, es_reemplazo: boolean, reemplaza_trabajador_id: string | null, notas: string | null }
export const COLOR_EXAMEN: Record<string, string> = { aprobado: '#1e8e4e', pendiente: '#f59e0b', rechazado: '#dc2626' }
export const EXAMENES: Record<string, string> = { pendiente: 'Pendiente', aprobado: 'Aprobado', rechazado: 'Rechazado' }
export const MODALIDADES: Record<string, string> = { vuelo: 'Vuelo', local: 'Local' }
export const AEROLINEAS = ['SKY', 'JETSMART', 'LATAM']
export const DIAS_SEM = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

export type Turno = { id: string, trabajador_id: string, sube: string, baja: string | null, notas?: string | null }
export type Asig = { id: string, trabajador_id: string, contrato_id: string, desde: string, hasta: string | null, regimen: string | null, tipo_contrato: string | null, vence: string | null, sueldo: number | null, condiciones: string | null, estatus_contrato?: string | null, estatus_fecha?: string | null }

export const asigEn = (asigs: Asig[], trabId: string, fecha: string) =>
  asigs.find(a => a.trabajador_id === trabId && a.desde <= fecha && (!a.hasta || a.hasta >= fecha))
export const turnoEn = (turnos: Turno[], trabId: string, fecha: string) =>
  turnos.find(t => t.trabajador_id === trabId && t.sube <= fecha && (!t.baja || t.baja >= fecha))
// Estado de un trabajador en una fecha: en faena (turno), descanso (con contrato, sin turno) o sin contrato
export function estadoEn(asigs: Asig[], turnos: Turno[], trabId: string, fecha: string): 'faena' | 'descanso' | 'sin_contrato' {
  if (!asigEn(asigs, trabId, fecha)) return 'sin_contrato'
  return turnoEn(turnos, trabId, fecha) ? 'faena' : 'descanso'
}
// Traduce errores de la base (traslapes) a un mensaje claro
export function msgError(e: any): string {
  const m = String(e?.message || e || '')
  if (m.includes('op_asignaciones') && m.includes('exclusion')) return 'Ese trabajador ya tiene un contrato en esas fechas. Un trabajador no puede estar en 2 contratos el mismo día: cierra primero la asignación anterior.'
  if (m.includes('op_turnos') && m.includes('exclusion')) return 'Ese turno se traslapa con otro turno del mismo trabajador.'
  if (m.includes('duplicate key') && m.includes('rut')) return 'Ya existe un trabajador con ese RUT.'
  if (m.includes('row-level security')) return 'No tienes permiso para esta acción.'
  return m
}
export async function descargarXlsx(nombre: string, construir: (ExcelJS: any) => Promise<any>) {
  const ExcelJS = (await import('exceljs')).default
  const libro = await construir(ExcelJS)
  const buf = await libro.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = nombre; a.click(); URL.revokeObjectURL(url)
}

import { supabase } from '@/lib/supabase'
// Trae todas las filas (Supabase entrega máximo 1000 por consulta)
export async function traerTodo(tabla: string, columnas = '*', orden = 'id'): Promise<any[]> {
  const out: any[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.from(tabla).select(columnas).order(orden).range(desde, desde + 999)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}

// Cambia un día de un trabajador a "en turno" (on=true) o "descanso" (on=false) ajustando los tramos de turno
export async function marcarDia(turnos: Turno[], trabId: string, dia: string, on: boolean): Promise<string | null> {
  // Siempre se parte de los turnos reales guardados (no de la pantalla): evita choques al hacer clic rápido en varias celdas
  const fresco = await supabase.from('op_turnos').select('*').eq('trabajador_id', trabId)
  const ts = ((fresco.error ? turnos : (fresco.data || [])) as Turno[]).sort((a, b) => a.sube.localeCompare(b.sube))
  const cont = ts.find(x => x.sube <= dia && (!x.baja || x.baja >= dia))
  const run = async (q: any) => { const { error } = await q; if (error) throw error }
  try {
    if (!on) {
      if (!cont) return null
      const ant = sumarDias(dia, -1), sig = sumarDias(dia, 1)
      if (cont.sube === dia && cont.baja === dia) await run(supabase.from('op_turnos').delete().eq('id', cont.id))
      else if (cont.sube === dia) await run(supabase.from('op_turnos').update({ sube: sig }).eq('id', cont.id))
      else if (cont.baja === dia) await run(supabase.from('op_turnos').update({ baja: ant }).eq('id', cont.id))
      else { await run(supabase.from('op_turnos').update({ baja: ant }).eq('id', cont.id)); await run(supabase.from('op_turnos').insert({ trabajador_id: trabId, sube: sig, baja: cont.baja })) }
    } else {
      if (cont) return null
      const prev = ts.find(x => x.baja === sumarDias(dia, -1)), next = ts.find(x => x.sube === sumarDias(dia, 1))
      if (prev && next) { await run(supabase.from('op_turnos').delete().eq('id', next.id)); await run(supabase.from('op_turnos').update({ baja: next.baja }).eq('id', prev.id)) }
      else if (prev) await run(supabase.from('op_turnos').update({ baja: dia }).eq('id', prev.id))
      else if (next) await run(supabase.from('op_turnos').update({ sube: dia }).eq('id', next.id))
      else await run(supabase.from('op_turnos').insert({ trabajador_id: trabId, sube: dia, baja: dia }))
    }
    return null
  } catch (e) { return msgError(e) }
}

// ---- Turnos por rango de días (varias celdas a la vez) ----
export type PlanTurnos = { borrar: string[], actualizar: { id: string, sube?: string, baja?: string | null }[], insertar: Turno[] }
const INF = '9999-12-31'
// Calcula (sin tocar la base) cómo quedan los turnos de un trabajador al poner los días a..b en turno (on) o descanso (!on)
export function planRango(ts: Turno[], trabId: string, a: string, b: string, on: boolean): PlanTurnos {
  const plan: PlanTurnos = { borrar: [], actualizar: [], insertar: [] }
  if (!on) {
    for (const t of ts) {
      const fin = t.baja || INF
      if (fin < a || t.sube > b) continue
      const izq = t.sube < a, der = fin > b
      if (!izq && !der) plan.borrar.push(t.id)
      else if (izq && !der) plan.actualizar.push({ id: t.id, baja: sumarDias(a, -1) })
      else if (!izq && der) plan.actualizar.push({ id: t.id, sube: sumarDias(b, 1) })
      else { plan.actualizar.push({ id: t.id, baja: sumarDias(a, -1) }); plan.insertar.push({ id: crypto.randomUUID(), trabajador_id: trabId, sube: sumarDias(b, 1), baja: t.baja }) }
    }
    return plan
  }
  const toc = ts.filter(t => t.sube <= sumarDias(b, 1) && (t.baja || INF) >= sumarDias(a, -1)).sort((x, y) => x.sube.localeCompare(y.sube))
  if (toc.length === 0) { plan.insertar.push({ id: crypto.randomUUID(), trabajador_id: trabId, sube: a, baja: b }); return plan }
  const sube = toc[0].sube < a ? toc[0].sube : a
  const baja = toc.some(t => !t.baja) ? null : toc.reduce((m, t) => ((t.baja as string) > m ? (t.baja as string) : m), b)
  plan.borrar.push(...toc.slice(1).map(t => t.id))
  if (sube !== toc[0].sube || baja !== toc[0].baja) plan.actualizar.push({ id: toc[0].id, sube, baja })
  return plan
}
// Aplica el plan a una lista local de turnos (para actualizar la pantalla al instante)
export function aplicarPlanLocal(ts: Turno[], plan: PlanTurnos): Turno[] {
  return [...ts.filter(t => !plan.borrar.includes(t.id)).map(t => { const u = plan.actualizar.find(x => x.id === t.id); return u ? { ...t, ...u } as Turno : t }), ...plan.insertar]
}
// Guarda el plan en la base (primero borra, luego actualiza, luego inserta, para no chocar con las restricciones)
export async function guardarPlan(plan: PlanTurnos): Promise<string | null> {
  try {
    for (const id of plan.borrar) { const { error } = await supabase.from('op_turnos').delete().eq('id', id); if (error) throw error }
    for (const u of plan.actualizar) { const { id, ...campos } = u; const { error } = await supabase.from('op_turnos').update(campos).eq('id', id); if (error) throw error }
    if (plan.insertar.length) { const { error } = await supabase.from('op_turnos').insert(plan.insertar.map(t => ({ id: t.id, trabajador_id: t.trabajador_id, sube: t.sube, baja: t.baja }))); if (error) throw error }
    return null
  } catch (e) { return msgError(e) }
}
