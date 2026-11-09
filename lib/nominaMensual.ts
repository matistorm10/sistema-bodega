import { FALLOS, TIPOS_PERSONAL, TIPOS_CONTRATO, cmpPersonal, fechaCorta, sumarDias, type Asig, type Turno, type Fallo } from '@/lib/operaciones'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export const nombreMesLargo = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`
const colLetra = (n: number) => { let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26) } return s }

// Libro Excel de la nómina del mes: una fila por trabajador y contrato con TODOS los que estuvieron en el contrato durante el mes
// (incluye los retirados), calendario de días en faena, fallos descontados y columnas en blanco para los montos de RR.HH.
export function construirNomina(X: any, p: { mes: string, trab: any[], asigs: Asig[], turnos: Turno[], fallos: Fallo[], contratoSel: string[], nCont: (id?: string) => string }) {
  const ini = p.mes + '-01'
  const dias: string[] = []; for (let d = ini; d.slice(0, 7) === p.mes; d = sumarDias(d, 1)) dias.push(d)
  const fin = dias[dias.length - 1]
  const falloDe = new Map<string, string>(); p.fallos.forEach(f => falloDe.set(f.trabajador_id + '|' + f.fecha, f.motivo))

  type Fila = { t: any, a: Asig, marcas: string[], dEn: number }
  const porContrato = new Map<string, Fila[]>()
  for (const t of p.trab) {
    if (t.tipo_personal === 'backoffice') continue
    const mias = p.asigs.filter(a => a.trabajador_id === t.id && a.desde <= fin && (!a.hasta || a.hasta >= ini) && (p.contratoSel.length === 0 || p.contratoSel.includes(a.contrato_id)))
    const ts = p.turnos.filter(x => x.trabajador_id === t.id && x.sube <= fin && (!x.baja || x.baja >= ini))
    for (const a of mias) {
      const marcas = dias.map(d => {
        const dentro = a.desde <= d && (!a.hasta || a.hasta >= d)
        if (!dentro || !ts.some(x => x.sube <= d && (!x.baja || x.baja >= d))) return ''
        const f = falloDe.get(t.id + '|' + d)
        return f ? (FALLOS[f]?.l || 'O') : '1'
      })
      const fila = { t, a, marcas, dEn: marcas.filter(m => m !== '').length }
      porContrato.set(a.contrato_id, [...(porContrato.get(a.contrato_id) || []), fila])
    }
  }

  const libro = new X.Workbook(); libro.creator = 'Sistema INDELI'
  const h = libro.addWorksheet('Nómina ' + p.mes, { views: [{ state: 'frozen', xSplit: 3, ySplit: 5 }] })
  const fallosCols = Object.keys(FALLOS)
  const cab = ['N°', 'Nombre', 'RUT', 'Cargo', 'Tipo', 'Inicio contrato', 'Salida', 'Motivo de salida', ...dias.map(d => String(Number(d.slice(8)))),
    'Días en faena', ...fallosCols.map(k => FALLOS[k].t), 'Total fallos', 'DÍAS A PAGAR',
    'Sueldo base ($)', 'Trato ($)', 'Horas extra (cant.)', 'Horas extra ($)', 'Bonos / otros ($)', 'Descuentos ($)', 'Observaciones']
  const cDia0 = 9, cDiaN = 8 + dias.length, cEn = cDiaN + 1, cF0 = cEn + 1, cFN = cEn + fallosCols.length, cTotF = cFN + 1, cPagar = cTotF + 1
  const totalCols = cab.length
  h.mergeCells(1, 1, 1, 8); h.getCell(1, 1).value = `NÓMINA MENSUAL DE ASISTENCIA · ${nombreMesLargo(p.mes).toUpperCase()}`; h.getCell(1, 1).font = { bold: true, size: 14 }
  h.getCell(2, 1).value = `Contratos: ${p.contratoSel.length === 0 ? 'todos' : p.contratoSel.map(id => p.nCont(id)).join(' | ')}`
  h.getCell(3, 1).value = `Incluye a todos los trabajadores que estuvieron en el contrato durante el mes (también los que salieron). Fallos: ${fallosCols.map(k => `${FALLOS[k].l} = ${FALLOS[k].t}`).join(' · ')}. Generado el ${fechaCorta(new Date().toISOString().slice(0, 10))}.`
  h.getCell(3, 1).font = { size: 9, color: { argb: 'FF667085' } }
  const filaCab = 5
  const c = h.getRow(filaCab); cab.forEach((v, i) => { const cell = c.getCell(i + 1); cell.value = v; cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i + 1 === cPagar ? 'FF1E8E4E' : i + 1 > cPagar ? 'FFB7791F' : i + 1 > cDiaN ? 'FF475467' : 'FF1B4F9C' } }; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true } })
  c.height = 34
  dias.forEach((d, i) => { const dow = new Date(d + 'T12:00:00').getDay(); if (dow === 0 || dow === 6) h.getRow(filaCab).getCell(cDia0 + i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF98A2B3' } } })

  let r = filaCab + 1; const filasDatos: number[] = []
  const contratosOrden = Array.from(porContrato.keys()).sort((a, b) => p.nCont(a).localeCompare(p.nCont(b), 'es'))
  for (const cid of contratosOrden) {
    const lista = porContrato.get(cid)!.sort((x, y) => cmpPersonal(x.t, y.t))
    const gr = h.getRow(r); gr.getCell(1).value = `${p.nCont(cid)} · ${lista.length} trabajador(es)`; gr.font = { bold: true }
    for (let i = 1; i <= totalCols; i++) gr.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FB' } }
    r++
    const r0 = r; let n = 1
    for (const f of lista) {
      const { t, a } = f
      const salioMes = !t.activo ? (t.fecha_retiro || a.hasta) : (a.hasta && a.hasta <= fin ? a.hasta : '')
      const motivo = !t.activo ? (t.motivo_retiro || 'Retirado') : (salioMes ? 'Fin de asignación al contrato' : '')
      const fila = h.getRow(r)
      const vals: any[] = [n++, t.nombre, t.rut || '', t.cargo || '', TIPOS_PERSONAL[t.tipo_personal] || 'Directo', fechaCorta(a.desde), salioMes ? fechaCorta(salioMes) : '', motivo, ...f.marcas.map(m => m === '1' ? 1 : m)]
      vals.forEach((v, i) => { fila.getCell(i + 1).value = v })
      const rango = `${colLetra(cDia0)}${r}:${colLetra(cDiaN)}${r}`
      const nf = f.marcas.filter(m => m !== '' && m !== '1').length
      fila.getCell(cEn).value = { formula: `COUNTIF(${rango},1)+COUNTIF(${rango},"?")`, result: f.dEn }
      fallosCols.forEach((k, i) => { fila.getCell(cF0 + i).value = { formula: `COUNTIF(${rango},"${FALLOS[k].l}")`, result: f.marcas.filter(m => m === FALLOS[k].l).length } })
      fila.getCell(cTotF).value = { formula: `SUM(${colLetra(cF0)}${r}:${colLetra(cFN)}${r})`, result: nf }
      fila.getCell(cPagar).value = { formula: `${colLetra(cEn)}${r}-${colLetra(cTotF)}${r}`, result: f.dEn - nf }
      fila.getCell(cPagar).font = { bold: true }; fila.getCell(cPagar).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4EA' } }
      if (a.sueldo) fila.getCell(cPagar + 1).value = Number(a.sueldo)
      f.marcas.forEach((m, i) => {
        const cell = fila.getCell(cDia0 + i); cell.alignment = { horizontal: 'center' }
        if (m === '1') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB7E1C4' } }
        else if (m) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB42318' } }; cell.font = { bold: true, color: { argb: 'FFFFFFFF' } } }
      })
      if (salioMes && salioMes <= fin) { for (let i = 1; i <= 8; i++) fila.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE2E1' } } }
      for (let i = cPagar + 1; i <= totalCols; i++) fila.getCell(i).border = { bottom: { style: 'hair' } }
      filasDatos.push(r); r++
    }
    // total del contrato
    const tr = h.getRow(r); tr.getCell(2).value = `Total ${p.nCont(cid)}`; tr.font = { bold: true }
    for (const col of [cEn, ...fallosCols.map((_, i) => cF0 + i), cTotF, cPagar]) tr.getCell(col).value = { formula: `SUM(${colLetra(col)}${r0}:${colLetra(col)}${r - 1})` }
    for (let i = 1; i <= totalCols; i++) tr.getCell(i).border = { top: { style: 'thin' } }
    r += 2
  }
  if (contratosOrden.length === 0) h.getCell(filaCab + 1, 2).value = 'No hay trabajadores con contrato en este mes para los contratos elegidos.'
  h.columns = [{ width: 5 }, { width: 30 }, { width: 13 }, { width: 22 }, { width: 10 }, { width: 11 }, { width: 11 }, { width: 24 }, ...dias.map(() => ({ width: 3.6 })),
    { width: 9 }, ...fallosCols.map(() => ({ width: 11 })), { width: 8 }, { width: 11 }, { width: 13 }, { width: 12 }, { width: 11 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 30 }]
  h.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  void TIPOS_CONTRATO
  return libro
}
