// ============================================================================
// LOGIN PAGE — Guía 0.11 Parte 5 (rediseño Aura)
// Server Component: verifica sesión antes de renderizar, consulta
// hay_usuarios_registrados() e interpreta searchParams para el aviso.
//
// Nueva estructura (sin split 54/46 de la 0.5):
//   <LoginAura />                      ← 6 capas decorativas fijas
//   <LoginThemeSwitcher />             ← selector de paleta (esquina superior derecha)
//   <BrandPanel title=... subtitle=...> ← envoltorio glass centrado
//     <LoginForm mostrarRegistro avisoInicial />
//   </BrandPanel>
//
// Códigos de query soportados (heredado de v1 de esta parte):
//   ?resetOk=1              → banda success "Contraseña actualizada"
//   ?err=callback           → banda error "El enlace no es válido"
//   ?err=session_expired    → banda error "Tu sesión expiró" (reservado)
// ============================================================================

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LoginAura } from '@/components/auth/LoginAura'
import { LoginThemeInjector } from '@/components/auth/LoginThemeInjector'
import { LoginThemeSwitcher } from '@/components/auth/LoginThemeSwitcher'
import { BrandPanel } from '@/components/auth/BrandPanel'
import { LoginForm, type AvisoInicial } from '@/components/auth/LoginForm'

export const metadata = {
    title: 'Iniciar sesión',
}

// Deriva la banda visual a partir de los query params.
// default null → banderas desconocidas se ignoran sin ruido.
function derivarAviso(params: Record<string, string | string[] | undefined>): AvisoInicial | null {
    if (params.resetOk === '1') {
        return {
            tipo: 'success',
            texto: 'Tu contraseña se actualizó correctamente. Puedes iniciar sesión con la nueva.',
        }
    }
    const err = typeof params.err === 'string' ? params.err : null
    switch (err) {
        case 'callback':
            return {
                tipo: 'error',
                texto: 'El enlace no es válido o ya se usó. Puedes solicitar uno nuevo.',
            }
        case 'session_expired':
            return {
                tipo: 'error',
                texto: 'Tu sesión expiró. Vuelve a iniciar sesión.',
            }
        default:
            return null
    }
}

export default async function LoginPage({
    searchParams,
}: {
    // Contrato Next 16 — searchParams es Promise en Server Components desde Next 15+
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const params = await searchParams
    const aviso = derivarAviso(params)

    // Un usuario ya autenticado que navega a /login salta al dashboard.
    // Defensa en profundidad — complementa al proxy (que solo permite el paso).
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) redirect('/dashboard')

    // La BD decide si el registro público existe. hay_usuarios_registrados()
    // es SECURITY DEFINER (Guía 0.5 Parte 1 B3) — se consulta con la anon key.
    // Fail-safe estricto: solo se muestra "Regístrate" si la respuesta es
    // explícitamente false (error/null → registro cerrado).
    const { data: hayUsuarios } = await supabase.rpc('hay_usuarios_registrados')
    const mostrarRegistro = hayUsuarios === false

    return (
        <>
            {/* Tema de arranque ANTES del pintado (Fase 3 · MEJORA 22 Sep): el login
                arranca SIEMPRE en Obsidiana (TEMA_LOGIN), sin importar lo que haya
                en localStorage['theme']. Aura y switcher fuera del panel. */}
            <LoginThemeInjector />
            <LoginAura />
            <LoginThemeSwitcher />

            <BrandPanel
                title="Acceso al sistema"
                subtitle={
                    mostrarRegistro
                        ? 'El imperio te está esperando. Registra al primer usuario del sistema.'
                        : 'El imperio te está esperando. Ingresá tus credenciales.'
                }
            >
                <LoginForm mostrarRegistro={mostrarRegistro} avisoInicial={aviso} />
            </BrandPanel>
        </>
    )
}
