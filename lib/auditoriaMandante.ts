import { hoyISO } from './estadoPlan'

export type AudItem = { id: string, formato_id: string, orden: number, seccion: string, numero: string | null, texto: string, orientacion: string | null, puntaje: number }
export type AudResp = { id?: string, levantamiento_id: string, item_id: string, estado: 'pendiente' | 'cumple' | 'no_cumple' | 'na', obs?: string | null, accion?: string | null, responsable?: string | null, plazo?: string | null, plan_estado?: string }
export type AudDoc = { id: string, levantamiento_id: string, item_id: string, path: string, nombre: string, vence: string | null, subido_por: string, subido_at: string, revision: 'pendiente' | 'aprobado' | 'rechazado', comentario: string | null, revisado_por: string | null, revisado_at: string | null }

export const sumaDias = (f: string, n: number) => { const [y, m, d] = f.split('-').map(Number); const t = new Date(y, m - 1, d + n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` }
export type Vig = 'vigente' | 'por_vencer' | 'vencido' | 'sin_fecha'
export const vigencia = (vence: string | null | undefined): Vig => { if (!vence) return 'sin_fecha'; const h = hoyISO(); return vence < h ? 'vencido' : vence <= sumaDias(h, 30) ? 'por_vencer' : 'vigente' }
// Un documento sirve como respaldo si no fue rechazado y no está vencido
export const docValido = (d: AudDoc) => d.revision !== 'rechazado' && vigencia(d.vence) !== 'vencido'

export function resumen(items: AudItem[], resp: Record<string, AudResp>, docs: AudDoc[], usaPuntaje: boolean) {
  let cumple = 0, na = 0, total = 0, nCumple = 0, nNo = 0, nNa = 0
  for (const it of items) {
    const w = usaPuntaje ? Number(it.puntaje) || 0 : 1
    total += w
    const e = resp[it.id]?.estado
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
