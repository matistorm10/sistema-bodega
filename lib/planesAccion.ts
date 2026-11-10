import { hoyISO } from './estadoPlan'

// Oportunidades de mejora / planes de acción que se levantan en el programa de liderazgo y que hay que cerrar con evidencia:
//  · ítems «NO» de las listas DS 594 y DS 132 (datos.det)  ·  compromisos del CdP de tarea crítica (datos.compromisos_lista)
export type PlanItem = {
  act: any, clave: { tipo: 'det' | 'comp', k: string | number }, ref: string,
  texto: string, responsable: string, plazo: string, cerrado: boolean, cierre?: any,
}

export function extraerPlanes(a: any): PlanItem[] {
  const d = a.datos || {}, out: PlanItem[] = []
  if (a.actividad === 'verificacion_ds594' || a.actividad === 'verificacion_ds132') {
    Object.entries(d.det || {}).forEach(([n, v]: any) => {
      if (!v || !(v.accion || v.justif)) return
      out.push({ act: a, clave: { tipo: 'det', k: n }, ref: `Ítem ${n}`, texto: v.accion || v.justif, responsable: v.responsable || '', plazo: v.fecha || '', cerrado: v.status === 'Ejecutado' || v.status === 'Cerrado' || !!v.cierre, cierre: v.cierre })
    })
  } else if (a.actividad === 'cdp_tarea_critica') {
    ;(d.compromisos_lista || []).forEach((c: any, i: number) => {
      if (!c?.texto || !c.plazo) return
      out.push({ act: a, clave: { tipo: 'comp', k: i }, ref: `Compromiso ${i + 1}`, texto: c.texto, responsable: c.responsable || '', plazo: c.plazo, cerrado: !!c.cierre || c.estado === 'Ejecutado', cierre: c.cierre })
    })
  }
  return out
}

export const diasHasta = (plazo: string) => Math.round((Date.parse(plazo + 'T12:00:00') - Date.parse(hoyISO() + 'T12:00:00')) / 86400000)

// Estado visible: en plazo (con los días que faltan), vence hoy, pendiente (plazo excedido) o cerrada
export function estadoPlazo(p: PlanItem): { txt: string, bg: string, col: string, orden: number } {
  if (p.cerrado) return { txt: '✔ Cerrada', bg: '#e7f6ec', col: '#14532d', orden: 9999 }
  if (!p.plazo) return { txt: 'Sin plazo', bg: '#f2f4f7', col: '#475467', orden: 5000 }
  const d = diasHasta(p.plazo)
  if (d < 0) return { txt: `Pendiente · ${-d} día${d === -1 ? '' : 's'} de atraso`, bg: '#fde8e8', col: '#9b1c1c', orden: d }
  if (d === 0) return { txt: 'Vence hoy', bg: '#fff3cd', col: '#7a4b00', orden: 0 }
  return { txt: `En plazo · faltan ${d} día${d === 1 ? '' : 's'}`, bg: d <= 3 ? '#fff3cd' : '#e8f0fe', col: d <= 3 ? '#7a4b00' : '#1B4F9C', orden: d }
}

// Devuelve una copia de datos con el cierre aplicado al ítem
export function aplicarCierre(datos: any, clave: PlanItem['clave'], cierre: any) {
  const nd = JSON.parse(JSON.stringify(datos || {}))
  if (clave.tipo === 'det') nd.det[clave.k] = { ...nd.det[clave.k], status: 'Ejecutado', cierre }
  else nd.compromisos_lista[clave.k as number] = { ...nd.compromisos_lista[clave.k as number], estado: 'Ejecutado', cierre }
  return nd
}
