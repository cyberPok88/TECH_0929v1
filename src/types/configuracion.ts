// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN — los contratos de la herramienta de borrado (Guía 2.4 · 05 Oct 2026)
//
// Acá viven las DOS listas de paquetes, y NO son la misma cosa:
//   · `PAQUETES`     — la lista BLANCA, en el ORDEN QUE IMPONE LA FK. Es el espejo
//                      exacto de `v_validos` dentro de `borrar_datos_erp()`.
//   · `PAQUETES_UI`  — lo que ve el humano, en ORDEN DE DOMINIO.
//
// ⚠️ Si agregás un paquete: va en LAS DOS listas y en la RPC. Si no, la RPC lanza
//    «Paquete desconocido» (o el paquete existe y nadie lo puede usar).
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Los paquetes de borrado. **El orden de ESTA lista es el de la RPC** (por dependencia
 * de FK), no el de la pantalla: la ejecución tiene que ir Cobranza → Ventas → Entradas…
 * porque `notas_remision` y `movimientos_cxc` bloquean a `clientes`.
 */
export const PAQUETES = [
    'cobranza',
    'ventas',
    'entradas',
    'compras',
    'inventario',
    'clientes',
    'proveedores',
    'productos',
    'catalogos',
    'sistema',
    'tesoreria',
] as const

export type PaqueteBorrado = (typeof PAQUETES)[number]

/** Un paquete tal como se muestra: id + etiqueta + para qué sirve. */
export interface PaqueteUI {
    id: PaqueteBorrado
    nombre: string
    ayuda: string
    /** `true` = no borra por grupo: el humano **tilda filas** (opción C). */
    porFilas?: boolean
}

/** ⭐ **El orden de la PANTALLA es el de DOMINIO** (no el de la FK, que es el de `PAQUETES`). */
export const PAQUETES_UI: readonly PaqueteUI[] = [
    { id: 'entradas', nombre: 'Entradas', ayuda: 'Las entradas y TODO su rastro: partidas, números de serie, lecturas SMART, etapas, devoluciones y divergencias.' },
    { id: 'compras', nombre: 'Compras', ayuda: 'Notas de compra al proveedor, sus renglones y sus pagos.' },
    { id: 'inventario', nombre: 'Inventario', ayuda: 'Lotes, kardex y conteos físicos. Se deriva de las entradas.' },
    { id: 'productos', nombre: 'Productos', ayuda: 'El catálogo de SKU. ⚠️ Borrarlos no libera el folio: reiniciá los folios o dos productos pueden compartir SKU.' },
    { id: 'catalogos', nombre: 'Catálogos', ayuda: 'Marcas, categorías y ubicaciones de almacén cargadas desde la app.', porFilas: true },
    { id: 'proveedores', nombre: 'Proveedores', ayuda: 'Los proveedores. Requiere que Entradas y Compras ya no existan.' },
    { id: 'clientes', nombre: 'Clientes', ayuda: 'Los clientes con movimiento. Los de mostrador (MOSTR-*) son semilla y se quedan.' },
    { id: 'ventas', nombre: 'Ventas', ayuda: 'Notas de remisión, cotizaciones y sus partidas.' },
    { id: 'cobranza', nombre: 'Cobranza', ayuda: 'Cobros, aplicaciones y el libro de cuenta por cobrar.' },
    { id: 'tesoreria', nombre: 'Tesorería', ayuda: 'Sesiones de caja, movimientos y arqueos.' },
    { id: 'sistema', nombre: 'Sistema', ayuda: 'Roles que creaste vos. ⚠️ Solo los no-sistema, y nunca uno con usuarios asignados.', porFilas: true },
]

/** Una fila del conteo: qué paquete, qué tabla y **cuántas filas se pierden**. */
export interface FilaConteo {
    paquete: string
    tabla: string
    filas: number
}

/** Una fila de catálogo o de rol, lista para tildar (opción C). */
export interface FilaCatalogo {
    id: string
    nombre: string
    /** ISO. Permite distinguir lo que sembró una migración de lo que cargó el usuario. */
    created_at: string
    /** En cuántos productos se usa (catálogos) o cuántos usuarios lo tienen (roles). */
    usos: number
}

/** Las 3 tablas de catálogo que la opción C permite tildar. */
export const TABLAS_CATALOGO = [
    'marcas_producto',
    'categorias_producto',
    'ubicaciones_almacen',
] as const

export type TablaCatalogo = (typeof TABLAS_CATALOGO)[number]

export const NOMBRE_TABLA_CATALOGO: Record<TablaCatalogo, string> = {
    marcas_producto: 'Marcas de producto',
    categorias_producto: 'Categorías',
    ubicaciones_almacen: 'Ubicaciones de almacén',
}

/**
 * Lo que el humano **tildó fila por fila** (opción C). Va como `jsonb` a la RPC.
 * ⚠️ Son **ids** — el humano decide, la RPC no adivina cuál es semilla.
 */
export interface SeleccionFilas {
    marcas_producto?: string[]
    categorias_producto?: string[]
    ubicaciones_almacen?: string[]
    roles?: string[]
}
