// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS DEL DOMINIO — USUARIOS (Guía 0.9)
// Espejo LITERAL de public.usuarios (docs/bd-usuarios.md §3). Los nombres
// snake_case son contrato con la BD: renombrar uno guarda el dato equivocado
// sin romper el build (CLAUDE.md, regla 4).
// ═══════════════════════════════════════════════════════════════════════════════

import type { TonoPildora } from '@/components/data-table'

// ── Fila del listado — lo que proyecta listarUsuarios() ─────────────────────
export interface UsuarioLista {
    id: string
    nombre_completo: string
    email: string
    telefono: string | null
    id_rol: string
    // Aplanado desde el embed roles(nombre): la tabla muestra el nombre, no el id.
    rol_nombre: string
    es_activo: boolean
    es_archivado: boolean
    // ⭐ ENRIQUECIMIENTO 02 Sep 2026 — columnas "Creado el" / "Actualizado el" y
    // badge "Admin principal". es_admin_principal y created_at/updated_at YA
    // existen en la BD (0.4): cero ANEXIÓN-BD.
    es_admin_principal: boolean
    created_at: string
    updated_at: string
}

// ── Opción del <select> de rol ──────────────────────────────────────────────
// ⭐ FRONTERA 0.10: la 0.9 solo LEE el catálogo roles. Dos columnas, nada más.
export interface RolOpcion {
    id: string
    nombre: string
}

// ── Estado derivado de la fila — el vocabulario de esta pantalla ────────────
// No es una columna: se deriva de es_activo/es_archivado. archivado gana.
export type EstadoUsuario = 'activo' | 'inactivo' | 'archivado'

export function estadoDeUsuario(
    u: Pick<UsuarioLista, 'es_activo' | 'es_archivado'>
): EstadoUsuario {
    if (u.es_archivado) return 'archivado'
    return u.es_activo ? 'activo' : 'inactivo'
}

// ⭐ EL MAPA estado → tono VIVE AQUÍ, no en Pildora (Decisión 13).
// Pildora recibe un TonoPildora; no sabe qué es "activo". El vocabulario de
// negocio se queda en su CRUD, y ningún CRUD futuro tiene que editar Pildora.
export const TONO_ESTADO: Record<EstadoUsuario, TonoPildora> = {
    activo: 'exito',
    inactivo: 'neutro',
    archivado: 'advertencia',
}

export const TEXTO_ESTADO: Record<EstadoUsuario, string> = {
    activo: 'Activo',
    inactivo: 'Inactivo',
    archivado: 'Archivado',
}

// ── Estado del filtro de la barra — cuatro posiciones (PLAN §1) ─────────────
// MEJORA 20 Ago 2026: el default es 'todos', que INCLUYE archivados (visibles
// siempre). 'archivados' queda como papelera enfocada (solo archivados);
// 'activo'/'inactivo' excluyen archivados (Decisión 12 revisada).
export type EstadoFiltro = 'activo' | 'inactivo' | 'archivados' | 'todos'

// ── Estado de la barra de filtros (lo posee la página, lo pinta UserFilters) ─
export interface FiltrosUsuario {
    busqueda: string
    // '' = todos los roles
    idRol: string
    estado: EstadoFiltro
}

// ── Forma canónica del formulario del modal ─────────────────────────────────
// Los schemas de Zod (validations/usuarios.ts) producen subconjuntos de esto:
// email y password solo participan en el alta; en edición email es de solo
// lectura (Decisión 7) y password no existe (llega con la 0.11).
export interface UsuarioFormData {
    nombre_completo: string
    email: string
    telefono: string
    id_rol: string
    password: string
    es_activo: boolean
}

// ── Respuestas tipadas de las Server Actions (Decisión 16 — nunca throw) ─────
export interface RespuestaLista<T> {
    success: boolean
    error?: string
    data?: T[]
}

export interface RespuestaAccion {
    success: boolean
    error?: string
}
