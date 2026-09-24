'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// NAV ITEM — Guía 0.6 · Dumb Component
//
// Un enlace del Sidebar. NO sabe cuál es la ruta actual: recibe isActive.
//
// ⚠️ next/link SÍ está permitido en un Dumb Component. La regla prohíbe LEER
//    estado del router (useRouter / usePathname), porque eso suscribiría los 29
//    ítems a cada navegación. Link solo navega y prefetchea: no lee nada.
// ═══════════════════════════════════════════════════════════════════════════════

import Link from 'next/link'

import { EstadoBadge } from '@/components/shell/EstadoBadge'
import { cn } from '@/lib/utils'
import type { AcentoModulo } from '@/config/acento-modulo'
import type { NavItemType } from '@/types/shell'

interface NavItemProps {
    item: NavItemType
    /** Lo calcula el Sidebar, que es quien conoce la ruta actual. */
    isActive: boolean
    isCollapsed: boolean
    /** Aviso de "me hicieron clic". El Sidebar decide si cierra el drawer. */
    onNavigate?: () => void
    /** Acento del módulo dueño de la ruta activa. Solo se aplica si isActive. */
    acento?: AcentoModulo
}

export function NavItem({ item, isActive, isCollapsed, onNavigate, acento }: NavItemProps) {
    const Icon = item.icon

    return (
        <Link
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? 'page' : undefined}
            // El tooltip nativo solo aporta en modo rail, donde no hay texto.
            // Fuera de ahí duplicaría la etiqueta visible.
            title={isCollapsed ? item.label : undefined}
            className={cn(
                'group relative flex items-center gap-2.5 rounded-sm pl-3.5 pr-2.5',
                // Densidad de dos alturas: 44px es el objetivo táctil mínimo de
                // CONTEXTO §11 (el cobrador opera en tableta); 34px es la densidad
                // de escritorio que deja ver el menú sin scroll infinito.
                'h-11 md:h-[34px]',
                'text-[13px] transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                // ⭐ MEJORA 22 Sep 2026 (acento A): el fondo y el texto del ítem activo son
                // UNIFORMES (como antes del acento por módulo). El acento del dominio vive
                // solo en el ICONO y el RIEL — el menú deja de ser un semáforo.
                isActive
                    ? 'bg-primary-bg text-sidebar-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-hover hover:text-sidebar-foreground',
                isCollapsed && 'justify-center px-0'
            )}
        >
            {/* Riel al borde izquierdo. Existe siempre —transparente en reposo—
                para que el hover lo insinúe y el activo lo encienda sin que la
                fila salte de ancho al aparecer y desaparecer un elemento. */}
            <span
                aria-hidden="true"
                className={cn(
                    'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r transition-colors',
                    isActive ? (acento?.punto ?? 'bg-primary') : 'bg-transparent group-hover:bg-sidebar-foreground/30'
                )}
            />

            <Icon
                className={cn('size-4 shrink-0', isActive ? (acento?.texto ?? 'text-primary') : 'opacity-80')}
                aria-hidden="true"
            />

            {/* En modo rail solo sobrevive el icono. */}
            {!isCollapsed && (
                <>
                    <span className="flex-1 truncate">{item.label}</span>
                    <EstadoBadge estado={item.estado} variante="punto" />
                </>
            )}
        </Link>
    )
}
