'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// THEME TOGGLER — Guía 0.6 · Smart Component
//
// Remasterización (unificación login ↔ dashboard): el selector deja de ser un
// popover (botón con nombre + menú) y pasa a un toggle compacto de 3 puntos —
// el MISMO lenguaje visual que LoginThemeSwitcher del área de login. Cada punto
// pinta el FONDO de su tema (oscuro/oscuro/claro), no el primary, para que la
// paleta se lea igual en la primera ojeada en ambas superficies.
//
// Persistencia intacta (4 escrituras): DOM · localStorage · Zustand · BD.
// El nombre sigue disponible por title/aria-label (nunca se pierde el dato).
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect } from 'react'
import { useTheme } from 'next-themes'

import { guardarTemaAction } from '@/lib/actions/preferences'
import { useAuth, useAuthStoreBase } from '@/lib/stores/auth-store'
import { cn } from '@/lib/utils'
import { TEMAS, TEMA_DEFAULT, esTemaValido, type TemaValue } from '@/types/shell'

/** Fondo de cada tema (mismo que LoginThemeSwitcher): oscuro / oscuro / claro. */
const FONDO_TEMA: Record<TemaValue, string> = {
    obsidiana: 'oklch(0.175 0.008 70)',
    turquesa: 'oklch(0.185 0.020 212)',
    piedra: 'oklch(0.955 0.014 85)',
}

export function ThemeToggler() {
    const { setTheme } = useTheme()
    const temaGuardado = useAuth((s) => s.usuario?.preferencias?.tema)

    // La BD guarda JSONB: puede llegar un valor viejo o basura.
    const temaActual: TemaValue = esTemaValido(temaGuardado) ? temaGuardado : TEMA_DEFAULT

    // ── Reconciliación con next-themes ─────────────────────────────────────────
    // sonner y las utilidades dark: leen la clase dark/light, no data-theme.
    useEffect(() => {
        const definicion = TEMAS.find((t) => t.id === temaActual)
        if (definicion) setTheme(definicion.esOscuro ? 'dark' : 'light')
    }, [temaActual, setTheme])

    /**
     * Las 4 escrituras, en orden deliberado:
     *   1. DOM          — instantáneo, el usuario ve el cambio al soltar el clic
     *   2. localStorage — sobrevive a la recarga aunque la red falle
     *   3. Zustand      — el toggle marca el punto correcto de inmediato
     *   4. BD           — fire-and-forget: solo afecta a OTROS dispositivos
     */
    const cambiarTema = (tema: TemaValue) => {
        const definicion = TEMAS.find((t) => t.id === tema)
        if (!definicion) return

        const raiz = document.documentElement
        if (definicion.dataTheme) {
            raiz.setAttribute('data-theme', definicion.dataTheme)
        } else {
            // Obsidiana vive en :root sin atributo.
            raiz.removeAttribute('data-theme')
        }

        try {
            localStorage.setItem('app-palette', definicion.id)
        } catch {
            // Modo privado o cuota llena: el tema sigue aplicado en esta sesión.
        }
        setTheme(definicion.esOscuro ? 'dark' : 'light')

        useAuthStoreBase.getState().actualizarPreferencias({ tema: definicion.id })

        void guardarTemaAction(definicion.id)
    }

    return (
        <div
            role="group"
            aria-label="Cambiar tema"
            className="inline-flex items-center gap-1 rounded-full border border-border bg-surface p-1"
        >
            {TEMAS.map((tema) => {
                const activo = tema.id === temaActual
                return (
                    <button
                        key={tema.id}
                        type="button"
                        onClick={() => cambiarTema(tema.id)}
                        title={tema.nombre}
                        aria-label={tema.nombre}
                        aria-pressed={activo}
                        className={cn(
                            'size-5 rounded-full border-2 transition-transform hover:scale-110',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                            activo ? 'border-foreground' : 'border-border/60'
                        )}
                        style={{ backgroundColor: FONDO_TEMA[tema.id] }}
                    />
                )
            })}
        </div>
    )
}
