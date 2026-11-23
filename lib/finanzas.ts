import { supabase } from '@/lib/supabase'

export type TipoArchivo = 'informe_compras' | 'libro_compras' | 'informe_ventas' | 'libro_ventas'
export const TIPOS: { id: TipoArchivo, label: string }[] = [
  { id: 'informe_compras', label: 'Informe de compras (por unidad de negocio)' },
  { id: 'libro_compras', label: 'Libro de compras (SII)' },
  { id: 'informe_ventas', label: 'Informe de ventas (por unidad de negocio)' },
  { id: 'libro_ventas', label: 'Libro de ventas (SII)' },
]

export type Linea = { unidad: string, concepto: string, detalle: string, glosa: string, monto: number }
export type Doc = {
  rut: string, razon: string, tipo: string, folio: string, fecha: string | null,
  neto: number, exento: number, iva: number, total: number, lineas: Linea[], periodo?: string
}

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
export const normTipo = (s: string) => sinTildes(String(s || '')).toUpperCase().replace(/\s+/g, ' ').trim()
export const normRut = (s: any) => String(s ?? '').replace(/[.\s]/g, '').toUpperCase()
const normCab = (s: any) => normTipo(String(s ?? '')).replace(/[^A-Z0-9/ ]/g, '')

// Montos: número, o texto como "(178,124)" = negativo, "1.234" no se usa porque Kame entrega enteros
export function num(v: any): number {
  if (v == null || v === '') return 0
  if (typeof v === 'number') return v
  if (typeof v === 'object' && 'result' in v) return num((v as any).result)
  let s = String(v).trim(); let neg = false
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1) }
  if (s.startsWith('-')) { neg = !neg; s = s.slice(1) }
  s = s.replace(/[,\s$]/g, '')
  const n = Number(s)
  return isNaN(n) ? 0 : (neg ? -n : n)
}

export function fecha(v: any): string | null {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = String(v).trim()
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return iso ? iso[0] : null
}

const texto = (v: any): string => {
  if (v == null) return ''
  if (typeof v === 'object' && !(v instanceof Date)) return String((v as any).text ?? (v as any).result ?? '')
  return String(v).trim()
}
const folioTxt = (v: any) => { const n = typeof v === 'number' ? v : Number(String(v).replace(/\D/g, '')); return isNaN(n) || v === '' ? String(v ?? '').trim() : String(Math.trunc(n)) }

async function leerFilas(file: File): Promise<any[][]> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const ws = wb.worksheets[0]
  const filas: any[][] = []
  ws.eachRow({ includeEmpty: true }, (row) => {
    const vals = (row.values as any[]).slice(1)
    filas.push(vals.map(v => (v && typeof v === 'object' && !(v instanceof Date) && 'result' in v) ? (v as any).result : v))
  })
  return filas
}

// Busca la fila de encabezados: la primera que contiene todas las columnas pedidas
function buscarCab(filas: any[][], requeridas: string[]): { i: number, col: Record<string, number> } | null {
  for (let i = 0; i < Math.min(filas.length, 30); i++) {
    const col: Record<string, number> = {}
    filas[i].forEach((c, j) => { const k = normCab(c); if (k && !(k in col)) col[k] = j })
    if (requeridas.every(r => r in col)) return { i, col }
  }
  return null
}

// Informe de compras / ventas: una fila por línea. Se agrupa por (rut, tipo, folio): nunca por folio solo.
export async function leerInforme(file: File, sentido: 'compra' | 'venta'): Promise<{ docs: Doc[], avisos: string[] }> {
  const filas = await leerFilas(file)
  const cab = buscarCab(filas, ['RUT', 'FOLIO', 'DOCUMENTO', 'UNIDAD NEGOCIO'])
  if (!cab) throw new Error('No encontré las columnas Rut, Documento, Folio y Unidad Negocio. ¿Es el informe correcto?')
  const c = cab.col
  const cMonto = sentido === 'compra' ? c['TOTAL LINEA'] : c['TOTAL']
  if (cMonto == null) throw new Error(sentido === 'compra' ? 'Falta la columna "Total Línea"' : 'Falta la columna "Total"')
  const docs = new Map<string, Doc>(); const avisos: string[] = []
  for (let i = cab.i + 1; i < filas.length; i++) {
    const f = filas[i]
    const rut = normRut(f[c['RUT']]); const folio = folioTxt(f[c['FOLIO']])
    if (!rut || !folio || isNaN(Number(folio))) continue
    const tipo = normTipo(texto(f[c['DOCUMENTO']]))
    const k = `${rut}|${tipo}|${folio}`
    let d = docs.get(k)
    if (!d) {
      d = {
        rut, razon: texto(f[c['RAZON SOCIAL']]), tipo, folio, fecha: fecha(f[c['FECHA']]),
        neto: 0, exento: sentido === 'compra' ? num(f[c['EXENTO']]) : 0,
        iva: sentido === 'compra' ? num(f[c['IVA']]) : 0, total: sentido === 'compra' ? num(f[c['TOTAL']]) : 0, lineas: [],
      }
      if (sentido === 'compra') d.neto = num(f[c['AFECTO']])
      docs.set(k, d)
    }
    d.lineas.push({
      unidad: texto(f[c['UNIDAD NEGOCIO']]),
      concepto: texto(f[c['CONCEPTO/ARTICULO']] ?? f[c['PRODUCTO']]),
      detalle: texto(f[c['DETALLE CONCEPTO COMPRA']]),
      glosa: texto(f[c['GLOSA']]),
      monto: num(f[cMonto]),
    })
  }
  const out = [...docs.values()]
  if (sentido === 'venta') out.forEach(d => { d.neto = d.lineas.reduce((a, l) => a + l.monto, 0) })
  else {
    // Control: las líneas deben sumar el neto del documento (una unidad por documento o varias, da igual)
    out.forEach(d => {
      const s = d.lineas.reduce((a, l) => a + l.monto, 0)
      if (Math.abs(s - d.neto) > 1 && Math.abs(s - (d.neto + d.exento)) > 1)
        avisos.push(`Folio ${d.folio} (${d.razon}): las líneas suman ${s.toLocaleString('es-CL')} y el documento dice ${d.neto.toLocaleString('es-CL')}`)
    })
  }
  return { docs: out, avisos }
}

// Libro del SII: secciones por tipo de documento, una fila por documento
export async function leerLibro(file: File, periodoManual: string): Promise<{ docs: Doc[], avisos: string[], periodo: string }> {
  const filas = await leerFilas(file)
  const cab = buscarCab(filas, ['FECHA', 'NUMERO', 'RUT', 'NETO', 'IVA', 'TOTAL'])
  if (!cab) throw new Error('No encontré las columnas FECHA, NUMERO, R.U.T., NETO, IVA y TOTAL. ¿Es el libro correcto?')
  const c = cab.col
  const docs = new Map<string, Doc>(); const avisos: string[] = []
  let seccion = ''
  for (let i = cab.i + 1; i < filas.length; i++) {
    const f = filas[i]; const a = texto(f[0])
    const numero = f[c['NUMERO']]
    if (numero == null || numero === '') {
      const t = normTipo(a)
      if (t && !t.startsWith('SUBTOTAL') && !t.startsWith('TOTAL') && !t.startsWith('RESUMEN') && !t.startsWith('DOCUMENTO')) seccion = t
      if (t.startsWith('RESUMEN')) break
      continue
    }
    const rut = normRut(f[c['RUT']]); const folio = folioTxt(numero)
    if (!rut || !seccion) continue
    const k = `${rut}|${seccion}|${folio}`
    if (docs.has(k)) avisos.push(`Documento repetido dentro del libro: ${seccion} ${folio} de ${rut}`)
    docs.set(k, {
      rut, razon: texto(f[c['NOMBRE']]), tipo: seccion, folio, fecha: fecha(f[c['FECHA']]),
      neto: num(f[c['NETO']]), exento: num(f[c['EXENTO']]), iva: num(f[c['IVA']]), total: num(f[c['TOTAL']]), lineas: [],
    })
  }
  // Período tributario: el que escribe el usuario, o el que aparece en el encabezado, o el mes más frecuente
  let periodo = periodoManual
  if (!periodo) {
    for (const f of filas.slice(0, cab.i)) for (const v of f) {
      const m = texto(v).match(/(\d{2})\/(\d{4})/); if (m) { periodo = `${m[2]}-${m[1]}`; break }
    }
  }
  if (!periodo) {
    const cuenta: Record<string, number> = {}
    docs.forEach(d => { const m = d.fecha?.slice(0, 7); if (m) cuenta[m] = (cuenta[m] || 0) + 1 })
    periodo = Object.entries(cuenta).sort((x, y) => y[1] - x[1])[0]?.[0] || ''
  }
  const out = [...docs.values()]
  out.forEach(d => { d.periodo = periodo })
  return { docs: out, avisos, periodo }
}

const lotes = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))

// Guarda en la base de forma idempotente: volver a subir el mismo archivo no duplica nada.
export async function guardarImportacion(tipo: TipoArchivo, archivo: string, docs: Doc[], periodo: string, avance?: (t: string) => void) {
  const sentido = tipo.endsWith('compras') ? 'compra' : 'venta'
  const esLibro = tipo.startsWith('libro')
  const { data: lote, error: eL } = await supabase.from('fin_lotes').insert({ tipo, archivo, periodo: periodo || null, docs: docs.length }).select('id').single()
  if (eL) throw eL

  // Qué documentos ya existen (para contar nuevos y no pisar datos del otro origen con ceros)
  const existentes = new Map<string, any>()
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.from('fin_documentos').select('id,rut,tipo_doc,folio,fecha_doc,neto,exento,iva,total').eq('sentido', sentido).order('id').range(desde, desde + 999)
    if (error) throw error
    ;(data || []).forEach(r => existentes.set(`${r.rut}|${r.tipo_doc}|${r.folio}`, r))
    if (!data || data.length < 1000) break
  }
  let nuevos = 0
  const filas = docs.map(d => {
    const prev = existentes.get(`${d.rut}|${d.tipo}|${d.folio}`)
    if (!prev) nuevos++
    const base: any = { sentido, rut: d.rut, razon_social: d.razon, tipo_doc: d.tipo, folio: d.folio, lote_id: lote.id }
    if (esLibro) {
      Object.assign(base, { fecha_doc: d.fecha, periodo_tributario: d.periodo || null, neto: d.neto, exento: d.exento, iva: d.iva, total: d.total, en_libro: true })
    } else {
      base.fecha_doc = d.fecha
      base.en_informe = true
      // En ventas el informe solo trae neto; IVA y total vienen del libro si ya está cargado
      if (sentido === 'compra') Object.assign(base, { neto: d.neto, exento: d.exento, iva: d.iva, total: d.total })
      else { base.neto = d.neto; if (!prev || !prev.total) { base.iva = Math.round(d.neto * 0.19); base.total = d.neto + base.iva } }
    }
    return base
  })
  const ids = new Map<string, string>()
  let hechos = 0
  for (const parte of lotes(filas, 200)) {
    const { data, error } = await supabase.from('fin_documentos').upsert(parte, { onConflict: 'sentido,rut,tipo_doc,folio' }).select('id,rut,tipo_doc,folio')
    if (error) throw error
    ;(data || []).forEach(r => ids.set(`${r.rut}|${r.tipo_doc}|${r.folio}`, r.id))
    hechos += parte.length; avance?.(`Guardando documentos ${hechos} de ${filas.length}…`)
  }

  if (!esLibro) {
    // Unidades de negocio: se crean las que falten (activas por defecto; se pueden desactivar en la pestaña Unidades)
    const { data: us } = await supabase.from('fin_unidades').select('id,nombre')
    const porNombre = new Map((us || []).map(u => [normTipo(u.nombre), u.id as string]))
    const faltan = [...new Set(docs.flatMap(d => d.lineas.map(l => l.unidad)).filter(n => n && !porNombre.has(normTipo(n))))]
    if (faltan.length) {
      const { data: nu, error } = await supabase.from('fin_unidades').insert(faltan.map(nombre => ({ nombre }))).select('id,nombre')
      if (error) throw error
      ;(nu || []).forEach(u => porNombre.set(normTipo(u.nombre), u.id))
    }
    // Se reemplazan las líneas de estos documentos (así el mismo archivo se puede volver a subir)
    const idsDocs = [...ids.values()]
    for (const parte of lotes(idsDocs, 100)) {
      const { error } = await supabase.from('fin_lineas').delete().in('documento_id', parte)
      if (error) throw error
    }
    const lineas: any[] = []
    docs.forEach(d => {
      const id = ids.get(`${d.rut}|${d.tipo}|${d.folio}`); if (!id) return
      d.lineas.forEach((l, n) => lineas.push({ documento_id: id, unidad_id: porNombre.get(normTipo(l.unidad)) || null, unidad_texto: l.unidad, concepto: l.concepto, detalle: l.detalle, glosa: l.glosa, monto: l.monto, n }))
    })
    let h2 = 0
    for (const parte of lotes(lineas, 300)) {
      const { error } = await supabase.from('fin_lineas').insert(parte)
      if (error) throw error
      h2 += parte.length; avance?.(`Guardando líneas ${h2} de ${lineas.length}…`)
    }
  }
  await supabase.from('fin_lotes').update({ nuevos, actualizados: docs.length - nuevos }).eq('id', lote.id)
  return { nuevos, actualizados: docs.length - nuevos }
}

// ---------- Remuneraciones (planilla mensual de RR.HH., extraída de BUK) ----------
export type Rem = { periodo: string, rut: string, nombre: string, cargo: string, centro: string, haberes: number, aporte: number, costo: number }
const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']

// Usa la hoja "TOTAL" (columna MES + todas las personas). Si no existe, lee las hojas por mes.
export async function leerRemuneraciones(file: File, anio: number): Promise<{ filas: Rem[], avisos: string[] }> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await file.arrayBuffer())
  const filas: Rem[] = []; const avisos: string[] = []
  const hojas = wb.worksheets.filter(w => normTipo(w.name) === 'TOTAL')
  const usar = hojas.length ? hojas : wb.worksheets.filter(w => MESES.includes(normTipo(w.name)))
  for (const ws of usar) {
    const rows: any[][] = []
    ws.eachRow({ includeEmpty: true }, r => rows.push((r.values as any[]).slice(1).map(v => (v && typeof v === 'object' && !(v instanceof Date) && 'result' in v) ? (v as any).result : v)))
    const cab = buscarCab(rows, ['RUT', 'CENTRO COSTO', 'COSTO EMPRESA'])
    if (!cab) { avisos.push(`Hoja ${ws.name}: no encontré las columnas RUT, CENTRO COSTO y COSTO EMPRESA`); continue }
    const c = cab.col
    for (let i = cab.i + 1; i < rows.length; i++) {
      const f = rows[i]; const rut = normRut(f[c['RUT']]); if (!rut || !/\d/.test(rut)) continue
      const mesTxt = hojas.length ? normTipo(texto(f[c['MES']])) : normTipo(ws.name)
      const m = MESES.indexOf(mesTxt); if (m < 0) continue
      const nombre = c['NOMBRES'] != null
        ? [f[c['NOMBRES']], f[c['AP PATERNO']], f[c['AP MATERNO']]].map(texto).filter(Boolean).join(' ')
        : texto(f[c['NOMBRE']])
      filas.push({
        periodo: `${anio}-${String(m + 1).padStart(2, '0')}`, rut, nombre, cargo: texto(f[c['CARGO']]),
        centro: texto(f[c['CENTRO COSTO']]), haberes: num(f[c['TOTAL HABERES']]),
        aporte: num(f[c['APORTE PATRONAL']] ?? f[c['AP PAT']]), costo: num(f[c['COSTO EMPRESA']]),
      })
    }
  }
  return { filas, avisos }
}

// Reemplaza por completo los períodos que trae el archivo (se puede volver a subir sin duplicar)
export async function guardarRemuneraciones(filas: Rem[], avance?: (t: string) => void) {
  const { data: us } = await supabase.from('fin_unidades').select('id,nombre')
  const { data: al } = await supabase.from('fin_alias_centro').select('centro_texto,unidad_id')
  const mapa = new Map<string, string>((us || []).map(u => [normTipo(u.nombre), u.id]))
  ;(al || []).forEach(a => { if (a.unidad_id) mapa.set(normTipo(a.centro_texto), a.unidad_id) })
  const periodos = [...new Set(filas.map(f => f.periodo))]
  for (const p of periodos) {
    const { error } = await supabase.from('fin_remuneraciones').delete().eq('periodo', p)
    if (error) throw error
  }
  const rows = filas.map(f => ({ periodo: f.periodo, rut: f.rut, nombre: f.nombre, cargo: f.cargo, centro_texto: f.centro, unidad_id: mapa.get(normTipo(f.centro)) || null, haberes: f.haberes, aporte_patronal: f.aporte, costo_empresa: f.costo }))
  let h = 0
  for (const parte of lotes(rows, 300)) {
    const { error } = await supabase.from('fin_remuneraciones').insert(parte)
    if (error) throw error
    h += parte.length; avance?.(`Guardando ${h} de ${rows.length}…`)
  }
  return periodos.length
}
