// Utilidades del módulo Operaciones (trabajadores, asignaciones a contrato y turnos)
export const hoyISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
export const sumarDias = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
export const fechaCorta = (iso?: string | null) => { if (!iso) return '—'; const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}-${m}-${y}` }
export const diasEntre = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)
export const TIPOS_CONTRATO: Record<string, string> = { pf1: 'Plazo fijo 1', pf2: 'Plazo fijo 2', indefinido: 'Indefinido' }
export const DIAS_SEM = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

export type Turno = { id: string, trabajador_id: string, sube: string, baja: string | null, notas?: string | null }
export type Asig = { id: string, trabajador_id: string, contrato_id: string, desde: string, hasta: string | null, regimen: string | null, tipo_contrato: string | null, vence: string | null, sueldo: number | null, condiciones: string | null }

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
