import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { entregarPDF } from '@/lib/abrirPDF'
import { cargarLogo } from '@/lib/generarGuiaTraslado'
import { ventana12, etiquetaMes } from '@/lib/capacitaciones'
import { VersionCap, FIRMAS_CAP, firmaDe } from '@/lib/capVersiones'

const CORTO: Record<string, string> = { oficina: 'Oficina', engie: 'ENGIE', sacyr: 'SACYR-EUROHINCA', sqm: 'SQM' }
const largo = (k: string) => { const [y, m] = k.split('-').map(Number); return `${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][m - 1]} ${y}` }

// Calendario anual de capacitaciones de la empresa (12 meses), listo para imprimir y pegar
export async function generarCalendarioCapacitaciones(o: { prog: any[], desde: string, version?: VersionCap | null }, ventana: Window | null) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = 297, M = 8
  const cols = ventana12(o.desde)
  const logo = await cargarLogo()
  const prog = o.prog.filter(p => p.activo !== false && Object.keys(p.meses || {}).some(k => cols.includes(k))).sort((a, b) => (a.categoria || '').localeCompare(b.categoria || '') || a.n - b.n)
  const encabezado = () => {
    doc.setDrawColor(120); doc.setLineWidth(0.3); doc.rect(M, 6, W - 2 * M, 16); doc.line(M + 38, 6, M + 38, 22)
    if (logo) { const w = 32, h = Math.min(13, w * logo.ratio); doc.addImage(logo.data, 'JPEG', M + 3, 6 + (16 - h) / 2, w, h) }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(0)
    doc.text('CALENDARIO DE CAPACITACIONES', M + 40 + (W - 2 * M - 40) / 2, 13, { align: 'center' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    doc.text(`${largo(cols[0])} a ${largo(cols[11])}`, M + 40 + (W - 2 * M - 40) / 2, 19, { align: 'center' })
  }
  encabezado()
  const body: any[] = []
  let cat = ''
  for (const p of prog) {
    if ((p.categoria || 'Otras') !== cat) { cat = p.categoria || 'Otras'; body.push([{ content: cat, colSpan: 3 + 12, styles: { fontStyle: 'bold', fillColor: [226, 232, 242], textColor: 0 } }]) }
    const lug: string[] = p.lugares || []
    body.push([p.n, p.tematica, `${p.horas ? p.horas + ' h · ' : ''}${lug.length >= 4 ? 'Todos' : lug.map(l => CORTO[l] || l).join(', ')}`, ...cols.map(k => p.meses?.[k] ? 'X' : '')])
  }
  autoTable(doc, {
    startY: 26, theme: 'grid', margin: { left: M, right: M, top: 26, bottom: 14 }, didDrawPage: encabezado,
    head: [['N°', 'Temática', 'Horas · Aplica a', ...cols.map(etiquetaMes)]], body,
    styles: { fontSize: 7.5, cellPadding: 1.4, lineColor: [150, 150, 150], lineWidth: 0.2, textColor: 0, valign: 'middle' },
    headStyles: { fillColor: [27, 79, 156], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 7 },
    columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: 82 }, 2: { cellWidth: 38 }, ...Object.fromEntries(cols.map((_, i) => [3 + i, { cellWidth: 13.4, halign: 'center' }])) },
    didParseCell: d => { if (d.section === 'body' && d.column.index >= 3 && d.cell.raw === 'X') { d.cell.styles.fillColor = [27, 79, 156]; d.cell.text = [''] } },
  })
  // Bloque de firmas (versión vigente): Elabora · Revisa · Aprueba
  if (o.version) {
    const v = o.version
    let y = ((doc as any).lastAutoTable?.finalY || 40) + 8
    const alto = 38
    if (y + alto > 198) { doc.addPage(); y = 30 }
    const bw = (W - 2 * M - 8) / 3
    FIRMAS_CAP.forEach((f, i) => {
      const x = M + i * (bw + 4), s = firmaDe(v, f.k)
      doc.setDrawColor(120); doc.setLineWidth(0.3); doc.rect(x, y, bw, alto)
      if (f.k === 'revisa' && (v.revisiones?.length || 0) > 1) {
        const rs = v.revisiones!, sw = bw / rs.length
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(0)
        doc.text('REVISA · ADMINISTRADOR DE CONTRATO', x + bw / 2, y + 5, { align: 'center' })
        rs.forEach((r, j) => {
          const cx = x + j * sw
          if (r.firma) { try { doc.addImage(r.firma, 'PNG', cx + sw / 2 - Math.min(18, sw / 2 - 3), y + 7, Math.min(36, sw - 6), 15) } catch { /* firma ilegible */ } }
          doc.line(cx + 4, y + 24, cx + sw - 4, y + 24)
          doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.text(r.nombre || '—', cx + sw / 2, y + 28.5, { align: 'center', maxWidth: sw - 4 })
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
          doc.text(r.firmado_at ? new Date(r.firmado_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '', cx + sw / 2, y + 36, { align: 'center' })
        })
        return
      }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(0)
      doc.text(f.t.toUpperCase(), x + bw / 2, y + 5, { align: 'center' })
      if (s.firma) { try { doc.addImage(s.firma, 'PNG', x + bw / 2 - 20, y + 7, 40, 15) } catch { /* firma ilegible */ } }
      doc.line(x + 8, y + 24, x + bw - 8, y + 24)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
      doc.text(s.nombre || '—', x + bw / 2, y + 28.5, { align: 'center' })
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
      doc.text(f.cargo, x + bw / 2, y + 32.5, { align: 'center' })
      doc.text(s.at ? new Date(s.at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '', x + bw / 2, y + 36, { align: 'center' })
    })
  }
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(90)
    doc.text('Celda azul = mes en que se realiza la capacitación. Los APR registran cada capacitación realizada, con su asistencia firmada, en el sistema.', M, 205)
    doc.text(`${o.version ? `Revisión ${(o.version.revision || '').trim() || o.version.numero} · ` : ''}Impreso el ${new Date().toLocaleDateString('es-CL')} · Página ${i} de ${n}`, W - M, 205, { align: 'right' })
  }
  entregarPDF(doc, `Calendario_Capacitaciones_${cols[0]}.pdf`, ventana)
}
