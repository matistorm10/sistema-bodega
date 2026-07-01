import { supabase } from '@/lib/supabase'

export default async function Home() {
  const { data: categorias, error } = await supabase
    .from('categorias')
    .select('*')
    .order('orden')

  if (error) {
    return <p>Error: {error.message}</p>
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Sistema Bodega INDELI</h1>
      <h2>Categorías ({categorias?.length})</h2>
      <ul>
        {categorias?.map(cat => (
          <li key={cat.id}>{cat.nombre}</li>
        ))}
      </ul>
    </main>
  )
}