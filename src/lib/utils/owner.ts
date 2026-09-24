// ═══════════════════════════════════════════════════════════════════════════════
// HELPER DEL DUEÑO — Guía 0.10 (local, candidato a PROMOCIÓN a la 0.8)
// useSoloDueno(): ¿es el usuario actual el dueño del sistema?
//
// Es el eje ORTOGONAL al rol: el rol (RBAC) dice qué puede un administrador
// genérico; es_admin_principal dice qué puede SOLO el dueño. En este CRUD la
// única acción exclusiva es eliminar rol.
//
// ⭐ Helper de CLIENTE (hook): lee es_admin_principal del store de auth, igual
// que tienePermiso()/useCanAction() (0.7). La ANEXIÓN 20 Ago a la 0.4 hizo que
// es_admin_principal viaje en obtener_sesion_completa(), así que la sesión ya lo
// trae — sin servidor ni Server Action de lectura. La defensa real (rechazar la
// eliminación) vive en eliminarRol() (servidor), que lo re-verifica por su cuenta.
// Las guías futuras lo reutilizan para sus acciones exclusivas del dueño.
//
// ⭐ El nombre lleva prefijo `use` porque llama a useAuth: la regla
// react-hooks/rules-of-hooks exige que toda función que invoque hooks sea un
// componente o un custom hook (prefijo `use`), como useCanAction() (0.7).
// ═══════════════════════════════════════════════════════════════════════════════

import { useAuth } from '@/lib/stores/auth-store'

/**
 * Indica si el usuario autenticado es el dueño del sistema.
 * Lee es_admin_principal del store (viaja en obtener_sesion_completa()).
 * Es un hook: llamarlo desde componentes ('use client').
 */
export function useSoloDueno(): boolean {
    return useAuth((s) => s.usuario?.es_admin_principal ?? false)
}
