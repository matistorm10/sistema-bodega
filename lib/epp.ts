// Tallas predefinidas para el catálogo de EPP (evita escribir la talla a mano y equivocarse)
export type TipoTalla = 'calzado' | 'ropa' | 'guante' | 'otra'
export const TIPOS_TALLA: Record<TipoTalla, string> = { calzado: 'Calzado (35–47)', ropa: 'Ropa (XS–XXXL)', guante: 'Guantes (6–11 / S–XL)', otra: 'Otra (personalizada)' }
const PRESET: Record<Exclude<TipoTalla, 'otra'>, string[]> = {
  calzado: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47'],
  ropa: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
  guante: ['6', '7', '8', '9', '10', '11', 'S', 'M', 'L', 'XL'],
}
export function tallasDe(item: any): string[] {
  if (!item?.usa_talla) return []
  if (item.tipo_talla === 'otra') return (item.tallas || []) as string[]
  return PRESET[(item.tipo_talla as Exclude<TipoTalla, 'otra'>) || 'ropa'] || PRESET.ropa
}
// orden natural: números primero (ascendente), luego letras en orden de PRESET.ropa
export function ordenTalla(a: string, b: string): number {
  const na = Number(a), nb = Number(b)
  if (!isNaN(na) && !isNaN(nb)) return na - nb
  if (!isNaN(na)) return -1
  if (!isNaN(nb)) return 1
  const r = PRESET.ropa, ia = r.indexOf(a), ib = r.indexOf(b)
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b)
}
