// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS DEL DOMINIO — ROLES Y EDITOR DE PERMISOS (Guía 0.10)
// Espejo LITERAL de public.roles / permisos_* / modulos / submodulos
// (docs/bd-roles.md §3 y ESQUEMA_BD.md). Los nombres snake_case son contrato con
// la BD: renombrar uno guarda el dato equivocado sin romper el build.
// ═══════════════════════════════════════════════════════════════════════════════

import type { TonoPildora } from '@/components/data-table'

// ── Fila del listado — lo que proyecta listarRoles() ─────────────────────────
export interface RolLista {
    id: string
    clave: string
    nombre: string
    descripcion: string | null
    nivel_jerarquico: number
    es_sistema: boolean
    es_editable: boolean
    created_at: string
}

// ── Tipo derivado de es_sistema / PERMISOS_SEMILLA — el vocabulario de esta pantalla ──
// No es una columna: se deriva. 'sistema' = rol de semilla (los 7 de la 0.4:
// administrador por es_sistema + los 6 editables por su clave en PERMISOS_SEMILLA).
// 'personalizado' = creado nuevo o clonado (clave fuera de la semilla).
export type TipoRol = 'sistema' | 'personalizado'

/** ¿Es un rol de semilla (los 7 de la 0.4)? es_sistema O clave en PERMISOS_SEMILLA. */
export function esRolDeSemilla(r: Pick<RolLista, 'es_sistema' | 'clave'>): boolean {
    return r.es_sistema || Boolean(PERMISOS_SEMILLA[r.clave])
}

export function tipoDeRol(r: Pick<RolLista, 'es_sistema' | 'clave'>): TipoRol {
    return esRolDeSemilla(r) ? 'sistema' : 'personalizado'
}

// ⭐ EL MAPA tipo → tono VIVE AQUÍ, no en Pildora. Pildora recibe un TonoPildora
// y no conoce la palabra "sistema"; el vocabulario se queda en su CRUD.
export const TONO_TIPO: Record<TipoRol, TonoPildora> = {
    sistema: 'info',
    personalizado: 'neutro',
}

export const TEXTO_TIPO: Record<TipoRol, string> = {
    sistema: 'Sistema',
    personalizado: 'Personalizado',
}

// ── Filtro del catálogo (PLAN §1) ─────────────────────────────────────────────
// 'sistema' = semilla · 'personalizado' = fuera de semilla · 'todos' = sin filtro.
export type TipoFiltro = 'todos' | 'sistema' | 'personalizado'

export interface FiltrosRoles {
    busqueda: string
    tipo: TipoFiltro
}

// ── Forma canónica del formulario del modal ───────────────────────────────────
// clave es SOLO de alta (inmutable — R1). Los schemas de Zod producen subconjuntos.
export interface RolFormData {
    clave: string
    nombre: string
    nivel_jerarquico: number
    descripcion: string
}

// ── Acciones que el editor ofrece (R4 — aprobar NO se ofrece) ─────────────────
export type AccionEditor = 'ver' | 'crear' | 'editar' | 'eliminar' | 'exportar'

export const ACCIONES_EDITOR: AccionEditor[] = ['ver', 'crear', 'editar', 'eliminar', 'exportar']

// ── Payload de permisos para la RPC (docs/bd-roles.md §2.1) ───────────────────
// Cada submódulo con su lista de acciones. Sin 'ver', el RPC lo descarta entero.
export interface PermisoPayload {
    href: string
    acciones: AccionEditor[]
}

// ── Árbol del editor: módulo → submódulos ─────────────────────────────────────
export interface SubmoduloPermisos {
    id: string
    href: string
    nombre: string
}

export interface ModuloPermisos {
    id: string
    nombre: string
    icono: string
    orden: number
    submodulos: SubmoduloPermisos[]
}

// ── Respuestas tipadas de las Server Actions (Decisión 17 — nunca throw) ───────
export interface RespuestaLista<T> {
    success: boolean
    error?: string
    data?: T[]
}

export interface RespuestaAccion {
    success: boolean
    error?: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERMISOS_SEMILLA — snapshot de la matriz 0.4 · Parte 6 · Bloque 9 (R6)
// Los 6 roles editables. 'administrador' se EXCLUYE (es_editable = false).
// Fuente canónica: GUIA_0_4_Parte6_V8.md B9 · ⭐ REGENERADO 01 Sep 2026 (D10 · Q1–Q4:
// semilla mínima de 72 permisos derivada del FLUJO_01). La BD NO conserva "lo original"
// (el admin pudo editarlos), por eso la semilla vive aquí.
// ⚠️ Al implementar/revisar: verificar esta constante contra la BD real (sembrada con
// la matriz nueva) y ajustarla si diverge — ver GUIAS/10/NOTAS_REVISION_SEMILLA_RBAC.md.
// ═══════════════════════════════════════════════════════════════════════════════
export const PERMISOS_SEMILLA: Record<string, PermisoPayload[]> = {
    vendedor: [
        { href: '/dashboard', acciones: ['ver'] },
        { href: '/dashboard/catalogos/productos', acciones: ['ver', 'exportar'] },
        { href: '/dashboard/catalogos/proveedores', acciones: ['ver'] },
    ],
    almacenista: [
        { href: '/dashboard', acciones: ['ver'] },
        { href: '/dashboard/catalogos/productos', acciones: ['ver', 'crear', 'editar', 'eliminar', 'exportar'] },
        { href: '/dashboard/catalogos/proveedores', acciones: ['ver', 'crear'] },
        { href: '/dashboard/entradas/alta', acciones: ['ver', 'editar'] },
    ],
    cajero: [
        { href: '/dashboard', acciones: ['ver'] },
    ],
    recepcionista: [
        { href: '/dashboard', acciones: ['ver'] },
        { href: '/dashboard/entradas/recepcion', acciones: ['ver', 'crear', 'editar'] },
        { href: '/dashboard/catalogos/productos', acciones: ['ver', 'crear'] },
        { href: '/dashboard/catalogos/proveedores', acciones: ['ver', 'crear'] },
    ],
    tecnico: [
        { href: '/dashboard', acciones: ['ver'] },
        { href: '/dashboard/entradas/revision', acciones: ['ver', 'editar'] },
        { href: '/dashboard/catalogos/productos', acciones: ['ver'] },
    ],
    acondicionador: [
        { href: '/dashboard', acciones: ['ver'] },
        { href: '/dashboard/entradas/acondicionamiento', acciones: ['ver', 'editar'] },
    ],
}
