'use server'

// ═══════════════════════════════════════════════════════════════════════════════
// SERVER ACTIONS — VENTAS (Guía 1.8 · 01 Oct 2026)
// 'use server': obligatorio · retornan objetos tipados — NUNCA throw.
//   · listarNotasRemision        (paginación SERVIDOR · filtros · embeds aplanados)
//   · listarVentasParaExportar   (visibles + filtros · sin paginar)
//   · listarPartidasNota         (las partidas de UNA nota — al EXPANDIR la fila)
//   ⏳ Las Partes 3–5 añaden: obtenerNotaRemision · crearNotaRemisionDirecta ·
//      editarNotaRemision · cancelarNotaRemision · registrarMovimientoCxC ·
//      consultarEstadoCuentaCliente · listarConceptosCxC
//
// ⚠️ `saldo_pendiente` y `id_estado_pago` los DERIVA `tr_cxc_estado_pago` (R27) y
//    `clientes.saldo_actual` lo deriva `tr_cxc_saldo_cliente`: estas SA los LEEN,
//    JAMÁS los escriben.
// ⚠️ Los embeds van ANIDADOS en la consulta y `aFilaNota` los APLANA: el tipo de
//    dominio lleva `cliente_codigo` / `estado_pago_clave`, no objetos.
// ═══════════════════════════════════════════════════════════════════════════════

// ⚠️ EL ENCABEZADO IMPORTA **SOLO** LO QUE ESTA PARTE USA. Las Partes 3–5 **ANEXAN** sus
// fragmentos con `Add-Content` y cada uno **trae sus propios imports** (medido 02 Oct 2026: el
// lint de la casa **no** habilita `import/first` ni `import/no-duplicates`, así que un `import`
// dentro del fragmento anexado es legal; y `noUnusedLocals` está ACTIVO ⇒ meter acá un import
// que esta parte todavía no usa **rompe `tsc` con TS6133**). ⇒ **NO adelantes imports de las
// Partes 3–5 a este encabezado.**
import { createClient } from '@/lib/supabase/server'
import type {
    ClaveEstadoPagoNota,
    FiltrosNotaRemision,
    NotaRemisionListado,
    PartidaRemisionListado,
    RespuestaLista,
} from '@/types/ventas'

// ── Formas crudas de PostgREST (embeds aplanados por aFilaNota) ───────────────
interface FilaNotaCruda {
    id: string
    folio: string
    id_cliente: string
    id_marca_comercial: string
    id_cotizacion_origen: string | null
    id_lista_precio: string | null
    id_metodo_envio: string | null
    id_vendedor: string | null
    es_credito: boolean
    fecha_emision: string
    fecha_vencimiento: string
    id_estado_pago: string
    subtotal: number
    descuento_global: number
    impuestos: number
    total: number
    saldo_pendiente: number
    es_cancelada: boolean
    motivo_cancelacion: string | null
    notas: string | null
    creado_por: string | null
    actualizado_por: string | null
    created_at: string
    updated_at: string
    clientes: { codigo: string; nombre_comercial: string } | null
    marcas_comerciales: { nombre_visible: string } | null
    usuarios: { nombre_completo: string } | null
    estados_pago: { clave: ClaveEstadoPagoNota; nombre: string } | null
}

/**
 * ⭐ Las columnas del listado.
 * ⚠️ NOMBRES LITERALES: `marcas_comerciales(nombre_visible)` y `usuarios(nombre_completo)` —
 *    **no** `nombre` (CLAUDE.md regla 4: un `nombre` contra un `nombre_completo` compila y
 *    guarda el dato equivocado para siempre).
 */
const COLUMNAS_NOTAS = [
    'id',
    'folio',
    'id_cliente',
    'id_marca_comercial',
    'id_cotizacion_origen',
    'id_lista_precio',
    'id_metodo_envio',
    'id_vendedor',
    'es_credito',
    'fecha_emision',
    'fecha_vencimiento',
    'id_estado_pago',
    'subtotal',
    'descuento_global',
    'impuestos',
    'total',
    'saldo_pendiente',
    'es_cancelada',
    'motivo_cancelacion',
    'notas',
    'creado_por',
    'actualizado_por',
    'created_at',
    'updated_at',
    'clientes(codigo,nombre_comercial)',
    'marcas_comerciales(nombre_visible)',
    'usuarios(nombre_completo)',
    'estados_pago(clave,nombre)',
].join(',')

function aFilaNota(p: FilaNotaCruda): NotaRemisionListado {
    return {
        id: p.id,
        folio: p.folio,
        id_cliente: p.id_cliente,
        id_marca_comercial: p.id_marca_comercial,
        id_cotizacion_origen: p.id_cotizacion_origen,
        id_lista_precio: p.id_lista_precio,
        id_metodo_envio: p.id_metodo_envio,
        id_vendedor: p.id_vendedor,
        es_credito: p.es_credito,
        fecha_emision: p.fecha_emision,
        fecha_vencimiento: p.fecha_vencimiento,
        id_estado_pago: p.id_estado_pago,
        subtotal: p.subtotal,
        descuento_global: p.descuento_global,
        impuestos: p.impuestos,
        total: p.total,
        saldo_pendiente: p.saldo_pendiente,
        es_cancelada: p.es_cancelada,
        motivo_cancelacion: p.motivo_cancelacion,
        notas: p.notas,
        creado_por: p.creado_por,
        actualizado_por: p.actualizado_por,
        created_at: p.created_at,
        updated_at: p.updated_at,
        cliente_codigo: p.clientes?.codigo ?? null,
        cliente_nombre: p.clientes?.nombre_comercial ?? null,
        marca_nombre: p.marcas_comerciales?.nombre_visible ?? null,
        vendedor_nombre: p.usuarios?.nombre_completo ?? null,
        estado_pago_clave: p.estados_pago?.clave ?? null,
        estado_pago_nombre: p.estados_pago?.nombre ?? null,
    }
}

/** El filtro por estado llega como **clave** (vocabulario de pantalla): se resuelve a su `id`. */
async function idEstadoPagoPorClave(
    supabase: Awaited<ReturnType<typeof createClient>>,
    clave: ClaveEstadoPagoNota
): Promise<string | null> {
    const { data } = await supabase
        .from('estados_pago')
        .select('id')
        .eq('clave', clave)
        .limit(1)
        .maybeSingle()
    return data?.id ?? null
}

// ── Listar notas (paginación SERVIDOR · filtros) ──────────────────────────────
export async function listarNotasRemision(
    filtros: FiltrosNotaRemision,
    pagina = 1,
    tamano = 25
): Promise<RespuestaLista<NotaRemisionListado>> {
    const supabase = await createClient()

    let query = supabase.from('notas_remision').select(COLUMNAS_NOTAS, { count: 'exact' })

    // Las canceladas NO se listan salvo que se pidan (decisión del filtro, no del servidor)
    if (!filtros.incluirCanceladas) query = query.eq('es_cancelada', false)
    if (filtros.idCliente) query = query.eq('id_cliente', filtros.idCliente)
    if (filtros.idMarca) query = query.eq('id_marca_comercial', filtros.idMarca)
    // ⭐ El filtro que la operación usa a diario: «lo que me deben»
    if (filtros.soloConSaldo) query = query.gt('saldo_pendiente', 0)
    if (filtros.fechaDesde) query = query.gte('fecha_emision', filtros.fechaDesde)
    if (filtros.fechaHasta) query = query.lte('fecha_emision', filtros.fechaHasta)

    if (filtros.estadoPago) {
        const idEstado = await idEstadoPagoPorClave(supabase, filtros.estadoPago)
        if (!idEstado) return { success: true, data: [], total: 0 }
        query = query.eq('id_estado_pago', idEstado)
    }

    const busqueda = filtros.busqueda.trim().replace(/[%_]/g, '')
    if (busqueda) {
        query = query.or(`folio.ilike.%${busqueda}%`)
    }

    const desde = (pagina - 1) * tamano
    const { data, error, count } = await query
        .order('fecha_emision', { ascending: false })
        .order('folio', { ascending: false })
        .range(desde, desde + tamano - 1)

    if (error) return { success: false, error: error.message }
    const notas = ((data ?? []) as unknown as FilaNotaCruda[]).map(aFilaNota)
    return { success: true, data: notas, total: count ?? notas.length }
}

// ── Exportar (visibles + filtros · sin paginar) ───────────────────────────────
export async function listarVentasParaExportar(
    filtros: FiltrosNotaRemision
): Promise<RespuestaLista<NotaRemisionListado>> {
    const supabase = await createClient()

    let query = supabase.from('notas_remision').select(COLUMNAS_NOTAS)

    if (!filtros.incluirCanceladas) query = query.eq('es_cancelada', false)
    if (filtros.idCliente) query = query.eq('id_cliente', filtros.idCliente)
    if (filtros.idMarca) query = query.eq('id_marca_comercial', filtros.idMarca)
    if (filtros.soloConSaldo) query = query.gt('saldo_pendiente', 0)
    if (filtros.fechaDesde) query = query.gte('fecha_emision', filtros.fechaDesde)
    if (filtros.fechaHasta) query = query.lte('fecha_emision', filtros.fechaHasta)

    if (filtros.estadoPago) {
        const idEstado = await idEstadoPagoPorClave(supabase, filtros.estadoPago)
        if (!idEstado) return { success: true, data: [] }
        query = query.eq('id_estado_pago', idEstado)
    }

    const busqueda = filtros.busqueda.trim().replace(/[%_]/g, '')
    if (busqueda) {
        query = query.or(`folio.ilike.%${busqueda}%`)
    }

    const { data, error } = await query
        .order('fecha_emision', { ascending: false })
        .order('folio', { ascending: false })

    if (error) return { success: false, error: error.message }
    return { success: true, data: ((data ?? []) as unknown as FilaNotaCruda[]).map(aFilaNota) }
}

// ── ⭐ Las partidas de UNA nota (se piden al EXPANDIR la fila) ─────────────────
/** Forma cruda: la partida + el embed de sus series (se aplana a `series: string[]`). */
interface FilaPartidaCruda extends Omit<PartidaRemisionListado, 'series'> {
    series_partida: { ns: string }[] | null
}

function aFilaPartida(p: FilaPartidaCruda): PartidaRemisionListado {
    const { series_partida, ...partida } = p
    return {
        ...partida,
        // Los N NS del renglón, ordenados: uno por PIEZA (PLAN §6.5 · tabla `series_partida`)
        series: (series_partida ?? []).map((s) => s.ns).sort(),
    }
}

/**
 * ⭐ NO van en el listado: pedir las partidas de las 25 filas de una página serían 25 consultas o
 * un join que multiplica las filas. Se piden **solo de la nota que el usuario abre** — el patrón
 * que estrenó 1.6 con `listarPartidasConAvance`.
 * ⚠️ Trae el embed `series_partida(ns)`: sin él, el desglose no puede mostrar los NS.
 */
export async function listarPartidasNota(
    id_nota: string
): Promise<RespuestaLista<PartidaRemisionListado>> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('partidas_remision')
        .select('*, series_partida(ns)')
        .eq('id_nota', id_nota)
        .order('orden', { ascending: true })

    if (error) return { success: false, error: error.message }
    return { success: true, data: ((data ?? []) as unknown as FilaPartidaCruda[]).map(aFilaPartida) }
}
// ═══════════════════════════════════════════════════════════════════════════════
// SERVER ACTIONS — VENTAS · LA EMISIÓN (Guía 1.8 · Parte 3)
// Se AÑADE al archivo de la Parte 2 (listado). Este fragmento trae SUS PROPIOS imports.
//
//   · crearNotaRemisionDirecta  — EMITE (delega la transacción al RPC `b7`)
//   · resolverPrecioPartida     — el precio que el grid MUESTRA (no el que se guarda)
//
// ⭐ EL NAVEGADOR PROPONE, EL SERVIDOR DISPONE: la cascada (base + lista) se RE-DERIVA
//    aquí contra la BD. El cliente solo aporta lo que es suyo — el descuento ADICIONAL
//    que negoció (PLAN §6.3) y las banderas de cortesía/autorización.
// ⚠️ Toda la escritura ocurre en `fn_emitir_nota_remision` (b7): UNA transacción.
//    Si algo falla —las tres puertas, el piso, un CHECK, la falta de lote— NO se emite nada.
// ═══════════════════════════════════════════════════════════════════════════════

import Decimal from 'decimal.js'

import { notaRemisionSchema } from '@/lib/validations/ventas'
import type { NotaRemisionInput, RespuestaDato } from '@/types/ventas'

/** Lo que el grid necesita saber ANTES de que el vendedor negocie. */
export interface PrecioPartida {
    id_producto: string
    precio_base: number
    /** El ajuste de la lista del cliente, YA normalizado a «descuento» (0.15 = −15%). */
    descuento_lista_porcentaje: number
    /** `precio_base × (1 − descuento_lista)` — lo que costaría sin negociar. */
    precio_con_lista: number
    /** El PISO del producto (R9): la UI avisa antes de que el trigger bloquee. */
    precio_minimo: number | null
    /** ¿El producto maneja número de serie? → el modal sabrá si pedirá el paso 3 (R30). */
    maneja_numero_serie: boolean
    /**
     * ⭐ **ANEXIÓN 05 Oct 2026**: cuántos **LOTES** tienen disponible HOY.
     * ⚠️ La emisión hace **FIFO sobre `lotes`** (`fn_venta_salida_inventario`), así que con
     *    **cero lotes disponibles la emisión FALLA**. Esto es lo que la confirmación anticipa.
     * ⚠️ Es un **AVISO, no una garantía**: entre mirar y emitir, otro vendedor puede consumir
     *    el lote (el único juez sigue siendo el RPC, en su transacción).
     */
    lotes_disponibles: number
}

/** Redondeo monetario: 4 decimales, la precisión de la BD (`numeric(14,4)`). */
function aMoneda(valor: Decimal): number {
    return valor.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber()
}

/**
 * ⭐ Suma días a una fecha `yyyy-mm-dd`, **en UTC y sin pasar por la zona local**.
 *
 * ⚠️ `new Date('2026-10-05')` la interpreta como UTC, así que **en México** cualquier
 *    lectura local pinta el día ANTERIOR — es el mismo defecto que documenta
 *    `formatearFecha` del módulo. Acá se arma con `Date.UTC` y se devuelve el ISO
 *    recortado: string puro de extremo a extremo, sin sorpresas de huso horario.
 *
 * Es la **única definición** de «vencimiento = emisión + plazo»: la usa la emisión.
 */
function sumarDias(fecha: string, dias: number): string {
    const [a, m, d] = fecha.split('-').map(Number)
    if (!a || !m || !d) return fecha
    const base = new Date(Date.UTC(a, m - 1, d))
    base.setUTCDate(base.getUTCDate() + dias)
    return base.toISOString().slice(0, 10)
}

/**
 * ⭐ EL RESOLUTOR DE PRECIO (R32② · R36) — lo que el grid MUESTRA al elegir un producto.
 * ⚠️ NO es el precio que se guarda: los snapshots los re-deriva `crearNotaRemisionDirecta`.
 * Sirve para que el vendedor vea el precio de lista y el piso ANTES de negociar.
 */
export async function resolverPrecioPartida(
    id_cliente: string,
    id_producto: string
): Promise<RespuestaDato<PrecioPartida>> {
    const supabase = await createClient()

    const { data: producto, error: errProd } = await supabase
        .from('productos')
        .select('precio_base, precio_minimo, maneja_numero_serie')
        .eq('id', id_producto)
        .maybeSingle()
    if (errProd) return { success: false, error: errProd.message }
    if (!producto) return { success: false, error: 'El producto no existe.' }

    // ⭐ FIX 02 Oct 2026 — LA LISTA LA TRAE **EL CLIENTE**, NO EL PRODUCTO. Medido contra la BD:
    //    ① `productos` **NO tiene FK a `listas_precios`** ⇒ el embed `listas_precios(...)` dentro de
    //       `productos` era **inválido** (no resolvía);
    //    ② la columna real es **`listas_precios.porcentaje_descuento`**, NO `porcentaje_ajuste`
    //       (habría dado `42703` en runtime);
    //    ③ y **`id_cliente` —el primer parámetro— NO SE USABA**: la cascada ignoraba la lista del
    //       cliente, que es justo lo que **R32② · R35** manda congelar al emitir (`clientes.id_lista_precio`
    //       → `listas_precios`, y esa FK **sí existe**).
    //    ⚠️ `porcentaje_descuento` es **positivo** (0.10 = −10%): se usa tal cual, y así cumple el
    //       CHECK de la partida (`descuento_lista_porcentaje >= 0`).
    const { data: cliente, error: errCli } = await supabase
        .from('clientes')
        .select('id_lista_precio')
        .eq('id', id_cliente)
        .maybeSingle()
    if (errCli) return { success: false, error: errCli.message }

    let porcentajeLista = 0
    /** ⭐ `g12_a4_b1` (05 Oct 2026) — la lista puede **subir** el precio: el signo lo da `tipo_ajuste`. */
    let esIncremento = false
    if (cliente?.id_lista_precio) {
        const { data: lista, error: errLista } = await supabase
            .from('listas_precios')
            .select('porcentaje_descuento, tipo_ajuste')
            .eq('id', cliente.id_lista_precio)
            .maybeSingle()
        if (errLista) return { success: false, error: errLista.message }
        porcentajeLista = Number(lista?.porcentaje_descuento ?? 0)
        esIncremento = lista?.tipo_ajuste === 'incremento'
    }

    const base = new Decimal(producto.precio_base ?? 0)
    const descuentoLista = new Decimal(porcentajeLista)
    /**
     * ⭐ EL SIGNO DE LA LISTA — la MISMA fórmula que `crearNotaRemisionDirecta` (R33 × R32② · R35).
     * ⚠️ Si acá se aplicara el signo y en la emisión no (o al revés), el vendedor vería un precio
     *    y se emitiría otro: es el defecto que ya se pagó con el % de partida.
     */
    const factorLista = new Decimal(1).plus(
        new Decimal(esIncremento ? 1 : -1).times(descuentoLista)
    )

    // ⭐ ANEXIÓN 05 Oct 2026 — ¿HAY DE DÓNDE SURTIR? La emisión hace FIFO sobre `lotes`, así que
    //    sin un lote con disponible **la emisión falla**. Se cuenta acá para que la confirmación
    //    lo ANTICIPE (antes el usuario se enteraba con la nota ya capturada).
    //    ⚠️ Se cuenta, no se resta stock: el juez del stock es el RPC.
    const { count: lotesDisponibles, error: errLotes } = await supabase
        .from('lotes')
        .select('id', { count: 'exact', head: true })
        .eq('id_producto', id_producto)
        .gt('cantidad_disponible', 0)
    if (errLotes) return { success: false, error: errLotes.message }

    return {
        success: true,
        data: {
            id_producto,
            precio_base: aMoneda(base),
            descuento_lista_porcentaje: aMoneda(descuentoLista),
            precio_con_lista: aMoneda(base.times(factorLista)),
            precio_minimo: producto.precio_minimo ?? null,
            maneja_numero_serie: Boolean(producto.maneja_numero_serie),
            lotes_disponibles: lotesDisponibles ?? 0,
        },
    }
}

/**
 * Traduce el error del RPC. `P0001` es el `RAISE EXCEPTION` de nuestros triggers y de los guards
 * de `b7`: **su mensaje YA está en español y es para el usuario** — se pasa tal cual. Los demás
 * códigos son técnicos y se envuelven.
 */
function traducirErrorEmision(codigo: string | undefined, mensaje: string): string {
    if (codigo === 'P0001') return mensaje
    if (codigo === '23505') return 'Ese folio ya existe. Vuelve a intentar la emisión.'
    if (codigo === '23503') return 'Falta un dato relacionado (cliente, producto o impuesto).'
    if (codigo === '23514') return 'Algún dato no cumple una regla de la nota. Revisa precios y cantidades.'
    if (codigo === '42501') return 'No tienes permiso para emitir notas de remisión.'
    return mensaje || 'No se pudo emitir la nota.'
}

// ── ⭐ EMITIR (R15 · R27 · R6 · R38 · R32 · R32③ · R9 · R11–R14 · R22 · R30 · R8 · R10) ────────
/**
 * ⭐ EMITE una nota de remisión. **Sin borrador: crear = emitir** (mapa D-17).
 *
 * ⚠️ LO QUE ESTA SA **NO** HACE, a propósito:
 *   · **no escribe la nota ni las partidas** — lo hace `fn_emitir_nota_remision` (b7) en UNA
 *     transacción, junto con el FIFO y el cargo al libro;
 *   · **no calcula el saldo ni el estado de pago** — los deriva `tr_cxc_estado_pago` (R27);
 *   · **no comprueba el permiso** — el gate vive dentro del RPC (no se puede esquivar).
 */
export async function crearNotaRemisionDirecta(
    input: NotaRemisionInput
): Promise<RespuestaDato<{ id: string; folio: string }>> {
    const parsed = notaRemisionSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
    }
    const d = parsed.data

    const supabase = await createClient()

    // ── El encabezado: la marca y la lista se HEREDAN del cliente (la marca: R2 ya no existe en el
    //    catálogo —la deriva el servidor— · la lista: R32② · R35) ──────
    const { data: cliente, error: errCli } = await supabase
        .from('clientes')
        .select('id, id_marca_comercial, id_lista_precio, dias_credito, id_vendedor_asignado')
        .eq('id', d.id_cliente)
        .maybeSingle()
    if (errCli) return { success: false, error: errCli.message }
    if (!cliente) return { success: false, error: 'El cliente no existe.' }

    // ── ⭐ LA CASCADA, RE-DERIVADA CONTRA LA BD (el navegador NO manda precios base) ──
    const idsProducto = d.partidas.map((p) => p.id_producto)
    const { data: productos, error: errProd } = await supabase
        .from('productos')
        .select('id, precio_base, maneja_numero_serie')
        .in('id', idsProducto)
    if (errProd) return { success: false, error: errProd.message }

    // ⭐ FIX 02 Oct 2026 — EL MISMO DEFECTO QUE EN `resolverPrecioPartida`, y acá es el que MANDA
    //    (estos snapshots son los que viajan al RPC): `productos` **NO tiene FK a `listas_precios`**
    //    (el embed era inválido) y la columna real es **`porcentaje_descuento`**, no `porcentaje_ajuste`.
    //    La lista la trae **EL CLIENTE** (`clientes.id_lista_precio`, la FK que **sí existe**), que es
    //    lo que **R32② · R35** manda congelar al emitir. Se resuelve **UNA vez, fuera del bucle**.
    let porcentajeLista = 0
    /** ⭐ `g12_a4_b1` — la lista puede **subir**: `descuento` baja, `incremento` sube (R33 × R32② · R35). */
    let esIncremento = false
    if (cliente.id_lista_precio) {
        const { data: lista, error: errLista } = await supabase
            .from('listas_precios')
            .select('porcentaje_descuento, tipo_ajuste')
            .eq('id', cliente.id_lista_precio)
            .maybeSingle()
        if (errLista) return { success: false, error: errLista.message }
        porcentajeLista = Number(lista?.porcentaje_descuento ?? 0)
        esIncremento = lista?.tipo_ajuste === 'incremento'
    }

    const porId = new Map((productos ?? []).map((p) => [p.id, p]))

    const partidas: Record<string, unknown>[] = []
    for (const p of d.partidas) {
        const prod = porId.get(p.id_producto)
        if (!prod) return { success: false, error: 'Algún producto de la nota no existe.' }

        const base = new Decimal(prod.precio_base ?? 0)
        // `porcentaje_descuento` es POSITIVO (0.10 = −10%) ⇒ se usa tal cual, y así cumple el CHECK
        // de la partida (`descuento_lista_porcentaje >= 0`).
        const ajuste = new Decimal(porcentajeLista)
        const descLista = ajuste
        const conLista = base.times(
            new Decimal(1).plus(new Decimal(esIncremento ? 1 : -1).times(ajuste))
        )
        // ⚠️ 🔴 LA UNIDAD (fix 05 Oct 2026): la pantalla captura un **% REAL** (5 = 5%), pero la
        //    columna guarda la **FRACCIÓN** (`0.05`), igual que `listas_precios.porcentaje_descuento`
        //    (`0.1200` = 12%) y que `clientes`/`productos`. Antes el valor viajaba tal cual ⇒ un `5`
        //    tecleado se guardaba como 500% y el precio salía NEGATIVO (`100 × (1 − 5) = −400`).
        const adicional = new Decimal(p.descuento_adicional_porcentaje || 0).dividedBy(100)
        /**
         * ⭐ **EL PRECIO LISTA ES LA PRIMERA VERDAD** (M5 · dueño, 05 Oct 2026): *«jala el disco de
         * 100 y mayoreo, saldría 85 como precio de lista, ese precio se puede modificar»*.
         * ⚠️ Si el formulario lo manda (el vendedor lo tocó o no), **manda ese**; si viene vacío
         *    (un cliente viejo del form, una conversión futura) se **deriva** con la lista del
         *    cliente: así la emisión nunca se cae por un campo que la pantalla no mandó.
         */
        const precioListaTecleado = new Decimal(p.precio_lista || 0)
        const precioLista = precioListaTecleado.gt(0) ? precioListaTecleado : conLista
        /**
         * 🔴 EL FIX DEL 05 OCT 2026 — ACÁ SE TIRABA EL PRECIO DEL VENDEDOR.
         *
         * ⚠️ Antes: `final = conLista × (1 − adicional)` **siempre**. El precio que el vendedor
         *    tecleaba se descartaba en silencio ⇒ el campo «no hacía nada»: la nota salía con el
         *    precio de lista. (Medido: el RPC **sí** respeta lo que recibe —`v_precio :=
         *    (v_p->>'precio_unitario_final')`, y el piso se evalúa contra ESE precio—, así que el
         *    defecto era 100% de la SA.)
         *
         * ⭐ Ahora manda el **precio lista** (editado o derivado) y el descuento por partida se
         *    aplica **encima**, sin tocar el precio lista: `final = precio_lista × (1 − adicional)`.
         */
        const derivado = precioLista.times(new Decimal(1).minus(adicional))
        // ⚠️ La cortesía es su propio caso (R10): su precio ES 0 y no se deriva.
        // ⭐ El `precio_unitario_final` es **resultado**, no se teclea: es lo que el RPC multiplica.
        const final = p.es_cortesia ? new Decimal(0) : derivado

        partidas.push({
            id_producto: p.id_producto,
            descripcion_snapshot: p.descripcion_snapshot,
            cantidad: p.cantidad,
            precio_base_snapshot: aMoneda(base),
            descuento_lista_porcentaje: aMoneda(descLista),
            // ⭐ M5 — EL PRECIO LISTA. ⚠️ Hoy el RPC NO lo lee (inserta por lista explícita de
            //    columnas) ⇒ llega a `p_input` pero no se persiste: ver la deuda declarada en
            //    `GUIAS/20/docs/bd-ventas.md` §M5 y BITACORA_BD #10.
            precio_lista: aMoneda(precioLista),
            descuento_adicional_porcentaje: aMoneda(adicional),
            precio_unitario_final: aMoneda(final),
            id_impuesto: p.id_impuesto,
            // ⚠️ FIX 02 Oct 2026 — acá se leía `p.importe_impuesto`, que **NO EXISTE** en
            //    `PartidaRemisionInput` (ni en el schema del formulario): el MVP **no captura
            //    impuestos por renglón**. El RPC lo tolera —`COALESCE(NULLIF(v_p->>'importe_impuesto','')
            //    ::numeric, 0)` ⇒ asienta **0**— así que la línea se retira en vez de inventar un
            //    campo que nadie llena. Si algún día se capturan impuestos, nace el campo en el tipo
            //    **y** en el formulario, no acá.
            // ⭐ R10 — la cortesía es su PROPIO caso: viaja marcada, no disfrazada de descuento
            es_cortesia: p.es_cortesia,
            motivo_cortesia: p.motivo_cortesia,
            // ⭐ R30 — los N NS del renglón, uno por PIEZA
            series: p.series,
        })
    }

    // ⚠️ La cortesía a $0 se fuerza aquí: si el grid la dejó con precio, el piso la bloquearía
    //    (el trigger exime por `es_cortesia`, pero un precio > 0 en una cortesía es un dato sucio).
    for (const p of partidas) {
        if (p.es_cortesia === true) p.precio_unitario_final = 0
    }

    // ── ⭐ EL VENCIMIENTO SE DERIVA (rediseño 05 Oct 2026) ────────────────────
    // ⚠️ Antes lo CAPTURABA el formulario. Ahora lo calcula el servidor — **una sola
    //    definición** de «cuándo vence»: la emisión + el plazo de crédito del CLIENTE
    //    (`clientes.dias_credito`). ⭐ Esa lectura ya estaba en el `select` de arriba y
    //    **no se usaba** (quedó muerta cuando el formulario traía la fecha): ahora manda.
    //    En CONTADO el vencimiento es el mismo día (política del negocio, 05 Oct 2026).
    const diasCredito = d.es_credito ? (cliente.dias_credito ?? 0) : 0
    const fechaVencimiento = sumarDias(d.fecha_emision, diasCredito)

    // ── ⭐ EL DESCUENTO DEL DOCUMENTO (3er nivel · 05 Oct 2026) ──────────────
    // ⚠️ La pantalla lo captura en **%**; la columna guarda un **MONTO**. La conversión se hace
    //    **contra el subtotal que esta misma SA manda** (`v_subtotal` del RPC = Σ cantidad ×
    //    precio_unitario_final) ⇒ **una sola definición del subtotal**, no dos que puedan diferir.
    //    ⚠️ El RPC calcula `v_total := v_subtotal − v_descuento_glob + impuestos`, así que el
    //    monto tiene que venir sobre ESE subtotal o el total no cierra.
    const pctDocumento = new Decimal(d.descuento_global_porcentaje || 0)
    const subtotalEnviado = partidas.reduce(
        (acc, p) =>
            acc.plus(
                new Decimal(String(p.cantidad ?? 0)).times(
                    new Decimal(String(p.precio_unitario_final ?? 0))
                )
            ),
        new Decimal(0)
    )
    const descuentoGlobal = aMoneda(subtotalEnviado.times(pctDocumento))

    // ── ⭐ EL RPC: LA TRANSACCIÓN (b7) ────────────────────────────────────────
    const { data, error } = await supabase.rpc('fn_emitir_nota_remision', {
        p_input: {
            id_cliente: d.id_cliente,
            es_credito: d.es_credito,
            fecha_emision: d.fecha_emision,
            // ⭐ DERIVADO, nunca del formulario (la columna es NOT NULL sin default).
            fecha_vencimiento: fechaVencimiento,
            id_vendedor: d.id_vendedor || cliente.id_vendedor_asignado || null,
            id_metodo_envio: d.id_metodo_envio || null,
            id_lista_precio: cliente.id_lista_precio,
            // ⭐ El 3er nivel: el descuento del DOCUMENTO, ya convertido a monto.
            descuento_global: descuentoGlobal,
            notas: d.notas,
            partidas,
            // ⭐ FIX 02 Oct 2026 — EL ACTO DE AUTORIZAR VIAJA. Antes **no se mandaba**: el modal lo
            //    capturaba, la SA lo descartaba y `p_input.autorizacion` llegaba vacío ⇒ la salida
            //    de emergencia del piso (`precio_bajo_minimo AND autorizado_por IS NOT NULL`) era
            //    **inalcanzable desde la pantalla**. El RPC lee `->>'autorizado_por'` y `->>'motivo'`.
            // ⚠️ **DECISIÓN ABIERTA (PLAN §6.2 · el cierre de `logica-negocio.md`)**: el RPC espera
            //    `autorizado_por` como **uuid** y esta pantalla captura **credenciales**
            //    (`usuario` + `contrasena`). Resolver esa identidad exige **verificar la credencial**
            //    (`signInWithPassword` sobre otro usuario **reemplaza la sesión del vendedor**), y eso
            //    **no se inventa acá**: el `motivo` sí llega; `autorizado_por` queda pendiente.
            //    Ver `DOCS/CONEXIONES_PENDIENTES.md` ⑫.
            autorizacion: d.autorizacion ?? null,
        },
    })

    if (error) return { success: false, error: traducirErrorEmision(error.code, error.message) }

    const res = data as { id: string; folio: string } | null
    if (!res?.id) return { success: false, error: 'La emisión no devolvió la nota creada.' }

    return { success: true, data: { id: res.id, folio: res.folio } }
}
// ═══════════════════════════════════════════════════════════════════════════════
// SERVER ACTIONS — VENTAS · LA FICHA Y EL ESTADO DE CUENTA (Guía 1.8 · Parte 4)
// Se AÑADE al archivo de las Partes 2–3.
//
//   · obtenerNotaRemision            — el expediente (encabezado + partidas + series + embudo)
//   · editarNotaRemision             — SOLO los 3 campos del mapa D-21
//   · consultarEstadoCuentaCliente   — ⭐ los asientos del LIBRO + saldo + vencido (R1)
//   · listarConceptosCxC             — el catálogo activo (R31)
//
// ⚠️ NINGUNA escribe saldos: `saldo_pendiente`/`id_estado_pago` los deriva
//    `tr_cxc_estado_pago` (R27) y `clientes.saldo_actual` lo deriva `tr_cxc_saldo_cliente`.
//    Estas SA LEEN lo que el libro ya dijo.
// ═══════════════════════════════════════════════════════════════════════════════

// ⚠️ ESTE FRAGMENTO SE **ANEXA** (`Add-Content`) ⇒ trae **SUS PROPIOS imports**. Los que ya puso
//    otra parte del archivo NO se repiten: `createClient` está en la Parte 2; `RespuestaDato` y
//    `notaRemisionSchema`, en la 3. ⚠️ `noUnusedLocals` está activo ⇒ **no adelantes imports de
//    las Partes siguientes**: un import sin uso rompe `tsc` (TS6133).
import { editarNotaRemisionSchema } from '@/lib/validations/ventas'
import type {
    ConceptoCxC,
    EstadoCuentaCliente,
    NotaRemisionDetalle,
    NotaRemisionEdicion,
    RespuestaAccion,
} from '@/types/ventas'

// ── El expediente: encabezado + partidas (con sus N series) + el embudo del libro ──
export async function obtenerNotaRemision(
    id: string
): Promise<RespuestaDato<NotaRemisionDetalle>> {
    const supabase = await createClient()

    const { data: nota, error: errNota } = await supabase
        .from('notas_remision')
        .select(COLUMNAS_NOTAS)
        .eq('id', id)
        .maybeSingle()
    if (errNota) return { success: false, error: errNota.message }
    if (!nota) return { success: false, error: 'La nota no existe.' }

    const { data: partidas, error: errPart } = await supabase
        .from('partidas_remision')
        .select('*, series_partida(ns)')
        .eq('id_nota', id)
        .order('orden', { ascending: true })
    if (errPart) return { success: false, error: errPart.message }

    // El embudo del libro: Σ cargos · Σ abonos · cuántos asientos (R1).
    // ⚠️ Se suman los ASIENTOS, no los saldos: el saldo lo dice `saldo_pendiente`.
    const { data: movs, error: errMov } = await supabase
        .from('movimientos_cxc')
        .select('naturaleza, monto')
        .eq('id_nota_remision', id)
    if (errMov) return { success: false, error: errMov.message }

    const filas = (movs ?? []) as { naturaleza: 'cargo' | 'abono'; monto: number }[]
    const totalCargos = filas
        .filter((m) => m.naturaleza === 'cargo')
        .reduce((s, m) => s + Number(m.monto), 0)
    const totalAbonos = filas
        .filter((m) => m.naturaleza === 'abono')
        .reduce((s, m) => s + Number(m.monto), 0)

    return {
        success: true,
        data: {
            ...aFilaNota(nota as unknown as FilaNotaCruda),
            partidas: ((partidas ?? []) as unknown as FilaPartidaCruda[]).map(aFilaPartida),
            total_cargos: totalCargos,
            total_abonos: totalAbonos,
            movimientos: filas.length,
        },
    }
}

// ── ⚠️ EDITAR: SOLO los 3 campos del mapa D-21 ────────────────────────────────
/**
 * ⚠️ **Las partidas NO se editan NUNCA** (mapa D-21): la mercancía ya salió del almacén y el cargo ya
 * está en el libro. Corregir un renglón es **cancelar y rehacer** (Parte 5), que deja rastro.
 * ⚠️ Una nota **cancelada no se edita**: su expediente está cerrado.
 */
export async function editarNotaRemision(
    id: string,
    input: NotaRemisionEdicion
): Promise<RespuestaAccion> {
    const parsed = editarNotaRemisionSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
    }
    const d = parsed.data

    const supabase = await createClient()

    const { data: actual, error: errLeer } = await supabase
        .from('notas_remision')
        .select('id, es_cancelada, fecha_emision, folio')
        .eq('id', id)
        .maybeSingle()
    if (errLeer) return { success: false, error: errLeer.message }
    if (!actual) return { success: false, error: 'La nota no existe.' }
    if (actual.es_cancelada) {
        return { success: false, error: `La nota ${actual.folio} está cancelada: no se puede editar.` }
    }
    if (d.fecha_vencimiento < actual.fecha_emision) {
        return { success: false, error: 'El vencimiento no puede ser anterior a la emisión.' }
    }

    const { error } = await supabase
        .from('notas_remision')
        .update({
            // ⭐ LOS TRES, y nada más:
            fecha_vencimiento: d.fecha_vencimiento,
            id_metodo_envio: d.id_metodo_envio || null,
            notas: d.notas || null,
            actualizado_por: (await supabase.auth.getUser()).data.user?.id ?? null,
        })
        .eq('id', id)

    if (error) return { success: false, error: error.message }
    return { success: true }
}

// ── ⭐ EL ESTADO DE CUENTA DEL CLIENTE (R1 · lo consumirá 1.9 tal cual) ───────
/**
 * ⭐ Los asientos del **libro**, paginados, con el saldo vigente y lo **vencido a hoy**.
 * La misma fuente que usará la tableta del cobrador (1.9): **una sola definición de «cuánto debe»**.
 * ⚠️ `saldo_actual` y `saldo_vencido` se LEEN; no se recalculan aquí (R27).
 */
export async function consultarEstadoCuentaCliente(
    id_cliente: string,
    pagina = 1,
    tamano = 50
): Promise<RespuestaDato<EstadoCuentaCliente>> {
    const supabase = await createClient()

    const { data: cliente, error: errCli } = await supabase
        .from('clientes')
        .select('id, codigo, nombre_comercial, saldo_actual')
        .eq('id', id_cliente)
        .maybeSingle()
    if (errCli) return { success: false, error: errCli.message }
    if (!cliente) return { success: false, error: 'El cliente no existe.' }

    // ⚠️ «VENCIDO» es una FECHA contra hoy, no un estado guardado: un campo `es_vencida` habría que
    //    refrescarlo a diario o mentiría el día que nadie corriera el job.
    const hoy = new Date().toISOString().slice(0, 10)
    const { data: vencidas, error: errVenc } = await supabase
        .from('notas_remision')
        .select('saldo_pendiente')
        .eq('id_cliente', id_cliente)
        .eq('es_cancelada', false)
        .gt('saldo_pendiente', 0)
        .lt('fecha_vencimiento', hoy)
    if (errVenc) return { success: false, error: errVenc.message }

    const saldoVencido = ((vencidas ?? []) as { saldo_pendiente: number }[]).reduce(
        (s, n) => s + Number(n.saldo_pendiente),
        0
    )

    const desde = (pagina - 1) * tamano
    const { data: movs, error: errMov, count } = await supabase
        .from('movimientos_cxc')
        .select(
            'id, folio, naturaleza, monto, saldo_anterior, saldo_resultante, motivo, created_at,' +
                'id_nota_remision, id_cobro,' +
                'conceptos_cxc(clave,nombre), notas_remision(folio)',
            { count: 'exact' }
        )
        .eq('id_cliente', id_cliente)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(desde, desde + tamano - 1)
    if (errMov) return { success: false, error: errMov.message }

    interface FilaMovCruda {
        id: string
        folio: string
        id_cliente: string
        id_marca_comercial: string
        id_concepto: string
        naturaleza: 'cargo' | 'abono'
        monto: number
        id_nota_remision: string | null
        id_cobro: string | null
        saldo_anterior: number
        saldo_resultante: number
        motivo: string | null
        creado_por: string | null
        created_at: string
        conceptos_cxc: { clave: string; nombre: string } | null
        notas_remision: { folio: string } | null
    }

    const movimientos = ((movs ?? []) as unknown as FilaMovCruda[]).map((m) => ({
        ...m,
        concepto_clave: m.conceptos_cxc?.clave ?? null,
        concepto_nombre: m.conceptos_cxc?.nombre ?? null,
        nota_folio: m.notas_remision?.folio ?? null,
    }))

    return {
        success: true,
        data: {
            id_cliente,
            cliente_codigo: cliente.codigo ?? null,
            cliente_nombre: cliente.nombre_comercial ?? null,
            saldo_actual: Number(cliente.saldo_actual ?? 0),
            saldo_vencido: saldoVencido,
            movimientos,
            total_movimientos: count ?? movimientos.length,
        },
    }
}

// ── El catálogo de conceptos (R31) ────────────────────────────────────────────
export async function listarConceptosCxC(): Promise<RespuestaLista<ConceptoCxC>> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('conceptos_cxc')
        .select('*')
        .eq('es_activo', true)
        .order('orden', { ascending: true })
    if (error) return { success: false, error: error.message }
    return { success: true, data: (data ?? []) as unknown as ConceptoCxC[] }
}
// ═══════════════════════════════════════════════════════════════════════════════
// SERVER ACTIONS — VENTAS · LA CANCELACIÓN (Guía 1.8 · Parte 5)
// Se AÑADE al archivo de las Partes 2–4.
//
// ⭐ DESHACER ES ESCRIBIR, NO BORRAR: la nota SE QUEDA (con su folio, sus partidas
//    y su motivo) y el sistema escribe el REVERSO de sus tres efectos. El rastro es
//    el producto.
// ⚠️ Toda la escritura vive en `fn_cancelar_nota_remision` (b8): UNA transacción.
//    Esta SA solo valida la forma, delega y traduce el error.
// ⚠️ LA SA NO DECIDE SI SE PUEDE: lo decide `tr_validar_cancelacion_nota` (B4.4)
//    DENTRO de la transacción, con el `FOR UPDATE` de b8 puesto — que es el único
//    lugar donde la respuesta es cierta (entre la consulta y el UPDATE puede entrar
//    un cobro). Preguntarlo aquí sería una falsa sensación de seguridad.
// ═══════════════════════════════════════════════════════════════════════════════

// ⚠️ ESTE FRAGMENTO SE **ANEXA** (`Add-Content`) ⇒ trae **SUS PROPIOS imports**. Los que ya puso
//    otra parte del archivo NO se repiten: `createClient` está en la Parte 2; `RespuestaDato` y
//    `traducirErrorEmision`, en la 3. ⚠️ `noUnusedLocals` está activo ⇒ **no adelantes imports
//    de las Partes siguientes**: un import sin uso rompe `tsc` (TS6133).
// ⚠️ FIX 02 Oct 2026 — `RespuestaAccion` **NO se repite acá**: el fragmento de la Parte 4 (que va
//    ANTES en el mismo archivo) ya lo importa, y dos `import type { RespuestaAccion }` del mismo
//    módulo dan **TS2300 (Duplicate identifier)**. Este fragmento trae solo lo SUYO, y también el
//    tipo del formulario de cancelación, que antes no importaba nadie (TS2304).
import { cancelarNotaRemisionSchema, type CancelarNotaRemisionForm } from '@/lib/validations/ventas'

/**
 * ⭐ CANCELA una nota de remisión. **Total, irreversible y con motivo** (mapa D-15).
 *
 * ⚠️ Lo que el RPC hace en UNA transacción (y por tanto lo que esta SA **no** repite):
 *   ① marca el documento (y **`tr_validar_cancelacion_nota` bloquea si hay cobros**) ·
 *   ② **devuelve el inventario** (una entrada inversa por cada salida, y el lote recupera) ·
 *   ③ **asienta el ABONO** por el saldo pendiente ·
 *   ④ ⭐ **libera los NS sin tocarlos** (la comprobación de «ya vendido» de b7 excluye las canceladas).
 */
export async function cancelarNotaRemision(
    id: string,
    input: CancelarNotaRemisionForm
): Promise<RespuestaAccion> {
    const parsed = cancelarNotaRemisionSchema.safeParse({ ...input, id })
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
    }

    const supabase = await createClient()

    const { error } = await supabase.rpc('fn_cancelar_nota_remision', {
        p_id_nota: id,
        p_motivo: parsed.data.motivo_cancelacion,
    })

    if (error) return { success: false, error: traducirErrorEmision(error.code, error.message) }
    return { success: true }
}

// ── ⭐ PARTE 6 · BLOQUE 1 — LA CONSULTA INVERSA (pestaña Ventas de la ficha del PRODUCTO) ──
// ⚠️ Este fragmento se **ANEXA** ⇒ trae **SUS PROPIOS imports**; los que ya están arriba
//    (`createClient`, `RespuestaLista`) **NO se repiten** (duplicarlos da TS2300).
import type { PartidaVendidaListado } from '@/types/ventas'

/**
 * ⚠️ La forma CRUDA de PostgREST: acá el embed viene **ANIDADO** (`notas_remision.clientes`).
 * El tipo de dominio (`PartidaVendidaListado`) lo quiere **APLANADO** ⇒ lo traduce
 * `aPartidaVendida`, igual que `aFilaNota` traduce el listado.
 * 🔴 MEDIDO (sesión de cierre, 04 Oct 2026): sin este paso la SA **compilaba y devolvía
 *    `nota_folio: undefined`** en cada fila — `tsc` y `eslint` no lo ven (el cast lo tapaba)
 *    y la pestaña del producto habría pintado **columnas vacías**.
 */
interface FilaPartidaVendidaCruda {
    id: string
    orden: number
    cantidad: number
    precio_unitario_final: number
    total: number
    descripcion_snapshot: string
    es_cortesia: boolean
    notas_remision: {
        folio: string
        fecha_emision: string
        es_cancelada: boolean
        clientes: { codigo: string; nombre_comercial: string } | null
    } | null
}

/** Aplana el embed (el idioma de la casa: `cliente_codigo`, no un objeto anidado). */
function aPartidaVendida(p: FilaPartidaVendidaCruda): PartidaVendidaListado {
    return {
        id: p.id,
        orden: p.orden,
        cantidad: p.cantidad,
        precio_unitario_final: p.precio_unitario_final,
        total: p.total,
        descripcion_snapshot: p.descripcion_snapshot,
        es_cortesia: p.es_cortesia,
        nota_folio: p.notas_remision?.folio ?? null,
        nota_fecha: p.notas_remision?.fecha_emision ?? null,
        cliente_codigo: p.notas_remision?.clientes?.codigo ?? null,
        cliente_nombre: p.notas_remision?.clientes?.nombre_comercial ?? null,
    }
}

/**
 * ⭐ DÓNDE SE FUE ESTE SKU — las partidas vendidas de un producto (pestaña Ventas de la ficha).
 * ⚠️ Es la consulta INVERSA del listado: el listado va nota → renglones; ésta va producto → notas.
 *    Por eso no se resuelve con `listarNotasRemision` (los renglones no viajan en el listado).
 * ⚠️ Excluye las notas CANCELADAS: una pieza que volvió al almacén no «se fue».
 */
export async function listarPartidasDeProducto(
    id_producto: string,
    pagina = 1,
    tamano = 50
): Promise<RespuestaLista<PartidaVendidaListado>> {
    const supabase = await createClient()

    const desde = (pagina - 1) * tamano
    const { data, error, count } = await supabase
        .from('partidas_remision')
        .select(
            'id, orden, cantidad, precio_unitario_final, total, descripcion_snapshot, es_cortesia,' +
                'notas_remision!inner(folio, fecha_emision, es_cancelada, clientes(codigo,nombre_comercial))',
            { count: 'exact' }
        )
        .eq('id_producto', id_producto)
        // ⚠️ `!inner` + el filtro: solo las notas VIGENTES
        .eq('notas_remision.es_cancelada', false)
        .order('fecha_emision', { referencedTable: 'notas_remision', ascending: false })
        .range(desde, desde + tamano - 1)

    if (error) return { success: false, error: error.message }
    const filas = ((data ?? []) as unknown as FilaPartidaVendidaCruda[]).map(aPartidaVendida)
    return { success: true, data: filas, total: count ?? 0 }
}
