'use client'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useUsuarioActual } from '@/lib/useUsuarioActual'

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { usuario, cargando, sinSesion } = useUsuarioActual()
  const pathname = usePathname()
  const router = useRouter()
  const esLogin = pathname === '/login' || pathname === '/reset-password'

  useEffect(() => {
    if (!cargando && sinSesion && !esLogin) router.push('/login')
  }, [cargando, sinSesion, esLogin, router])

  // Seguro global: si un archivo se suelta fuera de una zona de arrastre diseñada para recibirlo,
  // evita que el navegador lo abra y nos saque de la página (perdiendo lo que estábamos escribiendo).
  useEffect(() => {
    const evitar = (e: DragEvent) => e.preventDefault()
    window.addEventListener('dragover', evitar)
    window.addEventListener('drop', evitar)
    return () => {
      window.removeEventListener('dragover', evitar)
      window.removeEventListener('drop', evitar)
    }
  }, [])

  if (esLogin) return <>{children}</>
  if (cargando) return <div style={{padding:'2rem',textAlign:'center',fontFamily:'system-ui,sans-serif',color:'#999',fontSize:'13px'}}>Cargando...</div>
  if (sinSesion || !usuario) return <div style={{padding:'2rem',textAlign:'center',fontFamily:'system-ui,sans-serif',color:'#999',fontSize:'13px'}}>Redirigiendo al login...</div>

  return <>{children}</>
}
