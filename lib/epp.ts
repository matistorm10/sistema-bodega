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

// ---- Stock mínimo por faena + ítem + talla (talla '' para EPP sin talla) ----
export type EvalMin = { item: any, ubic: any, talla: string, min: number, stock: number }
export const stockDe = (stock: any[], ubId: string, itemId: string, talla: string): number =>
  stock.find(s => s.ubicacion_id === ubId && s.item_id === itemId && (s.talla || '') === talla)?.stock || 0
export const minimoDe = (minimos: any[], ubId: string, itemId: string, talla: string): number =>
  minimos.find(m => m.ubicacion_id === ubId && m.item_id === itemId && (m.talla || '') === talla)?.minimo || 0
// Compara el stock contra cada mínimo definido (mínimo > 0). Ignora mínimos huérfanos (ítem inactivo o talla que no corresponde).
export function evaluarMinimos(minimos: any[], stock: any[], items: any[], ubics: any[]): EvalMin[] {
  const out: EvalMin[] = []
  minimos.forEach(m => {
    if (!(m.minimo > 0)) return
    const item = items.find(i => i.id === m.item_id); const ubic = ubics.find(u => u.id === m.ubicacion_id)
    if (!item || !ubic) return
    const talla = m.talla || ''
    if (item.usa_talla ? !talla : !!talla) return
    out.push({ item, ubic, talla, min: m.minimo, stock: stockDe(stock, ubic.id, item.id, talla) })
  })
  return out
}
export const etiquetaMin = (e: EvalMin) => `${e.item.nombre}${e.talla ? ' talla ' + e.talla : ''} · ${e.ubic.nombre}: ${e.stock} (mínimo ${e.min})`
