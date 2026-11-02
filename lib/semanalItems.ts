import { periodos, ultimoCierre, limiteEntrega, estadoSemanal, isoFecha, aFechaLocal, hhmm } from './semanal'

export type ItemSem = {
  key: string, cliente: any, fin: string, limite: string, hora: string,
  tipo: 'entregado' | 'tarde' | 'vigente' | 'atraso' | 'proximo', texto: string, inf: any | null,
}

// Semanas que le corresponden entregar a un prevencionista (desde que se le asignó el cliente) + la semana siguiente.
export function itemsSemanales(usuarioId: string, clientes: any[], asigs: any[], informes: any[], hoy = new Date()): ItemSem[] {
  const out: ItemSem[] = []
  for (const a of asigs.filter(x => x.usuario_id === usuarioId)) {
    const c = clientes.find(x => x.id === a.cliente_id && x.activo !== false)
    if (!c) continue
    const desde = a.created_at ? isoFecha(new Date(a.created_at)) : '0000-00-00'
    const hecho = new Set<string>()
    const ps = periodos(c.dia_cierre, 26, hoy).filter(fin => limiteEntrega(fin, c.dias_plazo) >= desde)
    for (const fin of ps) {
      if (hecho.has(fin)) continue; hecho.add(fin)
      const inf = informes.find(i => i.cliente_id === c.id && i.usuario_id === usuarioId && i.periodo_fin === fin) || null
      const limite = limiteEntrega(fin, c.dias_plazo)
      const e = estadoSemanal(fin, c.dias_plazo, !!inf, c.hora_limite, hoy)
      const tarde = !!inf && !!inf.created_at && isoFecha(new Date(inf.created_at)) > limite
      out.push({ key: `${c.id}|${fin}`, cliente: c, fin, limite, hora: hhmm(c.hora_limite), inf, tipo: tarde ? 'tarde' : e.tipo, texto: tarde ? 'Entregado con atraso' : e.texto })
    }
    // la semana que viene (aún no cierra)
    const d = aFechaLocal(ultimoCierre(c.dia_cierre, hoy)); d.setDate(d.getDate() + 7)
    const fin = isoFecha(d)
    out.push({ key: `${c.id}|${fin}`, cliente: c, fin, limite: limiteEntrega(fin, c.dias_plazo), hora: hhmm(c.hora_limite), inf: null, tipo: 'proximo', texto: `Cierra el ${fin.split('-').reverse().join('-')}` })
  }
  return out.sort((x, y) => x.limite.localeCompare(y.limite))
}
