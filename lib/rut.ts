// Da formato chileno a un RUT mientras se escribe: 12.345.678-9 (puntos de miles y guion antes del dígito verificador)
export function formatearRut(valor: string): string {
  const limpio = (valor || '').replace(/[^0-9kK]/g, '').toUpperCase()
  if (limpio.length <= 1) return limpio
  const cuerpo = limpio.slice(0, -1).replace(/K/g, '')
  const dv = limpio.slice(-1)
  return cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv
}
