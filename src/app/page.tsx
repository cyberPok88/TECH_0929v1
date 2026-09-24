// ============================================================================
// REDIRECTOR RAÍZ — src/app/page.tsx
// Reemplaza la página de verificación visual de las Guías 0.1/0.2.
// No renderiza HTML. Su única función: leer la sesión y redirigir.
//
// Con sesión activa  → /dashboard
// Sin sesión         → /login
//
// Server Component: redirect() ocurre en el servidor antes de enviar HTML.
// El usuario nunca ve esta ruta — pasa por ella sin percibirla.
// El proxy (Parte 1) ya manda al dashboard a los autenticados en '/';
// esta página es la red de seguridad del servidor.
// ============================================================================

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
    const supabase = await createClient()

    // getUser() valida el token contra Supabase Auth desde el servidor
    // NUNCA getSession() — lee sin validar (bloqueado por ESLint de Guía 0.1)
    // getClaims() es exclusivo del Edge Runtime — no aplica en Server Components
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
        redirect('/dashboard')
    } else {
        redirect('/login')
    }

    // Nunca se alcanza en runtime — redirect() lanza NEXT_REDIRECT internamente.
    // Necesario para satisfacer el tipo de retorno JSX.Element | null de TypeScript.
    return null
}
