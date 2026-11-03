'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { card, Barra } from '@/components/programa/ui'
import { ACTIVIDADES, ORDEN_ACTIVIDADES, pct, mesActual, nombreMes, mesAnterior, estadoPlazo, textoPlazo } from '@/lib/programa'
import { estadoCelda, aplica, mesHoy } from '@/lib/capacitaciones'
import { itemsSemanales } from '@/lib/semanalItems'
import { misUbicacionesIds } from '@/lib/prevencion'
import { INICIO_OPERACION } from '@/lib/inicio'

type Tarea = { nivel: 'rojo' | 'amarillo' | 'azul', txt: string, href: string }
const COL = { rojo: ['#fde8e8', '#9b1c1c', '🔴'], amarillo: ['#fff8e5', '#7a5600', '🟡'], azul: ['#e8f0fb', '#1B4F9C', '🔵'] } as const
const hoyISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)

// Resumen ejecutivo de la gestión del APR: cuatro indicadores y la lista de lo que le toca resolver
export default function ResumenAPR({ usuario }: { usuario: { id: string, nombre: string, cargoPrograma?: string | null, rol?: string, esJefeHsec?: boolean } }) {
  const [d, setD] = useState<any | null>(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const mes = mesActual(), prev = mesAnterior(mes), hoy = hoyISO()
      const cargo = usuario.cargoPrograma || ''
      const desdeMes = (mes + '-01') < INICIO_OPERACION ? INICIO_OPERACION : mes + '-01'
      const propias = usuario.rol === 'admin' || usuario.esJefeHsec ? null : await misUbicacionesIds(usuario.id)
      const [metas, acts, men, menPrev, inf, asg, cli, sem, prog, ubl, ubs, chs] = await Promise.all([
        cargo ? supabase.from('pr_prog_metas').select('*').eq('cargo', cargo) : Promise.resolve({ data: [] } as any),
        supabase.from('pr_prog_actividades').select('actividad,revision_estado,revision_comentario').eq('usuario_id', usuario.id).eq('mes', mes),
        supabase.from('pr_prog_mensual').select('estado,enviado_at').eq('usuario_id', usuario.id).eq('mes', mes).maybeSingle(),
        supabase.from('pr_prog_mensual').select('estado,enviado_at').eq('usuario_id', usuario.id).eq('mes', prev).maybeSingle(),
        supabase.from('pr_informes_diarios').select('fecha,estado,revision,ubicacion_id').eq('creado_por', usuario.id).gte('fecha', desdeMes),
        supabase.from('pr_semanal_asignaciones').select('*').eq('usuario_id', usuario.id),
        supabase.from('pr_clientes_informe').select('*').eq('activo', true),
        supabase.from('pr_informes_semanales').select('*').eq('usuario_id', usuario.id),
        supabase.from('pr_cap_programa').select('*').eq('activo', true),
        supabase.from('pr_cap_ubic_lugar').select('*'),
        supabase.from('ubicaciones').select('id,nombre,activa'),
        supabase.from('pr_charlas').select('programa_id,ubicacion_id,fecha'),
      ])
      // Programa de liderazgo
      const filas = ORDEN_ACTIVIDADES.filter(k => (metas.data || []).some((m: any) => m.actividad === k) && (k !== 'verificacion_ds132' || (acts.data || []).some((a: any) => a.actividad === k)))
        .map(k => { const meta = (metas.data || []).find((m: any) => m.actividad === k).meta as number; const real = (acts.data || []).filter((a: any) => a.actividad === k && a.revision_estado !== 'rechazado').length; return { k, meta, real } })
      const tMeta = filas.reduce((s, f) => s + f.meta, 0), tReal = filas.reduce((s, f) => s + Math.min(f.real, f.meta), 0)
      const liderazgo = { pct: pct(tReal, tMeta), faltan: filas.filter(f => f.real < f.meta), tiene: filas.length > 0 }
      const progRech = (acts.data || []).filter((a: any) => a.revision_estado === 'rechazado')
      // Informes diarios
      const mis = inf.data || []
      const rechazados = mis.filter((i: any) => i.estado === 'cerrado' && i.revision === 'rechazado').length
      const porAprobar = mis.filter((i: any) => i.estado === 'cerrado' && i.revision === 'pendiente').length
      const borradores = mis.filter((i: any) => i.estado === 'borrador').length
      const enviadoHoy = mis.some((i: any) => i.fecha === hoy && i.estado === 'cerrado')
      const diasHabiles = (() => { let n = 0; const f = new Date(desdeMes + 'T12:00:00'); const t = new Date(hoy + 'T12:00:00'); for (; f <= t; f.setDate(f.getDate() + 1)) { const w = f.getDay(); if (w >= 1 && w <= 5) n++ } return n })()
      const diasConInforme = new Set(mis.filter((i: any) => i.estado === 'cerrado').map((i: any) => i.fecha)).size
      const esHabil = ![0, 6].includes(new Date().getDay())
      // Informes semanales
      const items = itemsSemanales(usuario.id, cli.data || [], asg.data || [], sem.data || [])
      const atrasados = items.filter(i => i.tipo === 'atraso')
      const proximo = items.filter(i => i.tipo === 'vigente').sort((a, b) => a.limite.localeCompare(b.limite))[0]
      const semRech = (sem.data || []).filter((s: any) => s.revision === 'rechazado').length
      const semHechos = items.filter(i => ['entregado', 'tarde'].includes(i.tipo)).length
      // Capacitaciones (faenas del APR)
      const ubics = (ubs.data || []).filter((u: any) => u.activa !== false && (!propias || propias.has(u.id)))
      const hoyM = mesHoy()
      let plan = 0, hechas = 0; const pend: string[] = []
      for (const u of ubics) {
        const lugar = (ubl.data || []).find((l: any) => l.ubicacion_id === u.id)?.lugar
        for (const p of (prog.data || []).filter((p: any) => aplica(p, lugar))) for (const k of Object.keys(p.meses || {}).filter(k => k <= hoyM && k >= INICIO_OPERACION.slice(0, 7))) {
          const h = (chs.data || []).filter((c: any) => c.programa_id === p.id && c.ubicacion_id === u.id && String(c.fecha).slice(0, 7) === k).length
          plan++; if (h > 0) hechas++
          else if (estadoCelda(k, 0, 1, hoyM) !== 'futuro') pend.push(`${p.tematica}${ubics.length > 1 ? ' · ' + u.nombre : ''}`)
        }
      }
      const cap = { pct: plan ? Math.round(hechas / plan * 100) : null, pend, plan }
      const prevPend = !!cargo && prev >= INICIO_OPERACION.slice(0, 7) && (!menPrev.data || ['abierto', 'devuelto'].includes(menPrev.data.estado))
      if (vivo) setD({ progRech, mes, liderazgo, men: men.data, prevPend, prev, rechazados, porAprobar, borradores, enviadoHoy, esHabil, diasHabiles, diasConInforme, atrasados, proximo, semRech, semHechos, cap, tieneFaena: ubics.length > 0, tieneSem: (asg.data || []).length > 0 })
    })()
    return () => { vivo = false }
  }, [usuario.id, usuario.cargoPrograma, usuario.rol, usuario.esJefeHsec])

  if (!d) return <div style={{ ...card, marginBottom: '14px', color: '#98a2b3', fontSize: '13px' }}>Preparando tu resumen...</div>

  // Lo que te toca resolver, de lo más urgente a lo menos urgente
  const tareas: Tarea[] = []
  if (d.progRech.length) tareas.push({ nivel: 'rojo', txt: `${d.progRech.length} documento(s) del programa de liderazgo rechazado(s): ${d.progRech.map((a: any) => `${ACTIVIDADES[a.actividad]?.corto || a.actividad}${a.revision_comentario ? ' («' + a.revision_comentario + '»)' : ''}`).join(', ')}`, href: '/hsec/programa' })
  if (d.rechazados) tareas.push({ nivel: 'rojo', txt: `${d.rechazados} informe(s) diario(s) rechazado(s) por el Jefe: corrígelos y reenvíalos`, href: '/hsec/prevencionista/informe-diario' })
  if (d.semRech) tareas.push({ nivel: 'rojo', txt: `${d.semRech} informe(s) semanal(es) rechazado(s): sube la versión corregida`, href: '/hsec/prevencionista/semanales' })
  d.atrasados.forEach((i: any) => tareas.push({ nivel: 'rojo', txt: `Informe semanal de ${i.cliente.nombre} atrasado (semana al ${i.fin.split('-').reverse().slice(0, 2).join('-')})`, href: '/hsec/prevencionista/semanales' }))
  if (d.prevPend) tareas.push({ nivel: estadoPlazo(d.prev, 'abierto').tipo === 'atraso' ? 'rojo' : 'amarillo', txt: `Programa de liderazgo de ${nombreMes(d.prev)} sin enviar (plazo ${textoPlazo(d.prev)})`, href: '/hsec/programa' })
  if (d.tieneFaena && d.esHabil && !d.enviadoHoy) tareas.push({ nivel: 'amarillo', txt: 'Hoy aún no envías tu informe diario', href: '/hsec/prevencionista/informe-diario' })
  if (d.proximo) tareas.push({ nivel: 'amarillo', txt: `Informe semanal de ${d.proximo.cliente.nombre}: ${d.proximo.texto}`, href: '/hsec/prevencionista/semanales' })
  d.liderazgo.faltan.slice(0, 3).forEach((f: any) => tareas.push({ nivel: 'amarillo', txt: `Programa de liderazgo: faltan ${f.meta - f.real} de ${ACTIVIDADES[f.k].corto}`, href: '/hsec/programa' }))
  if (d.cap.pend.length) tareas.push({ nivel: 'amarillo', txt: `${d.cap.pend.length} capacitación(es) del calendario sin registrar${d.cap.pend.length <= 2 ? ': ' + d.cap.pend.join(', ') : ''}`, href: '/hsec/prevencionista/capacitaciones' })
  if (d.borradores) tareas.push({ nivel: 'azul', txt: `${d.borradores} informe(s) diario(s) en borrador sin enviar`, href: '/hsec/prevencionista/informe-diario' })
  if (d.porAprobar) tareas.push({ nivel: 'azul', txt: `${d.porAprobar} informe(s) diario(s) esperando la aprobación del Jefe`, href: '/hsec/prevencionista/informe-diario' })

  const rojos = tareas.filter(t => t.nivel === 'rojo').length, amar = tareas.filter(t => t.nivel === 'amarillo').length
  const estado = rojos ? { ic: '🔴', t: 'Hay cosas atrasadas', s: `${rojos} urgente(s) y ${amar} por hacer`, bg: '#fde8e8', col: '#9b1c1c' }
    : amar ? { ic: '🟡', t: 'Vas bien, quedan pendientes', s: `${amar} cosa(s) por hacer, ninguna atrasada`, bg: '#fff8e5', col: '#7a5600' }
    : { ic: '🟢', t: 'Vas al día', s: 'No tienes pendientes. ¡Buen trabajo!', bg: '#e7f6ec', col: '#14532d' }

  const tile = (ic: string, titulo: string, big: string, sub: string, valor: number | null, href: string, color?: string) => (
    <Link href={href} style={{ ...card, textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#667085', fontWeight: 600 }}>{ic} {titulo}</p>
      <p style={{ margin: '0 0 6px', fontSize: '28px', fontWeight: 700, color: color || '#16213E', lineHeight: 1 }}>{big}</p>
      {valor !== null && <div style={{ marginBottom: '6px' }}><Barra valor={valor} /></div>}
      <p style={{ margin: 0, fontSize: '11.5px', color: '#667085' }}>{sub}</p>
    </Link>
  )
  const verde = (v: number | null) => v === null ? '#16213E' : v >= 90 ? '#1e8e4e' : v >= 60 ? '#b7791f' : '#c0392b'

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ ...card, background: estado.bg, borderColor: 'transparent', marginBottom: '10px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <span style={{ fontSize: '30px' }}>{estado.ic}</span>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: estado.col }}>Hola {usuario.nombre.split(' ')[0]} · {estado.t}</p>
          <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: estado.col }}>{estado.s} · {nombreMes(d.mes)}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '10px', marginBottom: '10px' }}>
        {d.liderazgo.tiene && tile('🎯', 'Programa de liderazgo', `${d.liderazgo.pct ?? 0}%`, d.men?.estado === 'enviado' || d.men?.estado === 'aprobado' ? 'Ya enviado a la jefatura' : `${estadoPlazo(d.mes, d.men?.estado).texto}`, d.liderazgo.pct ?? 0, '/hsec/programa', verde(d.liderazgo.pct))}
        {d.tieneFaena && tile('📝', 'Informes diarios del mes', `${d.diasConInforme}/${d.diasHabiles}`, d.enviadoHoy ? 'Hoy: ✓ enviado' : d.esHabil ? 'Hoy: pendiente' : 'Hoy no es día hábil', d.diasHabiles ? Math.round(d.diasConInforme / d.diasHabiles * 100) : null, '/hsec/prevencionista/informe-diario', verde(d.diasHabiles ? d.diasConInforme / d.diasHabiles * 100 : null))}
        {d.tieneSem && tile('📅', 'Informes semanales', d.atrasados.length ? `${d.atrasados.length} atrasado(s)` : '✓ al día', d.proximo ? `Próximo: ${d.proximo.cliente.nombre} · ${d.proximo.limite.split('-').reverse().slice(0, 2).join('-')}` : `${d.semHechos} entregado(s)`, null, '/hsec/prevencionista/semanales', d.atrasados.length ? '#c0392b' : '#1e8e4e')}
        {d.tieneFaena && tile('🎓', 'Capacitaciones a la fecha', d.cap.pct === null ? '—' : `${d.cap.pct}%`, d.cap.plan ? `${d.cap.plan - d.cap.pend.length} de ${d.cap.plan} del calendario` : 'Sin capacitaciones programadas aún', d.cap.pct, '/hsec/prevencionista/capacitaciones', verde(d.cap.pct))}
      </div>

      <div style={card}>
        <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '13.5px', color: '#16213E' }}>Lo que te toca ahora</p>
        {tareas.length === 0 && <p style={{ margin: 0, fontSize: '12.5px', color: '#14532d' }}>Nada pendiente por ahora. 🎉</p>}
        <div style={{ display: 'grid', gap: '6px' }}>
          {tareas.map((t, i) => { const [bg, col, ic] = COL[t.nivel]; return (
            <Link key={i} href={t.href} style={{ textDecoration: 'none', background: bg, color: col, borderRadius: '8px', padding: '8px 10px', fontSize: '12.5px', display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{ic} {t.txt}</span><span style={{ fontWeight: 700 }}>Ir →</span>
            </Link>) })}
        </div>
      </div>
    </div>
  )
}
