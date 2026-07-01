'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const tabs = ['Ingreso', 'Traslado', 'Cambio estado', 'Devolución', 'Pérdida']

export default function Movimientos() {
  const [tab, setTab] = useState('Ingreso')
  const [clase, setClase] = useState('propio')
  const [categorias, setCategorias] = useState<any[]>([])
  const [tipos, setTipos] = useState<any[]>([])
  const [ubicaciones, setUbicaciones] = useState<any[]>([])
  const [catSel, setCatSel] = useState('')
  const [tipoSel, setTipoSel] = useState('')
  const [dstSel, setDstSel] = useState('')
  const [modelo, setModelo] = useState('')
  const [codigo, setCodigo] = useState('')
  const [retornable, setRetornable] = useState('1')
  const [cantidad, setCantidad] = useState(1)
  const [exito, setExito] = useState('')

  useEffect(() => {
    supabase.from('categorias').select('*').order('orden').then(({data}) => setCategorias(data||[]))
    supabase.from('ubicaciones').select('*').order('nombre').then(({data}) => setUbicaciones(data||[]))
  }, [])

  useEffect(() => {
    if (!catSel) { setTipos([]); setTipoSel(''); return }
    supabase.from('tipos').select('*').eq('categoria_id', catSel).order('nombre').then(({data}) => { setTipos(data||[]); setTipoSel('') })
  }, [catSel])

  const bodegas = ubicaciones.filter(u => u.tipo === 'bodega')
  const faenas = ubicaciones.filter(u => u.tipo === 'faena' && u.activa)

  const registrar = async () => {
    if (!tipoSel || !dstSel || !modelo) { alert('Completa todos los campos.'); return }
    
    // 1. Crear o encontrar el producto
    let productoId = ''
    const { data: prodExist } = await supabase.from('productos').select('id').eq('tipo_id', tipoSel).eq('nombre', modelo).single()
    
    if (prodExist) {
      productoId = prodExist.id
    } else {
      const { data: newProd } = await supabase.from('productos').insert({tipo_id: tipoSel, nombre: modelo, retornable: retornable==='1', unidad: retornable==='1'?'un':'un', revisado: false}).select('id').single()
      productoId = newProd?.id
    }

    // 2. Registrar unidad o stock
    if (retornable === '1') {
      if (!codigo) { alert('Ingresa el código único.'); return }
      await supabase.from('unidades').insert({producto_id: productoId, codigo, estado: 'bueno', ubicacion_id: dstSel})
    } else {
      const { data: stockEx } = await supabase.from('stock').select('id, cantidad').eq('producto_id', productoId).eq('ubicacion_id', dstSel).single()
      if (stockEx) {
        await supabase.from('stock').update({cantidad: stockEx.cantidad + cantidad}).eq('id', stockEx.id)
      } else {
        await supabase.from('stock').insert({producto_id: productoId, ubicacion_id: dstSel, cantidad})
      }
    }

    setExito(`${modelo} registrado en ${ubicaciones.find(u=>u.id===dstSel)?.nombre}.`)
    setCatSel(''); setTipoSel(''); setModelo(''); setCodigo(''); setDstSel(''); setCantidad(1)
    setTimeout(() => setExito(''), 4000)
  }
    

  if (exito) return (
    <main style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'600px',margin:'0 auto',textAlign:'center',paddingTop:'4rem'}}>
      <div style={{fontSize:'48px',marginBottom:'12px'}}>✅</div>
      <p style={{fontSize:'16px',fontWeight:'600',margin:'0 0 8px',color:'#137333'}}>Movimiento registrado</p>
      <p style={{fontSize:'13px',color:'#666',margin:'0 0 24px'}}>{exito}</p>
      <button onClick={()=>setExito('')} style={{padding:'10px 24px',borderRadius:'8px',border:'none',background:'#1a73e8',color:'#fff',fontSize:'14px',fontWeight:'600',cursor:'pointer'}}>Registrar otro</button>
    </main>
  )

  return (
    <main style={{padding:'1.5rem',fontFamily:'system-ui,sans-serif',maxWidth:'600px',margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'1.5rem'}}>
        <Link href="/" style={{fontSize:'13px',color:'#1a73e8',textDecoration:'none'}}>← Inicio</Link>
        <h1 style={{fontSize:'20px',fontWeight:'600',margin:'0'}}>Movimientos</h1>
      </div>

      <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginBottom:'1rem'}}>
        {tabs.map(t => (
          <button key={t} onClick={()=>{setTab(t);setExito('')}} style={{padding:'6px 12px',borderRadius:'20px',border:'0.5px solid',fontSize:'12px',cursor:'pointer',background:tab===t?'#1a73e8':'#fff',color:tab===t?'#fff':'#444',borderColor:tab===t?'#1a73e8':'#ddd'}}>{t}</button>
        ))}
      </div>

      {tab !== 'Devolución' && (
        <div style={{display:'flex',gap:'8px',marginBottom:'1rem'}}>
          {['propio','arrendado'].map(c => (
            <button key={c} onClick={()=>setClase(c)} style={{flex:1,padding:'8px',borderRadius:'8px',border:'0.5px solid',fontSize:'13px',cursor:'pointer',background:clase===c?'#e8f0fe':'#fff',color:clase===c?'#1a73e8':'#444',borderColor:clase===c?'#1a73e8':'#ddd'}}>
              {c === 'propio' ? '🔧 Herramienta propia' : '🏗 Equipo arrendado'}
            </button>
          ))}
        </div>
      )}

      {tab === 'Ingreso' && clase === 'propio' && (
        <div style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'16px'}}>
          <div style={{marginBottom:'10px'}}>
            <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Categoría</label>
            <select value={catSel} onChange={e=>setCatSel(e.target.value)} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px'}}>
              <option value=''>Selecciona categoría...</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          {catSel && (
            <div style={{marginBottom:'10px'}}>
              <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Tipo</label>
              <select value={tipoSel} onChange={e=>setTipoSel(e.target.value)} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px'}}>
                <option value=''>Selecciona tipo...</option>
                {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
          )}

          {tipoSel && (
            <>
              <div style={{marginBottom:'10px'}}>
                <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Modelo / descripción</label>
                <input value={modelo} onChange={e=>setModelo(e.target.value)} placeholder="Ej: Taladro Bosch GSB 13" style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px',boxSizing:'border-box'}}/>
              </div>
              <div style={{marginBottom:'10px'}}>
                <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>¿Retornable?</label>
                <select value={retornable} onChange={e=>setRetornable(e.target.value)} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px'}}>
                  <option value='1'>Sí — código único por unidad</option>
                  <option value='0'>No — consumible por cantidad</option>
                </select>
              </div>
              {retornable==='1' ? (
                <div style={{marginBottom:'10px'}}>
                  <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Código único</label>
                  <input value={codigo} onChange={e=>setCodigo(e.target.value)} placeholder="Ej: BSH-001" style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px',boxSizing:'border-box'}}/>
                </div>
              ) : (
                <div style={{marginBottom:'10px'}}>
                  <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Cantidad</label>
                  <input type='number' value={cantidad} onChange={e=>setCantidad(Number(e.target.value))} min={1} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px',boxSizing:'border-box'}}/>
                </div>
              )}
              <div style={{marginBottom:'14px'}}>
                <label style={{fontSize:'13px',color:'#555',display:'block',marginBottom:'4px'}}>Destino</label>
                <select value={dstSel} onChange={e=>setDstSel(e.target.value)} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #ddd',fontSize:'13px'}}>
                  <option value=''>Selecciona destino...</option>
                  <optgroup label='Bodegas'>{bodegas.map(b=><option key={b.id} value={b.id}>{b.nombre}</option>)}</optgroup>
                  <optgroup label='Faenas'>{faenas.map(f=><option key={f.id} value={f.id}>{f.nombre}</option>)}</optgroup>
                </select>
              </div>
              <button onClick={registrar} style={{width:'100%',padding:'10px',borderRadius:'8px',border:'none',background:'#1a73e8',color:'#fff',fontSize:'14px',fontWeight:'600',cursor:'pointer'}}>Registrar ingreso</button>
            </>
          )}
        </div>
      )}

      {(tab !== 'Ingreso' || clase === 'arrendado') && (
        <div style={{background:'#fff',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'24px',textAlign:'center'}}>
          <p style={{fontSize:'13px',color:'#999',margin:'0'}}>Esta sección está en construcción. Próximamente disponible.</p>
        </div>
      )}
    </main>
  )
}