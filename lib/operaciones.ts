// Utilidades del módulo Operaciones (trabajadores, asignaciones a contrato y turnos)
export const hoyISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
export const sumarDias = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
export const fechaCorta = (iso?: string | null) => { if (!iso) return '—'; const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}-${m}-${y}` }
export const diasEntre = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)
export const TIPOS_CONTRATO: Record<string, string> = { pf1: 'Plazo fijo 1', pf2: 'Plazo fijo 2', indefinido: 'Indefinido' }
export const TIPOS_PERSONAL: Record<string, string> = { indirecto: 'Indirecto', directo: 'Directo' }
export const ordenPersonal = (t: any) => (t?.tipo_personal === 'indirecto' ? 0 : 1)
// Indirectos primero, luego directos; dentro de cada grupo por nombre
export const cmpPersonal = (a: any, b: any) => ordenPersonal(a) - ordenPersonal(b) || String(a.nombre).localeCompare(String(b.nombre), 'es')
// Etiqueta de contrato: Cliente · Nombre del contrato · N°
export function etiquetaContrato(c?: { nombre?: string, empresa?: string | null, referencia?: string | null } | null, largo = 60): string {
  if (!c) return '—'
  const ref = (c.referencia || '').trim(); const refC = ref.length > largo ? ref.slice(0, largo - 1).trimEnd() + '…' : ref
  return [c.empresa, refC, c.nombre && c.nombre !== ref ? 'N° ' + c.nombre : ''].filter(Boolean).join(' · ')
}
export type Vuelo = { id: string, trabajador_id: string, fecha: string, tipo: string | null, medio: string, aerolinea: string | null, hora: string | null, origen: string | null, destino: string | null, hora_salida: string | null, hora_llegada: string | null, reserva: string | null, notas: string | null, estado: string }
export const LUGARES = ['Santiago', 'Antofagasta', 'Calama', 'Iquique', 'Concepción', 'La Serena']
export const ESTADOS_VUELO: Record<string, string> = { por_comprar: 'Por comprar', comprado: 'Comprado' }
export const resumenVuelo = (v: Vuelo) => `${v.estado === 'por_comprar' ? 'POR COMPRAR · ' : ''}${v.tipo || 'vuelo'} ${v.medio === 'bus' ? 'bus' : v.aerolinea || ''} ${v.origen && v.destino ? v.origen + '→' + v.destino : ''} ${v.hora_salida ? v.hora_salida + (v.hora_llegada ? '-' + v.hora_llegada : '') : v.hora || ''}`.replace(/\s+/g, ' ').trim()
export const ESTATUS_CONTRATO: Record<string, string> = { carta_aviso: 'Carta de aviso enviada', proceso_finiquito: 'Proceso de finiquito' }
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
  const ts = [...turnos].sort((a, b) => a.sube.localeCompare(b.sube))
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
