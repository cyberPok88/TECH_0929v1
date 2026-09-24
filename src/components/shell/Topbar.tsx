'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// TOPBAR — Guía 0.6 · Smart Component
//
// Control del Sidebar · título contextual · tema · usuario · salir.
//
// ⚠️ Sin buscador global ni campana de notificaciones: no hay entidades que
//    buscar hasta los CRUDs ni tabla de notificaciones en el modelo. Registrados
//    como enchufes #13 y #14. Un input muerto en la barra principal solo enseña
//    al usuario a ignorar esa zona.
//
// Guía 0.11: el chip del avatar y el botón LogOut sueltos se colapsaron en
// <UserMenu /> — dropdown único con Mi perfil + Cerrar sesión.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react'
import { ChevronRight, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

import { ThemeToggler } from '@/components/shell/ThemeToggler'
import { UserMenu } from '@/components/shell/UserMenu'
import { acentoDeRuta } from '@/config/acento-modulo'
import { menuAplanado, useAuth } from '@/lib/stores/auth-store'
import { usePageContextStore } from '@/lib/stores/page-context-store'
import { useSidebarStore } from '@/lib/stores/sidebar-store'
import { cn } from '@/lib/utils'

export function Topbar() {
    const menu = useAuth(menuAplanado)

    // El título sale del store, no de la ruta: así una guía CRUD podrá mostrar
    // "Cotización COT-0042" en vez de "Cotizaciones" sin tocar el Shell.
    const pageInfo = usePageContextStore((s) => s.pageInfo)
    const currentPath = usePageContextStore((s) => s.currentPath)

    // Migaja de pan. Sale del MISMO menu[] que dibuja el Sidebar, no de partir el
    // pathname: '/dashboard/catalogos/productos' daría "catalogos", no "Catálogos".
    // El nombre bonito del módulo solo lo tiene la BD.
    const modulo = useMemo(
        () => menu.find((fila) => fila.href === currentPath)?.nombre_modulo ?? null,
        [menu, currentPath]
    )

    // Acento del módulo dueño de la ruta abierta (remasterización Fase 2):
    // tiñe el eyebrow (migaja) con la tinta del dominio.
    const acento = acentoDeRuta(currentPath)

    const isCollapsed = useSidebarStore((s) => s.isCollapsed)
    const toggleCollapse = useSidebarStore((s) => s.toggleCollapse)
    const setMobileOpen = useSidebarStore((s) => s.setMobileOpen)

    return (
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 md:px-4">
            {/* ─── Abrir drawer (solo móvil) ──────────────────────────────── */}
            <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Abrir menú"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-hover-background hover:text-foreground md:hidden"
            >
                <Menu className="h-4 w-4" />
            </button>

            {/* ─── Colapsar a rail (solo escritorio) ──────────────────────── */}
            <button
                type="button"
                onClick={toggleCollapse}
                aria-label={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
                className="hidden h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-hover-background hover:text-foreground md:inline-flex"
            >
                {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>

            {/* ─── Título contextual ──────────────────────────────────────── */}
            <div className="ml-1 flex min-w-0 flex-col leading-tight">
                <nav
                    aria-label="Ruta actual"
                    className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70"
                >
                    <span className="truncate">Tenochtitlán</span>
                    {modulo && (
                        <>
                            <ChevronRight aria-hidden="true" strokeWidth={2.5} className="size-2.5 shrink-0" />
                            {/* Punto + nombre en tinta del dominio (remasterización Fase 2).
                                El punto no es otro dato: es la señal del dominio en mono. */}
                            <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', acento.punto)} />
                            <span className={cn('truncate font-medium', acento.texto)}>{modulo}</span>
                        </>
                    )}
                </nav>
                <h1 className="truncate text-[15px] font-semibold text-foreground">
                    {pageInfo.title || 'Panel'}
                </h1>
            </div>

            {/* El subtítulo sale del bloque de título y pasa a la derecha del
                separador: apilado bajo la migaja, el encabezado crecía a 3 líneas
                y no cabía en 56px. Se oculta en móvil, donde el ancho es el
                recurso escaso y el título ya identifica la página. */}
            {pageInfo.subtitle && (
                <>
                    <span aria-hidden="true" className="mx-1 hidden h-6 w-px shrink-0 bg-border md:block" />
                    <p className="hidden min-w-0 truncate text-xs text-muted-foreground md:block">
                        {pageInfo.subtitle}
                    </p>
                </>
            )}

            {/* ─── Zona derecha ───────────────────────────────────────────── */}
            <div className="ml-auto flex items-center gap-1">
                {/* Marca: single-tenant, no hay entidad empresa en la sesión
                    (CONTEXTO §7 decisión 1). Es identidad, no selector. */}
                <span className="mr-2 hidden text-xs text-muted-foreground lg:inline">
                    Tenochtitlán <span className="text-muted-foreground/50">by Tech Computer</span>
                </span>

                <ThemeToggler />

                {/* UserMenu (Guía 0.11): dropdown con Mi perfil + Cerrar sesión.
                    Sustituye el chip suelto del avatar y el botón LogOut de la 0.6. */}
                <UserMenu />
            </div>
        </header>
    )
}
