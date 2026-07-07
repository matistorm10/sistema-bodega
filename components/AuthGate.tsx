'use client'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useUsuarioActual } from '@/lib/useUsuarioActual'

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { usuario, cargando, sinSesion } = useUsuarioActual()
  const pathname = usePathname()
  const router = useRouter()
  const esLogin = pathname === '/login'

  useEffect(() => {
    if (!cargando && sinSesion && !esLogin) router.push('/login')
  }, [cargando, sinSesion, esLogin, router])

  if (esLogin) return <>{children}</>
  if (cargando) return <div style={{padding:'2rem',textAlign:'center',fontFamily:'system-ui,sans-serif',color:'#999',fontSize:'13px'}}>Cargando...</div>
  if (sinSesion || !usuario) return <div style={{padding:'2rem',textAlign:'center',fontFamily:'system-ui,sans-serif',color:'#999',fontSize:'13px'}}>Redirigiendo al login...</div>

  return <>{children}</>
}
