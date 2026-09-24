// ═══════════════════════════════════════════════════════════════════════════════
// DICCIONARIO DE ACCIONES DEL TOOLBAR — Guía 0.6
//
// Qué botones ofrece cada ruta. La clave del registro es el href EXACTO de
// `submodulos` — el mismo que cada página pasa a usePageConfig({ path }).
//
// ⭐ Derivado de la matriz RBAC real de la Guía 0.4 (72 permisos · D10 · 01 Sep 2026):
//    SELECT s.href, string_agg(DISTINCT a.clave, ',') FROM submodulos s
//    JOIN permisos_acciones pa ON pa.id_submodulo = s.id
//    JOIN acciones a ON a.id = pa.id_accion GROUP BY s.href;
//
// ⚠️ SOLO las 11 rutas de la fundación (D10 — crecer por CRUD). Cuando una guía
//    CRUD construya su módulo, agrega AQUÍ sus rutas (patrón 2.0/2.1/2.2).
//
// ⚠️ En la Guía 0.6 los botones NO tienen onClick: se ven y respetan el diseño,
//    pero no actúan. Cada guía CRUD conecta el suyo. Es deliberado.
//
// ⚠️ La Guía 0.7 NO modifica este archivo: filtra estas acciones cruzando
//    `accion` contra permisos[].clave_accion del store.
// ═══════════════════════════════════════════════════════════════════════════════

// Solo los iconos que ALGUNA ruta usa. Un import sin usar rompe `npm run lint`
// (regla de la Guía 0.1). Cuando una guía CRUD agregue una acción nueva,
// agrega también su icono aquí.
import {
    Plus,
    Download,
    Upload,
    Pencil,
    RefreshCw,
} from 'lucide-react'

import type { ToolbarAction } from '@/types/shell'

// ── Acciones recurrentes: se declaran una vez y se reutilizan ─────────────────
// Los objetos son inmutables en la práctica (nadie los muta), así que compartir
// la referencia entre rutas es seguro y evita 29 copias del mismo botón.

const NUEVO = (label: string): ToolbarAction => ({
    id: 'nuevo', label, icon: Plus, accion: 'crear', variant: 'default',
})

const EXPORTAR: ToolbarAction = {
    id: 'exportar', label: 'Exportar', icon: Download, accion: 'exportar', variant: 'outline',
}

const ACTUALIZAR: ToolbarAction = {
    id: 'actualizar', label: 'Actualizar', icon: RefreshCw, accion: 'ver', variant: 'ghost',
}

/**
 * Acciones base por ruta.
 * Clave = href de submodulos, carácter por carácter.
 */
export const toolbarConfig: Record<string, ToolbarAction[]> = {

    // ── SISTEMA ────────────────────────────────────────────────────────────────
    '/dashboard': [ACTUALIZAR],

    '/dashboard/sistema/empresa': [
        { id: 'editar', label: 'Editar datos', icon: Pencil, accion: 'editar', variant: 'default' },
    ],
    // Los CRUD de sistema se recargan solos tras cada alta/edición/baja y al
    // cambiar de filtro; ACTUALIZAR sería un botón que no aporta. El onClick de
    // "Nuevo" lo inyecta cada página CRUD (usuarios: Guía 0.9 · roles: Guía 0.10).
    '/dashboard/sistema/usuarios': [NUEVO('Nuevo usuario')],
    '/dashboard/sistema/roles': [NUEVO('Nuevo rol')],
    '/dashboard/sistema/configuracion': [
        { id: 'guardar', label: 'Guardar cambios', icon: Pencil, accion: 'editar', variant: 'default' },
    ],

    // ── CATÁLOGOS (los que el Flujo 01 consume · D10) ──────────────────────────
    '/dashboard/catalogos/productos': [
        NUEVO('Nuevo producto'),
        // Importación masiva: CONTEXTO §6 — 600+ productos, captura manual inviable
        { id: 'importar', label: 'Importar CSV', icon: Upload, accion: 'importar', variant: 'secondary' },
        EXPORTAR,
    ],
    '/dashboard/catalogos/proveedores': [NUEVO('Nuevo proveedor'), EXPORTAR],

    // ── ENTRADAS (Flujo 01 · D10) ──────────────────────────────────────────────
    // NUEVO en recepción (única ruta que crea) · EXPORTAR declarado: la página
    // inyecta la conducta (exportarEntradasCsv) en recepción; el resto lo filtra RBAC.
    '/dashboard/entradas/recepcion': [NUEVO('Nueva entrada'), EXPORTAR],
    '/dashboard/entradas/revision': [EXPORTAR],
    '/dashboard/entradas/acondicionamiento': [EXPORTAR],
    '/dashboard/entradas/alta': [EXPORTAR],
    '/dashboard/entradas/divergencias': [EXPORTAR],
}

/**
 * Acciones base de una ruta. Devuelve [] si la ruta no está en el diccionario
 * (una página sin acciones es válida — el Toolbar simplemente no se dibuja).
 */
export function getAccionesBase(path: string): ToolbarAction[] {
    return toolbarConfig[path] ?? []
}
