'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN THEME SWITCHER — Guía 0.11 Parte 5 · Selector de paleta para /login
//
// Standalone: no lee auth-store ni llama Server Actions. Usa next-themes +
// data-theme en <html>, respetando el contrato de globals.css (0.1 P3 B10).
//
// ⭐ MEJORA 22 Sep 2026 — el área de login ARRANCA SIEMPRE en TEMA_LOGIN
//    (Obsidiana). El resaltado inicial ya NO lee next-themes: lo que se pinta al
//    cargar lo decide LoginThemeInjector con la MISMA constante, así que leer
//    `theme` (que trae una elección vieja de localStorage['theme']) mostraba el
//    círculo de una paleta mientras la página arrancaba en otra. El clic sí aplica
//    y resalta la elegida; al recargar se vuelve a Obsidiana.
//
// Al loguearse, la 0.6 (ThemeInjector server + ThemeToggler client) reconcilia
// next-themes con usuarios.preferencias.tema — el control pasa a la BD.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { useTheme } from 'next-themes'
import { TEMAS, TEMA_LOGIN, type TemaValue } from '@/types/shell'

export function LoginThemeSwitcher() {
    const { setTheme } = useTheme()

    // El resaltado inicial es la paleta que el inyector fuerza antes del pintado.
    // Estado local (no derivado) porque el clic debe reflejarse de inmediato.
    const [activo, setActivo] = useState<TemaValue>(TEMA_LOGIN)

    const cambiar = (nuevo: TemaValue) => {
        const definicion = TEMAS.find((t) => t.id === nuevo)
        if (!definicion) return
        setActivo(nuevo)

        // next-themes administra la CLASE dark/light (sonner + utilidades dark:) y
        // el color-scheme — NO data-theme. Mismo mapeo que ThemeToggler (0.6):
        // esOscuro → 'dark'.
        setTheme(definicion.esOscuro ? 'dark' : 'light')

        // data-theme lo escribe este componente porque globals.css bindea a
        // [data-theme="turquesa"] / [data-theme="piedra"]; Obsidiana vive en :root
        // SIN atributo, así que se QUITA (escribir data-theme="obsidiana" dejaba un
        // atributo que no existe en el CSS).
        if (typeof document !== 'undefined') {
            if (definicion.dataTheme) {
                document.documentElement.setAttribute('data-theme', definicion.dataTheme)
            } else {
                document.documentElement.removeAttribute('data-theme')
            }
        }
    }

    // Colores de los círculos — muestra de cada paleta (mismos oklch que definen
    // el --bg de cada tema en globals.css).
    const swatchStyle = (tema: TemaValue): React.CSSProperties => {
        const map: Record<TemaValue, string> = {
            obsidiana: 'oklch(0.175 0.008 70)',
            turquesa: 'oklch(0.185 0.020 212)',
            piedra: 'oklch(0.955 0.014 85)',
        }
        return { background: map[tema] }
    }

    return (
        <div
            role="group"
            aria-label="Paleta de tema"
            style={{
                position: 'fixed',
                top: 20,
                right: 24,
                zIndex: 3,
                display: 'flex',
                gap: 6,
                padding: 5,
                background: 'oklch(var(--surface-raised) / 0.6)',
                border: '1px solid oklch(var(--fg) / 0.12)',
                borderRadius: 999,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
            }}
        >
            {TEMAS.map((t) => {
                const seleccionado = activo === t.id
                return (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => cambiar(t.id)}
                        title={t.nombre}
                        aria-label={t.nombre}
                        aria-pressed={seleccionado}
                        style={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            border: seleccionado
                                ? '2px solid oklch(var(--fg) / 0.6)'
                                : t.id === 'piedra'
                                    ? '2px solid oklch(var(--border))'
                                    : '2px solid transparent',
                            cursor: 'pointer',
                            transition: 'transform .12s ease, border-color .12s ease',
                            ...swatchStyle(t.id),
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                    />
                )
            })}
        </div>
    )
}
