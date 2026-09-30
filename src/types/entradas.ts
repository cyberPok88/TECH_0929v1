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

/**
 * ⭐ MEJORA 25 (24 Sep 2026 · decisión 22 del mapa) — **la TANDA**: el grupo aprobado
 * (partida + huella) que se libera hacia Acondicionamiento **mientras la entrada sigue en
 * revisión**. Es un camino PARALELO al de `entradas.estado`: la entrada no cambia de estado.
 *   `por_limpiar` → `en_limpieza` (acondicionador) → `en_almacen` (entrega) → `confirmada` (alta).
 */
export type EstadoTanda = 'por_limpiar' | 'en_limpieza' | 'en_almacen' | 'confirmada'

/**
 * ⭐ FIX 25 Sep 2026 — **los estados en los que la REVISIÓN todavía puede ENTREGAR mercancía.**
 *
 * Fuente ÚNICA: la valida la Server Action `liberarAvance` **y** la consultan las superficies para
 * NO ofrecer una acción imposible. Antes la lista vivía **sólo** dentro de la Server Action y las
 * puertas de la UI se pintaban con `liberables > 0` a secas: el resultado medido fue que el botón
 * aparecía en **7 entradas `ajustada`/`revisada_sin_dev`** (todas con aprobadas y sin liberar) y
 * **no** en la única que sí podía (`ING-0008`, ya 24/24 liberadas). Al tocarlo, el servidor
 * respondía `«La entrada ya avanzó: no se puede liberar desde la revisión.»` y no pasaba nada.
 *
 * ⚠️ **Corrección 25 Sep 2026 (MEJORA 27 · decisión 22.f) — la justificación anterior era FALSA y se
 * corrige.** Decía: *«Después de `revisada_sin_dev` la mercancía aprobada ya salió del expediente por
 * el cierre de la revisión»*. **No es así, y se midió:** en `revisada_sin_dev` y `con_dev` la
 * mercancía **no se mueve** — el expediente sólo cambió de estado y espera a que **Recepción genere
 * la nota** (`NC-####` → `ajustada`). Las piezas aprobadas siguen físicamente donde estaban. Dejar
 * fuera esos dos estados bloquea el flujo FÍSICO por un **trámite**, que es exactamente lo contrario
 * de la decisión 22 (y el usuario lo reportó: *«revisé pero no me permitió … liberar esas piezas»*
 * sobre `ING-0002`, `revisada_sin_dev`, con **6 aprobadas y 0 liberadas**).
 *
 * `ajustada` **sí** queda fuera: ahí el documento ya está ruteado al **acondicionamiento clásico**, y
 * liberar sería abrir un segundo camino para lo mismo (el alta clásica coteja el saldo, así que no
 * rompería nada — pero ofrece una puerta que no hace falta).
 *
 * ⚠️ **CORRECCIÓN 29 Sep 2026 (usuario) — la justificación de arriba era FALSA y se corrige.** Decía
 * que en `ajustada` *«liberar sería abrir un segundo camino para lo mismo»*. **No es lo mismo, y se
 * midió con el caso vivo `ING-0026`:** la revisión cerró, **8 aprobadas y 0 liberadas**, Recepción
 * generó su nota (`NC-0023` → `ajustada`)… y las 8 piezas **siguen físicamente en la mesa del
 * técnico**. La nota es la mitad **administrativa**; la liberación es la **entrega física**, y cerrar
 * la puerta por un trámite es exactamente lo que la MEJORA 27 ya había corregido para
 * `revisada_sin_dev`/`con_dev` — de los que `ajustada` es el **estado siguiente** (la nota se genera
 * *porque* la revisión cerró).
 *
 * **No hay doble conteo, y la reconciliación ya estaba construida:** Almacén coteja el **saldo**
 * (`Σ aprobadas − Σ liberadas`), así que lo que salga por tanda se descuenta del camino clásico:
 * liberar 3 de 8 después de la nota deja el saldo en 5 ⇒ 3 + 5 = 8. Sin duplicar y sin perder.
 * **El corte físico es `en_acondicionamiento`:** al pulsar «Tomar para acondicionar» la mercancía ya
 * entró al puesto y ahí sí se cierra la liberación.
 */
export const ESTADOS_LIBERABLES: EstadoEntrada[] = [
    'recien_creada',
    'lista_para_revision',
    'en_revision',
    // ⭐ MEJORA 27 · 22.f — la revisión CERRÓ pero la mercancía sigue esperando: se puede entregar.
    'revisada_sin_dev',
    'con_dev',
    // ⭐ MEJORA 42-bis · 29 Sep 2026 — la nota YA se generó, pero la mercancía no se ha entregado:
    // mientras queden aprobadas sin liberar, la entrega es de Revisión (no del cierre del documento).
    'ajustada',
]

/** ¿Esta entrada todavía puede entregar una tanda a Acondicionamiento? (espejo de la SA) */
export function puedeLiberar(estado: EstadoEntrada): boolean {
    return ESTADOS_LIBERABLES.includes(estado)
}

/**
 * ⭐ MEJORA 28 — **los estados en los que Recepción puede ajustar la DEV y generar la nota.**
 * Fuente ÚNICA: la valida la Server Action `ajustarYGenerarNota` **y** la consultan las puertas de
 * la UI (`AjusteDevModal` · `PartidasExpandidas` · `devPendiente`), para que no puedan discrepar.
 * Es el mismo patrón que `ESTADOS_LIBERABLES` (MEJORA 26) — que nació justo de un botón que se
 * ofrecía y el servidor rechazaba.
 *
 * ⚠️ **El orden importa**: una entrada que **ya tiene nota** está en `ajustada`, así que si se
 * mirara solo el estado el mensaje diría *«aún no está lista»* cuando la verdad es *«ya se hizo»*.
 * Por eso `puedeAjustarNota` recibe también el `id_nota` y devuelve `false` en los dos casos —
 * y el mensaje lo distingue quien lo escribe.
 */
export const ESTADOS_AJUSTABLES: EstadoEntrada[] = ['revisada_sin_dev', 'con_dev']

export function puedeAjustarNota(estado: EstadoEntrada, idNota: string | null): boolean {
    return idNota === null && ESTADOS_AJUSTABLES.includes(estado)
}

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
    /**
     * ⭐ MEJORA 24 Sep 2026 (Fase 2 · Revisión) — Σ `cantidad_aprobada` de `partidas_resueltas`:
     * lo que el técnico **ya aprobó** (el fruto de la etapa). Es el tercer tramo del avance
     * (`aprobadas` · DEV · pendientes) y lo que permite decir «En revisión · 9/12».
     */
    piezas_aprobadas: number
    /**
     * ⭐ MEJORA 25 — Σ de `liberaciones_entrada.cantidad`: lo que **ya salió** del expediente como
     * tanda hacia Acondicionamiento. El cuarto tramo del avance de la cola de Revisión, y lo que
     * permite decir «20 aprobadas · 10 ya en limpieza».
     */
    piezas_liberadas: number
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
     * ⭐ MEJORA 28 Sep 2026 — **la mercancía de esta partida se identifica por número de serie**
     * (D1 de la MEJORA 35): al guardar la revisión se pide el concentrado de NS. La captura
     * Recepción; aquí llega para poder **editar** una entrada recién creada sin perder la bandera.
     */
    lleva_ns: boolean
    /**
     * ⭐ MEJORA 22 Sep 2026 — DEV de la partida con el **dato real** de `devoluciones_entrada`
     * (no una resta `original − vigente`): pueden convivir una DEV viva y `cantidad_vigente`
     * intacta mientras el ajuste está pendiente. `dev_ajustada` = ya tiene `fecha_ajuste`.
     */
    dev_cantidad: number
    dev_ajustada: boolean
}

// ── Partida con su AVANCE de revisión (acordeón de Revisión · MEJORA 20 Sep) ─────
/**
 * ⭐ MEJORA 24 Sep 2026 (Fase 2 · Revisión) — la **huella que produjo la etapa**: marca + los
 * atributos que el técnico capturó, con cuántas piezas quedaron así. Es la EVOLUCIÓN de lo que
 * Recepción declaró (`{tipo, capacidad}`) y lo que el desglose tiene que poder mostrar.
 * ⚠️ Puede haber **varias por partida**: una partida de «100 discos» puede rendir 2 huellas
 * (2TB y 4TB, por ejemplo). Se devuelven TODAS — elegir una sería mentir sobre lo aprobado.
 */
export interface HuellaResuelta {
    id_marca: string | null
    marca_nombre: string | null
    atributos: Record<string, unknown>
    cantidad_aprobada: number
    /**
     * ⭐ MEJORA 25 — **id de la fila en `partidas_resueltas`**: es la UNIDAD de liberación
     * (el «grupo» = partida + huella). Sin él la UI no podría pedir «libera estas 10».
     */
    id_partida_resuelta: string
    /** ⭐ MEJORA 25 — Σ ya liberada de este grupo en tandas anteriores. */
    cantidad_liberada: number
    /**
     * ⭐ MEJORA 29 — Σ `cantidad` de las DEV **de esta huella**. Antes la DEV era de la PARTIDA y se
     * repetía (o se omitía) en sus líneas; ahora cada línea desglosa la suya y **el padre es la suma
     * de sus líneas**.
     */
    cantidad_devuelta: number
    /** ⭐ MEJORA 29 — ¿alguna DEV de esta huella ya tiene `fecha_ajuste`? */
    dev_ajustada: boolean
}

/**
 * ⭐ MEJORA 29 (25 Sep 2026) — la **huella canónica**: la misma huella escrita en otro orden de
 * claves es la MISMA huella (`jsonb` de Postgres ya normaliza; el camino JS no). Vive en el módulo
 * de tipos — y no en la Server Action — para que el **guardado**, la **lectura** y el **desglose**
 * usen una sola definición: dos maneras de canonicalizar son dos maneras de no emparejar, y esa
 * clase de defecto ya se pagó una vez (la huella duplicada de la MEJORA 25).
 */
export function huellaCanonica(at: Record<string, unknown> | null | undefined): string {
    const o = at ?? {}
    return JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]))
}

/** ⭐ MEJORA 29 — la CLAVE de una línea del desglose: **marca + huella canónica**. */
export function claveLinea(
    idMarca: string | null,
    atributos: Record<string, unknown> | null | undefined
): string {
    return `${idMarca ?? ''}|${huellaCanonica(atributos)}`
}

/**
 * ⭐ MEJORA 29 — una huella que **solo tiene DEV** (nada aprobado). Antes no podía existir: la marca
 * de la pieza mala se tiraba al agrupar y la DEV se agregaba a la partida. Ahora es una **línea
 * más** del desglose («Corsair · 2 malas») y el padre sigue siendo la suma de sus líneas.
 */
export interface HuellaDevuelta {
    id_marca: string | null
    marca_nombre: string | null
    atributos: Record<string, unknown>
    cantidad: number
    ajustada: boolean
}

export interface PartidaConAvance {
    id: string
    partida: number
    /**
     * ⭐ MEJORA 35 (27 Sep 2026) — **la mercancía de esta partida se identifica por número de serie**:
     * al guardar la revisión se piden los NS (el concentrado de la entrada). Es la bandera de **D1**,
     * capturada en Recepción; vive en la PARTIDA porque es la unidad que llega y se revisa.
     *
     * ⚠️ **REQUERIDO, no opcional — y es una lección pagada, no un estilo** (28 Sep 2026). Nació
     * opcional «para no tocar el mapeo» y el mapeo no se tocó: `lleva_ns` nunca llegaba al wizard y
     * las pantallas de escaneo **no se abrían jamás**, con `tsc`/`lint`/`build` en verde. Un dato que
     * **decide comportamiento** viaja requerido: así el compilador obliga a quien lo construye.
     */
    lleva_ns: boolean
    id_categoria: string | null
    categoria_nombre: string | null
    /** Snapshot de recepción (atributos `en_entrada`) — base de la huella. */
    atributos: Record<string, unknown>
    cantidad_original: number
    /**
     * ⭐ MEJORA 28 (decisión 22.h) — lo que quedará tras el ajuste (`original − Σ DEV`). Lo pinta
     * el desglose de Recepción en su columna **Final**; el desglose de Revisión no lo usa.
     */
    cantidad_vigente: number
    /** ⭐ MEJORA 28 — el costo acordado de la línea declarada (columna **Costo** de Recepción). */
    costo_acordado: number
    /** ⭐ MEJORA 24 Sep 2026 — Σ `cantidad_aprobada`: lo que la etapa aprobó en esta partida. */
    aprobadas: number
    /** ⭐ MEJORA 24 Sep 2026 — Σ `cantidad` de `devoluciones_entrada`: las MALAS REALES.
     *  Antes iban sumadas dentro de `revisadas` y «1 mala» y «40 malas» se veían idénticas. */
    dev_cantidad: number
    /** ⭐ MEJORA 24 Sep 2026 — ¿la DEV ya tiene `fecha_ajuste`? (por cotejar ↔ ajustada). */
    dev_ajustada: boolean
    /** ⭐ MEJORA 24 Sep 2026 — la huella resuelta (marca + atributos) por grupo aprobado. */
    huellas: HuellaResuelta[]
    /** ⭐ MEJORA 29 — las huellas que **solo** tienen DEV (ninguna aprobada): son líneas propias. */
    devs: HuellaDevuelta[]
    /**
     * ⭐ MEJORA 25 — Σ liberada de esta partida (en cualquiera de sus grupos).
     * Es el cuarto tramo del avance: `aprobadas · liberadas · DEV · faltan`.
     */
    liberadas: number
    /** Piezas ya revisadas = aprobadas + devueltas. */
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
    /** ⭐ MEJORA 25 — Σ ya liberada de este grupo (tandas creadas, en cualquier estado). */
    cantidad_liberada: number
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
     * ⭐ MEJORA 23 Sep 2026 (12) — **display aplanado** del embed de `listarResultadoRevision`: de
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
    /**
     * ⭐ MEJORA 29 Sep 2026 — las dos columnas que la MEJORA 35 agregó a la tabla y que **este tipo
     * nunca recibió**: sin consumidor, el hueco no se notaba. Ahora sí lo hay (la consulta de NS de
     * Almacén), y son justo las que hacen que un NS *cuente algo*: de qué PARTIDA salió y si era
     * bueno o malo.
     */
    id_partida_entrada: string | null
    resultado: 'PASA' | 'NO_PASA'
    /** NULL hasta que Almacén resuelve el SKU por huella (hoy nadie lo escribe: ver la consulta). */
    id_producto: string | null
    creado_por: string | null
    created_at: string
}

/**
 * ⭐ MEJORA 29 Sep 2026 — **la respuesta del control de NS del puesto de Almacén.**
 *
 * El escenario que sirve (`bd-entradas.md` · M35): vuelve un disco con su serial y hay que decir
 * **de dónde vino y qué pasó con él**. Lo que el concentrado **sí** sabe: entrada · proveedor · fecha
 * · partida · bueno/malo · quién lo capturó. Lo que **no** sabe, y se declara en vez de inventarse:
 * **la marca del NS** (una partida rinde varias filas de producto y el serial no las distingue) — por
 * eso el producto se informa a nivel **PARTIDA** (`productos`), no por serial.
 */
export interface ProductoDeLaPartidaNs {
    sku: string
    nombre: string
    cantidad_aprobada: number
}

export interface ResultadoConsultaNs {
    /** El NS tal como se buscó (recortado). */
    ns: string
    /** `false` NO es un error: es la respuesta «este serial no está en el concentrado». */
    encontrado: boolean
    resultado?: 'PASA' | 'NO_PASA'
    folio?: string
    estado_entrada?: EstadoEntrada
    proveedor?: string | null
    fecha_entrada?: string
    partida?: number | null
    categoria?: string | null
    /** Nombre del técnico que firmó la tanda donde se escaneó. */
    capturado_por?: string | null
    capturado_at?: string
    /**
     * Lo que esa PARTIDA rindió (SKU por huella, resuelto en Almacén). Vacío = todavía no se dio de
     * alta, o la partida rindió varias huellas y el concentrado no puede decir cuál es este NS.
     */
    productos?: ProductoDeLaPartidaNs[]
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
    /**
     * ⭐ MEJORA 28 Sep 2026 — **la bandera que enciende el concentrado de NS en Revisión** (D1). Es
     * una decisión de la PUERTA, no del técnico: quien recibe sabe si la mercancía trae serial
     * (discos, RAM, equipos) o no (cables, adaptadores). Sin este control, la bandera nacía siempre
     * en `false` y el wizard de revisión **nunca** pedía los NS.
     */
    lleva_ns: boolean
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
    /** Un estado suelto (filtro clásico de catálogo). */
    estado: '' | EstadoEntrada
    /**
     * ⭐ MEJORA 24 Sep 2026 (Fase 2 · Revisión) — la cola de una ETAPA no es un estado suelto:
     * «A revisar» son TRES (`recien_creada` · `lista_para_revision` · `en_revision`). Convive con
     * `estado`; si el conjunto viene con elementos manda él (`in`).
     */
    estados?: EstadoEntrada[]
    /**
     * ⭐ MEJORA 24 Sep 2026 (Fase 2) — **antigüedad mínima en días**: «lo que lleva ≥ N días
     * esperando». Es el filtro que hace visible el problema reportado (una entrada puede llevar
     * 3 días en cola). No se deriva de `fecha_hasta` a propósito: si el usuario toca el rango de
     * fechas, la antigüedad no debe cambiar sola.
     */
    antiguedad_min?: number
    /**
     * ⭐ MEJORA 24 Sep 2026 (Fase 2 · Revisión) — **el orden es de la VISTA, no del listado**:
     *  · `recientes` (default) — del más nuevo al más viejo. Es el listado de CONSULTA y el
     *    comportamiento que ya tenían Recepción, Alta y Acondicionamiento.
     *  · `cola` — el orden de un PUESTO DE TRABAJO: **arriba lo que le falta a la etapa**
     *    (`fecha_fin_rev` nula), **abajo lo ya cerrado**; dentro del primer nivel manda la
     *    antigüedad (lo que más espera, primero). Lo pide la cola de Revisión.
     * ⚠️ No se ordena por la PRIORIDAD de cada estado: `entradas.estado` es `text` (medido en
     * `information_schema`), así que PostgREST solo podría ordenarlo alfabéticamente. El corte de
     * dos niveles («pendiente / cerrado») se logra con `nullsfirst` sobre `fecha_fin_rev`, que es
     * el marcador real del fin de la revisión — un orden por ESTADO fino exigiría un objeto de BD
     * (vista o columna generada con `case`), carril ANEXIÓN-BD.
     */
    orden?: 'recientes' | 'cola'
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
    /**
     * ⚠️ LEGADO (MEJORA 35) — el NS **deja de ser un dato de la pieza**: se captura en el concentrado
     * de la tanda (`NsTanda`) al guardar. Este campo queda solo como respaldo de lo capturado antes del
     * cambio; el wizard ya no lo pide cuando la partida lleva NS.
     */
    ns?: string
}

/**
 * ⭐ MEJORA 35 (27 Sep 2026) — **el CONCENTRADO de la tanda**: los NS que el técnico escanea después de
 * revisar, primero los de las piezas que pasaron y después los de las que no. **No lleva marca ni
 * motivo** porque el NS no los conoce: la marca la determina la REVISIÓN por huella (una partida puede
 * rendir varias filas de producto) y el motivo vive en la DEV/tanda.
 */
export interface NsTanda {
    pasa: string[]
    noPasa: string[]
}

/** Avance de revisión de UNA partida (las piezas que el técnico firma al guardar). */
export interface AvanceRevisionInput {
    id_entrada: string
    piezas: PiezaRevision[]
    /**
     * ⭐ MEJORA 35 — las dos listas del concentrado. **Sin ellas no se escribe** (D2): el wizard las
     * pide antes de llamar a esta acción, y si el técnico cancela la captura, no se guarda nada.
     * Sin `ns` la acción cae al respaldo legado (piezas con `ns` propio).
     */
    ns?: NsTanda
}

export interface ResultadoRevision {
    aprobadas: PartidaResuelta[]
    devoluciones: DevolucionEntrada[]
}

// ── ⭐ MEJORA 25 — LA TANDA (liberación parcial · decisión 22 del mapa) ─────────
/**
 * Un **grupo** de la tanda: cuántas piezas de UNA huella salieron juntas. La unidad de liberación
 * es el grupo (partida + huella) — la misma agrupación que ya usa `partidas_resueltas` y con la
 * que Almacén resuelve el SKU. Se descartó la pieza suelta con N/S: mata la decisión 14 del mapa
 * («revisión sin NS = resultado agrupado»).
 */
export interface TandaGrupo {
    /** id de la fila en `liberaciones_entrada` (una por grupo). */
    id: string
    id_partida_resuelta: string
    partida_numero: number | null
    id_categoria: string | null
    categoria_nombre: string | null
    id_marca: string | null
    marca_nombre: string | null
    atributos: Record<string, unknown>
    /** Piezas liberadas de este grupo. */
    cantidad: number
    /** SKU resuelto por Almacén (`null` hasta el alta). */
    id_producto: string | null
    producto_sku: string | null
    /** Costo congelado de la partida — lo necesita el lote del alta; Acondicionamiento no lo pinta. */
    costo_acordado: number
    /** Piezas ya dadas de alta de este grupo (solo tiene valor en `confirmada`). */
    cantidad_confirmada: number | null
}

/** La tanda completa: N grupos que salieron juntos. Es la fila de la cola de Acondicionamiento. */
export interface TandaLiberada {
    id_tanda: string
    /** Consecutivo por entrada (el que se ve: «T1»). */
    tanda: number
    id_entrada: string
    entrada_folio: string
    proveedor_nombre: string | null
    estado: EstadoTanda
    /** Σ de las piezas de la tanda. */
    piezas: number
    /** Σ ya dada de alta (solo en `confirmada`). */
    piezas_confirmadas: number
    fecha_liberacion: string
    liberador_nombre: string | null
    /**
     * ⚠️ MEJORA 25 (usuario, 24 Sep): la **autoría y la fecha de la liberación NO son un dato para
     * el acondicionador** — se cargan para la bitácora y para el detalle de Revisión, pero la cola
     * de Acondicionamiento no las pinta (solo producto · partida · piezas · estado).
     */
    grupos: TandaGrupo[]
}

/**
 * ⭐ MEJORA 27 (25 Sep 2026 · decisión 22.g) — **LA BANDEJA**: la fila con la que trabaja el
 * acondicionador.
 *
 * El pedido del usuario: *«como una bandeja donde si van entregando de revisión ahí se van agrupando
 * si vienen de la misma entrada misma partida»*. Medido en `ING-0001`: la partida 1 liberó **dos
 * tandas del mismo ADATA 1TB** (4 + 2) y la cola las mostraba como **dos filas**.
 *
 * **Agrupa por GRUPO (partida + huella) + estado**, no por partida: una partida puede rendir **dos
 * marcas** (→ dos SKU) y `ING-0002` es exactamente ese caso — agrupar por partida las juntaría, que
 * es justo lo que la decisión 22.e prohíbe. Y agrupa por estado porque sólo se puede accionar sobre
 * tandas que están en el mismo momento del trabajo.
 */
export interface BandejaLiberada {
    /** Clave de agrupación: `${id_partida_resuelta}|${estado}`. */
    clave: string
    id_partida_resuelta: string
    id_entrada: string
    entrada_folio: string
    proveedor_nombre: string | null
    estado: EstadoTanda
    /** Las tandas que la componen (una bandeja puede traer varias). */
    ids_tanda: string[]
    tandas: number[]
    /** Σ de las piezas de sus tandas. */
    piezas: number
    piezas_confirmadas: number
    /** La más antigua: es la que manda el tono de urgencia de la cola. */
    fecha_primera_liberacion: string
    partida_numero: number | null
    id_categoria: string | null
    categoria_nombre: string | null
    id_marca: string | null
    marca_nombre: string | null
    atributos: Record<string, unknown>
    id_producto: string | null
    producto_sku: string | null
    costo_acordado: number
}

/** Entrada de `liberarAvance`: los grupos y cuántas piezas de cada uno salen ahora. */
export interface LiberarAvanceInput {
    id_entrada: string
    items: { id_partida_resuelta: string; cantidad: number }[]
    notas?: string
}

/**
 * ⭐ MEJORA 27 Sep 2026 (Fase 1 · Recepción) — **UNA LIBERACIÓN de ESTE ingreso**, fila por fila: es
 * la bandeja del acondicionador con sus tres fechas (liberación · inicio de limpieza · entrega).
 *
 * ⚠️ No es `BandejaLiberada`: esa es la unidad de la **cola** del acondicionador (agrupa las tandas
 * de un grupo). Aquí se lee el documento: lo que salió de ESTA entrada, en orden de tanda.
 */
export interface LiberacionDeIngreso {
    id: string
    tanda: number | null
    partida_numero: number | null
    marca_nombre: string | null
    atributos: Record<string, unknown>
    cantidad: number
    estado: EstadoTanda
    fecha_liberacion: string | null
    fecha_inicio_acond: string | null
    fecha_entrega: string | null
    fecha_confirmacion: string | null
}

/**
 * ⭐ MEJORA 27 Sep 2026 (Fase 1 · Recepción) — **LAS ETAPAS DE UN INGRESO** (solo lectura).
 *
 * El pedido del usuario: *«Recepción es un puesto importante, prácticamente es un usuario
 * administrador que ve todas las etapas, tiene jerarquía alta, y justo es para que él pueda revisar
 * cómo va evolucionando las cosas sin abandonar Entradas»*.
 *
 * Las cuatro etapas se leen con UN solo read (`listarEtapasDeIngreso`) que junta lo que cada etapa ya
 * sabe: Recepción y Revisión con `listarPartidasConAvance`, Almacén con `abrirCotejoAlta` (misma
 * definición de las líneas de cotejo, no una copia) y Acondicionamiento con las liberaciones de este
 * ingreso. **Cero escritura**: es consulta pura (decisión ⑧ del mockup aprobado el 27 Sep 2026).
 */
export interface EtapasDeIngreso {
    acondicionamiento: LiberacionDeIngreso[]
    cotejo: CotejoLinea[]
    divergencias: Divergencia[]
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
    /**
     * ⭐ MEJORA 25 — lo que **falta por dar de alta** = `cantidad_aprobada − Σ liberado`.
     * Es el número que el alta clásica debe cotejar: si se usara `cantidad_aprobada`, las piezas
     * que ya salieron por tanda **subirían stock dos veces**. La NOTA no se toca (cobra todo lo
     * aceptado: es lo que se le debe al proveedor — decisión 22.b).
     */
    cantidad_pendiente: number
    costo_acordado: number
    /**
     * ⭐ MEJORA 25 — solo en el alta de una TANDA: el id de la fila de `liberaciones_entrada` que
     * se marca `confirmada` al dar el alta. En el alta clásica (por entrada) va `undefined`.
     */
    id_liberacion?: string
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

/**
 * ⭐ MEJORA 24 Sep 2026 (Fase 2 · Revisión) — el estado en el idioma de la ETAPA.
 *
 * ⚠️ Por qué NO se reusa `TEXTO_ESTADO_ENTRADA`: ese mapa describe el **documento** y lo comparten
 * las 5 fases. En la cola del técnico «Recién creada» no dice que la fila **le toca a él**, y una
 * entrada puede llevar **3 días** ahí con el mismo gris que una recién capturada (caso real
 * `ING-0001`, 21 Sep). Aquí el texto es la **acción pendiente de esta etapa**; la antigüedad la
 * agrega la columna (`columnaEstadoRevision` · `urgenciaDeCola`) porque escala el tono.
 *
 * `EstadoEntrada` tiene 10 valores: el mapa es total a propósito — si nace un estado nuevo, el
 * compilador obliga a decidir qué dice la cola de Revisión.
 */
export const TEXTO_ETAPA_REVISION: Record<EstadoEntrada, string> = {
    recien_creada: 'Revisar',
    lista_para_revision: 'Revisar',
    en_revision: 'En revisión',
    // ⭐ FIX 25 Sep 2026 (usuario) — *«en estado dice con DEV, pero tampoco se ha realizado al 100 la
    // revisión … solo si hay dev esa píldora no muestra el estado de la revisión»*: el rótulo de la
    // DEV estaba **tapando** que la revisión YA cerró. El texto dice primero el estado de la ETAPA y
    // después el pendiente de Recepción, igual que `en_revision` añade su avance.
    revisada_sin_dev: 'Revisión cerrada',
    con_dev: 'Cerrada · con DEV',
    // ⚠️ MEJORA 32 — estos dos rótulos son los del caso **sin nada por liberar**. Si queda saldo
    // aprobado sin liberar, la cola de Revisión NO usa este mapa: dice «Por liberar (n)» desde
    // `columnaEstadoRevision` (el pendiente es una CANTIDAD, no un estado — decisión 22 / R23).
    // ⭐ FIX 25 Sep 2026 (usuario · ING-0002) — decía **«Cerrada»** y era falso: con la nota ya
    // generada la entrada **no está cerrada**, le faltan acondicionamiento y almacén (medido sobre
    // `ING-0002`: `estado='ajustada'`, `fecha_fin_acond` y `fecha_fin_almacen` **nulas**, 0 lotes y
    // 0 movimientos; 4 aprobadas y **0 liberadas**). El usuario lo leyó como *«me cerró el ingreso …
    // solo se generó la NC, y aún le faltan etapas por completar»*. Aquí la revisión ya no es suya:
    // dice lo mismo que los tres estados posteriores — **otra etapa** la tiene.
    ajustada: 'Otra etapa',
    en_acondicionamiento: 'Otra etapa',
    en_almacen: 'Otra etapa',
    confirmada: 'Otra etapa',
    bloqueada_por_divergencia: 'Bloqueada',
}

/** El tono BASE de cada estado de la etapa. En cola (`Revisar`) la antigüedad lo sobreescribe. */
export const TONO_ETAPA_REVISION: Record<EstadoEntrada, TonoPildora> = {
    recien_creada: 'info', // en cola
    lista_para_revision: 'info', // en cola
    en_revision: 'advertencia', // el técnico ya está dentro
    revisada_sin_dev: 'listo', // terminó sin rechazos; falta el cierre de Recepción
    con_dev: 'peligro', // hay rechazos: el documento regresa a Recepción
    ajustada: 'listo',
    en_acondicionamiento: 'neutro',
    en_almacen: 'neutro',
    confirmada: 'neutro',
    bloqueada_por_divergencia: 'bloqueado',
}

/**
 * ⭐ MEJORA 24 Sep 2026 (Fase 1 · Recepción) — el estado en el idioma de la ETAPA.
 * Mismo criterio que `TEXTO_ETAPA_REVISION` (Fase 2): el mapa del documento lo comparten las 5
 * fases y no dice qué espera ESTA cola. Aquí el texto es la acción pendiente de Recepción:
 * «Ajustar y generar nota» cuando la entrada está revisada (con o sin DEV) y todavía sin nota.
 *
 * ⚠️ Diferencia deliberada con Revisión: allí la cola es PASIVA (se espera al técnico) y el tono
 * lo manda la antigüedad desde `info`. Aquí lo pendiente es una **acción que Recepción debe
 * cerrar**: nunca es «info» — arranca en `advertencia` y a los ≥3 días pasa a `peligro` y late.
 *
 * Total sobre los 10 estados: si nace uno nuevo, el compilador obliga a decidir qué dice Recepción.
 */
export const TEXTO_ETAPA_RECEPCION: Record<EstadoEntrada, string> = {
    recien_creada: 'Esperando revisión',
    lista_para_revision: 'Esperando revisión',
    en_revision: 'En revisión técnica',
    // ⭐ FIX 24 Sep 2026 (usuario) — `revisada_sin_dev` quiere decir **revisada SIN devoluciones**:
    // no hay nada que ajustar, solo se genera la nota. Decía «Ajustar y generar nota», que manda a
    // ajustar algo que no existe. `con_dev` (sí hubo rechazos) conserva el verbo completo.
    revisada_sin_dev: 'Generar nota',
    // ⭐ MEJORA 27 Sep 2026 (usuario) — «Ajustar + nota»: la MISMA frase que el botón de la acción
    // (una sola forma de nombrarla en toda la pantalla). Dice las dos cosas que hace, corto.
    con_dev: 'Ajustar + nota',
    // ⭐ FIX 25 Sep 2026 (usuario · ING-0002) — decía **«Cerrada»**: Recepción ya hizo lo suyo (la
    // nota está generada) pero la entrada **sigue viva** esperando acondicionamiento. El texto dice
    // el hecho consumado —lo que Recepción produjo— y no un cierre que no ocurrió. El tono sigue
    // `listo`: es un punto de control cumplido, no una etapa en marcha.
    ajustada: 'Nota generada',
    en_acondicionamiento: 'Otra etapa',
    en_almacen: 'Otra etapa',
    confirmada: 'Otra etapa',
    bloqueada_por_divergencia: 'Bloqueada',
}

/** El tono BASE. En lo pendiente (`revisada_sin_dev` · `con_dev`) la antigüedad lo gradúa. */
export const TONO_ETAPA_RECEPCION: Record<EstadoEntrada, TonoPildora> = {
    recien_creada: 'info', // llegó y espera al técnico: no es tarea de Recepción
    lista_para_revision: 'info',
    en_revision: 'advertencia', // el técnico está dentro; Recepción espera
    revisada_sin_dev: 'advertencia', // pendiente de Recepción (la edad lo sube)
    con_dev: 'advertencia', // pendiente de Recepción (la edad lo sube)
    ajustada: 'listo',
    en_acondicionamiento: 'neutro',
    en_almacen: 'neutro',
    confirmada: 'neutro',
    bloqueada_por_divergencia: 'bloqueado',
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

/**
 * ⭐ MEJORA 25 — el estado de la TANDA en el idioma del puesto. La cola de Acondicionamiento NO
 * dice el nombre interno: dice qué le toca hacer. `confirmada` es «En almacén» y no «Confirmada»
 * porque desde el piso lo que importa es que la mercancía ya es vendible.
 */
export const TEXTO_ESTADO_TANDA: Record<EstadoTanda, string> = {
    por_limpiar: 'Por limpiar',
    en_limpieza: 'En limpieza',
    en_almacen: 'Lista para almacén',
    confirmada: 'En almacén',
}

/** Tinta para lo que espera / está en marcha · relleno para lo que ya cerró (misma ley del módulo). */
export const TONO_ESTADO_TANDA: Record<EstadoTanda, TonoPildora> = {
    por_limpiar: 'info', // en cola: espera al acondicionador
    en_limpieza: 'advertencia', // alguien ya está dentro
    en_almacen: 'avanzando', // entregada, espera el alta
    confirmada: 'exito', // cerrada: stock real
}

/** ⭐ MEJORA 23 Sep 2026 (12) — la DEV tiene estado y ahora se ve: ámbar mientras espera el ajuste
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
