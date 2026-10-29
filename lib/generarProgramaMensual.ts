import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { abrirVentanaPDF, entregarPDF } from '@/lib/abrirPDF'
import { cargarLogo, normalizarImagen } from '@/lib/generarGuiaTraslado'

export type ProgramaPDF = {
  mesTexto: string            // "octubre 2026"
  cargoTexto: string          // "Asesor en prevención de riesgos (APR)"
  anexo: string               // "ANEXO 4 · ASESORES EN PREVENCIÓN DE RIESGOS"
  nombre: string
  filas: { actividad: string, programadas: number, real: number, pct: number }[]
  cumplimiento: number
  enviadoPor: string; fechaEnvio: string; firmaEnvia?: string | null
  revisor: string; fechaRevision: string; firmaRevisor?: string | null
  estado: string
  plazoTexto: string
  comentario: string
  detalle: { fecha: string, actividad: string, faena: string, detalle: string, pct: string }[]
}

export const ANEXOS: Record<string, string> = {
  administrador_faena: 'ANEXO 1 · ADMINISTRADOR DE FAENA',
  jefe_prevencion: 'ANEXO 2 · JEFE PREVENCIÓN DE RIESGOS',
  supervisor: 'ANEXO 3 · SUPERVISORES',
  asesor_prl: 'ANEXO 4 · ASESORES EN PREVENCIÓN DE RIESGOS',
  gerente_general: 'ANEXO 5 · GERENTE GENERAL',
}

export function abrirVentanaPrograma() { return abrirVentanaPDF() }

export async function generarProgramaMensual(p: ProgramaPDF, ventana: Window | null) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 14
  const AZUL: [number, number, number] = [27, 79, 156]
  const logo = await cargarLogo()
  const fe = async (d?: string | null) => d ? await normalizarImagen(d) : null
  const firmaE = await fe(p.firmaEnvia), firmaR = await fe(p.firmaRevisor)

  // Encabezado (se repite en cada página)
  const encabezado = () => {
    doc.setDrawColor(120); doc.setLineWidth(0.3)
    doc.rect(M, 10, W - 2 * M, 22)
    doc.line(M + 40, 10, M + 40, 32); doc.line(W - M - 52, 10, W - M - 52, 32)
    if (logo) { const w = 34, h = Math.min(18, w * logo.ratio); doc.addImage(logo.data, 'JPEG', M + 3, 10 + (22 - h) / 2, w, h) }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(0)
    doc.text('PROGRAMA DE ACTIVIDADES', M + 40 + (W - 2 * M - 92) / 2, 19, { align: 'center' })
    doc.text('PERSONALIZADO', M + 40 + (W - 2 * M - 92) / 2, 25, { align: 'center' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
    ;['Código: IDL-SSO-PLP-001', 'Fecha: 24-07-2026', 'Versión: 00', 'Revisión: 00'].forEach((t, i) => doc.text(t, W - M - 50, 15.5 + i * 4.8))
  }
  encabezado()

  let y = 42
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...AZUL)
  doc.text('PROGRAMA MENSUAL DE ACTIVIDADES PERSONALIZADAS', W / 2, y, { align: 'center' }); y += 6.5
  doc.setFontSize(11); doc.setTextColor(0)
  doc.text(p.anexo, W / 2, y, { align: 'center' }); y += 8

  doc.setFontSize(10); doc.setFont('helvetica', 'normal')
  doc.text('Nombre:', M, y); doc.setFont('helvetica', 'bold'); doc.text(p.nombre, M + 18, y)
  doc.setFont('helvetica', 'normal'); doc.text('Cargo:', 110, y); doc.setFont('helvetica', 'bold'); doc.text(p.cargoTexto, 122, y, { maxWidth: W - M - 122 }); y += 6
  doc.setFont('helvetica', 'normal'); doc.text('Mes:', M, y); doc.setFont('helvetica', 'bold'); doc.text(p.mesTexto, M + 18, y)
  doc.setFont('helvetica', 'normal'); doc.text('Estado:', 110, y); doc.setFont('helvetica', 'bold'); doc.text(p.estado, 124, y); y += 6

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.text('Programa de actividades generales', M, y + 2); y += 4

  autoTable(doc, {
    startY: y + 1, margin: { left: M, right: M },
    head: [['Actividad', 'Programadas', 'Real', '% cumplimiento']],
    body: p.filas.map(f => [f.actividad, String(f.programadas).padStart(2, '0'), String(f.real).padStart(2, '0'), String(f.pct)]),
    foot: [['', '', 'Porcentaje real de cumplimiento:', `${p.cumplimiento}%`]],
    styles: { fontSize: 9.5, cellPadding: 2.4, lineColor: [150, 150, 150], lineWidth: 0.2, textColor: 0 },
    headStyles: { fillColor: [226, 232, 242], textColor: 0, fontStyle: 'bold', halign: 'center' },
    footStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', halign: 'right' },
    columnStyles: { 0: { cellWidth: 92 }, 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' } },
    showFoot: 'lastPage',
  })
  y = (doc as any).lastAutoTable.finalY + 8

  // Cuadros de recepción con firma
  const cuadro = (titulo: string, etiqueta: string, nombre: string, fecha: string, firma: { data: string, w: number, h: number } | null) => {
    doc.setDrawColor(120); doc.setLineWidth(0.3)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(0)
    doc.text(titulo, M, y); y += 2.5
    doc.rect(M, y, W - 2 * M, 26)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5)
    doc.text(etiqueta, M + 3, y + 7); doc.setFont('helvetica', 'bold'); doc.text(nombre || '________________________', M + 3 + doc.getTextWidth(etiqueta) + 2, y + 7)
    doc.setFont('helvetica', 'normal'); doc.text('Fecha:', M + 3, y + 21); doc.text(fecha || '______________', M + 16, y + 21)
    doc.text('Firma:', 105, y + 21)
    if (firma) { const h = 16, w = Math.min(46, h * firma.w / firma.h); doc.addImage(firma.data, 'PNG', 118, y + 3 + (16 - Math.min(h, w * firma.h / firma.w)) / 2, w, Math.min(h, w * firma.h / firma.w)) }
    doc.setDrawColor(150); doc.line(118, y + 22, W - M - 4, y + 22)
    y += 26 + 8
  }
  cuadro('Acuso recibir conforme el programa de personalizado', 'Recibido por:', p.enviadoPor, p.fechaEnvio, firmaE)
  cuadro('Registro de entrega a APR', 'Recepcionado por:', p.revisor, p.fechaRevision, firmaR)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('Comentarios (Feedback):', M, y); y += 2.5
  doc.setDrawColor(120); doc.rect(M, y, W - 2 * M, 28)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5)
  doc.text(p.comentario || '', M + 3, y + 6, { maxWidth: W - 2 * M - 6 })
  y += 28 + 6
  doc.setFontSize(8.5); doc.setTextColor(90)
  doc.text(p.plazoTexto, M, y)

  // Detalle de actividades registradas
  if (p.detalle.length) {
    doc.addPage(); encabezado()
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...AZUL)
    doc.text(`Detalle de actividades registradas · ${p.nombre} · ${p.mesTexto}`, M, 42)
    autoTable(doc, {
      startY: 46, margin: { left: M, right: M, top: 38 },
      head: [['Fecha', 'Actividad', 'Faena', 'Detalle', '%']],
      body: p.detalle.map(d => [d.fecha, d.actividad, d.faena, d.detalle, d.pct]),
      styles: { fontSize: 8.5, cellPadding: 2, lineColor: [190, 190, 190], lineWidth: 0.15 },
      headStyles: { fillColor: [226, 232, 242], textColor: 0 },
      columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 48 }, 2: { cellWidth: 32 }, 4: { cellWidth: 14, halign: 'center' } },
      didDrawPage: () => encabezado(),
    })
  }

  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120)
    doc.text(`INDELI Construcción y Montaje Limitada · Programa de Actividades Personalizado · Documento generado por Sistema INDELI · Página ${i} de ${total}`, W / 2, 290, { align: 'center' })
  }
  entregarPDF(doc, `Programa_${p.nombre.replace(/\s+/g, '_')}_${p.mesTexto.replace(/\s+/g, '_')}.pdf`, ventana)
}

// Arma el PDF mensual de una persona a partir de lo ya cargado en pantalla.
// Debe llamarse directo desde el clic (abre la ventana antes de consultar).
import { supabase } from '@/lib/supabase'
import { ACTIVIDADES, ORDEN_ACTIVIDADES, CARGOS_PROGRAMA, nombreMes, pct, textoPlazo } from '@/lib/programa'

const fcl = (f?: string | null) => f ? f.slice(0, 10).split('-').reverse().join('-') : ''

export async function descargarProgramaMensual(o: {
  persona: { id: string, nombre: string, cargo: string }
  mes: string
  metas: any[]; acts: any[]; mensual: any | null; faenas: any[]
}) {
  const ventana = abrirVentanaPrograma()
  try {
    const { persona, mes, mensual } = o
    const ms = o.metas.filter(m => m.cargo === persona.cargo)
    const mine = o.acts.filter(a => a.usuario_id === persona.id)
    const filas = ORDEN_ACTIVIDADES.filter(k => ms.some(m => m.actividad === k)).map(k => {
      const meta = ms.find(m => m.actividad === k)!.meta as number
      const real = mine.filter(a => a.actividad === k).length
      return { actividad: ACTIVIDADES[k].nombre, programadas: meta, real, pct: pct(Math.min(real, meta), meta) ?? 0 }
    })
    const tm = filas.reduce((s, f) => s + f.programadas, 0), tr = filas.reduce((s, f) => s + Math.min(f.real, f.programadas), 0)

    const ids = [persona.id, mensual?.revisado_por].filter(Boolean) as string[]
    const [{ data: firmas }, { data: rev }] = await Promise.all([
      supabase.from('firmas_usuario').select('usuario_id,imagen,consentimiento_at').in('usuario_id', ids),
      mensual?.revisado_por ? supabase.from('usuarios').select('nombre').eq('id', mensual.revisado_por).maybeSingle() : Promise.resolve({ data: null } as any),
    ])
    const firmaDe = (id?: string) => (firmas || []).find((f: any) => f.usuario_id === id && f.consentimiento_at)?.imagen || null
    const enviado = !!mensual && (mensual.estado === 'enviado' || mensual.estado === 'aprobado')
    const aprobado = mensual?.estado === 'aprobado'

    await generarProgramaMensual({
      mesTexto: nombreMes(mes), cargoTexto: CARGOS_PROGRAMA[persona.cargo] || '', anexo: ANEXOS[persona.cargo] || 'ANEXO',
      nombre: persona.nombre, filas, cumplimiento: pct(tr, tm) ?? 0,
      enviadoPor: enviado ? persona.nombre : '', fechaEnvio: enviado ? fcl(mensual.enviado_at) : '',
      firmaEnvia: enviado ? firmaDe(persona.id) : null,
      revisor: aprobado ? (rev?.nombre || '') : '', fechaRevision: aprobado ? fcl(mensual.revisado_at) : '',
      firmaRevisor: aprobado ? firmaDe(mensual.revisado_por) : null,
      estado: !mensual ? 'En curso' : ({ abierto: 'En curso', enviado: 'Enviado', aprobado: 'Aprobado', devuelto: 'Devuelto' } as any)[mensual.estado],
      plazoTexto: `Plazo de entrega: hasta el ${textoPlazo(mes)}.`,
      comentario: mensual?.comentario || '',
      detalle: mine.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).map(a => ({
        fecha: fcl(a.fecha), actividad: ACTIVIDADES[a.actividad]?.corto || a.actividad,
        faena: o.faenas.find(x => x.id === a.ubicacion_id)?.nombre || '—',
        detalle: a.datos?.tarea || a.datos?.tema || (a.datos?.rbs ? `RBS N°${a.datos.rbs}` : ''),
        pct: a.porcentaje !== null && a.porcentaje !== undefined ? `${a.porcentaje}%` : '',
      })),
    }, ventana)
  } catch (e: any) {
    ventana?.close()
    alert('No se pudo generar el PDF: ' + (e?.message || e))
  }
}
