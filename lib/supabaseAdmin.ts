import { createClient } from '@supabase/supabase-js'

// ¡NUNCA importar este archivo desde un componente 'use client'!
// Solo se usa dentro de app/api/.../route.ts (código de servidor).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})