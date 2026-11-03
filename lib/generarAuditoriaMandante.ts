import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { entregarPDF } from '@/lib/abrirPDF'
import { cargarLogo } from '@/lib/generarGuiaTraslado'
import { AudItem, AudResp, AudDoc, resumen, vigencia, calificacion } from '@/lib/auditoriaMandante'

const fcl = (f?: string | null) => f ? f.split('-').reverse().join('-') : ''
const EST: Record<string, string> = { pendiente: 'Pendiente', cumple: 'Cumple', no_cumple: 'No cumple', na: 'N/A' }

export async function generarEstadoAuditoria(o: { formato: any, contrato: string, items: AudItem[], resp: Record<string, AudResp>, docs: AudDoc[] }, ventana: Window | null) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = 297, M = 10
  const AZUL: [number, number, number] = [27, 79, 156]
  const logo = await cargarLogo()
  const r = resumen(o.items, o.resp, o.docs, !!o.formato.usa_puntaje)
  const encabezado = () => {
    doc.setDrawColor(120); doc.setLineWidth(0.3); doc.rect(M, 8, W - 2 * M, 16); doc.line(M + 38, 8, M + 38, 24)
    if (logo) { const w = 32, h = Math.min(13, w * logo.ratio); doc.addImage(logo.data, 'JPEG', M + 3, 8 + (16 - h) / 2, w, h) }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(0)
    doc.text('ESTADO DE LEVANTAMIENTO · AUDITORÍA MANDANTE', M + 40 + (W - 2 * M - 40) / 2, 14, { align: 'center' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    doc.text(`${o.formato.nombre}${o.formato.codigo ? ' · ' + o.formato.codigo : ''}`, M + 40 + (W - 2 * M - 40) / 2, 20, { align: 'center' })
  }
  encabezado()
  const base = { styles: { fontSize: 8, cellPadding: 1.6, lineColor: [150, 150, 150] as [number, number, number], lineWidth: 0.2, textColor: 0 as any, valign: 'middle' as const },
    headStyles: { fillColor: [226, 232, 242] as [number, number, number], textColor: 0 as any, fontStyle: 'bold' as const }, margin: { left: M, right: M, top: 28 }, didDrawPage: encabezado }
  const k = { fontStyle: 'bold' as const, fillColor: [243, 245, 249] as [number, number, number] }
  autoTable(doc, { ...base, startY: 28, theme: 'grid', body: [
    [{ content: 'Contrato', styles: k }, o.contrato, { content: 'Fecha del informe', styles: k }, fcl(new Date().toISOString().slice(0, 10))],
    [{ content: 'Cumplimiento', styles: k }, `${r.pct.toFixed(1)}%${o.formato.usa_puntaje ? ' · ' + calificacion(r.pct) : ''}`, { content: 'Ítems', styles: k }, `Cumple ${r.nCumple} · No cumple ${r.nNo} · N/A ${r.nNa} · Pendientes ${r.pend} (de ${r.n})`],
    [{ content: 'Documentos', styles: k }, `${o.docs.length} cargados · ${r.porRevisar} por revisar`, { content: 'Vigencia', styles: k }, `${r.vencidos} vencido(s) · ${r.porVencer} por vencer (30 días)`],
  ] })
  const body: any[] = []
  let sec = ''
  for (const it of o.items) {
    if (it.seccion !== sec) { sec = it.seccion; body.push([{ content: sec, colSpan: 5, styles: { fontStyle: 'bold', fillColor: [226, 232, 242] } }]) }
    const rs = o.resp[it.id]
    const ds = o.docs.filter(d => d.item_id === it.id)
    const dtxt = ds.length ? ds.map(d => `• ${d.nombre}${d.vence ? ` (vence ${fcl(d.vence)}${vigencia(d.vence) === 'vencido' ? ' VENCIDO' : ''})` : ''} – ${d.revision === 'aprobado' ? 'aprobado' : d.revision === 'rechazado' ? 'rechazado' : 'por revisar'}`).join('\n') : '—'
    const plan = rs?.estado === 'no_cumple' && rs.accion ? `\nPlan: ${rs.accion}${rs.responsable ? ' · ' + rs.responsable : ''}${rs.plazo ? ' · ' + fcl(rs.plazo) : ''} (${rs.plan_estado || 'En ejecución'})` : ''
    body.push([it.numero || '', it.texto, EST[rs?.estado || 'pendiente'], dtxt, (rs?.obs || '') + plan])
  }
  autoTable(doc, { ...base, startY: (doc as any).lastAutoTable.finalY + 5, theme: 'grid', head: [['Nº', 'Ítem', 'Estado', 'Documentos de respaldo', 'Observaciones / plan']], body,
    styles: { ...base.styles, fontSize: 7.5 }, columnStyles: { 0: { cellWidth: 9, halign: 'center' }, 1: { cellWidth: 100 }, 2: { cellWidth: 20, halign: 'center' }, 3: { cellWidth: 85 } },
    didParseCell: (h: any) => { if (h.section === 'body' && h.column.index === 2) { const t = h.cell.raw; h.cell.styles.textColor = t === 'Cumple' ? [20, 83, 45] : t === 'No cumple' ? [155, 28, 28] : [90, 90, 90]; h.cell.styles.fontStyle = 'bold' } } })
  doc.setFontSize(8); doc.setTextColor(...AZUL)
  entregarPDF(doc, `Auditoria_Mandante_${o.formato.nombre.replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`, ventana)
}
