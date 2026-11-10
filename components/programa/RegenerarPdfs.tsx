'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { generarRegistroActividad } from '@/lib/generarRegistroActividad'
import { CARGOS_PROGRAMA, ACTIVIDADES } from '@/lib/programa'
import { card, btn } from './ui'

// Vuelve a generar los PDF de los registros ya firmados para que incluyan las fotos de respaldo / cierres y el formato actual.
// Conserva las firmas y la fecha de firma originales; el PDF anterior queda guardado en el almacenamiento.
export default function RegenerarPdfs() {
  const [corriendo, setCorriendo] = useState(false); const [msg, setMsg] = useState(''); const [fallos, setFallos] = useState<string[]>([])
  const correr = async () => {
    if (!confirm('Se volverán a generar los PDF de los registros ya firmados que tienen fotos de respaldo (y los CdP de tarea crítica). Conservan sus firmas y fechas. ¿Continuar?')) return
    setCorriendo(true); setFallos([]); setMsg('Buscando registros…')
    const { data } = await supabase.from('pr_prog_actividades').select('*').not('firmado_at', 'is', null).order('fecha')
    const lista = (data || []).filter((a: any) => (a.datos?.respaldos || []).length > 0 || a.actividad === 'cdp_tarea_critica' || Object.values(a.datos?.det || {}).some((v: any) => v?.cierre))
    const ids = Array.from(new Set(lista.flatMap((a: any) => [a.usuario_id, a.admin_firma_por].filter(Boolean))))
    const [{ data: us }, { data: fs }, { data: ub }] = await Promise.all([
      supabase.from('usuarios').select('id,nombre,cargo_programa').in('id', ids), supabase.from('firmas_usuario').select('usuario_id,imagen').in('usuario_id', ids), supabase.from('ubicaciones').select('id,nombre')])
    const U = Object.fromEntries((us || []).map((u: any) => [u.id, u])), F = Object.fromEntries((fs || []).map((f: any) => [f.usuario_id, f.imagen]))
    let ok = 0; const mal: string[] = []
    for (let i = 0; i < lista.length; i++) {
      const a: any = lista[i]; setMsg(`Regenerando ${i + 1} de ${lista.length}…`)
      try {
        const u = U[a.usuario_id]
        const blob = await generarRegistroActividad({
          actividad: a.actividad, fecha: a.fecha, faena: (ub || []).find((x: any) => x.id === a.ubicacion_id)?.nombre || '', nombre: u?.nombre || '', cargo: u?.cargo_programa ? CARGOS_PROGRAMA[u.cargo_programa] : '',
          datos: a.datos, porcentaje: a.actividad === 'cdp_tarea_critica' ? null : a.porcentaje, firma: F[a.usuario_id] || null, firmadoAt: a.firmado_at,
          admin: a.admin_firma_at ? { nombre: U[a.admin_firma_por]?.nombre || '', firma: F[a.admin_firma_por] || null, firmadoAt: a.admin_firma_at } : null,
        })
        const path = `programa/${a.usuario_id}/registros/${a.id}_${Date.now()}.pdf`
        const up = await supabase.storage.from('hsec-documentos').upload(path, blob, { contentType: 'application/pdf' })
        if (up.error) throw new Error(up.error.message)
        const { error } = await supabase.from('pr_prog_actividades').update({ pdf_path: path }).eq('id', a.id)
        if (error) throw new Error(error.message)
        ok++
      } catch (e: any) { mal.push(`${ACTIVIDADES[a.actividad]?.corto} ${a.fecha}: ${e.message}`) }
    }
    setFallos(mal); setMsg(`Listo: ${ok} de ${lista.length} PDF regenerados.`); setCorriendo(false)
  }
  return (
    <div style={{ ...card, marginBottom: '12px' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={correr} disabled={corriendo} style={{ ...btn(false), padding: '6px 14px', fontSize: '12.5px' }}>{corriendo ? 'Trabajando…' : '🔄 Regenerar PDF de registros antiguos'}</button>
        <span style={{ fontSize: '12.5px', color: '#667085' }}>{msg || 'Incluye las fotos de respaldo en los registros firmados antes de este cambio.'}</span>
      </div>
      {fallos.map((f, i) => <p key={i} style={{ margin: '4px 0 0', fontSize: '12px', color: '#c5221f' }}>{f}</p>)}
    </div>)
}
