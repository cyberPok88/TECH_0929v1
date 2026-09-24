'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PROTECTED ACTION — Guía 0.7 · Componente de seguridad
//
// Granularidad fina: protege UNA acción (no una ruta entera — eso lo hace el
// RBACGuard). Las guías CRUD (1.0+) envuelven con esto los botones que no
// pasan por el Toolbar: acciones de fila, acciones dentro de tarjetas, etc.
//
//   <ProtectedAction href="/dashboard/catalogos/productos" accion="aprobar">
//       <Button>Aprobar</Button>
//   </ProtectedAction>
//
// modos (Decisión 16):
//   'ocultar'       (default) — el control no existe para quien no puede.
//   'deshabilitar'  — se ve, pero no responde: el usuario aprende que la
//                     acción no es suya sin que el layout salte.
//
// El veredicto sale de useCanAction — reactivo, falla cerrado, cero BD.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCanAction } from '@/hooks/useCanAction'
import { cn } from '@/lib/utils'
import type { AccionClave } from '@/types/shell'

interface ProtectedActionProps {
    /** href de la ruta sobre la que se pregunta (contrato literal de permisos[]) */
    href: string
    /** clave de la acción — contrato literal de la tabla acciones (Guía 0.4) */
    accion: AccionClave
    /** 'ocultar' (default) elimina el control; 'deshabilitar' lo pinta apagado */
    modo?: 'ocultar' | 'deshabilitar'
    children: React.ReactNode
}

export function ProtectedAction({
    href,
    accion,
    modo = 'ocultar',
    children,
}: ProtectedActionProps) {
    const puede = useCanAction(href, accion)

    if (modo === 'deshabilitar') {
        return (
            <span
                aria-disabled={!puede}
                className={cn(!puede && 'pointer-events-none select-none opacity-50')}
            >
                {children}
            </span>
        )
    }

    if (!puede) return null
    return <>{children}</>
}
