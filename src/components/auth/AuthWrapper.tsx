'use client'

// ============================================================================
// AUTH WRAPPER — Protector del dashboard (lado del cliente)
// Segunda capa de seguridad después del proxy (Parte 1).
// Cubre la navegación SPA donde el proxy no intercepta requests HTTP:
//   · Store vacío con cookie válida (refresh, pestaña nueva) → rehidratar
//   · Sesión inválida o limbo (JWT sin perfil) → limpiar y volver a /login
//   · Logout en otra pestaña / expiración → SIGNED_OUT en vivo → /login
// ============================================================================

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth, useAuthStoreBase } from '@/lib/stores/auth-store'
import { rehidratarSesionAction } from '@/lib/actions/auth'
import { Loader2 } from 'lucide-react'

/**
 * ⭐ FIX 24 Sep 2026 — huella de la sesión (menú + permisos), para re-aplicar la rehidratación
 * SOLO cuando el servidor dice algo distinto y no provocar re-renders en cada navegación.
 */
function huellaSesion(s: {
    menu?: { href: string }[] | null
    permisos?: { href: string; clave_accion: string }[] | null
}): string {
    const menu = (s.menu ?? []).map((m) => m.href).sort().join('|')
    const permisos = (s.permisos ?? []).map((p) => `${p.href}:${p.clave_accion}`).sort().join('|')
    return `${menu}::${permisos}`
}

interface AuthWrapperProps {
    children: React.ReactNode
}

export function AuthWrapper({ children }: AuthWrapperProps) {
    const router = useRouter()
    // useAuth (con useSyncExternalStore) — lectura SSR-safe del store
    const isAuthenticated = useAuth((s) => s.isAuthenticated)
    const isLoading = useAuth((s) => s.isLoading)
    // checking: verificación en curso (local) — spinner mientras se resuelve
    const [checking, setChecking] = useState(true)

    useEffect(() => {
        const { setSesion, clearAuth, setLoading } = useAuthStoreBase.getState()

        const verificarSesion = async () => {
            // Server Action → obtener_sesion_completa() en la BD (usuario + menú + permisos)
            const data = await rehidratarSesionAction()

            // Sesión corrupta o limbo (JWT sin perfil): limpiar y volver al login.
            // En V8 no hay onboarding — el trigger de la Parte 1 crea el perfil en
            // la misma transacción del registro; el error aquí es un caso extremo.
            if (data.error) {
                clearAuth()
                router.replace('/login')
                return
            }

            if (!data.usuario) {
                // Sin usuario → sesión completamente inválida
                clearAuth()
                router.replace('/login')
                return
            }

            // El store ya tiene sesión (navegación interna del dashboard).
            //
            // ⭐ FIX 24 Sep 2026 (RBAC VIVO) — antes este bloque DESCARTABA la respuesta y solo
            // apagaba el loading. El store persistido en localStorage conserva `permisos[]` y
            // `menu[]` del LOGIN, así que un cambio de permisos en la BD (una semilla nueva o el
            // editor de roles) **no llegaba a la sesión abierta ni con F5**: el botón «Cotejar y
            // dar alta» seguía deshabilitado por un `useCanAction` viejo aunque la BD ya lo
            // autorizara. El servidor es la fuente de verdad: si la huella cambió, se aplica.
            // (La RPC ya se estaba llamando; el fix no agrega viajes.)
            const actual = useAuthStoreBase.getState()
            if (actual.isAuthenticated) {
                if (huellaSesion(actual) !== huellaSesion(data)) setSesion(data)
                setLoading(false)
                setChecking(false)
                return
            }

            // Store vacío (refresh de página o pestaña nueva) → hidratar
            setSesion(data)
            setChecking(false)
        }

        verificarSesion()

        // Listener de eventos de Auth — detecta logout multi-pestaña y expiración.
        // El store persistido en localStorage NO se entera solo: onAuthStateChange
        // es la voz de Supabase Auth en tiempo real.
        const supabase = createClient()
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT') {
                clearAuth()
                router.push('/login')
            }
        })

        // Limpiar el listener al desmontar el componente
        return () => subscription.unsubscribe()
    }, [router])

    // Spinner centralizado mientras se verifica la sesión — tokens semánticos
    if (checking || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        )
    }

    // Sin autenticación → no renderizar nada (el useEffect ya redirigió)
    if (!isAuthenticated) return null

    // Sesión válida → renderizar el contenido protegido
    return children
}
