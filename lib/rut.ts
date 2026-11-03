// Da formato chileno a un RUT mientras se escribe: 12.345.678-9 (puntos de miles y guion antes del dígito verificador)
export function formatearRut(valor: string): string {
  const limpio = (valor || '').replace(/[^0-9kK]/g, '').toUpperCase()
  if (limpio.length <= 1) return limpio
  const cuerpo = limpio.slice(0, -1).replace(/K/g, '')
  const dv = limpio.slice(-1)
  return cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv
}

// Valida el dígito verificador (módulo 11) de un RUT chileno
export function rutValido(valor: string): boolean {
  const limpio = (valor || '').replace(/[^0-9kK]/g, '').toUpperCase()
  if (limpio.length < 8) return false
  const cuerpo = limpio.slice(0, -1), dv = limpio.slice(-1)
  let suma = 0, mul = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) { suma += Number(cuerpo[i]) * mul; mul = mul === 7 ? 2 : mul + 1 }
  const r = 11 - (suma % 11)
  const esperado = r === 11 ? '0' : r === 10 ? 'K' : String(r)
  return dv === esperado
}
