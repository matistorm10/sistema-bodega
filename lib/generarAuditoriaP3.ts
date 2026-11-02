import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { entregarPDF } from '@/lib/abrirPDF'
import { cargarLogo, normalizarImagen } from '@/lib/generarGuiaTraslado'
import { P3_ITEMS, P3_SECCIONES, P3_TOTAL_PUNTOS, resultadoP3 } from '@/lib/p3'
import { estadoPlan } from '@/lib/estadoPlan'

export type DatosP3 = {
  ident: Record<string, string>, cont: Record<string, string>,
  resp: Record<string, { r?: string, obs?: string }>, notas: string,
  plan: Record<string, { accion?: string, responsable?: string, fecha?: string, status?: string, evidencia?: string, evidenciaNombre?: string }>,
  part: Record<string, { nombre?: string, fecha?: string }>,
}
export const p3Nuevo = (): DatosP3 => ({ ident: {}, cont: {}, resp: {}, notas: '', plan: {}, part: {} })

const fcl = (f?: string) => f ? f.split('-').reverse().join('-') : ''

export async function generarAuditoriaP3(o: { fecha: string, contrato: string, d: DatosP3, aprNombre: string, cerradoAt?: string | null, firma?: string | null }, ventana: Window | null) {
  const { d } = o
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = 297, M = 10
  const AZUL: [number, number, number] = [27, 79, 156]
  const logo = await cargarLogo()
  const firma = o.firma ? await normalizarImagen(o.firma) : null
  const res = resultadoP3(d.resp)

  const encabezado = () => {
    doc.setDrawColor(120); doc.setLineWidth(0.3); doc.rect(M, 8, W - 2 * M, 18); doc.line(M + 38, 8, M + 38, 26); doc.line(W - M - 50, 8, W - M - 50, 26)
    if (logo) { const w = 32, h = Math.min(15, w * logo.ratio); doc.addImage(logo.data, 'JPEG', M + 3, 8 + (18 - h) / 2, w, h) }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(0)
    doc.text('ETAPA 3: AUDITORÍA DE CALIFICACIÓN / CUMPLIMIENTO LEGAL', M + 40 + (W - 2 * M - 90) / 2, 14, { align: 'center' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    doc.text('Reglamento de Contratistas y Subcontratistas SQM · Sistema de Gestión de Salud y Seguridad en el Trabajo', M + 40 + (W - 2 * M - 90) / 2, 20, { align: 'center' })
    doc.text('Código: REG-PR-004', W - M - 48, 14); doc.text('Versión: 002', W - M - 48, 20)
  }
  encabezado()
  const base = { styles: { fontSize: 8, cellPadding: 1.6, lineColor: [150, 150, 150] as [number, number, number], lineWidth: 0.2, textColor: 0 as any, valign: 'middle' as const },
    headStyles: { fillColor: [226, 232, 242] as [number, number, number], textColor: 0 as any, fontStyle: 'bold' as const }, margin: { left: M, right: M, top: 30 }, didDrawPage: encabezado }
  const k = { fontStyle: 'bold' as const, fillColor: [243, 245, 249] as [number, number, number] }
  const titulo = (t: string, y0?: number) => { const y = y0 ?? ((doc as any).lastAutoTable?.finalY ?? 30) + 5; if (y > 185) { doc.addPage(); return titulo(t, 34) } doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...AZUL); doc.text(t, M, y); doc.setTextColor(0); return y + 1.5 }

  const i = d.ident, c = d.cont
  autoTable(doc, { ...base, startY: titulo('IDENTIFICACIÓN EMPRESA EVALUADA', 33), theme: 'grid', body: [
    [{ content: 'RUT', styles: k }, i.rutEmp || '', { content: 'Razón social', styles: k }, i.razon || '', { content: 'Nombre de fantasía', styles: k }, i.fantasia || ''],
    [{ content: 'Rut administrador', styles: k }, i.rutAdm || '', { content: 'Nombre y apellidos', styles: k }, i.nomAdm || '', { content: 'Correo electrónico', styles: k }, i.mailAdm || ''],
    [{ content: 'Rut APR', styles: k }, i.rutApr || '', { content: 'Nombre y apellidos', styles: k }, i.nomApr || o.aprNombre, { content: 'Correo electrónico', styles: k }, i.mailApr || ''],
    [{ content: 'Teléfonos empresa', styles: k }, i.telEmp || '', { content: 'Dirección empresa', styles: k }, i.dirEmp || '', { content: 'Correo electrónico empresa', styles: k }, i.mailEmp || ''],
  ] })
  autoTable(doc, { ...base, startY: titulo('ANTECEDENTES DEL CONTRATO'), theme: 'grid', body: [
    [{ content: 'Nombre del contrato / Número', styles: k }, { content: o.contrato || c.nombre || '', colSpan: 5 }],
    [{ content: 'Dotación actual en faena', styles: k }, c.dotacion || '', { content: 'Fecha inicio contrato', styles: k }, fcl(c.ini), { content: 'Fecha término contrato', styles: k }, fcl(c.fin)],
    [{ content: 'Vicepresidencia', styles: k }, c.vp || '', { content: 'Gerencia', styles: k }, c.ger || '', { content: 'Superintendencia', styles: k }, c.sup || ''],
    [{ content: 'Nombre contacto contratos SQM', styles: k }, c.contacto || '', { content: 'Nombre ITO SQM', styles: k }, c.ito || '', { content: 'Nombre APR SQM', styles: k }, c.aprSqm || ''],
  ] })
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.text(`Fecha de la auditoría: ${fcl(o.fecha)}`, W - M, 33, { align: 'right' })

  // Ítems
  const body: any[] = []
  let sec = -1
  for (const it of P3_ITEMS) {
    if (it.s !== sec) { sec = it.s; body.push([{ content: P3_SECCIONES[sec], colSpan: 7, styles: { fontStyle: 'bold', fillColor: [226, 232, 242] } }]) }
    const r = d.resp[it.n]?.r
    body.push([it.n, it.t, r === 'SI' ? 'X' : '', r === 'NO' ? 'X' : '', r === 'NA' ? 'X' : '', it.p, d.resp[it.n]?.obs || ''])
  }
  autoTable(doc, { ...base, startY: titulo('ÍTEMES DE EVALUACIÓN'), theme: 'grid', head: [['Nº', 'Ítemes de evaluación', 'SI', 'NO', 'NA', 'Puntaje', 'Observaciones']], body,
    columnStyles: { 0: { cellWidth: 9, halign: 'center' }, 1: { cellWidth: 125 }, 2: { cellWidth: 9, halign: 'center' }, 3: { cellWidth: 9, halign: 'center' }, 4: { cellWidth: 9, halign: 'center' }, 5: { cellWidth: 14, halign: 'center' }, 6: { cellWidth: 'auto' } }, styles: { ...base.styles, fontSize: 7.5 } })

  autoTable(doc, { ...base, startY: titulo('RESULTADO AUDITORÍA DE CALIFICACIÓN'), theme: 'grid',
    head: [['SI', 'NO', 'NA', 'Puntaje total', 'Puntos obtenidos', 'Puntos NA', '% cumplimiento', 'Calificación']],
    body: [[
      P3_ITEMS.filter(x => d.resp[x.n]?.r === 'SI').length, P3_ITEMS.filter(x => d.resp[x.n]?.r === 'NO').length, P3_ITEMS.filter(x => d.resp[x.n]?.r === 'NA').length,
      P3_TOTAL_PUNTOS, res.obt, res.na, `${res.pct.toFixed(1)}%`, res.cal.toUpperCase(),
    ]], styles: { ...base.styles, halign: 'center', fontSize: 9 } })
  autoTable(doc, { ...base, startY: titulo('NOTAS / OBSERVACIONES'), theme: 'grid', body: [[d.notas || ' ']] })

  // Plan de acción
  const noItems = P3_ITEMS.filter(x => d.resp[x.n]?.r === 'NO')
  doc.addPage()
  autoTable(doc, { ...base, startY: titulo('PLAN DE ACCIÓN · Verificación de cumplimiento SGSST · Empresas contratistas SQM', 34), theme: 'grid',
    head: [['Nº', 'Acciones de mejoramiento propuestas', 'Responsables', 'Fecha cumplimiento', 'Estatus']],
    body: noItems.length ? noItems.map(x => { const p = d.plan[x.n] || {}; return [x.n, p.accion || '', p.responsable || '', fcl(p.fecha), estadoPlan(p.status, p.fecha)] }) : [['', 'Sin incumplimientos: no requiere plan de acción.', '', '', '']],
    columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 3: { cellWidth: 32, halign: 'center' }, 4: { cellWidth: 30, halign: 'center' } } })

  // Revisión / aprobación
  const filas = [
    ['Auditor Gestión de Riesgos SQM', d.part.auditor?.nombre, d.part.auditor?.fecha],
    ['Representante Empresa Ctta.', d.part.rep?.nombre, d.part.rep?.fecha],
    ['Asesor de Prevención de Riesgos Ctta.', `${o.aprNombre} (APR)`, o.cerradoAt ? o.cerradoAt.slice(0, 10) : ''],
    ['Toma conocimiento ITO SQM', d.part.ito?.nombre, d.part.ito?.fecha],
  ]
  autoTable(doc, { ...base, startY: titulo('REVISIÓN / APROBACIÓN'), theme: 'grid', head: [['Participantes evaluación', 'Nombre / Cargo', 'Fecha', 'Firma']],
    body: filas.map(f => [f[0] || '', f[1] || '', fcl(f[2] || ''), '']), styles: { ...base.styles, minCellHeight: 14 },
    columnStyles: { 0: { cellWidth: 70 }, 2: { cellWidth: 30, halign: 'center' }, 3: { cellWidth: 60 } },
    didDrawCell: (h: any) => { if (firma && h.section === 'body' && h.row.index === 2 && h.column.index === 3) doc.addImage(firma.data, 'PNG', h.cell.x + 2, h.cell.y + 1, 30, Math.min(12, 30 * firma.h / firma.w)) } })
  doc.setFontSize(7.5); doc.setTextColor(100); doc.text('c.c. CCTA, Depto Contratos, Gerencia, Archivo', M, (doc as any).lastAutoTable.finalY + 5)
  entregarPDF(doc, `Auditoria_P3_${o.fecha}.pdf`, ventana)
}
