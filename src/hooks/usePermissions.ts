// ═══════════════════════════════════════════════════════════════════════════════
// usePermissions — Guía 0.7
//
// «¿Qué acciones me quedan en este href?» — el INVENTARIO reactivo.
//
// Para pantallas que no se conforman con ocultar/deshabilitar botones (una
// página CRUD que quiera pintar su propio menú de acciones completo, o un
// toolbar por módulo). Devuelve las filas de permisos[] cuyo href coincide,
// con sus clave_accion y fecha asignada (via PermisoAccion).
//
// ⚠️ REGLA DURA: nunca filtrar dentro del selector de useAuth. Un array nuevo
//    por render es una snapshot nueva para useSyncExternalStore → re-render →
//    snapshot nueva → BUCLE INFINITO. Por eso se deriva con useMemo sobre la
//    referencia estable de permisos[].
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react'

import { useAuth } from '@/lib/stores/auth-store'
import type { PermisoAccion } from '@/types/auth'

/**
 * Devuelve las acciones concedidas al usuario en `href`.
 * La referencia del array solo cambia cuando permisos[] o `href` cambian.
 */
export function usePermissions(href: string): PermisoAccion[] {
    const permisos = useAuth((s) => s.permisos)

    return useMemo(() => permisos.filter((p) => p.href === href), [permisos, href])
}
