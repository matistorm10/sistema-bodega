import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { cargarLogo, normalizarImagen } from '@/lib/generarGuiaTraslado'
import { ACTIVIDADES, ITEMS_CDR, ITEMS_ABC, COLS_EPP, COLS_BLOQUEO } from '@/lib/programa'
import { RBS } from '@/lib/rbs'
import { DS594 } from '@/lib/ds594'

export type RegistroPDF = {
  actividad: string, fecha: string, faena: string, nombre: string, cargo: string,
  datos: any, porcentaje: number | null,
  firma?: string | null, firmadoAt?: string | null,   // sin firmadoAt = vista previa
}
const R: Record<string, string> = { si: 'SÍ', no: 'NO', na: 'N/A', C: 'C', NC: 'NC', NA: 'NA' }
const fcl = (f?: string | null) => f ? f.slice(0, 10).split('-').reverse().join('-') : ''

export async function generarRegistroActividad(r: RegistroPDF): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 14, AZUL: [number, number, number] = [27, 79, 156]
  const meta = ACTIVIDADES[r.actividad]
  const d = r.datos || {}
  const logo = await cargarLogo()
  const firma = r.firma ? await normalizarImagen(r.firma) : null
  const preview = !r.firmadoAt

  const encabezado = () => {
    doc.setDrawColor(120); doc.setLineWidth(0.3); doc.rect(M, 8, W - 2 * M, 20); doc.line(M + 40, 8, M + 40, 28)
    if (logo) { const w = 34, h = Math.min(16, w * logo.ratio); doc.addImage(logo.data, 'JPEG', M + 3, 8 + (20 - h) / 2, w, h) }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(0)
    doc.text('PROGRAMA DE LIDERAZGO PERCIBIDO', M + 42 + (W - 2 * M - 42) / 2, 16, { align: 'center' })
    doc.setFontSize(10); doc.setTextColor(...AZUL)
    doc.text(meta.nombre.toUpperCase(), M + 42 + (W - 2 * M - 42) / 2, 22.5, { align: 'center', maxWidth: W - 2 * M - 46 })
    doc.setTextColor(0)
    if (preview) { doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(197, 34, 31); doc.text('VISTA PREVIA · SIN FIRMAR', W - M, 6, { align: 'right' }); doc.setTextColor(0) }
  }
  encabezado()

  const base = { styles: { fontSize: 8.5, cellPadding: 1.8, lineColor: [150, 150, 150] as [number, number, number], lineWidth: 0.2, textColor: 0 as any, valign: 'middle' as const },
    headStyles: { fillColor: [226, 232, 242] as [number, number, number], textColor: 0 as any, fontStyle: 'bold' as const }, margin: { left: M, right: M, top: 32 }, didDrawPage: encabezado }
  const k = { fontStyle: 'bold' as const, fillColor: [243, 245, 249] as [number, number, number] }
  const fin = () => (doc as any).lastAutoTable?.finalY ?? 32
  const titulo = (t: string) => { const y = fin() + 6; doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...AZUL); doc.text(t, M, y); doc.setTextColor(0); return y + 1.5 }

  // Datos generales
  const gen: [string, string][] = [['Realizado por', r.nombre], ['Cargo', r.cargo], ['Faena / centro de costo', r.faena], ['Fecha', fcl(r.fecha)]]
  if (d.hora) gen.push(['Hora', d.hora])
  if (d.empresa) gen.push(['Empresa', d.empresa])
  if (d.lugar) gen.push([r.actividad === 'verificacion_ds594' ? 'Sector auditado' : 'Lugar / área', d.lugar])
  if (d.tarea) gen.push(['Tarea', d.tarea])
  if (d.supervisor) gen.push(['Supervisor', d.supervisor])
  if (d.colaborador) gen.push(['Colaborador observado', d.colaborador])
  if (d.duracion) gen.push(['Duración', d.duracion])
  if (r.actividad === 'cdp_rbs' && d.rbs) { const rb = RBS.find(x => x.n === d.rbs); gen.push(['RBS', `N° ${d.rbs}${rb ? ' · ' + rb.titulo : ''}`]) }
  const filasGen: any[][] = []
  for (let i = 0; i < gen.length; i += 2) {
    const a = gen[i], b = gen[i + 1]
    filasGen.push([{ content: a[0], styles: k }, a[1], b ? { content: b[0], styles: k } : '', b ? b[1] : ''])
  }
  autoTable(doc, { ...base, startY: 34, theme: 'grid', body: filasGen, columnStyles: { 0: { cellWidth: 34 }, 2: { cellWidth: 34 } } })

  // Checklists SI / NO / N/A
  const resp = (i: number) => R[d.items?.[i]] || '—'
  if (r.actividad === 'confirmacion_rol') {
    autoTable(doc, { ...base, startY: titulo('Confirmación del rol'), head: [['Ítem', 'Resp.']], body: ITEMS_CDR.map((t, i) => [t, resp(i)]), columnStyles: { 1: { cellWidth: 16, halign: 'center', fontStyle: 'bold' } } })
  } else if (r.actividad === 'confirmacion_abc') {
    let n = 0
    const body: any[] = []
    ITEMS_ABC.forEach(g => { body.push([{ content: g.grupo, colSpan: 2, styles: k }]); g.items.forEach(t => { body.push([t, resp(n++)]) }) })
    autoTable(doc, { ...base, startY: titulo('Confirmación ABC'), head: [['Ítem', 'Resp.']], body, columnStyles: { 1: { cellWidth: 16, halign: 'center', fontStyle: 'bold' } } })
  } else if (r.actividad === 'cdp_rbs') {
    const rb = RBS.find(x => x.n === d.rbs)
    if (rb) autoTable(doc, { ...base, startY: titulo('Comportamientos observados'), head: [['Comportamiento', 'Resp.']], body: rb.items.map((t, i) => [t, resp(i)]), columnStyles: { 1: { cellWidth: 16, halign: 'center', fontStyle: 'bold' } } })
  } else if (r.actividad === 'verificacion_ds594') {
    let n = 0
    const body: any[] = []
    DS594.forEach(sec => { body.push([{ content: sec.titulo, colSpan: 3, styles: k }]); sec.items.forEach(it => { body.push([it.n, it.t, resp(n++)]) }) })
    autoTable(doc, { ...base, startY: titulo('Auditoría DS 594'), head: [['N°', 'Requisito', 'Resp.']], body, columnStyles: { 0: { cellWidth: 12 }, 2: { cellWidth: 14, halign: 'center', fontStyle: 'bold' } } })
    const det = Object.entries(d.det || {}).filter(([, v]: any) => v && (v.justif || v.accion))
    if (det.length) autoTable(doc, { ...base, startY: titulo('Plan de acción de los ítems «NO»'), head: [['Ítem', 'Justificación', 'Acción', 'Responsable', 'Fecha', 'Estado']], body: det.map(([n, v]: any) => [n, v.justif, v.accion, v.responsable, fcl(v.fecha), v.status]) })
  } else if (r.actividad === 'cdp_tarea_critica') {
    autoTable(doc, { ...base, startY: titulo('Resultado de la observación'), theme: 'grid', body: [[{ content: 'Comportamientos seguros', styles: k }, String(d.n_seguros ?? ''), { content: 'Oportunidades de mejora', styles: k }, String(d.n_oport ?? '')]] })
    const lista = (a: string[]) => (a || []).filter(x => x && x.trim()).map((x, i) => [String(i + 1), x])
    const f = lista(d.fortalezas), o = lista(d.oportunidades)
    if (f.length) autoTable(doc, { ...base, startY: titulo('Fortalezas'), head: [['N°', 'Fortaleza']], body: f, columnStyles: { 0: { cellWidth: 10 } } })
    if (o.length) autoTable(doc, { ...base, startY: titulo('Oportunidades de mejora'), head: [['N°', 'Oportunidad']], body: o, columnStyles: { 0: { cellWidth: 10 } } })
    if ((d.compromisos_lista || []).length) autoTable(doc, { ...base, startY: titulo('Compromisos'), head: [['Compromiso', 'Responsable', 'Plazo']], body: d.compromisos_lista.map((c: any) => [c.texto, c.responsable, c.plazo]) })
  } else if (r.actividad === 'inspeccion_epp' || r.actividad === 'inspeccion_bloqueo') {
    const cols = r.actividad === 'inspeccion_epp' ? COLS_EPP : COLS_BLOQUEO
    autoTable(doc, { ...base, startY: titulo('Matriz de inspección (C = conforme · NC = no conforme · NA = no aplica)'), styles: { ...base.styles, fontSize: 7.5, cellPadding: 1.2, halign: 'center' },
      head: [['Trabajador', ...cols, 'Obs.']], body: (d.filas || []).map((f: any) => [f.nombre, ...cols.map((_: string, i: number) => R[f.vals?.[i]] || '—'), f.obs || '']), columnStyles: { 0: { halign: 'left' } } })
    if ((d.hallazgos || []).length) autoTable(doc, { ...base, startY: titulo('Hallazgos'), head: [['Trabajador', 'Hallazgo', 'Acción', 'Responsable']], body: d.hallazgos.map((h: any) => [h.trabajador, h.hallazgo, h.accion, h.responsable]) })
  }

  // Textos libres
  const libres: [string, string][] = []
  if (d.compromisos) libres.push(['Compromisos', d.compromisos])
  if (d.feedback) libres.push(['Feedback', d.feedback])
  if (d.fortalezas_txt) libres.push(['Fortalezas', d.fortalezas_txt])
  if (d.oportunidades_txt) libres.push(['Oportunidades de mejora', d.oportunidades_txt])
  if (d.peligro) libres.push(['Peligro identificado', d.peligro])
  if (d.oport_levantadas || d.oport_vencidas) libres.push(['Oportunidades', `Levantadas: ${d.oport_levantadas || 0} · Vencidas: ${d.oport_vencidas || 0}`])
  if (libres.length) autoTable(doc, { ...base, startY: titulo('Observaciones'), theme: 'grid', body: libres.map(([a, b]) => [{ content: a, styles: k }, b]), columnStyles: { 0: { cellWidth: 40 } } })

  // Resultado y firma
  let y = fin() + 8
  if (y > 235) { doc.addPage(); encabezado(); y = 40 }
  if (r.porcentaje !== null && r.porcentaje !== undefined) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...AZUL)
    doc.text(`Porcentaje de cumplimiento: ${r.porcentaje}%`, M, y); doc.setTextColor(0); y += 9
  }
  doc.setDrawColor(120); doc.setLineWidth(0.3); doc.rect(M, y, W - 2 * M, 38)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.text('Firma electrónica del responsable', M + 3, y + 6)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  if (preview) {
    doc.setTextColor(197, 34, 31); doc.text('Pendiente de firma. Al confirmar, el documento será firmado con tu firma y quedará guardado.', M + 3, y + 22, { maxWidth: W - 2 * M - 6 }); doc.setTextColor(0)
  } else {
    if (firma) { const h = 18, w = Math.min(55, h * firma.w / firma.h); doc.addImage(firma.data, 'PNG', M + 3, y + 9, w, w * firma.h / firma.w) }
    doc.line(M + 3, y + 28, M + 80, y + 28)
    doc.text(r.nombre + (r.cargo ? ` · ${r.cargo}` : ''), M + 3, y + 32.5)
    const fh = new Date(r.firmadoAt!).toLocaleString('es-CL', { timeZone: 'America/Santiago', dateStyle: 'short', timeStyle: 'short' })
    doc.text(`Firmado electrónicamente el ${fh}`, M + 100, y + 32.5)
  }

  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120); doc.text(`INDELI Construcción y Montaje Ltda. · Sistema INDELI · ${r.nombre} · ${fcl(r.fecha)} · Página ${i} de ${n}`, W / 2, 291, { align: 'center' }) }
  return doc.output('blob')
}
