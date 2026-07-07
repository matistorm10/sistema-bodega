'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AZUL, fondoPagina } from '@/lib/theme'

export default function Inventario() {
  const [ubicaciones, setUbicaciones] = useState<any[]>([])
  const [ubSel, setUbSel] = useState('') // '' = todas las ubicaciones
  const [claseSel, setClaseSel] = useState('') // '' = todas, 'propio', 'arrendado'
  const [items, setItems] = useState<any[]>([])
  const [arriendos, setArriendos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    supabase.from('ubicaciones').select('*').order('tipo').order('nombre').then(({data}) => setUbicaciones(data||[]))
  }, [])

  // Trae TODO el inventario de TODAS las ubicaciones de una vez
  useEffect(() => {
    setCargando(true)
    Promise.all([
      supabase.from('unidades').select('id, codigo, estado, producto_id, ubicacion_id, ubicaciones(nombre), productos(nombre, retornable, tipo_id, tipos(nombre, categoria_id, categorias(nombre, orden)))').neq('estado','baja'),
      supabase.from('stock').select('id, cantidad, producto_id, ubicacion_id, ubicaciones(nombre), productos(nombre, retornable, tipo_id, tipos(nombre, categoria_id, categorias(nombre, orden)))').gt('cantidad', 0),
      supabase.from('arriendos').select('*, tipos(nombre, categorias(nombre)), ubicacion:ubicacion_id(nombre)').eq('estado','activo').order('descripcion')
    ]).then(([unidadesRes, stockRes, arriendosRes]) => {
      if (unidadesRes.error) console.error('Error unidades:', unidadesRes.error.message)
      if (stockRes.error) console.error('Error stock:', stockRes.error.message)
      if (arriendosRes.error) console.error('Error arriendos:', arriendosRes.error.message)
      const deUnidades = (unidadesRes.data||[]).map((u:any) => ({
        retornable: true,
        ubicacion_id: u.ubicacion_id, ubicacion: u.ubicaciones?.nombre || '—',
        categoria: u.productos?.tipos?.categorias?.nombre || '—', categoria_orden: u.productos?.tipos?.categorias?.orden ?? 999,
        tipo: u.productos?.tipos?.nombre || '—',
        producto: u.productos?.nombre || '—',
        codigo: u.codigo, estado: u.estado, cantidad: 1,
        key: 'u-' + u.id
      }))
      const deStock = (stockRes.data||[]).map((s:any) => ({
        retornable: false,
        ubicacion_id: s.ubicacion_id, ubicacion: s.ubicaciones?.nombre || '—',
        categoria: s.productos?.tipos?.categorias?.nombre || '—', categoria_orden: s.productos?.tipos?.categorias?.orden ?? 999,
        tipo: s.productos?.tipos?.nombre || '—',
        producto: s.productos?.nombre || '—',
        codigo: '—', estado: '—', cantidad: s.cantidad,
        key: 's-' + s.id
      }))
      const todas = [...deUnidades, ...deStock].sort((a, b) =>
        a.ubicacion.localeCompare(b.ubicacion) ||
        a.categoria_orden - b.categoria_orden ||
        a.tipo.localeCompare(b.tipo) ||
        a.producto.localeCompare(b.producto) ||
        String(a.codigo).localeCompare(String(b.codigo))
      )
      setItems(todas)
      setArriendos(arriendosRes.data||[])
      setCargando(false)
    })
  }, [])

  const bodegas = ubicaciones.filter(u => u.tipo === 'bodega')
  const faenas = ubicaciones.filter(u => u.tipo === 'faena')

  // Filtros (del lado del cliente, sin volver a consultar la base de datos)
  const mostrarPropio = claseSel === '' || claseSel === 'propio'
  const mostrarArrendado = claseSel === '' || claseSel === 'arrendado'
  const itemsFiltrados = (ubSel ? items.filter(i => i.ubicacion_id === ubSel) : items)
  const arriendosFiltrados = (ubSel ? arriendos.filter(a => a.ubicacion_id === ubSel) : arriendos)

  const th: React.CSSProperties = {textAlign:'left',fontSize:'11px',color:'#666',fontWeight:'600',padding:'8px 10px',borderBottom:'1px solid #e0e0e0',whiteSpace:'nowrap'}
  const td: React.CSSProperties = {fontSize:'12px',color:'#333',padding:'8px 10px',borderBottom:'0.5px solid #eee'}
  const estadoTextColor = (e: string) => e === 'malo' ? '#c5221f' : e === 'bueno' ? '#137333' : '#666'

  const sinResultados = !cargando &&
    (!mostrarPropio || itemsFiltrados.length === 0) &&
    (!mostrarArrendado || arriendosFiltrados.length === 0)

  return (
    <main style={fondoPagina}>
    <div style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'900px',margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'1.5rem',background:'#fff',borderRadius:'16px',padding:'14px 20px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
        <Link href="/" style={{fontSize:'13px',color:AZUL,textDecoration:'none'}}>← Inicio</Link>
        <h1 style={{fontSize:'20px',fontWeight:'600',margin:'0'}}>Inventario</h1>
      </div>

      <div style={{display:'flex',gap:'12px',flexWrap:'wrap',marginBottom:'1.25rem',background:'#fff',borderRadius:'14px',padding:'14px 16px',boxShadow:'0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)'}}>
        <div style={{minWidth:'220px'}}>
          <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Ubicación</label>
          <select value={ubSel} onChange={e=>setUbSel(e.target.value)} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px'}}>
            <option value=''>Todas las ubicaciones</option>
            <optgroup label='Bodegas'>{bodegas.map(b=><option key={b.id} value={b.id}>{b.nombre}</option>)}</optgroup>
            <optgroup label='Faenas'>{faenas.map(f=><option key={f.id} value={f.id}>{f.nombre}{!f.activa ? ' (cerrada)' : ''}</option>)}</optgroup>
          </select>
        </div>
        <div style={{minWidth:'220px'}}>
          <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Clase</label>
          <div style={{display:'flex',gap:'6px'}}>
            {[{v:'',l:'Todos'},{v:'propio',l:'🔧 Propio'},{v:'arrendado',l:'🏗 Arrendado'}].map(op => (
              <button key={op.v} type="button" onClick={()=>setClaseSel(op.v)} style={{flex:1,padding:'8px',borderRadius:'8px',border:claseSel===op.v?`1.5px solid ${AZUL}`:'0.5px solid #ddd',background:claseSel===op.v?'#e8f0fe':'#fff',color:claseSel===op.v?AZUL:'#444',fontSize:'12px',cursor:'pointer'}}>{op.l}</button>
            ))}
          </div>
        </div>
      </div>

      {cargando && <p style={{fontSize:'13px',color:'#999'}}>Cargando...</p>}
      {sinResultados && <p style={{fontSize:'13px',color:'#999'}}>No hay inventario registrado con este filtro.</p>}

      {mostrarPropio && itemsFiltrados.length > 0 && (
        <div style={{marginBottom:'1.5rem'}}>
          <p style={{fontSize:'14px',fontWeight:'700',margin:'0 0 8px'}}>🔧 Herramientas propias</p>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'8px'}}>
              <thead>
                <tr>
                  <th style={th}>Ubicación</th>
                  <th style={th}>Categoría</th>
                  <th style={th}>Tipo</th>
                  <th style={th}>Descripción</th>
                  <th style={th}>Código</th>
                  <th style={th}>Cantidad</th>
                  <th style={th}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {itemsFiltrados.map(row => (
                  <tr key={row.key}>
                    <td style={td}>{row.ubicacion}</td>
                    <td style={td}>{row.categoria}</td>
                    <td style={td}>{row.tipo}</td>
                    <td style={td}>{row.producto}</td>
                    <td style={td}>{row.codigo}</td>
                    <td style={td}>{row.cantidad ?? '—'}</td>
                    <td style={{...td, color: estadoTextColor(row.estado)}}>{row.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {mostrarArrendado && arriendosFiltrados.length > 0 && (
        <div>
          <p style={{fontSize:'14px',fontWeight:'700',margin:'0 0 8px'}}>🏗 Equipos arrendados</p>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'8px'}}>
              <thead>
                <tr>
                  <th style={th}>Ubicación</th>
                  <th style={th}>Categoría</th>
                  <th style={th}>Tipo</th>
                  <th style={th}>Descripción</th>
                  <th style={th}>Proveedor</th>
                  <th style={th}>N° OC</th>
                  <th style={th}>Fecha inicio</th>
                  <th style={th}>Valor día</th>
                  <th style={th}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {arriendosFiltrados.map(a => (
                  <tr key={a.id}>
                    <td style={td}>{a.ubicacion?.nombre || '—'}</td>
                    <td style={td}>{a.tipos?.categorias?.nombre || '—'}</td>
                    <td style={td}>{a.tipos?.nombre || '—'}</td>
                    <td style={td}>{a.descripcion}</td>
                    <td style={td}>{a.proveedor}</td>
                    <td style={td}>{a.orden_compra || '—'}</td>
                    <td style={td}>{a.fecha_inicio}</td>
                    <td style={td}>${Math.round(a.valor_dia).toLocaleString('es-CL')}</td>
                    <td style={{...td, color: estadoTextColor(a.estado_fisico)}}>{a.estado_fisico}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    </main>
  )
}
