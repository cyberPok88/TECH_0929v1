// ═══════════════════════════════════════════════════════════════════════════════
// useCanAction — Guía 0.7
//
// «¿Puede ESTE usuario ejecutar ESTA acción en ESTE href?»
//
// Un veredicto reactivo, derivado de permisos[] (cargado por la RPC al
// loguear o rehidratar): cambiar el rol en la BD cambia los veredictos sin
// recompilar — es el corazón del RBAC VIVO (Parte 0, "Expansión").
//
// ⚠️ FALLA CERRADO por diseño (Parte 1): con la sesión sin hidratar devuelve
//    false. Los componentes que lo usan deben tratar el false como "no",
//    nunca como "todavía no lo sé".
// ═══════════════════════════════════════════════════════════════════════════════

import { useAuth } from '@/lib/stores/auth-store'
import type { AccionClave } from '@/types/shell'

/**
 * Indica si el usuario autenticado puede ejecutar `accion` en `href`.
 * Reactivo: se re-evalúa al cambiar `permisos[]` del store.
 *
 * @example
 * const puedeExportar = useCanAction('/dashboard/catalogos/productos', 'exportar')
 */
export function useCanAction(href: string, accion: AccionClave): boolean {
    return useAuth((s) => s.tienePermiso(href, accion))
}
