import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { entregarPDF } from '@/lib/abrirPDF'
import { cargarLogo, normalizarImagen } from '@/lib/generarGuiaTraslado'
import type { DatosInforme } from '@/lib/informeDiario'

const sn = (v: string) => v === 'si' ? 'Sí' : v === 'no' ? 'No' : '—'
const ce = (v: string) => v === 'C' ? 'Conforme' : v === 'NC' ? 'No conforme' : v === 'NA' ? 'N/A' : '—'

export async function generarInformeDiario(o: { fecha: string, faena: string, elaboro: string, d: DatosInforme, cerradoAt?: string | null, firma?: string | null }, ventana: Window | null) {
  const { d } = o
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 12
  const AZUL: [number, number, number] = [27, 79, 156]
  const logo = await cargarLogo()
  const firma = o.firma ? await normalizarImagen(o.firma) : null
  const fecha = o.fecha.split('-').reverse().join('-')

  const encabezado = () => {
    doc.setDrawColor(120); doc.setLineWidth(0.3); doc.rect(M, 8, W - 2 * M, 18); doc.line(M + 38, 8, M + 38, 26)
    if (logo) { const w = 32, h = Math.min(15, w * logo.ratio); doc.addImage(logo.data, 'JPEG', M + 3, 8 + (18 - h) / 2, w, h) }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(0)
    doc.text('INDELI MONTAJE Y CONSTRUCCIÓN LIMITADA', M + 40 + (W - 2 * M - 40) / 2, 15, { align: 'center' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    doc.text('ÁREA DE SEGURIDAD Y SALUD OCUPACIONAL', M + 40 + (W - 2 * M - 40) / 2, 21, { align: 'center' })
  }
  encabezado()
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...AZUL)
  doc.text('INFORME DIARIO DE SEGURIDAD Y SALUD OCUPACIONAL', W / 2, 35, { align: 'center' })

  const base = { styles: { fontSize: 8.5, cellPadding: 1.8, lineColor: [150, 150, 150] as [number, number, number], lineWidth: 0.2, textColor: 0 as any },
    headStyles: { fillColor: [226, 232, 242] as [number, number, number], textColor: 0 as any, fontStyle: 'bold' as const }, margin: { left: M, right: M, top: 30 }, didDrawPage: encabezado }
  const k = { fontStyle: 'bold' as const, fillColor: [243, 245, 249] as [number, number, number] }
  const titulo = (t: string) => { const y = ((doc as any).lastAutoTable?.finalY ?? 38) + 5; doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...AZUL); doc.text(t, M, y); doc.setTextColor(0); return y + 1.5 }
  const tabla = (t: string, head: string[], body: string[][]) => autoTable(doc, { ...base, startY: titulo(t), head: [head], body: body.length ? body : [head.map(() => '')] })

  autoTable(doc, { ...base, startY: 39, theme: 'grid', body: [
    [{ content: 'Faena / proyecto', styles: k }, o.faena, { content: 'Contrato', styles: k }, d.contrato],
    [{ content: 'Fecha', styles: k }, fecha, { content: 'Turno / horario', styles: k }, d.turno],
    [{ content: 'Elaborado por', styles: k }, o.elaboro, { content: 'Cargo', styles: k }, d.cargo],
    [{ content: 'Empresa mandante', styles: k }, d.mandante, { content: 'Dotación INDELI', styles: k }, `H: ${d.dotH || '—'}   M: ${d.dotM || '—'}   Total: ${(Number(d.dotH) || 0) + (Number(d.dotM) || 0)}`],
  ] })
  autoTable(doc, { ...base, startY: titulo('1 Resumen de la jornada'), theme: 'grid', body: [
    [{ content: 'Área / frente', styles: k }, d.area, { content: 'Tarea principal', styles: k }, d.tarea],
    [{ content: 'Trabajos críticos', styles: k }, d.criticos, { content: 'PTS / permiso', styles: k }, d.pts],
  ] })
  const llenas = (f: Record<string, string>[], cols: string[]) => f.filter(r => cols.some(c => (r[c] || '').trim())).map(r => cols.map(c => r[c] || ''))
  tabla('2 Actividades preventivas realizadas', ['Actividad', 'Cantidad', 'Área / participantes', 'Resultado u observación'], llenas(d.actividades, ['actividad', 'cantidad', 'area', 'resultado']))
  tabla('3 Condiciones de seguridad y salud ocupacional', ['Fortalezas o debilidades', 'Conforme / No conforme / N/A', 'Observación'],
    d.condiciones.filter(c => c.estado || c.obs).map(c => [c.item, ce(c.estado), c.obs || '']))
  autoTable(doc, { ...base, startY: titulo('4 Incidentes y atención de salud'), theme: 'grid', body: [
    [{ content: 'Incidentes', styles: k }, sn(d.incidentes), { content: 'Atenciones', styles: k }, sn(d.atenciones)],
    [{ content: 'Descripción / folio', styles: k }, { content: d.descIncidente || '', colSpan: 3 }],
  ] })
  tabla('5 Oportunidades de mejora', ['N°', 'Oportunidad de mejora', 'Acción inmediata', 'Compromiso', 'Responsable', 'Plazo / estado'],
    d.mejoras.filter(r => Object.values(r).some(v => v.trim())).map((r, i) => [String(i + 1), r.oportunidad, r.accion, r.compromiso, r.responsable, r.plazo]))
  tabla('6 Coordinaciones y comunicaciones relevantes', ['Hora', 'Con quién / área', 'Tema e instrucción o acuerdo'], llenas(d.coordinaciones, ['hora', 'con', 'tema']))
  tabla('7 Pendientes para el siguiente turno', ['Pendiente', 'Responsable', 'Fecha comprometida'], llenas(d.pendientes, ['pendiente', 'responsable', 'fecha']))
  autoTable(doc, { ...base, startY: titulo('8 Cierre de la jornada'), theme: 'grid', body: [
    [{ content: 'Sin novedades', styles: k }, sn(d.sinNovedades), { content: 'Reporte al cliente', styles: k }, sn(d.reporteCliente)],
    [{ content: 'Hora de cierre', styles: k }, d.horaCierre, { content: 'Próximo turno', styles: k }, d.proximoTurno],
    [{ content: 'Observaciones generales', styles: k }, { content: d.observaciones || '', colSpan: 3 }],
  ] })

  let y = (doc as any).lastAutoTable.finalY + 8
  if (y > 245) { doc.addPage(); encabezado(); y = 40 }
  doc.setDrawColor(120); doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(0)
  if (firma) { const h = 16, w = Math.min(45, h * firma.w / firma.h); doc.addImage(firma.data, 'PNG', M + 10, y, w, w * firma.h / firma.w) }
  doc.line(M, y + 18, M + 80, y + 18); doc.line(W - M - 80, y + 18, W - M, y + 18)
  doc.setFont('helvetica', 'bold'); doc.text('Elaboró / APR INDELI', M, y + 23); doc.text('Revisó / Supervisor', W - M - 80, y + 23)
  doc.setFont('helvetica', 'normal')
  doc.text(`Nombre: ${o.elaboro}`, M, y + 28); doc.text(`Nombre: ${d.supervisor || '____________________'}`, W - M - 80, y + 28)
  doc.text(`Fecha y hora: ${o.cerradoAt ? new Date(o.cerradoAt).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '____________'}`, M, y + 33)
  doc.text('Fecha y hora: ____________________', W - M - 80, y + 33)

  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120); doc.text(`Informe diario SSO · ${o.faena} · ${fecha} · Página ${i} de ${n}`, W / 2, 291, { align: 'center' }) }
  entregarPDF(doc, `Informe_diario_SSO_${o.faena.replace(/\s+/g, '_')}_${o.fecha}.pdf`, ventana)
}
