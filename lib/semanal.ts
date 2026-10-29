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
export function estadoSemanal(fin: string, diasPlazo: number, entregado: boolean, hoy = new Date()): EstadoSem {
  if (entregado) return { tipo: 'entregado', texto: 'Entregado' }
  const lim = limiteEntrega(fin, diasPlazo)
  const h = iso(hoy)
  const dif = Math.round((aFecha(lim).getTime() - aFecha(h).getTime()) / 86400000)
  if (dif >= 0) return { tipo: 'vigente', texto: dif === 0 ? 'Vence hoy' : dif === 1 ? 'Vence mañana' : `Vence en ${dif} días (${fechaLarga(lim)})` }
  return { tipo: 'atraso', texto: `Atrasado ${-dif} día${-dif === 1 ? '' : 's'} (venció el ${fechaLarga(lim)})` }
}
export const COLOR_SEM = { entregado: ['#d7efe0', '#14532d', '🟢'], vigente: ['#fef7e0', '#986a00', '🟡'], atraso: ['#fde8e8', '#9b1c1c', '🔴'] } as const
