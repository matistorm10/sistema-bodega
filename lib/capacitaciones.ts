import { INICIO_MES } from '@/lib/inicio'
export const LUGARES: Record<string, string> = { oficina: 'Oficina central', engie: 'Faenas ENGIE', sacyr: 'Faenas SACYR - EUROHINCA', sqm: 'Faenas SQM' }
export const MESES_C = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SET', 'OCT', 'NOV', 'DIC']
export const mesKey = (anio: number, m: number) => `${anio}-${String(m).padStart(2, '0')}`
export const mesHoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 7)

// Un ítem del programa aplica a una ubicación según el "lugar" (oficina / ENGIE / SACYR / SQM) con que se la clasificó.
export const aplica = (p: { lugares: string[] }, lugar?: string | null) => !lugar || p.lugares.includes(lugar)

export function estadoCelda(mes: string, hechas: number, requeridas: number, hoy = mesHoy()): 'ok' | 'parcial' | 'atraso' | 'futuro' | 'actual' {
  if (mes < INICIO_MES && hechas === 0) return 'futuro'
  if (requeridas > 0 && hechas >= requeridas) return 'ok'
  if (hechas > 0 && requeridas === 0) return 'ok'
  if (hechas > 0) return mes < hoy ? 'atraso' : 'parcial'
  if (mes < hoy) return 'atraso'
  return mes === hoy ? 'actual' : 'futuro'
}
export const COLOR_CELDA = {
  ok: ['#d7efe0', '#14532d'], parcial: ['#fef7e0', '#986a00'], atraso: ['#fde8e8', '#9b1c1c'], actual: ['#e8f0fb', '#1B4F9C'], futuro: ['#f1f3f7', '#667085'],
} as const

// ───── Calendario de 12 meses corridos (claves 'AAAA-MM') ─────
export const sumaMes = (k: string, n: number) => { const [y, m] = k.split('-').map(Number); const t = new Date(y, m - 1 + n, 1); return mesKey(t.getFullYear(), t.getMonth() + 1) }
export const ventana12 = (desde: string) => Array.from({ length: 12 }, (_, i) => sumaMes(desde, i))
export const etiquetaMes = (k: string) => `${MESES_C[Number(k.slice(5)) - 1]} ${k.slice(2, 4)}`

// Inicio del ciclo de 12 meses: el que fijó el Jefe o, si no hay, el primer mes con capacitaciones
export const desdeCiclo = (config: any[] | null | undefined, prog: any[]) => {
  const v = config?.find(c => c.clave === 'ciclo_desde')?.valor
  if (v) return v as string
  const ks = prog.flatMap(p => Object.keys(p.meses || {})).sort()
  return ks[0] || mesHoy()
}
