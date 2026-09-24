'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// SIDEBAR — Guía 0.6 · Smart Component
//
// ⭐ EL COMPONENTE CENTRAL DE ESTA GUÍA.
//
// Dibuja el menú a partir de menu[] de la sesión — que la BD ya filtró por
// permisos_navegacion del rol. NO existe aquí ninguna lista de rutas: si este
// archivo contuviera un array de hrefs, el vendedor vería módulos que no le
// tocan y nada fallaría en tsc ni en build.
//
// Ver Parte 0: "un menú hardcodeado es el anti-patrón central de esta guía".
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Search, X } from 'lucide-react'

import { NavGroup } from '@/components/shell/nav/NavGroup'
import { NavItem } from '@/components/shell/nav/NavItem'
import { Avatar } from '@/components/shell/Avatar'
import { getIcon } from '@/config/icon-map'
import { acentoDeRuta } from '@/config/acento-modulo'
import { useAuth, menuAplanado } from '@/lib/stores/auth-store'
import { useSidebarStore } from '@/lib/stores/sidebar-store'
import { cn } from '@/lib/utils'
import type { NavGroupType } from '@/types/shell'

/**
 * ¿La ruta `href` está activa dado el pathname actual?
 *
 * Regla general: coincidencia exacta O ruta hija
 * (/dashboard/ventas/remisiones/123 debe marcar Remisiones).
 *
 * ⚠️ EXCEPCIÓN /dashboard: es prefijo de las otras 28 rutas. Con la regla
 *    general estaría permanentemente activo, así que se compara exacto.
 */
function esRutaActiva(href: string, pathname: string): boolean {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname === href || pathname.startsWith(href + '/')
}

export function Sidebar() {
    const pathname = usePathname()
    const menu = useAuth(menuAplanado)
    const usuario = useAuth((s) => s.usuario)

    const isCollapsed = useSidebarStore((s) => s.isCollapsed)
    const isMobileOpen = useSidebarStore((s) => s.isMobileOpen)
    const expandedGroups = useSidebarStore((s) => s.expandedGroups)
    const setMobileOpen = useSidebarStore((s) => s.setMobileOpen)
    const toggleGroup = useSidebarStore((s) => s.toggleGroup)
    const setExpandedGroups = useSidebarStore((s) => s.setExpandedGroups)
    const setCollapsed = useSidebarStore((s) => s.setCollapsed)

    // Filtro local del menú. NO es la búsqueda global del enchufe #13: no toca la
    // BD ni busca entidades — solo acota los grupos que ya llegaron en la sesión.
    // Es volátil a propósito: nadie quiere reabrir la app con el menú filtrado.
    const [filtro, setFiltro] = useState('')

    // ═══════════════════════════════════════════════════════════════════════════
    // ⭐ EL REDUCE — 29 filas planas → 9 grupos
    //
    // NO ordena nada: obtener_sesion_completa() ya devuelve el menú con
    // ORDER BY orden_modulo, orden_submodulo. Un Map conserva el orden de
    // inserción, así que recorrer en orden produce grupos en orden.
    // Reordenar aquí duplicaría una decisión que ya tomó la BD.
    // ═══════════════════════════════════════════════════════════════════════════
    const grupos = useMemo<NavGroupType[]>(() => {
        const acumulador = new Map<string, NavGroupType>()

        for (const fila of menu) {
            let grupo = acumulador.get(fila.nombre_modulo)

            if (!grupo) {
                grupo = {
                    modulo: fila.nombre_modulo,
                    icon: getIcon(fila.icono_modulo),
                    orden: fila.orden_modulo,
                    items: [],
                }
                acumulador.set(fila.nombre_modulo, grupo)
            }

            grupo.items.push({
                href: fila.href,
                label: fila.nombre_submodulo,
                icon: getIcon(fila.icono_submodulo),
                estado: fila.estado_desarrollo,
            })
        }

        return Array.from(acumulador.values()).map((grupo) => {
            // ⭐ Módulo HÍBRIDO (MEJORA 22 Sep 2026 · antes el colapso del fix 18 Sep):
            // un item cuyo href es prefijo de los demás es el "aterrizaje" del módulo
            // (Entradas → /dashboard/entradas · Sistema → /dashboard). NO se colapsa:
            // ese href sube al ENCABEZADO del grupo (el renglón navega al panel) y los
            // demás items siguen formando el acordeón. El colapso anterior escondía 5
            // rutas del Sistema (empresa · usuarios · roles · configuración · pruebas).
            if (grupo.items.length <= 1) return grupo
            const aterrizaje = grupo.items.find((item) =>
                grupo.items.every((otro) => otro.href === item.href || otro.href.startsWith(item.href + '/'))
            )
            return aterrizaje ? { ...grupo, hrefLanding: aterrizaje.href } : grupo
        })
    }, [menu])

    // Módulo que contiene la ruta abierta. Se calcula sobre `grupos` (el menú
    // completo), NO sobre los filtrados: si se calculara sobre el filtro, teclear
    // algo que excluya la página actual la dejaría sin módulo activo.
    const moduloActivo = useMemo(() => {
        const grupo = grupos.find((g) => g.items.some((i) => esRutaActiva(i.href, pathname)))
        return grupo?.modulo ?? null
    }, [grupos, pathname])

    // Acento del módulo dueño de la ruta abierta (remasterización Fase 2).
    // Los ítems activos del Sidebar lo usan como tinta de dominio.
    const acento = acentoDeRuta(pathname)

    // Un módulo sobrevive al filtro si coincide su nombre —y entonces conserva
    // todas sus rutas— o si alguna de sus rutas coincide.
    const gruposVisibles = useMemo<NavGroupType[]>(() => {
        const aguja = filtro.trim().toLowerCase()
        if (!aguja) return grupos

        return grupos.flatMap((grupo) => {
            if (grupo.modulo.toLowerCase().includes(aguja)) return [grupo]

            const items = grupo.items.filter((i) => i.label.toLowerCase().includes(aguja))
            return items.length > 0 ? [{ ...grupo, items }] : []
        })
    }, [grupos, filtro])

    // Con filtro activo todo se muestra abierto: plegar lo que el usuario acaba
    // de buscar obligaría a un segundo clic para ver el resultado.
    const hayFiltro = filtro.trim().length > 0

    // Auto-expandir el grupo de la ruta actual.
    // Recargar en /dashboard/ventas/remisiones con todo cerrado dejaría al
    // usuario sin pista de dónde está: la expansión es informativa.
    useEffect(() => {
        if (!moduloActivo) return
        if (expandedGroups.includes(moduloActivo)) return
        setExpandedGroups([...expandedGroups, moduloActivo])
        // expandedGroups fuera de deps a propósito: solo interesa reaccionar al
        // cambio de ruta, no a cada plegado manual del usuario.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [moduloActivo])

    return (
        <>
            {/* ─── Backdrop del drawer móvil ──────────────────────────────── */}
            {isMobileOpen && (
                <div
                    aria-hidden="true"
                    onClick={() => setMobileOpen(false)}
                    className="fixed inset-0 z-40 bg-black/50 md:hidden"
                />
            )}

            <aside
                className={cn(
                    'shell-transition z-50 flex flex-col border-r border-border bg-sidebar',
                    'shadow-premium-side',
                    // Escritorio: columna fija que cambia de ancho al colapsar
                    'md:relative md:translate-x-0',
                    isCollapsed ? 'md:w-16' : 'md:w-64',
                    // Móvil: drawer deslizante
                    'fixed inset-y-0 left-0 w-64',
                    isMobileOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                {/* ─── Marca ──────────────────────────────────────────────── */}
                <div
                    className={cn(
                        'flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-3',
                        isCollapsed && 'md:justify-center md:px-0'
                    )}
                >
                    <span className="grid size-7 shrink-0 place-items-center rounded-sm bg-primary font-display text-[13px] font-bold text-primary-fg">
                        T
                    </span>
                    {!isCollapsed && (
                        <span className="flex min-w-0 flex-col leading-tight">
                            <span className="truncate font-display text-[13px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground">
                                Tenochtitlán
                            </span>
                            <span className="truncate font-mono text-[9px] uppercase tracking-widest text-sidebar-foreground/50">
                                Imperio Tecnológico
                            </span>
                        </span>
                    )}

                    {/* Cerrar el drawer — solo móvil */}
                    <button
                        type="button"
                        onClick={() => setMobileOpen(false)}
                        aria-label="Cerrar menú"
                        className="ml-auto rounded p-1 text-sidebar-foreground/60 hover:bg-sidebar-hover md:hidden"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* ─── Filtro de rutas ────────────────────────────────────── */}
                {/* Oculto en rail: sin ancho para el input, y escribir en él
                    obligaría a descolapsar de todos modos. */}
                {!isCollapsed && (
                    <div className="shrink-0 px-3 py-2.5">
                        <div className="flex items-center gap-2 rounded-sm border border-border bg-surface-2 px-2 focus-within:border-primary/50">
                            <Search
                                aria-hidden="true"
                                strokeWidth={1.75}
                                className="size-3.5 shrink-0 text-sidebar-foreground/50"
                            />
                            <input
                                type="search"
                                value={filtro}
                                onChange={(e) => setFiltro(e.target.value)}
                                aria-label="Filtrar módulos y rutas"
                                placeholder="Filtrar módulo o ruta…"
                                className="h-9 w-full bg-transparent text-[12px] text-sidebar-foreground outline-none placeholder:text-sidebar-foreground/40 md:h-7"
                            />
                        </div>
                    </div>
                )}

                {/* ─── Navegación ─────────────────────────────────────────── */}
                <nav
                    aria-label="Navegación principal"
                    className="custom-scrollbar flex-1 overflow-y-auto px-2 pb-3"
                >
                    {grupos.length === 0 ? (
                        // Menú vacío = la BD no dio permisos de navegación a este rol.
                        // No es un error de render: es información.
                        <p className="px-3 py-6 text-xs text-sidebar-foreground/50">
                            Tu rol no tiene módulos asignados. Contacta al administrador.
                        </p>
                    ) : gruposVisibles.length === 0 ? (
                        // Distinto del caso anterior: aquí SÍ hay menú, no hay coincidencias.
                        <p className="px-3 py-6 text-xs text-sidebar-foreground/50">
                            Ninguna ruta coincide con «{filtro.trim()}».
                        </p>
                    ) : (
                        gruposVisibles.map((grupo) => {
                            // El item de aterrizaje no se repite como child: vive en el
                            // encabezado (hrefLanding). `total` cuenta los hijos reales.
                            const hijos = grupo.items.filter((i) => i.href !== grupo.hrefLanding)
                            return (
                                <NavGroup
                                    key={grupo.modulo}
                                    modulo={grupo.modulo}
                                    icon={grupo.icon}
                                    total={hijos.length}
                                    hrefLanding={grupo.hrefLanding}
                                    isActiveHeader={
                                        grupo.hrefLanding
                                            ? esRutaActiva(grupo.hrefLanding, pathname)
                                            : false
                                    }
                                    isExpanded={hayFiltro || expandedGroups.includes(grupo.modulo)}
                                    isCollapsed={isCollapsed}
                                    tieneActivo={moduloActivo === grupo.modulo}
                                    acento={acento}
                                    onNavigate={() => setMobileOpen(false)}
                                    onToggle={() => {
                                        if (isCollapsed) {
                                            // Rail: el clic en un módulo descolapsa
                                            // el sidebar y deja ese grupo abierto.
                                            setCollapsed(false)
                                            setExpandedGroups(
                                                expandedGroups.includes(grupo.modulo)
                                                    ? expandedGroups
                                                    : [...expandedGroups, grupo.modulo]
                                            )
                                        } else {
                                            toggleGroup(grupo.modulo)
                                        }
                                    }}
                                >
                                    {hijos.map((item) => (
                                        <NavItem
                                            key={item.href}
                                            item={item}
                                            isActive={esRutaActiva(item.href, pathname)}
                                            isCollapsed={isCollapsed}
                                            acento={acento}
                                            onNavigate={() => setMobileOpen(false)}
                                        />
                                    ))}
                                </NavGroup>
                            )
                        })
                    )}
                </nav>

                {/* ─── Tarjeta de usuario ─────────────────────────────────── */}
                {usuario && (
                    <div
                        className={cn(
                            'flex shrink-0 items-center gap-2.5 border-t border-border p-3',
                            isCollapsed && 'md:justify-center'
                        )}
                    >
                        <Avatar nombre={usuario.nombre_completo} size="sm" />
                        {!isCollapsed && (
                            <span className="flex min-w-0 flex-col leading-tight">
                                <span className="truncate text-[12px] text-sidebar-foreground">
                                    {usuario.nombre_completo}
                                </span>
                                <span className="truncate font-mono text-[10px] uppercase tracking-wider text-sidebar-foreground/50">
                                    {usuario.rol.nombre}
                                </span>
                            </span>
                        )}
                    </div>
                )}
            </aside>
        </>
    )
}
