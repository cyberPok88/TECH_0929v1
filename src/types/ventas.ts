// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS DEL DOMINIO — VENTAS (Guía 1.8 · 01 Oct 2026)
// Espejo LITERAL de public.notas_remision + partidas_remision + movimientos_cxc +
// conceptos_cxc (GUIAS/20/docs/bd-ventas.md §0 · columnas reales).
// Los nombres snake_case son contrato con la BD: renombrar uno guarda el dato
// equivocado sin romper el build (CLAUDE.md, regla 4). La BD real manda.
//
// ⚠️ `numeric` llega de Postgres como STRING y las SA lo convierten con Number(...)
//    al aplanar: el dominio es `number`, los formularios son `string`.
// ⭐ `movimientos_cxc` es EL LIBRO append-only y su contrato lo comparten 1.7/1.9/2.3.
// ═══════════════════════════════════════════════════════════════════════════════

import type { TonoPildora } from '@/components/data-table'

// ── Vocabulario cerrado (CHECKs en BD) ────────────────────────────────────────

/** El SIGNO del asiento: `cargo` suma a lo que el cliente debe · `abono` resta. */
export type NaturalezaCxC = 'cargo' | 'abono'

/**
 * Las **5 claves** de `estados_pago` que una nota puede tomar. ⭐ **NINGUNA se captura**: las
 * deriva `tr_cxc_estado_pago` del libro, con esta precedencia:
 * `cancelada` > `pagada` > `vencida` > `parcial` > `pendiente`.
 */
export type ClaveEstadoPagoNota = 'pendiente' | 'parcial' | 'pagada' | 'vencida' | 'cancelada'

/** Qué tipo de documento originó el asiento — o ninguno (un anticipo suelto, 1.9). */
export type TipoOrigenAsiento = 'nota' | 'cobro' | 'anticipo' | 'ajuste'

// ── Tabla: notas_remision (24 columnas) ───────────────────────────────────────
export interface NotaRemision {
    id: string
    folio: string
    id_cliente: string
    /** Heredada del cliente al emitir (desnormalización deliberada · MODELO §8.6). */
    id_marca_comercial: string
    /** ⏳ Lo escribe la conversión de **1.7**. */
    id_cotizacion_origen: string | null
    /** CONGELADA al emitir: si la lista cambia, la nota no se recalcula. */
    id_lista_precio: string | null
    id_metodo_envio: string | null
    id_vendedor: string | null
    /** ⭐ Decide si aplican LAS TRES PUERTAS de crédito (mapa D-13). */
    es_credito: boolean
    fecha_emision: string
    /** `emisión + clientes.dias_credito` por defecto, **editable** (D-12). */
    fecha_vencimiento: string
    /** DERIVADO del libro por trigger · nunca se captura. */
    id_estado_pago: string
    subtotal: number
    descuento_global: number
    impuestos: number
    total: number
    /** DERIVADO del libro (`Σ cargos − Σ abonos`) · nunca se captura. */
    saldo_pendiente: number
    es_cancelada: boolean
    motivo_cancelacion: string | null
    notas: string | null
    creado_por: string | null
    actualizado_por: string | null
    created_at: string
    updated_at: string
}

// ── Tabla: partidas_remision (23 columnas) ────────────────────────────────────
export interface PartidaRemision {
    id: string
    id_nota: string
    orden: number
    id_producto: string
    /** El catálogo cambia; la nota conserva lo que decía al emitirse. */
    descripcion_snapshot: string
    cantidad: number
    /** ⭐ Los CONGELADOS: son lo que permite que convertir NO recalcule. */
    precio_base_snapshot: number
    /** 0..1 (CONVENCIONES §9.3 regla 1) — el porcentaje de la cascada de listas. */
    descuento_lista_porcentaje: number
    /** 0..1 — la negociación del vendedor (PLAN §6.3). */
    descuento_adicional_porcentaje: number
    precio_unitario_final: number
    id_impuesto: string | null
    importe_impuesto: number
    subtotal: number
    total: number
    /** Del **lote consumido** por FIFO → el MARGEN real de la venta. */
    costo_unitario_snapshot: number | null
    // ⚠️ AQUÍ NO HAY `numero_serie`: una partida de 10 discos lleva **10 NS** (PLAN §6.5) y una
    //    columna de texto solo guarda uno. Los NS viven en `series_partida` — una fila por PIEZA.
    /** ⚠️ Autorización del piso de precio (mapa D-14). */
    precio_bajo_minimo: boolean
    autorizado_por: string | null
    motivo_autorizacion: string | null
    /** ⭐ MAPEO 01 Oct: la cortesía NO es un descuento — es su propio caso. */
    es_cortesia: boolean
    motivo_cortesia: string | null
    creado_por: string | null
    created_at: string
}

// ── Tabla: series_partida — ⭐ UNA FILA POR NÚMERO DE SERIE (6 columnas) ───────
/**
 * ⭐ Una fila por **NÚMERO DE SERIE** vendido en una partida (PLAN §6.5: N NS por renglón).
 * El patrón es el que 1.6 ya usa en `lecturas_disco`. Traza de garantía:
 * **NS → partida → nota → cliente**.
 * ⚠️ **Sin UNIQUE global sobre `ns`**: al cancelar la nota el NS **vuelve a estar disponible**
 * (mapa D-11), así que la misma pieza puede aparecer en dos filas de dos notas distintas. El
 * rechazo del «ya vendido» lo hace el RPC **dentro de la transacción**, contra las notas
 * **no canceladas**.
 */
export interface SeriePartida {
    id: string
    id_partida: string
    /** FK al concentrado de 1.6 — `null` si la pieza entró **sin acta**. */
    id_numero_serie: string | null
    /** El **snapshot** del texto: la traza sobrevive aunque el concentrado cambie. */
    ns: string
    creado_por: string | null
    created_at: string
}

/** Partida con sus series aplanadas — lo que devuelve `listarPartidasNota` para la fila expandible. */
export interface PartidaRemisionListado extends PartidaRemision {
    /** Los N NS del renglón, ya aplanados del embed (el idioma de la casa: nada anidado). */
    series: string[]
}

// ── Tabla: movimientos_cxc — ⭐ EL LIBRO (14 columnas · APPEND-ONLY) ───────────
/**
 * ⭐ El libro de cuenta por cobrar. **Cargo = lo vendido · abono = lo pagado.**
 * El saldo se **deriva** de aquí: nunca se captura, y un error se corrige con un
 * **asiento inverso** — jamás editando (CONVENCIONES §9.3 regla 3).
 * ⚠️ **NO tiene `updated_at`**: la ausencia comunica inmutabilidad.
 */
export interface MovimientoCxC {
    id: string
    /** Folio PROPIO del libro (D-20): un movimiento puede NO tener documento. */
    folio: string
    id_cliente: string
    id_marca_comercial: string
    id_concepto: string
    /** Copiada del concepto al asentar: el asiento se explica solo. */
    naturaleza: NaturalezaCxC
    /** SIEMPRE positivo; el signo lo da `naturaleza`. */
    monto: number
    id_nota_remision: string | null
    /** ⏳ Lo escribe **1.9**. */
    id_cobro: string | null
    /** La cadena de saldos: permite reconstruir la cuenta a CUALQUIER fecha de corte. */
    saldo_anterior: number
    saldo_resultante: number
    motivo: string | null
    creado_por: string | null
    created_at: string
}

// ── Tabla: conceptos_cxc (12 columnas) ────────────────────────────────────────
export interface ConceptoCxC {
    id: string
    /** Contrato de texto: regex `^[a-z][a-z0-9_]*$` (CHECK en BD). */
    clave: string
    nombre: string
    naturaleza: NaturalezaCxC
    /** Herencia del sistema anterior: un concepto puede SER una forma de pago. */
    es_forma_pago: boolean
    id_forma_pago_sat: string | null
    exige_referencia: boolean
    descripcion: string | null
    es_activo: boolean
    orden: number
    created_at: string
    updated_at: string
}

// ── Vistas aplanadas (lo que devuelven las Server Actions con embeds) ─────────

/** ⭐ Fila del LISTADO. La casa **APLANA los embeds en la propia fila** con el sufijo `_clave`/`_nombre`/
 *  `_codigo` — **no anida objetos** (patrón medido en `types/notas-compra.ts`: `proveedor_codigo` ·
 *  `proveedor_nombre` · `estado_pago_clave` · `estado_pago_nombre`). Se mantiene aparte del espejo puro
 *  para que la verificación «cada campo es una columna» siga siendo comprobable. */
export interface NotaRemisionListado extends NotaRemision {
    cliente_codigo: string | null
    cliente_nombre: string | null
    marca_nombre: string | null
    vendedor_nombre: string | null
    estado_pago_clave: ClaveEstadoPagoNota | null
    estado_pago_nombre: string | null
}

/** Ficha completa: el listado + sus partidas + el embudo del libro. */
export interface NotaRemisionDetalle extends NotaRemisionListado {
    partidas: PartidaRemisionListado[]
    /** Σ cargos · Σ abonos · cuántos asientos — el resumen de la pestaña Estado de cuenta. */
    total_cargos: number
    total_abonos: number
    movimientos: number
}

/**
 * ⭐ DÓNDE SE FUE ESTE SKU — una partida vendida vista DESDE el producto (Parte 6 · BLOQUE 1).
 * Es la consulta **INVERSA** del listado: el listado va nota → renglones; ésta va producto → notas.
 * ⚠️ Los embeds van **APLANADOS** (el idioma de la casa: nada anidado en el tipo).
 */
export interface PartidaVendidaListado {
    id: string
    orden: number
    cantidad: number
    precio_unitario_final: number
    total: number
    descripcion_snapshot: string
    es_cortesia: boolean
    nota_folio: string | null
    nota_fecha: string | null
    cliente_codigo: string | null
    cliente_nombre: string | null
}

/** Un asiento del libro ya aplanado para el estado de cuenta (mismo idioma: embeds planos). */
export interface MovimientoCxCListado extends MovimientoCxC {
    concepto_clave: string | null
    concepto_nombre: string | null
    nota_folio: string | null
}

/** ⭐ Lo que pinta la pestaña **Estado de cuenta** de la ficha (y consumirá 1.9). */
export interface EstadoCuentaCliente {
    id_cliente: string
    cliente_codigo: string | null
    cliente_nombre: string | null
    /** El derivado que alimenta `tr_cxc_saldo_cliente`. */
    saldo_actual: number
    /** Lo VENCIDO a hoy — es lo que decide si el cliente es **moroso**. */
    saldo_vencido: number
    movimientos: MovimientoCxCListado[]
    total_movimientos: number
}

// ── Formularios (los `numeric` viajan como string: patrón de la casa) ─────────

/** Un renglón del grid mientras se captura. */
export interface PartidaRemisionInput {
    /** `''` = renglón nuevo sin guardar (patrón 1.1). */
    id: string
    id_producto: string
    /** Solo lectura en UI: lo trae el producto. */
    descripcion_snapshot: string
    cantidad: string
    precio_base_snapshot: string
    descuento_lista_porcentaje: string
    /**
     * ⭐ **EL PRECIO LISTA** (M5 · 05 Oct 2026): el precio DESPUÉS de la lista del cliente
     * (`base × (1 ± lista)`) y **ANTES** del descuento por partida — **la primera verdad**, y el
     * vendedor **lo puede modificar a mano** (85 → 90).
     * ⚠️ `''` ⇒ la emisión lo deriva con la lista del cliente (red de seguridad).
     */
    precio_lista: string
    /** ⭐ El descuento **por partida**, en **% real** (5 = 5%): afecta el **importe**, no el precio lista. */
    descuento_adicional_porcentaje: string
    /** El resultado: `precio_lista × (1 − descuento_adicional)`. Es lo que multiplica el RPC. */
    precio_unitario_final: string
    id_impuesto: string
    /** ⭐ Los N NS del renglón (PLAN §6.5). El paso de asignar NS los llena; uno por PIEZA. */
    series: string[]
    /** ⭐ La cortesía se marca aquí y **exime del piso**. */
    es_cortesia: boolean
    motivo_cortesia: string
}

/** La emisión completa: encabezado + partidas + los N NS del paso 3. */
export interface NotaRemisionInput {
    id_cliente: string
    es_credito: boolean
    fecha_emision: string
    /**
     * ⭐ **EL VENCIMIENTO NO SE CAPTURA** (rediseño 05 Oct 2026): lo DERIVA la SA con el
     * plazo de crédito del cliente (`emisión + clientes.dias_credito`; en contado, el
     * mismo día). Era el único de los campos recortados que se tecleaba de verdad.
     */
    id_vendedor: string
    /**
     * ⭐ **EL DESCUENTO DEL DOCUMENTO** (05 Oct 2026) — el 3er nivel de descuento del negocio.
     *
     * ⚠️ **Se captura en % y viaja en %** (el dueño: *«el pone 4 y significa 4%, si pone 50
     * es 50%»*), pero la columna de la BD (`notas_remision.descuento_global`) guarda un
     * **MONTO en $** ⇒ la SA hace la conversión **contra el subtotal que ella misma manda**
     * (una sola definición del subtotal, no dos).
     *
     * 📐 LOS 4 NIVELES, EN ORDEN (medido en `fn_emitir_nota_remision`):
     *   1. `productos.precio_base`                        → el precio de referencia
     *   2. `clientes.id_lista_precio` → `listas_precios`  → **nivel 1** (por partida)
     *   3. `partidas_remision.descuento_adicional_porcentaje` → **nivel 2** (por partida)
     *      ⇒ los dos anteriores quedan **cocidos en `precio_unitario_final`**
     *   4. `notas_remision.descuento_global`              → **nivel 3** (del DOCUMENTO:
     *      el RPC lo resta del **subtotal**, no por renglón)
     */
    descuento_global_porcentaje: string
    id_metodo_envio: string
    notas: string
    partidas: PartidaRemisionInput[]
    /** ⭐ Los NS capturados en el paso de asignación, uno por PIEZA (PLAN §6.5). */
    numeros_serie: string[]
    /** ⭐ El acto de excepción, cuando una puerta o el piso lo exigieron (PLAN §6.2).
     *  ⚠️ MVP (02 Oct 2026): es una **CONFIRMACIÓN** ⇒ solo el motivo. La autorización de
     *  segundo nivel (credenciales verificadas + `aprobar`) vuelve en V2. */
    autorizacion?: {
        motivo: string
    }
}

/** La edición: SOLO lo que no mueve nada (mapa D-21). */
export interface NotaRemisionEdicion {
    fecha_vencimiento: string
    id_metodo_envio: string
    notas: string
}

/**
 * Filtros del listado. ⭐ **En camelCase** y con `''` = «todos» (patrón medido de la casa en
 * `FiltrosNotaCompra`): los DTO de filtro **no son filas de la BD**, así que no llevan snake_case.
 */
export interface FiltrosNotaRemision {
    busqueda: string
    /** `''` = todos los clientes. */
    idCliente: string
    /** `''` = todas las marcas. */
    idMarca: string
    /** `''` = todos los estados. */
    estadoPago: ClaveEstadoPagoNota | ''
    /** `''` = sin filtro (yyyy-mm-dd sobre `fecha_emision`). */
    fechaDesde: string
    /** `''` = sin filtro. */
    fechaHasta: string
    /** Solo las que tienen saldo — el filtro que la operación usa a diario. */
    soloConSaldo: boolean
    /** Por defecto las canceladas **no** se listan. */
    incluirCanceladas: boolean
}

// ── Opciones de selector ─────────────────────────────────────────────────────
// ⭐ ⚠️ El contrato de `ClienteOpcion` **NO se declara aquí**: lo declara el módulo DUEÑO (1.3) en
// `@/types/clientes`, igual que `ProveedorOpcion` (1.1) y `ProductoOpcion` (1.2). El
// `SelectorCliente` promovido importa `listarClientesActivos()` **y su tipo** desde 1.3.
// Redeclararlo aquí crearía DOS contratos para el mismo hecho — el anti-patrón que el carril
// PROMOCIÓN prohíbe.
// ⭐ MEDIDO el 01 Oct 2026: `actions/clientes.ts:207` ya expone
// `listarClientesActivos(): Promise<RespuestaLista<ClienteOpcion>>` y el encabezado de ese archivo
// dice literalmente «contrato **1.7/1.8/1.9**» ⇒ **el contrato ya existe y ya estaba previsto**. La
// PROMOCIÓN `SelectorCliente` solo necesita **el componente**, no contrato nuevo.

// ── Vocabulario de pantalla: etiquetas y tonos de píldora ────────────────────

export const ETIQUETA_ESTADO_PAGO: Record<ClaveEstadoPagoNota, string> = {
    pendiente: 'Pendiente',
    parcial: 'Parcial',
    pagada: 'Pagada',
    vencida: 'Vencida',
    cancelada: 'Cancelada',
}

export const TONO_ESTADO_PAGO: Record<ClaveEstadoPagoNota, TonoPildora> = {
    pendiente: 'info',
    parcial: 'advertencia',
    pagada: 'exito',
    vencida: 'peligro',
    cancelada: 'neutro',
}

export const ETIQUETA_NATURALEZA_CXC: Record<NaturalezaCxC, string> = {
    cargo: 'Cargo',
    abono: 'Abono',
}

export const TONO_NATURALEZA_CXC: Record<NaturalezaCxC, TonoPildora> = {
    cargo: 'advertencia',
    abono: 'exito',
}

// ── Respuestas tipadas de las Server Actions (patrón de la casa) ─────────────

export interface RespuestaLista<T> {
    success: boolean
    error?: string
    data?: T[]
    total?: number
}

export interface RespuestaDato<T> {
    success: boolean
    error?: string
    data?: T
}

export interface RespuestaAccion {
    success: boolean
    error?: string
}
