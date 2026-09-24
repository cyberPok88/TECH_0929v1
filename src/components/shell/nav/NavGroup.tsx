'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// NAV GROUP — Guía 0.6 · Dumb Component
//
// El acordeón de un módulo. Con los módulos sembrados (hoy 5 · D10), mostrarlo todo abierto
// convertiría el Sidebar en scroll infinito.
//
// Recibe `children`, no un array de items: así no necesita conocer NavItemType
// ni cómo se decide qué ítem está activo. Su única tarea es el cromo del
// acordeón. El Sidebar compone: <NavGroup>{items.map(...)}</NavGroup>
//
// ⭐ HÍBRIDO (MEJORA 22 Sep 2026): si el Sidebar pasa `hrefLanding`, el renglón del
// módulo pasa a tener DOS zonas de clic — el enlace al panel del módulo (icono +
// nombre + total) y el chevron que despliega las etapas. Antes ese módulo se
// colapsaba a un único enlace (fix 18 Sep), y sus otras rutas quedaban
// inalcanzables desde el menú.
// ═══════════════════════════════════════════════════════════════════════════════

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { AcentoModulo } from '@/config/acento-modulo'
import type { IconoApp } from '@/config/icon-map'

interface NavGroupProps {
    modulo: string
    icon: IconoApp
    /** Cuántos hijos dibuja el acordeón. Es un dato de la sesión, no del Shell: con
     *  otro rol el mismo módulo llega con menos, y el número lo delata. */
    total: number
    /**
     * ⭐ Híbrido: href del panel del módulo (su item de aterrizaje). Si viene, el
     * encabezado NAVEGA ahí además de desplegar. Lo resuelve el Sidebar.
     */
    hrefLanding?: string
    /** Lo resuelve el Sidebar: la ruta abierta es el panel de este módulo. */
    isActiveHeader?: boolean
    isExpanded: boolean
    isCollapsed: boolean
    /** El Sidebar ya resolvió si la ruta actual vive dentro de este grupo.
     *  Sin esta señal, un grupo plegado que contiene la página abierta dejaría
     *  al usuario sin referencia de dónde está. */
    tieneActivo: boolean
    /** Acento del módulo dueño de la ruta activa. Solo se aplica si tieneActivo. */
    acento?: AcentoModulo
    onToggle: () => void
    /** Aviso de navegación desde el encabezado — el Sidebar cierra el drawer móvil. */
    onNavigate?: () => void
    children: React.ReactNode
}

export function NavGroup({
    modulo,
    icon: Icon,
    total,
    hrefLanding,
    isActiveHeader = false,
    isExpanded,
    isCollapsed,
    tieneActivo,
    acento,
    onToggle,
    onNavigate,
    children,
}: NavGroupProps) {
// ── Modo rail ──────────────────────────────────────────────────────────────
    // Solo sobrevive el icono del MÓDULO: sin children (submódulos). El clic
    // descolapsa el sidebar y abre el grupo — lo decide el onToggle de quien
    // lo compone (Sidebar), que sí conoce el estado colapsado.
    if (isCollapsed) {
        return (
            <div className="py-1">
                <button
                    type="button"
                    onClick={onToggle}
                    aria-label={modulo}
                    title={modulo}
                    className={cn(
                        'flex h-11 w-full items-center justify-center rounded-sm px-0 md:h-9',
                        'text-sidebar-foreground/50 transition-colors',
                        'hover:bg-sidebar-hover hover:text-sidebar-foreground/80',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        // El módulo que contiene la página actual se distingue
                        // aunque todo esté colapsado.
                        tieneActivo && (acento?.texto ?? 'text-primary')
                    )}
                >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                </button>
            </div>
        )
    }

    const etiqueta = cn(
        'truncate text-left font-display text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors',
        // El módulo que contiene la página actual se distingue aunque esté plegado.
        // ⭐ MEJORA 22 Sep 2026 (acento A): la ETIQUETA es UNIFORME — el acento del
        // dominio vive solo en el ICONO del módulo.
        tieneActivo ? 'text-sidebar-foreground' : 'text-sidebar-foreground/50'
    )

    const chevron = (
        // El chevron rota 90°: apuntando a la derecha lee "hay algo dentro",
        // hacia abajo "ya está abierto". En el encabezado simple ocupa el lugar
        // del icono del módulo, que solo competía con los 29 iconos de submódulo
        // (el híbrido sí lo muestra: es un destino, no solo un cajón).
        <ChevronRight
            aria-hidden="true"
            strokeWidth={2.5}
            className={cn(
                'size-3 shrink-0 text-sidebar-foreground/40 transition-transform duration-200',
                isExpanded && 'rotate-90'
            )}
        />
    )

    return (
        <div className="py-0.5">
            {hrefLanding ? (
                /* ── Encabezado HÍBRIDO: enlace al panel + chevron de despliegue ── */
                <div className="flex items-center">
                    <button
                        type="button"
                        onClick={onToggle}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? `Contraer ${modulo}` : `Desplegar ${modulo}`}
                        className={cn(
                            'grid h-11 w-7 shrink-0 place-items-center rounded-sm md:h-8',
                            'text-sidebar-foreground/40 transition-colors hover:text-sidebar-foreground/70',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
                        )}
                    >
                        {chevron}
                    </button>

                    <Link
                        href={hrefLanding}
                        onClick={onNavigate}
                        aria-current={isActiveHeader ? 'page' : undefined}
                        className={cn(
                            'flex h-11 min-w-0 flex-1 items-center gap-2 rounded-sm pr-3 md:h-8',
                            'transition-colors hover:bg-sidebar-hover',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
                        )}
                    >
                        <Icon
                            className={cn(
                                'size-4 shrink-0',
                                isActiveHeader ? (acento?.texto ?? 'text-primary') : 'text-sidebar-foreground/45'
                            )}
                            aria-hidden="true"
                        />
                        <span className={etiqueta}>{modulo}</span>
                        <span className="ml-auto font-mono text-[10px] tabular-nums text-sidebar-foreground/35">
                            {total}
                        </span>
                    </Link>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={onToggle}
                    aria-expanded={isExpanded}
                    className={cn(
                        'flex h-11 w-full items-center gap-2 rounded-sm px-3 md:h-8',
                        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        'hover:bg-sidebar-hover'
                    )}
                >
                    {chevron}
                    <span className={etiqueta}>{modulo}</span>
                    <span className="ml-auto font-mono text-[10px] tabular-nums text-sidebar-foreground/35">
                        {total}
                    </span>
                </button>
            )}

            {isExpanded && (
                <div className="mt-0.5 space-y-0.5">{children}</div>
            )}
        </div>
    )
}
