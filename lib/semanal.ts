export const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const aFecha = (s: string) => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d) }
const isoDow = (d: Date) => ((d.getDay() + 6) % 7) + 1
export const fechaLarga = (s: string) => s.split('-').reverse().join('-')

// Cierre de semana más reciente (<= hoy) según el día de cierre del cliente.
export function ultimoCierre(diaCierre: number, hoy = new Date()): string {
  const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  while (isoDow(d) !== diaCierre) d.setDate(d.getDate() - 1)
  return iso(d)
}
// Últimos n períodos, del más reciente al más antiguo.
export function periodos(diaCierre: number, n = 6, hoy = new Date()): string[] {
  const d = aFecha(ultimoCierre(diaCierre, hoy))
  return Array.from({ length: n }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() - 7 * i); return iso(x) })
}
export const inicioPeriodo = (fin: string) => { const d = aFecha(fin); d.setDate(d.getDate() - 6); return iso(d) }
export const limiteEntrega = (fin: string, diasPlazo: number) => { const d = aFecha(fin); d.setDate(d.getDate() + diasPlazo); return iso(d) }

export type EstadoSem = { tipo: 'entregado' | 'vigente' | 'atraso', texto: string }
export const hhmm = (h?: string | null) => (h || '23:59').slice(0, 5)
export function estadoSemanal(fin: string, diasPlazo: number, entregado: boolean, hora?: string | null, ahora = new Date()): EstadoSem {
  if (entregado) return { tipo: 'entregado', texto: 'Entregado' }
  const lim = limiteEntrega(fin, diasPlazo), hh = hhmm(hora)
  const [H, M] = hh.split(':').map(Number)
  const l = aFecha(lim); l.setHours(H, M, 0, 0)
  const dif = Math.round((aFecha(lim).getTime() - aFecha(iso(ahora)).getTime()) / 86400000)
  if (ahora.getTime() <= l.getTime()) return { tipo: 'vigente', texto: dif === 0 ? `Vence hoy a las ${hh}` : dif === 1 ? `Vence mañana a las ${hh}` : `Vence en ${dif} días (${fechaLarga(lim)} ${hh})` }
  return { tipo: 'atraso', texto: `Atrasado · venció el ${fechaLarga(lim)} a las ${hh}` }
}
export const COLOR_SEM = { entregado: ['#d7efe0', '#14532d', '🟢'], vigente: ['#fef7e0', '#986a00', '🟡'], atraso: ['#fde8e8', '#9b1c1c', '🔴'] } as const
