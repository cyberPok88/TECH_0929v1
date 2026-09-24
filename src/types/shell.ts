// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS DEL APP SHELL — Guía 0.6
// Vocabulario compartido entre stores, diccionarios y componentes del Shell.
// NO describe datos de la BD (eso es types/auth.ts): describe elementos de UI.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { IconoApp } from '@/config/icon-map'
import type { EstadoDesarrollo } from '@/types/auth'

// ═══════════════════════════════════════════════════════════════════════════════
// SISTEMA DE TEMAS — UN SOLO EJE
// CONTEXTO §11 define 3 direcciones completas, cada una con su luminancia.
// No existe "Obsidiana en claro": la paleta ES el modo. Ver Parte 0, Decisión 5.
// ═══════════════════════════════════════════════════════════════════════════════

export type TemaValue = 'obsidiana' | 'turquesa' | 'piedra'

export const TEMA_DEFAULT: TemaValue = 'piedra'

/**
 * Paleta de arranque del ÁREA DE LOGIN (usuario sin autenticar).
 * Decisión del usuario (22 Sep 2026): la tarjeta de presentación arranca SIEMPRE
 * en Obsidiana, sin importar lo que haya en `localStorage['theme']` — la elección
 * pre-login del `LoginThemeSwitcher` NO sobrevive a una recarga (dentro de la
 * pestaña sí, mientras se navegue por SPA entre las pantallas de login).
 * El dashboard NO usa esta constante: ahí manda la preferencia del usuario (BD) o
 * `TEMA_DEFAULT`. La consumen `LoginThemeInjector` (data-theme antes del pintado) y
 * `LoginThemeSwitcher` (resaltado inicial) — una sola fuente, sin duplicar el literal.
 */
export const TEMA_LOGIN: TemaValue = 'obsidiana'

export interface TemaDefinicion {
    id: TemaValue
    nombre: string
    descripcion: string
    /** true → next-themes debe quedar en 'dark' (sonner y utilidades dark: de Tailwind) */
    esOscuro: boolean
    /** Valor del atributo data-theme en <html>. null = Obsidiana, que vive en :root sin atributo */
    dataTheme: string | null
    /**
     * Color fijo del punto de muestra en el selector.
     * Excepción deliberada a "nunca colores hardcodeados": estos tres puntos deben
     * mostrar cómo se ve CADA tema, incluidos los inactivos. Un token semántico
     * pintaría siempre el tema actual y los tres saldrían iguales. Son datos, no tokens.
     */
    muestra: string
}

export const TEMAS: readonly TemaDefinicion[] = [
    {
        id: 'obsidiana',
        nombre: 'Obsidiana',
        descripcion: 'Ámbar cálido sobre piedra volcánica',
        esOscuro: true,
        dataTheme: null,
        muestra: '#C9A44A',
    },
    {
        id: 'turquesa',
        nombre: 'Turquesa',
        descripcion: 'Tech moderno, contraste frío',
        esOscuro: true,
        dataTheme: 'turquesa',
        muestra: '#2DD4BF',
    },
    {
        id: 'piedra',
        nombre: 'Piedra Solar',
        descripcion: 'Terracota natural, modo diurno',
        esOscuro: false,
        dataTheme: 'piedra',
        muestra: '#A0522D',
    },
] as const

/**
 * Valida un string arbitrario contra las 3 direcciones conocidas.
 * La BD guarda preferencias en JSONB: nada impide que llegue basura o un tema
 * de una versión anterior. Sin este guard, un valor desconocido dejaría la app
 * sin atributo data-theme y con colores a medias.
 */
export function esTemaValido(valor: unknown): valor is TemaValue {
    return typeof valor === 'string' && TEMAS.some(t => t.id === valor)
}

// ═══════════════════════════════════════════════════════════════════════════════
// NAVEGACIÓN — lo que el Sidebar dibuja tras agrupar el menú plano de la sesión
// ═══════════════════════════════════════════════════════════════════════════════

/** Una ruta del menú, ya resuelta a componente de icono. */
export interface NavItemType {
    href: string
    label: string
    icon: IconoApp
    estado: EstadoDesarrollo
}

/** Un módulo con sus rutas. Lo produce el reduce del Sidebar, no la BD. */
export interface NavGroupType {
    modulo: string
    icon: IconoApp
    orden: number
    items: NavItemType[]
    /**
     * ⭐ Módulo HÍBRIDO (MEJORA 22 Sep 2026): href del item "aterrizaje" del módulo —
     * el que es prefijo de los demás (Entradas → `/dashboard/entradas` · Sistema →
     * `/dashboard`). El Sidebar lo saca de los children y lo sube al ENCABEZADO del
     * grupo: el renglón navega al panel y el chevron despliega las etapas.
     * Antes (fix 18 Sep) el módulo se colapsaba a ese único enlace — con el efecto
     * colateral de dejar inalcanzables las otras 5 rutas del Sistema.
     */
    hrefLanding?: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOLBAR — barra de acciones contextual
// ═══════════════════════════════════════════════════════════════════════════════

/** Las 9 filas de la tabla `acciones` (6 de Guía 0.4 P6 B8 + `importar` por Guía 1.1 D6 + `suspender` (D23) y `reasignar_vendedor` (Q9) por Guía 1.2 b12 · 23 Ago 2026). Contrato literal con la BD. */
export type AccionClave = 'ver' | 'crear' | 'editar' | 'eliminar' | 'exportar' | 'aprobar' | 'importar' | 'suspender' | 'reasignar_vendedor'

/** Variantes reales del Button de la Guía 0.1. No inventar otras. */
export type ToolbarVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'

export interface ToolbarAction {
    /** Único dentro de la ruta. Es la llave del merge config ⊕ inyectadas. */
    id: string
    label: string
    icon: LucideIcon
    /**
     * Clave de permiso. En la 0.6 es solo declarativa; la Guía 0.7 la cruza contra
     * permisos[].clave_accion para ocultar el botón. Por eso se declara desde ahora:
     * así la 0.7 no necesita modificar toolbar-config.ts.
     */
    accion: AccionClave
    variant?: ToolbarVariant
    disabled?: boolean
    /**
     * Título/tooltip del botón. Se renderiza como `title` en el Button de la
     * Toolbar (Guía 0.6). Lo usan los botones deshabilitados para explicar el
     * porqué — p.ej. "La selección incluye tu propia cuenta".
     * Se compara en areActionsEqual(): un título que cambia ES un cambio visible.
     */
    title?: string
    /**
     * Solo lo traen las acciones inyectadas por una página.
     * Las del diccionario navegan o se conectan en su guía CRUD.
     * ⚠️ Se ignora deliberadamente en areActionsEqual(): una función siempre es
     * una referencia nueva y compararla dispararía re-render infinito.
     */
    onClick?: () => void
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXTO DE PÁGINA — lo que cada page.tsx le comunica al Shell
// ═══════════════════════════════════════════════════════════════════════════════

export interface PageInfo {
    title: string
    subtitle?: string
}

export interface PageConfig {
    info: PageInfo
    /** Debe coincidir CARÁCTER POR CARÁCTER con el href de submodulos y con la clave de toolbar-config. */
    path: string
    actions?: ToolbarAction[]
    /**
     * ⭐ Controles de filtro de la página (01 Sep 2026 · decisión 25 — FiltrosBar).
     * El Shell renderiza la sección `<FiltrosBar />` solo si esto existe; si es
     * undefined/null la sección colapsa. El elemento DEBE ser estable (useMemo):
     * el guard anti-bucle de setPageConfig lo compara por REFERENCIA.
     */
    filtros?: ReactNode
}
