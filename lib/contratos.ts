// Documentación por contrato: estados y categorías
export const CATEGORIAS = [['PTS', 'Procedimientos de Trabajo Seguro (PTS)'], ['Matriz', 'Matrices'], ['Plan de emergencia', 'Planes de emergencia'], ['Otro', 'Otros documentos']] as const
export const ESTADOS_DOC = ['En creación', 'Enviado a aprobación', 'Observado', 'Aprobado', 'En modificación'] as const
export const COLOR_DOC: Record<string, [string, string]> = {
  'En creación': ['#f1f3f7', '#475467'],
  'Enviado a aprobación': ['#fef7e0', '#986a00'],
  'Observado': ['#fde8e8', '#9b1c1c'],
  'Aprobado': ['#e7f6ec', '#14532d'],
  'En modificación': ['#e8f0fe', '#1B4F9C'],
}
export const diasDesde = (iso?: string | null) => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : 0
