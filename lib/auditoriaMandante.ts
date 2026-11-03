import { hoyISO } from './estadoPlan'

export type AudItem = { id: string, formato_id: string, orden: number, seccion: string, numero: string | null, texto: string, orientacion: string | null, puntaje: number, requiere_trabajador?: boolean }
export type AudResp = { id?: string, levantamiento_id: string, item_id: string, estado: 'pendiente' | 'cumple' | 'no_cumple' | 'na', obs?: string | null, accion?: string | null, responsable?: string | null, plazo?: string | null, plan_estado?: string }
export type AudDoc = { id: string, levantamiento_id: string, item_id: string, path: string, nombre: string, vence: string | null, subido_por: string, subido_at: string, revision: 'pendiente' | 'aprobado' | 'rechazado', comentario: string | null, revisado_por: string | null, revisado_at: string | null, trabajador_id?: string | null, trab_ids?: string[] }

export const sumaDias = (f: string, n: number) => { const [y, m, d] = f.split('-').map(Number); const t = new Date(y, m - 1, d + n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` }
export type Vig = 'vigente' | 'por_vencer' | 'vencido' | 'sin_fecha'
export const vigencia = (vence: string | null | undefined): Vig => { if (!vence) return 'sin_fecha'; const h = hoyISO(); return vence < h ? 'vencido' : vence <= sumaDias(h, 30) ? 'por_vencer' : 'vigente' }
// Un documento sirve como respaldo si no fue rechazado y no está vencido
export const docValido = (d: AudDoc) => d.revision !== 'rechazado' && vigencia(d.vence) !== 'vencido'

export function resumen(items: AudItem[], resp: Record<string, AudResp>, docs: AudDoc[], usaPuntaje: boolean, trabs: AudTrab[] = []) {
  let cumple = 0, na = 0, total = 0, nCumple = 0, nNo = 0, nNa = 0
  for (const it of items) {
    const w = usaPuntaje ? Number(it.puntaje) || 0 : 1
    total += w
    let e = resp[it.id]?.estado
    if (e === 'cumple' && it.requiere_trabajador && !difCompleta(it.id, trabs, docs).ok) e = 'pendiente'
    if (e === 'cumple') { cumple += w; nCumple++ } else if (e === 'na') { na += w; nNa++ } else if (e === 'no_cumple') nNo++
  }
  const base = total - na
  const pct = base > 0 ? (cumple / base) * 100 : 0
  const pend = items.length - nCumple - nNo - nNa
  const porRevisar = docs.filter(d => d.revision === 'pendiente').length
  const ids = new Set(items.map(i => i.id))
  const vivos = docs.filter(d => ids.has(d.item_id) && d.revision !== 'rechazado')
  const vencidos = vivos.filter(d => vigencia(d.vence) === 'vencido').length
  const porVencer = vivos.filter(d => vigencia(d.vence) === 'por_vencer').length
  return { pct, nCumple, nNo, nNa, pend, porRevisar, vencidos, porVencer, n: items.length }
}
export type Cal = 'Preferente' | 'Condicional' | 'Restringido'
export const calificacion = (pct: number): Cal => pct >= 95 ? 'Preferente' : pct >= 80 ? 'Condicional' : 'Restringido'

// ───── Respaldo por trabajador (documentos de difusión firmados) ─────
export type AudTrab = { id: string, levantamiento_id: string, nombre: string, rut: string, fecha_ingreso: string | null, activo: boolean }
export type EstTrab = 'falta' | 'revisar' | 'ok' | 'rechazado'
// Estado del respaldo de un trabajador en un ítem: toma el documento más reciente que no esté vencido
export function estadoTrab(docs: AudDoc[], trabId: string, itemId: string): { e: EstTrab, doc?: AudDoc } {
  const ds = docs.filter(d => d.item_id === itemId && !!d.trab_ids?.includes(trabId)).sort((a, b) => b.subido_at.localeCompare(a.subido_at))
  if (!ds.length) return { e: 'falta' }
  const buenos = ds.filter(docValido)
  if (buenos.length) { const ap = buenos.find(d => d.revision === 'aprobado'); return ap ? { e: 'ok', doc: ap } : { e: 'revisar', doc: buenos[0] } }
  return { e: 'rechazado', doc: ds[0] }
}
export const trabActivos = (trabs: AudTrab[]) => trabs.filter(t => t.activo)
// El ítem está respaldado cuando todos los trabajadores activos tienen su documento cargado
export function difCompleta(itemId: string, trabs: AudTrab[], docs: AudDoc[]) {
  const act = trabActivos(trabs)
  const faltan = act.filter(t => { const e = estadoTrab(docs, t.id, itemId).e; return e === 'falta' || e === 'rechazado' })
  return { total: act.length, faltan: faltan.length, ok: act.length > 0 && faltan.length === 0 }
}
export function resumenTrabajadores(items: AudItem[], trabs: AudTrab[], docs: AudDoc[]) {
  const its = items.filter(i => i.requiere_trabajador)
  const act = trabActivos(trabs)
  const filas = act.map(t => {
    const est = its.map(i => estadoTrab(docs, t.id, i.id).e)
    return { t, est, cargados: est.filter(e => e === 'ok' || e === 'revisar').length, aprobados: est.filter(e => e === 'ok').length, completo: est.every(e => e === 'ok' || e === 'revisar') }
  })
  return { its, filas, total: act.length, completos: filas.filter(f => f.completo).length, aprobados: filas.filter(f => f.aprobados === its.length).length }
}
