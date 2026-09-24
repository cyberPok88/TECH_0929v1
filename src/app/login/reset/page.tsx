// ============================================================================
// RESET PASSWORD PAGE — Guía 0.11 Parte 5 (rediseño Aura)
// Server Component: verifica sesión temporal PASSWORD_RECOVERY (viva).
// Si no hay sesión (link caducado), muestra CTA dentro del panel para solicitar
// uno nuevo — sin montar el formulario.
// ============================================================================

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LoginAura } from '@/components/auth/LoginAura'
import { LoginThemeInjector } from '@/components/auth/LoginThemeInjector'
import { LoginThemeSwitcher } from '@/components/auth/LoginThemeSwitcher'
import { BrandPanel } from '@/components/auth/BrandPanel'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'

export const metadata = {
    title: 'Establecer nueva contraseña',
}

export default async function ResetPasswordPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // getUser() valida el JWT contra el servidor. Sin sesión temporal (callback
    // no corrió, o aterrizaje en frío escribiendo la URL a mano), user es null.
    // Se muestra el estado terminal en la misma URL — mejor que redirigir y
    // perder el contexto de correo.
    const enlaceValido = !!user

    return (
        <>
            <LoginThemeInjector />
            <LoginAura />
            <LoginThemeSwitcher />

            <BrandPanel
                title={enlaceValido ? 'Nueva contraseña' : 'El enlace no es válido'}
                subtitle={
                    enlaceValido
                        ? 'Elige una contraseña segura para tu cuenta.'
                        : 'El enlace para restablecer tu contraseña ya se usó o caducó.'
                }
            >
                {enlaceValido ? (
                    <ResetPasswordForm />
                ) : (
                    <div style={{ marginTop: 20 }}>
                        <p style={{ fontSize: 13.5, color: 'oklch(var(--muted-fg))', lineHeight: 1.6, marginBottom: 20 }}>
                            Los enlaces son de un solo uso y expiran aproximadamente en una hora.
                            Puedes solicitar uno nuevo abajo.
                        </p>
                        <Link
                            href="/login/recuperar"
                            className="login-btn"
                            style={{ marginTop: 0, textDecoration: 'none' }}
                        >
                            Solicitar un enlace nuevo
                        </Link>
                        <Link
                            href="/login"
                            style={{ display: 'block', textAlign: 'center', marginTop: 14, fontSize: 13, color: 'oklch(var(--muted-fg))', textDecoration: 'none' }}
                        >
                            Volver a iniciar sesión
                        </Link>
                    </div>
                )}
            </BrandPanel>
        </>
    )
}
