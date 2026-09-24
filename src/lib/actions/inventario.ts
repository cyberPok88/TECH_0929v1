// ═══════════════════════════════════════════════════════════════════════════════
// SERVER ACTIONS — INVENTARIO (Guía 1.5 · 17 Sep 2026)
// 'use server': obligatorio · retornan objetos tipados — NUNCA throw.
//   listarExistencias (paginación servidor) · listarCategoriasYMarcas ·
//   listarUbicacionesActivas · [Parte 3: kardex/lotes] · [Parte 4: salida] ·
//   [Parte 5: conteo físico]
// El libro es append-only: la UI nunca inserta directo — toda escritura pasa por
// SA con gate de rol (movimientos/lotes: solo INSERT con permiso 'editar').
// ═══════════════════════════════════════════════════════════════════════════════

'use server'

import { createClient } from '@/lib/supabase/server'
import { conteoSchema, salidaManualSchema } from '@/lib/validations/inventario'
import type { ConteoInput, SalidaManualInput } from '@/lib/validations/inventario'
import type { FiltrosExistencias } from '@/types/inventario'
import type {
    ConteoInventario,
    ConteoInventarioDetalle,
    ExistenciaProducto,
    FiltrosConteos,
    LoteInventario,
    MovimientoInventario,
    RespuestaAccion,
    RespuestaDato,
    RespuestaLista,
} from '@/types/inventario'

// ── Forma cruda del embed PostgREST (embeds aplanados por aFila) ───────────────
interface FilaExistenciaCruda {
    id: string
    sku: string
    nombre: string
    id_categoria: string | null
    categorias_producto: { nombre: string } | null
    id_marca: string | null
    marcas_producto: { nombre: string } | null
    stock_actual: number
    stock_minimo: number
    id_ubicacion_default: string | null
    ubicaciones_almacen: { rack: string; nivel: string; organizador: string; charola: string } | null
    maneja_numero_serie: boolean
    lotes_abiertos: { id: string }[] | null
}

function estadoExistencia(stock: number, minimo: number): 'ok' | 'bajo_minimo' | 'sin_stock' {
    if (stock <= 0) return 'sin_stock'
    if (stock < minimo) return 'bajo_minimo'
    return 'ok'
}

function aFila(f: FilaExistenciaCruda): ExistenciaProducto {
    const u = f.ubicaciones_almacen
    return {
        id_producto: f.id,
        sku: f.sku,
        nombre: f.nombre,
        id_categoria: f.id_categoria,
        categoria_nombre: f.categorias_producto?.nombre ?? null,
        id_marca: f.id_marca,
        marca_nombre: f.marcas_producto?.nombre ?? null,
        stock_actual: f.stock_actual,
        stock_minimo: f.stock_minimo,
        id_ubicacion_default: f.id_ubicacion_default,
        ubicacion_nombre: u
            ? `${u.rack}·${u.nivel}·${u.organizador}·${u.charola}`
            : null,
        maneja_numero_serie: f.maneja_numero_serie,
        estado_existencia: estadoExistencia(f.stock_actual, f.stock_minimo),
        total_lotes: f.lotes_abiertos?.length ?? 0,
    }
}

/** Opciones para los filtros (catálogos 1.0/1.2 — lectura). */
export async function listarCategoriasYMarcas(): Promise<
    RespuestaDato<{ categorias: { id: string; nombre: string }[]; marcas: { id: string; nombre: string }[] }>
> {
    const supabase = await createClient()
    const [cat, marcas] = await Promise.all([
        supabase
            .from('categorias_producto')
            .select('id, nombre')
            .eq('es_activo', true)
            .order('nombre', { ascending: true }),
        supabase
            .from('marcas_producto')
            .select('id, nombre')
            .eq('es_activo', true)
            .order('nombre', { ascending: true }),
    ])
    if (cat.error) return { success: false, error: cat.error.message }
    if (marcas.error) return { success: false, error: marcas.error.message }
    return {
        success: true,
        data: {
            categorias: (cat.data ?? []).map((c) => ({ id: c.id, nombre: c.nombre })),
            marcas: (marcas.data ?? []).map((m) => ({ id: m.id, nombre: m.nombre })),
        },
    }
}

/** Ubicaciones activas (selector del conteo físico · Parte 5). */
export async function listarUbicacionesActivas(): Promise<
    RespuestaLista<{ id: string; nombre: string }>
> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('ubicaciones_almacen')
        .select('id, rack, nivel, organizador, charola')
        .eq('es_activo', true)
        .order('rack', { ascending: true })
    if (error) return { success: false, error: error.message }
    return {
        success: true,
        data: (data ?? []).map((u) => ({
            id: (u as { id: string }).id,
            nombre: `${(u as { rack: string }).rack}·${(u as { nivel: string }).nivel}·${(u as { organizador: string }).organizador}·${(u as { charola: string }).charola}`,
        })),
    }
}

export async function listarExistencias(
    filtros: FiltrosExistencias,
    pagina: number,
    tamano: number
): Promise<RespuestaLista<ExistenciaProducto>> {
    const supabase = await createClient()

    const desde = (pagina - 1) * tamano
    let query = supabase
        .from('productos')
        .select(
            `id, sku, nombre, id_categoria, id_marca, stock_actual, stock_minimo,
             id_ubicacion_default, maneja_numero_serie,
             categorias_producto (nombre),
             marcas_producto (nombre),
             ubicaciones_almacen (rack, nivel, organizador, charola),
             lotes ( id ) filter: (cantidad_disponible > 0)`,
            { count: 'exact' }
        )
        .eq('es_archivado', false)
        .eq('es_activo', true)
        .range(desde, desde + tamano - 1)
        .order('nombre', { ascending: true })

    const termino = filtros.busqueda.trim().replace(/[%_]/g, '')
    if (termino) {
        query = query.or(`nombre.ilike.%${termino}%,sku.ilike.%${termino}%`)
    }
    if (filtros.id_categoria) {
        const { data: hijos } = await supabase
            .from('categorias_producto')
            .select('id')
            .eq('id_categoria_padre', filtros.id_categoria)
        const ids = [filtros.id_categoria, ...(hijos ?? []).map((h) => h.id)]
        query = query.in('id_categoria', ids)
    }
    if (filtros.id_marca) query = query.eq('id_marca', filtros.id_marca)

    const { data, error, count } = await query
    if (error) return { success: false, error: error.message }

    let filas = (data ?? []) as unknown as FilaExistenciaCruda[]
    if (filtros.estado) {
        filas = filas.filter((f) => estadoExistencia(f.stock_actual, f.stock_minimo) === filtros.estado)
    }

    return {
        success: true,
        data: filas.map(aFila),
        total: count ?? filas.length,
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// KARDEX + LOTES (Parte 3) — solo lectura · el libro es append-only
// ═══════════════════════════════════════════════════════════════════════════════

interface FilaMovimientoCruda {
    id: string
    id_producto: string
    id_lote: string | null
    tipo_movimiento: string
    cantidad: number
    stock_anterior: number
    stock_resultante: number
    costo_unitario: number | null
    origen_tabla: string | null
    origen_id: string | null
    numero_serie: string | null
    motivo: string | null
    created_at: string
    creado_por: string | null
    creadores: { nombre_completo: string } | null
    productos: { nombre: string; sku: string } | null
}

function aMovimiento(f: FilaMovimientoCruda): MovimientoInventario {
    return {
        id: f.id,
        id_producto: f.id_producto,
        producto_nombre: f.productos?.nombre ?? null,
        producto_sku: f.productos?.sku ?? null,
        id_lote: f.id_lote,
        tipo_movimiento: f.tipo_movimiento as MovimientoInventario['tipo_movimiento'],
        cantidad: f.cantidad,
        stock_anterior: f.stock_anterior,
        stock_resultante: f.stock_resultante,
        costo_unitario: f.costo_unitario,
        origen_tabla: (f.origen_tabla ?? null) as MovimientoInventario['origen_tabla'],
        origen_id: f.origen_id,
        numero_serie: f.numero_serie,
        motivo: f.motivo,
        created_at: f.created_at,
        creado_por: f.creado_por,
        creador_nombre: f.creadores?.nombre_completo ?? null,
    }
}

export async function listarMovimientosPorProducto(
    idProducto: string,
    pagina = 1,
    tamano = 25
): Promise<RespuestaLista<MovimientoInventario>> {
    const supabase = await createClient()
    const desde = (pagina - 1) * tamano
    const { data, error, count } = await supabase
        .from('movimientos_inventario')
        .select(
            `id, id_producto, id_lote, tipo_movimiento, cantidad, stock_anterior,
             stock_resultante, costo_unitario, origen_tabla, origen_id, numero_serie,
             motivo, created_at, creado_por,
             creadores ( nombre_completo ),
             productos ( nombre, sku )`,
            { count: 'exact' }
        )
        .eq('id_producto', idProducto)
        .order('created_at', { ascending: false })
        .range(desde, desde + tamano - 1)
    if (error) return { success: false, error: error.message }
    return {
        success: true,
        data: ((data ?? []) as unknown as FilaMovimientoCruda[]).map(aMovimiento),
        total: count ?? 0,
    }
}

interface FilaLoteCruda {
    id: string
    id_producto: string
    cantidad_original: number
    cantidad_disponible: number
    costo_unitario: number | null
    fecha_entrada: string
    origen_tabla: string
    origen_id: string | null
    id_ubicacion: string | null
    notas: string | null
    creado_por: string | null
    created_at: string
    productos: { nombre: string; sku: string } | null
    ubicaciones_almacen: { rack: string; nivel: string; organizador: string; charola: string } | null
}

function aLote(f: FilaLoteCruda): LoteInventario {
    const u = f.ubicaciones_almacen
    return {
        id: f.id,
        id_producto: f.id_producto,
        producto_nombre: f.productos?.nombre ?? null,
        producto_sku: f.productos?.sku ?? null,
        cantidad_original: f.cantidad_original,
        cantidad_disponible: f.cantidad_disponible,
        costo_unitario: f.costo_unitario,
        fecha_entrada: f.fecha_entrada,
        origen_tabla: f.origen_tabla,
        origen_id: f.origen_id,
        id_ubicacion: f.id_ubicacion,
        ubicacion_nombre: u ? `${u.rack}·${u.nivel}·${u.organizador}·${u.charola}` : null,
        notas: f.notas,
        creado_por: f.creado_por,
        created_at: f.created_at,
    }
}

export async function listarLotesPorProducto(
    idProducto: string
): Promise<RespuestaLista<LoteInventario>> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('lotes')
        .select(
            `id, id_producto, cantidad_original, cantidad_disponible, costo_unitario,
             fecha_entrada, origen_tabla, origen_id, id_ubicacion, notas, creado_por,
             created_at,
             productos ( nombre, sku ),
             ubicaciones_almacen ( rack, nivel, organizador, charola )`
        )
        .eq('id_producto', idProducto)
        .order('created_at', { ascending: true })
    if (error) return { success: false, error: error.message }
    return {
        success: true,
        data: ((data ?? []) as unknown as FilaLoteCruda[]).map(aLote),
    }
}

export async function obtenerMovimiento(id: string): Promise<RespuestaDato<MovimientoInventario>> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('movimientos_inventario')
        .select(
            `id, id_producto, id_lote, tipo_movimiento, cantidad, stock_anterior,
             stock_resultante, costo_unitario, origen_tabla, origen_id, numero_serie,
             motivo, created_at, creado_por,
             creadores ( nombre_completo ),
             productos ( nombre, sku )`
        )
        .eq('id', id)
        .single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: aMovimiento(data as unknown as FilaMovimientoCruda) }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRAR SALIDA MANUAL (Parte 4 · 17 Sep 2026)
// ═══════════════════════════════════════════════════════════════════════════════

interface LoteConsumible {
    id: string
    cantidad_disponible: number
}

/** Regla de negocio FIFO: descuenta la cantidad consumiendo el lote más viejo primero.
 *  Devuelve ok/error. No escribe el movimiento — solo actualiza lotes. */
async function consumirLotesFifo(
    supabase: Awaited<ReturnType<typeof createClient>>,
    idProducto: string,
    cantidad: number
): Promise<{ ok: boolean; error?: string }> {
    const { data, error } = await supabase
        .from('lotes')
        .select('id, cantidad_disponible')
        .eq('id_producto', idProducto)
        .gt('cantidad_disponible', 0)
        .order('created_at', { ascending: true })
    if (error) return { ok: false, error: error.message }

    const lotes = (data ?? []) as unknown as LoteConsumible[]
    const disponible = lotes.reduce((acc, l) => acc + Number(l.cantidad_disponible), 0)
    if (disponible < cantidad) {
        return { ok: false, error: `Stock insuficiente: hay ${disponible} disponible(s) y pides ${cantidad}.` }
    }

    let restante = cantidad
    for (const lote of lotes) {
        if (restante <= 0) break
        const tomar = Math.min(Number(lote.cantidad_disponible), restante)
        const { error: errUpd } = await supabase
            .from('lotes')
            .update({ cantidad_disponible: Number(lote.cantidad_disponible) - tomar })
            .eq('id', lote.id)
        if (errUpd) return { ok: false, error: errUpd.message }
        restante -= tomar
    }
    return { ok: true }
}

export async function registrarSalidaManual(input: SalidaManualInput): Promise<RespuestaAccion> {
    const parsed = salidaManualSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
    }
    const { id_producto, cantidad, motivo, numero_serie, notas } = parsed.data

    const supabase = await createClient()
    const { data: producto, error: errProd } = await supabase
        .from('productos')
        .select('id, stock_actual, maneja_numero_serie')
        .eq('id', id_producto)
        .single()
    if (errProd) return { success: false, error: errProd.message }

    const manejaSerie = (producto as { maneja_numero_serie: boolean }).maneja_numero_serie
    if (manejaSerie && numero_serie.trim() === '') {
        return { success: false, error: 'Este producto maneja número de serie — indica el NS que sale.' }
    }

    const n = Number(cantidad)
    const stockActual = Number((producto as { stock_actual: number }).stock_actual)
    if (n > stockActual) {
        return { success: false, error: `Stock insuficiente: hay ${stockActual} y pides ${n}.` }
    }

    // Consumo FIFO (la SA es el único escritor manual del libro/lotes).
    const fifo = await consumirLotesFifo(supabase, id_producto, n)
    if (!fifo.ok) return { success: false, error: fifo.error }

    const stockAnterior = stockActual
    const stockResultante = stockActual - n
    const { error: errMov } = await supabase.from('movimientos_inventario').insert({
        id_producto,
        id_lote: null,
        tipo_movimiento: 'salida',
        cantidad: -n,
        stock_anterior: stockAnterior,
        stock_resultante: stockResultante,
        origen_tabla: 'ajuste_manual',
        origen_id: null,
        numero_serie: numero_serie.trim() === '' ? null : numero_serie.trim(),
        // El libro no tiene columna `notas`: el texto libre se concatena al motivo.
        motivo: notas.trim() === '' ? motivo : `${motivo} — ${notas.trim()}`,
    })
    if (errMov) return { success: false, error: errMov.message }

    return { success: true }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEO DE INVENTARIO FÍSICO (Parte 5 · 17 Sep 2026)
// ═══════════════════════════════════════════════════════════════════════════════

interface FilaConteoCruda {
    id: string
    fecha_conteo: string
    id_ubicacion: string
    estado: string
    notas: string | null
    creado_por: string | null
    created_at: string
    creadores: { nombre_completo: string } | null
    ubicaciones_almacen: { rack: string; nivel: string; organizador: string; charola: string } | null
    renglones_count: unknown[] | null
}

function aConteo(f: FilaConteoCruda): ConteoInventario {
    const u = f.ubicaciones_almacen
    const conteoRenglones = (f.renglones_count ?? []) as unknown as { count: number }[]
    return {
        id: f.id,
        fecha_conteo: f.fecha_conteo,
        id_ubicacion: f.id_ubicacion,
        ubicacion_nombre: u ? `${u.rack}·${u.nivel}·${u.organizador}·${u.charola}` : null,
        estado: f.estado as ConteoInventario['estado'],
        notas: f.notas,
        creado_por: f.creado_por,
        creador_nombre: f.creadores?.nombre_completo ?? null,
        created_at: f.created_at,
        total_renglones: conteoRenglones[0]?.count ?? 0,
    }
}

export async function listarConteos(
    filtros: FiltrosConteos,
    pagina = 1,
    tamano = 25
): Promise<RespuestaLista<ConteoInventario>> {
    const supabase = await createClient()
    const desde = (pagina - 1) * tamano

    let query = supabase
        .from('conteos_inventario')
        .select(
            `id, fecha_conteo, id_ubicacion, estado, notas, creado_por, created_at,
             creadores ( nombre_completo ),
             ubicaciones_almacen ( rack, nivel, organizador, charola ),
             renglones_conteo ( count )`,
            { count: 'exact' }
        )
        .order('fecha_conteo', { ascending: false })
        .order('created_at', { ascending: false })
        .range(desde, desde + tamano - 1)

    if (filtros.estado) query = query.eq('estado', filtros.estado)
    if (filtros.fecha_desde) query = query.gte('fecha_conteo', filtros.fecha_desde)
    if (filtros.fecha_hasta) query = query.lte('fecha_conteo', filtros.fecha_hasta)

    const { data, error, count } = await query
    if (error) return { success: false, error: error.message }
    return {
        success: true,
        data: ((data ?? []) as unknown as FilaConteoCruda[]).map(aConteo),
        total: count ?? 0,
    }
}

interface FilaRenglonCruda {
    id: string
    id_conteo: string
    id_producto: string
    cantidad_contada: number
    productos: { nombre: string; sku: string } | null
}

export async function obtenerConteo(id: string): Promise<RespuestaDato<ConteoInventarioDetalle>> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('conteos_inventario')
        .select(
            `id, fecha_conteo, id_ubicacion, estado, notas, creado_por, created_at,
             creadores ( nombre_completo ),
             ubicaciones_almacen ( rack, nivel, organizador, charola )`
        )
        .eq('id', id)
        .single()
    if (error) return { success: false, error: error.message }

    const { data: renglones, error: errR } = await supabase
        .from('renglones_conteo')
        .select(`id, id_conteo, id_producto, cantidad_contada, productos ( nombre, sku )`)
        .eq('id_conteo', id)
    if (errR) return { success: false, error: errR.message }

    const filas = (renglones ?? []) as unknown as FilaRenglonCruda[]
    // Stock del sistema ACTUAL por producto (para la diferencia en el detalle).
    const ids = filas.map((f) => f.id_producto)
    const stocks = await listarStocksProductos(ids)

    const conteo = aConteo({ ...(data as unknown as FilaConteoCruda), renglones_count: [] })
    return {
        success: true,
        data: {
            ...conteo,
            renglones: filas.map((f) => ({
                id: f.id,
                id_conteo: f.id_conteo,
                id_producto: f.id_producto,
                producto_nombre: f.productos?.nombre ?? null,
                producto_sku: f.productos?.sku ?? null,
                cantidad_contada: f.cantidad_contada,
                stock_sistema: stocks[f.id_producto] ?? 0,
            })),
        },
    }
}

/** Stock actual de un conjunto de productos: Record<id, stock_actual>. */
async function listarStocksProductos(ids: string[]): Promise<Record<string, number>> {
    if (ids.length === 0) return {}
    const supabase = await createClient()
    const { data } = await supabase.from('productos').select('id, stock_actual').in('id', ids)
    const mapa: Record<string, number> = {}
    for (const p of data ?? []) {
        mapa[(p as { id: string }).id] = Number((p as { stock_actual: number }).stock_actual)
    }
    return mapa
}

/** Crea el conteo borrador con sus renglones. */
export async function crearConteo(input: ConteoInput): Promise<RespuestaDato<{ id: string }>> {
    const parsed = conteoSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
    }
    const supabase = await createClient()
    const { fecha_conteo, id_ubicacion, notas, renglones } = parsed.data

    const { data: nuevo, error } = await supabase
        .from('conteos_inventario')
        .insert({
            fecha_conteo,
            id_ubicacion,
            notas: notas.trim() === '' ? null : notas.trim(),
        })
        .select('id')
        .single()
    if (error) return { success: false, error: error.message }
    const idConteo = (nuevo as { id: string }).id

    // BD real de renglones_conteo: solo (id_conteo, id_producto, cantidad_contada) + UNIQUE.
    const filas = renglones.map((r) => ({
        id_conteo: idConteo,
        id_producto: r.id_producto,
        cantidad_contada: Number(r.cantidad_contada),
    }))
    const { error: errR } = await supabase.from('renglones_conteo').insert(filas)
    if (errR) return { success: false, error: errR.message }

    return { success: true, data: { id: idConteo } }
}

/** Edita el conteo BORRADOR: reemplaza los renglones (borra y reinserta). */
export async function editarConteo(id: string, input: ConteoInput): Promise<RespuestaAccion> {
    const parsed = conteoSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
    }
    const supabase = await createClient()

    const { data: actual } = await supabase.from('conteos_inventario').select('estado').eq('id', id).single()
    if ((actual as { estado?: string })?.estado !== 'borrador') {
        return { success: false, error: 'Solo un conteo en borrador se puede editar.' }
    }

    const { error: errEnc } = await supabase
        .from('conteos_inventario')
        .update({
            fecha_conteo: parsed.data.fecha_conteo,
            id_ubicacion: parsed.data.id_ubicacion,
            notas: parsed.data.notas.trim() === '' ? null : parsed.data.notas.trim(),
        })
        .eq('id', id)
    if (errEnc) return { success: false, error: errEnc.message }

    const { error: errDel } = await supabase.from('renglones_conteo').delete().eq('id_conteo', id)
    if (errDel) return { success: false, error: errDel.message }

    const filas = parsed.data.renglones.map((r) => ({
        id_conteo: id,
        id_producto: r.id_producto,
        cantidad_contada: Number(r.cantidad_contada),
    }))
    const { error: errIns } = await supabase.from('renglones_conteo').insert(filas)
    if (errIns) return { success: false, error: errIns.message }

    return { success: true }
}

/** Aplica el conteo: ajusta el libro por la diferencia de cada renglón (origen inventario_fisico). */
export async function aplicarConteo(id: string): Promise<RespuestaAccion> {
    const supabase = await createClient()

    const { data: actual } = await supabase.from('conteos_inventario').select('estado').eq('id', id).single()
    if ((actual as { estado?: string })?.estado !== 'borrador') {
        return { success: false, error: 'Solo un conteo en borrador se puede aplicar.' }
    }

    const { data: renglones, error: errR } = await supabase
        .from('renglones_conteo')
        .select('id_producto, cantidad_contada')
        .eq('id_conteo', id)
    if (errR) return { success: false, error: errR.message }

    const filas = (renglones ?? []) as unknown as { id_producto: string; cantidad_contada: number }[]
    const stocks = await listarStocksProductos(filas.map((f) => f.id_producto))

    for (const renglon of filas) {
        const stockSistema = stocks[renglon.id_producto] ?? 0
        const contada = Number(renglon.cantidad_contada)
        const diferencia = contada - stockSistema
        if (diferencia === 0) continue

        const { data: prod } = await supabase
            .from('productos')
            .select('maneja_numero_serie')
            .eq('id', renglon.id_producto)
            .single()
        const manejaSerie = (prod as { maneja_numero_serie: boolean } | null)?.maneja_numero_serie ?? false

        if (diferencia < 0) {
            // Sobra stock según el sistema → sale (FIFO sobre lotes existentes).
            const fifo = await consumirLotesFifo(supabase, renglon.id_producto, Math.abs(diferencia))
            if (!fifo.ok) return { success: false, error: fifo.error }
            const { error: errMov } = await supabase.from('movimientos_inventario').insert({
                id_producto: renglon.id_producto,
                id_lote: null,
                tipo_movimiento: 'ajuste_negativo',
                cantidad: diferencia,
                stock_anterior: stockSistema,
                stock_resultante: contada,
                origen_tabla: 'inventario_fisico',
                origen_id: id,
                motivo: `Conteo físico — faltante de ${Math.abs(diferencia)}`,
            })
            if (errMov) return { success: false, error: errMov.message }
        } else {
            // Faltaba stock según el sistema → sobrante físico.
            if (manejaSerie) {
                return {
                    success: false,
                    error:
                        `El producto maneja número de serie y el conteo encontró sobrante sin NS. ` +
                        `Revisa la pieza antes de aplicar (no se registra a ciegas).`,
                }
            }
            const { error: errLote } = await supabase.from('lotes').insert({
                id_producto: renglon.id_producto,
                cantidad_original: diferencia,
                cantidad_disponible: diferencia,
                costo_unitario: null,
                origen_tabla: 'inventario_fisico',
                origen_id: id,
                notas: 'Ajuste por conteo físico (sobrante)',
            })
            if (errLote) return { success: false, error: errLote.message }
            const { error: errMov } = await supabase.from('movimientos_inventario').insert({
                id_producto: renglon.id_producto,
                id_lote: null,
                tipo_movimiento: 'ajuste_positivo',
                cantidad: diferencia,
                stock_anterior: stockSistema,
                stock_resultante: contada,
                origen_tabla: 'inventario_fisico',
                origen_id: id,
                motivo: `Conteo físico — sobrante de ${diferencia}`,
            })
            if (errMov) return { success: false, error: errMov.message }
        }
    }

    const { error: errEstado } = await supabase
        .from('conteos_inventario')
        .update({ estado: 'aplicado' })
        .eq('id', id)
    if (errEstado) return { success: false, error: errEstado.message }

    return { success: true }
}

/** Cancela (soft) un conteo en borrador — sin tocar el libro. */
export async function cancelarConteo(id: string): Promise<RespuestaAccion> {
    const supabase = await createClient()
    const { data: actual } = await supabase.from('conteos_inventario').select('estado').eq('id', id).single()
    if ((actual as { estado?: string })?.estado !== 'borrador') {
        return { success: false, error: 'Solo un conteo en borrador se puede cancelar.' }
    }
    const { error } = await supabase.from('conteos_inventario').update({ estado: 'cancelado' }).eq('id', id)
    if (error) return { success: false, error: error.message }
    return { success: true }
}
