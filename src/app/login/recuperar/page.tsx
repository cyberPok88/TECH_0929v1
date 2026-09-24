// ============================================================================
// RECUPERAR PASSWORD PAGE — Guía 0.11 Parte 5 (rediseño Aura)
// Server Component: verifica que NO haya sesión activa (redirige al dashboard
// si la hay). Nuevo layout Aura: consistente con /login y /login/reset.
// ============================================================================

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LoginAura } from '@/components/auth/LoginAura'
import { LoginThemeInjector } from '@/components/auth/LoginThemeInjector'
import { LoginThemeSwitcher } from '@/components/auth/LoginThemeSwitcher'
import { BrandPanel } from '@/components/auth/BrandPanel'
import { RecuperarPasswordForm } from '@/components/auth/RecuperarPasswordForm'

export const metadata = {
    title: 'Recuperar contraseña',
}

export default async function RecuperarPasswordPage() {
    // Un usuario logueado que aterrizó aquí por accidente: /dashboard/perfil es
    // su vía de cambio (Parte 3). Redirigir es el destino esperado.
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) redirect('/dashboard')

    return (
        <>
            <LoginThemeInjector />
            <LoginAura />
            <LoginThemeSwitcher />

            <BrandPanel
                title="¿Olvidaste tu contraseña?"
                subtitle="Te enviaremos un enlace para que puedas volver a entrar."
            >
                <RecuperarPasswordForm />
            </BrandPanel>
        </>
    )
}
