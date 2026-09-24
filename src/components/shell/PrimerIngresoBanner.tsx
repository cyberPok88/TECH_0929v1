'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PRIMER INGRESO BANNER — Guía 0.11 Parte 4
//
// Aparece arriba del contenido del dashboard cuando el usuario aún no ha
// cambiado su contraseña temporal (auth.users.user_metadata.password_changed_once
// ausente o false).
//
// La señal `mostrar` viene desde el layout Server (que ya hizo getUser()).
// El componente decide en el cliente si aparece finalmente, aplicando el
// dismiss de sesión (sessionStorage) — dura toda la pestaña, muere al cerrarla.
//
// ⭐ FIX 21 Ago 2026 — dismiss POR USUARIO: la clave de sessionStorage incluye
// el userId. Antes era global a la pestaña: si el admin cerraba el banner y
// luego otro usuario entraba en la MISMA pestaña, el flag viejo lo ocultaba.
// Ahora cada usuario tiene su propio dismiss en la pestaña.
//
// NO bloquea. NO cierra sesión. Es empujón, no guardián.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { KeyRound, X } from 'lucide-react'

interface PrimerIngresoBannerProps {
    mostrar: boolean
    userId: string
}

const storageKey = (userId: string) => `primer-ingreso-dismissed-${userId}`

export function PrimerIngresoBanner({ mostrar, userId }: PrimerIngresoBannerProps) {
    // Estado local — refleja "el usuario cerró el banner en esta pestaña".
    // Inicia en null (indeterminado) para evitar hydration mismatch: durante
    // el primer render Server el sessionStorage no existe, así que devolvemos
    // null y decidimos en el useEffect del cliente.
    const [dismissed, setDismissed] = useState<boolean | null>(null)

    useEffect(() => {
        // Leer el flag solo del lado cliente. Si la pestaña no tiene el flag
        // PARA ESTE USUARIO, el banner puede mostrarse.
        //
        // ⭐ FIX 21 Ago 2026 (react-hooks/set-state-in-effect): el setState NO
        // puede vivir síncrono en el cuerpo del efecto — la regla lo rompe. Se
        // mueve al .then() de una promesa (callback asíncrono, permitido), mismo
        // patrón que el FIX 19 Ago de usuarios/page.tsx.
        Promise.resolve()
            .then(() => {
                try {
                    const guardado = sessionStorage.getItem(storageKey(userId))
                    setDismissed(guardado === 'true')
                } catch {
                    // Storage puede estar bloqueado (modo incógnito estricto, iframe).
                    // Fallback: no dismiss — el banner se muestra hasta que el usuario
                    // cambie la contraseña por otra vía.
                    setDismissed(false)
                }
            })
    }, [userId])

    const cerrar = () => {
        try {
            sessionStorage.setItem(storageKey(userId), 'true')
        } catch {
            // Ignorar — al menos el estado local se actualiza y el banner se va
            // de esta vista.
        }
        setDismissed(true)
    }

    // No mostrar si:
    //   · La señal server dice que no aplica (usuario ya cambió su contraseña)
    //   · El usuario cerró el banner en esta pestaña
    //   · Todavía no se resolvió el estado del sessionStorage (evita flash)
    if (!mostrar || dismissed === null || dismissed === true) return null

    return (
        <div
            role="status"
            aria-live="polite"
            className="mb-4 flex items-start gap-3 rounded-md border border-warning/30 bg-warning-bg px-4 py-3"
        >
            <KeyRound
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning"
            />

            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-warning-fg">
                    Estás usando la contraseña temporal que te asignaron
                </p>
                <p className="mt-0.5 text-xs text-warning-fg/80">
                    Te sugerimos cambiarla por una que solo tú conozcas. Toma menos de un minuto.
                </p>
                <div className="mt-2.5 flex items-center gap-3">
                    <Link
                        href="/dashboard/perfil"
                        className="inline-flex h-8 items-center rounded-md bg-warning px-3 text-xs font-medium text-warning-foreground transition-colors hover:bg-warning-hover"
                    >
                        Cambiar mi contraseña
                    </Link>
                    <button
                        type="button"
                        onClick={cerrar}
                        className="text-xs text-warning-fg/70 hover:text-warning-fg"
                    >
                        Más tarde
                    </button>
                </div>
            </div>

            <button
                type="button"
                onClick={cerrar}
                aria-label="Cerrar aviso"
                className="rounded-md p-1 text-warning-fg/60 hover:bg-warning/10 hover:text-warning-fg"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    )
}
