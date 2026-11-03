import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { entregarPDF } from '@/lib/abrirPDF'
import { cargarLogo } from '@/lib/generarGuiaTraslado'
import { ventana12, etiquetaMes } from '@/lib/capacitaciones'

const CORTO: Record<string, string> = { oficina: 'Oficina', engie: 'ENGIE', sacyr: 'SACYR-EUROHINCA', sqm: 'SQM' }
const largo = (k: string) => { const [y, m] = k.split('-').map(Number); return `${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][m - 1]} ${y}` }

// Calendario anual de capacitaciones de la empresa (12 meses), listo para imprimir y pegar
export async function generarCalendarioCapacitaciones(o: { prog: any[], desde: string }, ventana: Window | null) {
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
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(90)
    doc.text('Celda azul = mes en que se realiza la capacitación. Los APR registran cada capacitación realizada, con su asistencia firmada, en el sistema.', M, 205)
    doc.text(`Impreso el ${new Date().toLocaleDateString('es-CL')} · Página ${i} de ${n}`, W - M, 205, { align: 'right' })
  }
  entregarPDF(doc, `Calendario_Capacitaciones_${cols[0]}.pdf`, ventana)
}
