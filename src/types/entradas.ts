// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS DEL DOMINIO — ENTRADAS (Guía 1.6 · 18 Sep 2026)
// Espejo LITERAL de public.entradas + partidas_entrada + partidas_resueltas +
// devoluciones_entrada + transiciones_etapa + divergencias + numeros_serie
// (GUIAS/18/docs/bd-entradas.md §3 · columnas reales). La BD real manda.
// ═══════════════════════════════════════════════════════════════════════════════

import type { TonoPildora } from '@/components/data-table'
import type { AtributoEsquema } from '@/types/catalogos'

// ── Vocabulario cerrado (CHECKs en BD · mapa 18 Sep) ────────────────────────────
export type EstadoEntrada =
    | 'recien_creada' | 'lista_para_revision' | 'en_revision' | 'revisada_sin_dev'
    | 'con_dev' | 'ajustada' | 'en_acondicionamiento' | 'en_almacen' | 'confirmada'
    | 'bloqueada_por_divergencia'

export type ResultadoRev = 'SIN_MALAS' | 'CON_MALAS'
export type OrigenEntrada = 'flujo' | 'directa'
export type EstadoPartida = 'PENDIENTE' | 'OK' | 'MAL'
export type EstadoDevolucion = 'por_cotejar' | 'ajustada'
export type EstadoDivergencia = 'abierta' | 'resuelta'

// ── Documento de entrada (cabecera) ─────────────────────────────────────────────
export interface Entrada {
    id: string
    folio: string
    id_proveedor: string
    proveedor_nombre: string | null
    fecha: string
    estado: EstadoEntrada
    resultado_rev: ResultadoRev | null
    es_sin_revision: boolean
    origen: OrigenEntrada
    id_nota: string | null
    notas: string | null
    fecha_fin_rev: string | null
    fecha_fin_acond: string | null
    fecha_fin_almacen: string | null
    creado_por: string | null
    creador_nombre: string | null
    created_at: string
    // ⭐ MEJORA 20 Sep 2026 — agregados para las columnas de las tablas por fase
    // (calzados en `listarEntradas` vía embeds PostgREST: no hay SQL nuevo).
    partidas_count: number
    piezas_total: number
    /**
     * ⭐ MEJORA 22 Sep 2026 — el «final» de la tabla: Σ `cantidad_vigente`. Mientras el ajuste
     * está pendiente vale lo mismo que `piezas_total` (la DEV todavía no bajó cantidades);
     * `devPendiente()` distingue ese caso para no mostrar un final que aún no existe.
     */
    piezas_vigentes: number
    monto_total: number
    devolucion_total: number
    nota_folio: string | null
}

// ── Línea declarada (cantidad_original y costo INMUTABLES) ──────────────────────
// ⭐ clasificación por CATÁLOGO (fix 18 Sep): id_categoria + atributos en_huella
// (capturados en recepción); la marca se añade en revisión al fijar el SKU.
export interface PartidaEntrada {
    id: string
    id_entrada: string
    partida: number
    id_categoria: string | null
    categoria_nombre: string | null
    atributos: Record<string, unknown>
    cantidad_original: number
    cantidad_vigente: number
    costo_acordado: number
    estado_partida: EstadoPartida
    /**
     * ⭐ MEJORA 22 Sep 2026 — DEV de la partida con el **dato real** de `devoluciones_entrada`
     * (no una resta `original − vigente`): pueden convivir una DEV viva y `cantidad_vigente`
     * intacta mientras el ajuste está pendiente. `dev_ajustada` = ya tiene `fecha_ajuste`.
     */
    dev_cantidad: number
    dev_ajustada: boolean
}

// ── Partida con su AVANCE de revisión (acordeón de Revisión · MEJORA 20 Sep) ─────
export interface PartidaConAvance {
    id: string
    partida: number
    id_categoria: string | null
    categoria_nombre: string | null
    /** Snapshot de recepción (atributos `en_entrada`) — base de la huella. */
    atributos: Record<string, unknown>
    cantidad_original: number
    /** Piezas ya revisadas = aprobadas (huella) + devueltas (DEV). */
    revisadas: number
    restantes: number
    estado_partida: EstadoPartida
}

// ── Desglose por SKU resuelto (produce revisión o almacén) ──────────────────────
export interface PartidaResuelta {
    id: string
    id_partida_entrada: string
    /** ⭐ Evolución V5 (20 Sep): la huella trae la MARCA; el SKU lo asigna ALMACÉN (null hasta entonces). */
    id_marca: string | null
    marca_nombre?: string | null
    id_producto: string | null
    producto_nombre: string | null
    producto_sku: string | null
    cantidad_aprobada: number
    atributos: Record<string, unknown>
}

// ── Devolución (DEV — auto-generada al cerrar revisión) ─────────────────────────
export interface DevolucionEntrada {
    id: string
    id_entrada: string
    id_partida_entrada: string
    id_motivo: string
    motivo_nombre: string | null
    cantidad: number
    porcentaje_salud: number | null
    ns: string | null
    estado: EstadoDevolucion
    ajustado_por: string | null
    fecha_ajuste: string | null
    creado_por: string | null
    created_at: string
    /**
     * ⭐ MEJORA 22 Sep 2026 (12) — **display aplanado** del embed de `listarResultadoRevision`: de
     * QUÉ partida y de qué **producto declarado** (categoría + atributos capturados en recepción =
     * la huella) se está devolviendo. Responde «¿qué se devuelve?» sin abrir nada más.
     * ⚠️ El **SKU no existe aquí**: lo resuelve Almacén y solo para lo **aprobado** — una pieza
     * devuelta nunca llega a SKU, y la marca que el técnico elige en el wizard se descarta al
     * agrupar los NO_PASA por (partida, motivo).
     */
    partida_numero: number | null
    categoria_nombre: string | null
    atributos: Record<string, unknown>
}

// ── Bitácora de transiciones (append-only) ─────────────────────────────────────
export interface TransicionEtapa {
    id: string
    id_entrada: string
    desde_estado: string | null
    hacia_estado: string
    actor_id: string | null
    actor_nombre: string | null
    actor_rol: string | null
    notas: string | null
    created_at: string
}

// ── Divergencia (cotejo que no cuadra) ──────────────────────────────────────────
export interface Divergencia {
    id: string
    id_entrada: string
    entrada_folio: string | null
    cantidad_esperada: number
    cantidad_encontrada: number
    id_causa: string
    causa_nombre: string | null
    responsable: string | null
    cantidad_autorizada: number | null
    estado: EstadoDivergencia
    creado_por: string | null
    created_at: string
}

// ── Número de serie (concentrado NS→ingreso · solo camino 1 · inmutable) ────────
export interface NumeroSerie {
    id: string
    ns: string
    id_entrada: string
    id_producto: string | null
    created_at: string
}

// ── Catálogos de operación ──────────────────────────────────────────────────────
export interface MotivoRechazo {
    id: string
    clave: string
    nombre: string
    requiere_porcentaje: boolean
}
export interface CausaDivergencia {
    id: string
    clave: string
    nombre: string
}

// ── Formas de captura (opcionales viajan como '') ──────────────────────────────
export interface PartidaEntradaForm {
    id: string // '' = nueva
    id_categoria: string // UUID del catálogo (select) — nunca texto libre
    atributos: Record<string, string> // en_huella capturados en recepción (clave → valor)
    cantidad_original: string
    costo_acordado: string
}
export interface EntradaFormData {
    id_proveedor: string
    es_sin_revision: boolean
    origen: OrigenEntrada
    notas: string
    partidas: PartidaEntradaForm[]
}

// ── Filtros de listados ─────────────────────────────────────────────────────────
export interface FiltrosEntradas {
    busqueda: string
    estado: '' | EstadoEntrada
    fecha_desde: string
    fecha_hasta: string
}

// ── Revisión: lote de piezas (el técnico firma por lote, resultado agrupado) ────
/** ⭐ Vocabulario correcto (usuario 20 Sep): ENTRADA/INGRESO → PARTIDA → PIEZA.
 *  NO se usa "lote" para la revisión: el avance se guarda por PARTIDA. */
export interface PiezaRevision {
    id_partida_entrada: string
    /** ⭐ La REVISIÓN captura la marca + atributos (huella); NO el SKU. */
    id_marca: string
    atributos: Record<string, string>
    resultado: 'PASA' | 'NO_PASA'
    id_motivo?: string
    porcentaje_salud?: number
    ns?: string // solo PASA + maneja_numero_serie
}

/** Avance de revisión de UNA partida (las piezas que el técnico firma al guardar). */
export interface AvanceRevisionInput {
    id_entrada: string
    piezas: PiezaRevision[]
}

export interface ResultadoRevision {
    aprobadas: PartidaResuelta[]
    devoluciones: DevolucionEntrada[]
}

// ── Alta/almacén: cotejo físico ────────────────────────────────────────────────
export interface CotejoLinea {
    id_partida_resuelta: string
    /** ⭐ La huella viene de REVISIÓN; el ALMACÉN resuelve el SKU (`id_producto`/`sku`/`nombre`). */
    id_categoria: string | null
    id_marca: string | null
    marca_nombre: string | null
    atributos: Record<string, unknown>
    id_producto: string | null
    sku: string
    nombre: string
    cantidad_aprobada: number
    costo_acordado: number
}

export interface ConfirmarAltaInput {
    id_entrada: string
    lineas: {
        id_partida_resuelta: string
        id_producto: string
        cantidad_fisica: number
        costo_acordado: number
    }[]
}

// ── Display ─────────────────────────────────────────────────────────────────────
export const TEXTO_ESTADO_ENTRADA: Record<EstadoEntrada, string> = {
    recien_creada: 'Recién creada',
    lista_para_revision: 'Por revisar',
    en_revision: 'En revisión',
    revisada_sin_dev: 'Revisada',
    con_dev: 'Con devolución',
    ajustada: 'Ajustada',
    en_acondicionamiento: 'En acondicionamiento',
    en_almacen: 'En almacén',
    confirmada: 'Confirmada',
    bloqueada_por_divergencia: 'Bloqueada (divergencia)',
}

// ⭐ MEJORA 22 Sep 2026 — un color DISTINTO por estado (antes 10 estados en 5 tonos:
// «recién creada», «revisada» y «ajustada» salían idénticas, y 4 estados compartían el ámbar).
// Criterio: **tinta** (translúcido) para lo que está en cola o pendiente · **relleno** (`-bg`)
// para lo que está en marcha o cerrado · y `hito` (violeta) para el punto de control del flujo.
// ⚠️ Verificado por HUE en las 3 paletas: NO se usan `primary`/`secondary` como color de estado
// (en Obsidiana `primary` es ámbar ≈ `warning`; en Piedra `secondary` es verde = `success`).
export const TONO_ESTADO_ENTRADA: Record<EstadoEntrada, TonoPildora> = {
    recien_creada: 'neutro', // borrador: existe pero no arrancó (gris)
    lista_para_revision: 'info', // en COLA (azul tinta)
    en_revision: 'advertencia', // el técnico está trabajando (ámbar tinta)
    revisada_sin_dev: 'listo', // revisión terminada OK, falta el cierre (verde tinta)
    con_dev: 'peligro', // hay rechazos por resolver (rojo tinta)
    ajustada: 'hito', // punto de control cumplido: nota generada (violeta)
    en_acondicionamiento: 'encurso', // etapa en marcha (azul relleno)
    en_almacen: 'avanzando', // etapa avanzada en marcha (ámbar relleno)
    confirmada: 'exito', // cerrado: stock real (verde relleno)
    bloqueada_por_divergencia: 'bloqueado', // detenido por divergencia (rojo relleno)
}

export const TEXTO_ESTADO_PARTIDA: Record<EstadoPartida, string> = {
    PENDIENTE: 'Pendiente',
    OK: 'Ok',
    MAL: 'Con malas',
}

export const TEXTO_ESTADO_DEVOLUCION: Record<EstadoDevolucion, string> = {
    por_cotejar: 'Por cotejar',
    ajustada: 'Ajustada',
}

/** ⭐ MEJORA 22 Sep 2026 (12) — la DEV tiene estado y ahora se ve: ámbar mientras espera el ajuste
 *  del recepcionista, verde en tinta cuando el ajuste ya ocurrió (mismo criterio de la MEJORA 10:
 *  tinta = pendiente/cerrado, relleno = en marcha). */
export const TONO_ESTADO_DEVOLUCION: Record<EstadoDevolucion, TonoPildora> = {
    por_cotejar: 'advertencia',
    ajustada: 'listo',
}

// ── Respuestas tipadas de las Server Actions (nunca throw — patrón 0.9) ─────────
export interface RespuestaLista<T> { success: boolean; error?: string; data?: T[]; total?: number }
export interface RespuestaDato<T> { success: boolean; error?: string; data?: T }
export interface RespuestaAccion { success: boolean; error?: string }

// ── Categoría capturable (esquema no vacío — HDD/M.2/SSD/RAM) ────────────────────
// Select de recepción + esquema que revisión renderiza para resolver el SKU por huella.
export interface CategoriaCapturable {
    id: string
    nombre: string
    esquema: AtributoEsquema[]
}
