// Estado del plan de acción (DS 594): se guarda «En ejecución» o «Ejecutado»; «Pendiente» se calcula
// solo cuando está en ejecución y ya pasó la fecha comprometida.
export const hoyISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
export function estadoPlan(status?: string, fecha?: string): 'En ejecución' | 'Ejecutado' | 'Pendiente' {
  if (status === 'Ejecutado' || status === 'Cerrado') return 'Ejecutado'
  if (fecha && fecha < hoyISO()) return 'Pendiente'
  return 'En ejecución'
}
export const COLOR_PLAN: Record<string, [string, string]> = {
  'En ejecución': ['#e8f0fe', '#1B4F9C'], 'Ejecutado': ['#e7f6ec', '#14532d'], 'Pendiente': ['#fde8e8', '#9b1c1c'],
}
