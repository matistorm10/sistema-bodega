export const LUGARES: Record<string, string> = { oficina: 'Oficina central', engie: 'Faenas ENGIE', sacyr: 'Faenas SACYR - EUROHINCA', sqm: 'Faenas SQM' }
export const MESES_C = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SET', 'OCT', 'NOV', 'DIC']
export const mesKey = (anio: number, m: number) => `${anio}-${String(m).padStart(2, '0')}`
export const mesHoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 7)

// Un ítem del programa aplica a una ubicación según el "lugar" (oficina / ENGIE / SACYR / SQM) con que se la clasificó.
export const aplica = (p: { lugares: string[] }, lugar?: string | null) => !lugar || p.lugares.includes(lugar)

export function estadoCelda(mes: string, hechas: number, requeridas: number, hoy = mesHoy()): 'ok' | 'parcial' | 'atraso' | 'futuro' | 'actual' {
  if (requeridas > 0 && hechas >= requeridas) return 'ok'
  if (hechas > 0 && requeridas === 0) return 'ok'
  if (hechas > 0) return mes < hoy ? 'atraso' : 'parcial'
  if (mes < hoy) return 'atraso'
  return mes === hoy ? 'actual' : 'futuro'
}
export const COLOR_CELDA = {
  ok: ['#d7efe0', '#14532d'], parcial: ['#fef7e0', '#986a00'], atraso: ['#fde8e8', '#9b1c1c'], actual: ['#e8f0fb', '#1B4F9C'], futuro: ['#f1f3f7', '#667085'],
} as const
