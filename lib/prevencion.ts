export const TIPOS_CHARLA: Record<string, string> = {
  charla_5min: 'Charla de 5 minutos',
  induccion: 'Inducción',
  capacitacion: 'Capacitación',
  otra: 'Otra',
}
export const fechaCL = (f?: string | null) => f ? f.slice(0, 10).split('-').reverse().join('-') : ''
