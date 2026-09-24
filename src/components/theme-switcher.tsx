"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Moon, Sun, Monitor, Palette, Check } from "lucide-react"
import { cn } from "@/lib/utils"

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════════

type ColorMode = "light" | "dark" | "system"

interface PaletteOption {
    id: string
    label: string
    // Color fijo representativo para el dot de preview.
    // Excepcion documentada a la regla de no usar colores hardcodeados:
    // estos valores son datos estaticos que identifican visualmente cada
    // paleta — no son tokens de tema que deban cambiar con el modo.
    dotColor: string
    dataTheme: string | null
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACION DE PALETAS
// Debe coincidir con los data-theme definidos en globals.css.
// null en dataTheme = paleta Obsidiana (default, sin atributo en <html>)
// ═══════════════════════════════════════════════════════════════════════════════

const PALETTES: PaletteOption[] = [
    {
        id: "obsidiana",
        label: "Obsidiana",
        dotColor: "#C9A44A",
        dataTheme: null,
    },
    {
        id: "turquesa",
        label: "Turquesa",
        dotColor: "#2DD4BF",
        dataTheme: "turquesa",
    },
    {
        id: "piedra",
        label: "Piedra Solar",
        dotColor: "#A0522D",
        dataTheme: "piedra",
    },
]

const COLOR_MODES: { id: ColorMode; label: string; icon: React.ReactNode }[] = [
    { id: "light",  label: "Claro",   icon: <Sun className="h-4 w-4" /> },
    { id: "system", label: "Sistema", icon: <Monitor className="h-4 w-4" /> },
    { id: "dark",   label: "Oscuro",  icon: <Moon className="h-4 w-4" /> },
]

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ThemeSwitcher — Selector de modo y paleta semantica.
 *
 * Componente de verificacion visual para guias 0.1 a 0.5.
 * En Guia 0.6 se reemplaza por ThemeToggler integrado en el Topbar del App Shell,
 * con persistencia en BD y sincronizacion cross-device.
 */
export function ThemeSwitcher() {
    const { theme, setTheme } = useTheme()
    
    // ─── Estado con inicializacion perezosa (Lazy Initializer) ─────────────
    // Evita el error de lint "set-state-in-effect" al leer el valor 
    // antes del primer renderizado directamente desde localStorage.
    const [activePalette, setActivePalette] = React.useState<string>(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("app-palette")
            return saved ? saved : "obsidiana"
        }
        return "obsidiana"
    })

    // ─── Hidratacion segura ──────────────────────────────────────────────────
    // useSyncExternalStore es el patron aprobado para detectar cliente vs servidor.
    // useTheme() retorna undefined en SSR — sin este guard el componente
    // renderiza contenido incorrecto o lanza errores de hidratacion.
    // PROHIBIDO: useState(false) + useEffect(() => setMounted(true))
    const isClient = React.useSyncExternalStore(
        () => () => {},
        () => true,
        () => false,
    )

    // ─── Sincronizacion del DOM (Atributo data-theme) ─────────────────────
    // Sincroniza visualmente el HTML con la paleta activa en estado.
    // Al no hacer setState aqui, evitamos el cascading render.
    React.useEffect(() => {
        const palette = PALETTES.find(p => p.id === activePalette)
        if (palette?.dataTheme) {
            document.documentElement.setAttribute("data-theme", palette.dataTheme)
        } else {
            document.documentElement.removeAttribute("data-theme")
        }
    }, [activePalette])

    // ─── Skeleton de carga ──────────────────────────────────────────────────
    // Mismas dimensiones que el componente real para evitar layout shift.
    if (!isClient) {
        return (
            <div className="w-64 h-40 rounded-xl bg-surface animate-pulse" />
        )
    }

    // ─── Handler de paleta ──────────────────────────────────────────────────
    const handlePaletteChange = (palette: PaletteOption) => {
        setActivePalette(palette.id)
        // Persistir en localStorage — independiente del modo dark/light
        localStorage.setItem("app-palette", palette.id)
    }

    return (
        <div className={cn(
            "flex flex-col gap-4 p-4 rounded-xl border",
            "bg-surface border-border shadow-premium-sm",
            "w-64"
        )}>

            {/* ─── Selector de modo ─────────────────────────────────────────── */}
            <div className="flex flex-col gap-2">
                <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <Monitor className="h-3.5 w-3.5" />
                    Modo
                </span>
                <div className="flex items-center gap-1 p-1 rounded-lg bg-hover-background">
                    {COLOR_MODES.map((mode) => (
                        <button
                            key={mode.id}
                            onClick={() => setTheme(mode.id)}
                            title={mode.label}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md",
                                "text-xs font-medium transition-all duration-150",
                                theme === mode.id
                                    // Activo: fondo elevado + color de acento primario
                                    ? "bg-surface shadow-premium-sm text-primary"
                                    // Inactivo: transparente + texto muted con hover
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {mode.icon}
                            <span className="hidden sm:inline">{mode.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Divisor semantico */}
            <div className="h-px bg-border" />

            {/* ─── Selector de paleta ───────────────────────────────────────── */}
            <div className="flex flex-col gap-2">
                <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <Palette className="h-3.5 w-3.5" />
                    Paleta
                </span>
                <div className="flex flex-col gap-1">
                    {PALETTES.map((palette) => {
                        const isActive = activePalette === palette.id
                        return (
                            <button
                                key={palette.id}
                                onClick={() => handlePaletteChange(palette)}
                                className={cn(
                                    "flex items-center justify-between px-3 py-2 rounded-lg",
                                    "text-sm transition-all duration-150 border",
                                    isActive
                                        // Activo: fondo accent-bg + borde sutil del acento
                                        ? "bg-primary-bg text-primary font-medium border-primary/20"
                                        // Inactivo: hover suave + borde transparente
                                        : "text-foreground hover:bg-hover-background border-transparent"
                                )}
                            >
                                <span className="flex items-center gap-2.5">
                                    {/* Dot de preview — color fijo, ver nota en PaletteOption */}
                                    <span
                                        className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-black/10"
                                        style={{ backgroundColor: palette.dotColor }}
                                    />
                                    {palette.label}
                                </span>
                                {/* Checkmark visible solo en la paleta activa */}
                                {isActive && (
                                    <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
