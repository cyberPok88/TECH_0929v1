// ═══════════════════════════════════════════════════════════════════════════════
// SERVER ACTIONS — NOTAS DE COMPRA (Guía 1.4 · rediseño 05 Sep 2026)
// 'use server': obligatorio · retornan objetos tipados — NUNCA throw.
//   listarNotasCompra (paginación servidor) · listarNotasCompraParaExportar ·
//   obtenerNotaCompra (encabezado + partidas + pagos) · listarProductosParaPartida
//   crearNotaCompraDirecta (folio NC-#### + partidas) · editarNotaCompra ·
//   registrarPagoNota (historial + deriva saldo/estado) · cancelarNotaCompra
// La nota NO mueve inventario (solo Almacén/Entradas 1.6 marca `recibida`).
// ═══════════════════════════════════════════════════════════════════════════════

'use server'

import Decimal from 'decimal.js'
import { createClient } from '@/lib/supabase/server'
import {
    notaCancelarSchema,
    notaCrearSchema,
    notaEditarSchema,
    pagoNotaSchema,
} from '@/lib/validations/notas-compra'
import type {
    NotaCancelarInput,
    NotaCrearInput,
    NotaEditarInput,
    PagoNotaInput,
} from '@/lib/validations/notas-compra'
import type {
    EstadoPagoClave,
    FiltrosNotaCompra,
    NotaCompra,
    NotaCompraDetalle,
    PagoNota,
    PartidaNota,
    RespuestaAccion,
    RespuestaDato,
    RespuestaLista,
} from '@/types/notas-compra'

// ── Formas crudas de PostgREST (embeds aplanados por aFila) ────────────────────
interface FilaNotaCruda {
    id: string
    folio: string
    id_proveedor: string
    origen: NotaCompra['origen']
    id_entrada: string | null
    fecha_nota: string
    estado_fisico: NotaCompra['estado_fisico']
    id_estado_pago: string
    total: number
    saldo_pendiente: number
    numero_factura_proveedor: string | null
    referencia_proveedor: string | null
    notas: string | null
    es_cancelada: boolean
    motivo_cancelacion: string | null
    creado_por: string | null
    actualizado_por: string | null
    created_at: string
    updated_at: string
    proveedores: { codigo: string; nombre_comercial: string } | null
    estados_pago: { clave: EstadoPagoClave; nombre: string } | null
}

const COLUMNAS_NOTAS = [
    'id', 'folio', 'id_proveedor', 'origen', 'id_entrada', 'fecha_nota',
    'estado_fisico', 'id_estado_pago', 'total', 'saldo_pendiente',
    'numero_factura_proveedor', 'referencia_proveedor', 'notas',
    'es_cancelada', 'motivo_cancelacion',
    'creado_por', 'actualizado_por', 'created_at', 'updated_at',
    'proveedores(codigo,nombre_comercial)',
    'estados_pago(clave,nombre)',
].join(',')

function aFilaNota(p: FilaNotaCruda): NotaCompra {
    return {
        id: p.id,
        folio: p.folio,
        id_proveedor: p.id_proveedor,
        proveedor_codigo: p.proveedores?.codigo ?? null,
        proveedor_nombre: p.proveedores?.nombre_comercial ?? null,
        origen: p.origen,
        id_entrada: p.id_entrada,
        fecha_nota: p.fecha_nota,
        estado_fisico: p.estado_fisico,
        id_estado_pago: p.id_estado_pago,
        estado_pago_clave: p.estados_pago?.clave ?? null,
        estado_pago_nombre: p.estados_pago?.nombre ?? null,
        total: p.total,
        saldo_pendiente: p.saldo_pendiente,
        numero_factura_proveedor: p.numero_factura_proveedor,
        referencia_proveedor: p.referencia_proveedor,
        notas: p.notas,
        es_cancelada: p.es_cancelada,
        motivo_cancelacion: p.motivo_cancelacion,
        creado_por: p.creado_por,
        actualizado_por: p.actualizado_por,
        created_at: p.created_at,
        updated_at: p.updated_at,
    }
}

function aNull(v: string): string | null {
    const t = v.trim()
    return t ? t : null
}

function aNumero(v: string): number {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
}

function aEntero(v: string): number {
    return Math.trunc(aNumero(v))
}

function traducirErrorNotaCompra(codigo: string | undefined, mensaje: string): string {
    if (codigo === '23505') return 'Ya existe una nota con ese folio.'
    if (codigo === '23503') return 'Uno de los valores seleccionados ya no existe (proveedor, producto o estado).'
    if (codigo === '23514') return 'La nota incumple una regla de negocio (cantidades, montos o cancelación).'
    if (codigo === '42501') return 'No tienes permiso para realizar esta acción.'
    return mensaje
}

async function sesionActiva(
    supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ userId: string } | { error: string }> {
    const { data: sesion } = await supabase.auth.getUser()
    if (!sesion.user) return { error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }
    return { userId: sesion.user.id }
}

async function idEstadoPagoPorClave(
    supabase: Awaited<ReturnType<typeof createClient>>,
    clave: EstadoPagoClave
): Promise<string | null> {
    const { data } = await supabase.from('estados_pago').select('id').eq('clave', clave).limit(1).maybeSingle()
    return data?.id ?? null
}

// ── Listar notas (paginación servidor · filtros) ──────────────────────────────
export async function listarNotasCompra(
    filtros: FiltrosNotaCompra,
    pagina = 1,
    tamano = 25
): Promise<RespuestaLista<NotaCompra>> {
    const supabase = await createClient()

    let query = supabase.from('notas_compra').select(COLUMNAS_NOTAS, { count: 'exact' })

    if (filtros.idProveedor) query = query.eq('id_proveedor', filtros.idProveedor)
    if (filtros.estadoFisico) query = query.eq('estado_fisico', filtros.estadoFisico)
    if (filtros.fechaDesde) query = query.gte('fecha_nota', filtros.fechaDesde)
    if (filtros.fechaHasta) query = query.lte('fecha_nota', filtros.fechaHasta)

    if (filtros.estadoPago) {
        const idEstado = await idEstadoPagoPorClave(supabase, filtros.estadoPago)
        if (!idEstado) return { success: true, data: [], total: 0 }
        query = query.eq('id_estado_pago', idEstado)
    }

    const busqueda = filtros.busqueda.trim().replace(/[%_]/g, '')
    if (busqueda) {
        query = query.or(`folio.ilike.%${busqueda}%,numero_factura_proveedor.ilike.%${busqueda}%`)
    }

    const desde = (pagina - 1) * tamano
    const { data, error, count } = await query
        .order('fecha_nota', { ascending: false })
        .order('folio', { ascending: false })
        .range(desde, desde + tamano - 1)

    if (error) return { success: false, error: error.message }
    const notas = ((data ?? []) as unknown as FilaNotaCruda[]).map(aFilaNota)
    return { success: true, data: notas, total: count ?? notas.length }
}

// ── Exportar (visibles + filtros · sin paginar) ────────────────────────────────
export async function listarNotasCompraParaExportar(
    filtros: FiltrosNotaCompra
): Promise<RespuestaLista<NotaCompra>> {
    const supabase = await createClient()

    let query = supabase.from('notas_compra').select(COLUMNAS_NOTAS)

    if (filtros.idProveedor) query = query.eq('id_proveedor', filtros.idProveedor)
    if (filtros.estadoFisico) query = query.eq('estado_fisico', filtros.estadoFisico)
    if (filtros.fechaDesde) query = query.gte('fecha_nota', filtros.fechaDesde)
    if (filtros.fechaHasta) query = query.lte('fecha_nota', filtros.fechaHasta)

    if (filtros.estadoPago) {
        const idEstado = await idEstadoPagoPorClave(supabase, filtros.estadoPago)
        if (!idEstado) return { success: true, data: [] }
        query = query.eq('id_estado_pago', idEstado)
    }

    const busqueda = filtros.busqueda.trim().replace(/[%_]/g, '')
    if (busqueda) {
        query = query.or(`folio.ilike.%${busqueda}%,numero_factura_proveedor.ilike.%${busqueda}%`)
    }

    const { data, error } = await query
        .order('fecha_nota', { ascending: false })
        .order('folio', { ascending: false })

    if (error) return { success: false, error: error.message }
    return { success: true, data: ((data ?? []) as unknown as FilaNotaCruda[]).map(aFilaNota) }
}

// ── Obtener nota: encabezado + partidas + historial de pagos ──────────────────
export async function obtenerNotaCompra(id: string): Promise<RespuestaDato<NotaCompraDetalle>> {
    const supabase = await createClient()

    const { data: encabezado, error: err1 } = await supabase
        .from('notas_compra')
        .select(COLUMNAS_NOTAS)
        .eq('id', id)
        .maybeSingle()
    if (err1) return { success: false, error: err1.message }
    if (!encabezado) return { success: false, error: 'La nota no existe o no tienes acceso.' }

    const { data: filasPartidas, error: err2 } = await supabase
        .from('partidas_nota')
        .select('id, id_nota, id_producto, descripcion, cantidad, costo_acordado, subtotal_partida, orden, productos(sku, nombre)')
        .eq('id_nota', id)
        .order('orden', { ascending: true })
    if (err2) return { success: false, error: err2.message }

    const partidas: PartidaNota[] = ((filasPartidas ?? []) as unknown as Array<{
        id: string
        id_nota: string
        id_producto: string | null
        descripcion: string | null
        cantidad: number
        costo_acordado: number
        subtotal_partida: number
        orden: number
        productos: { sku: string; nombre: string } | null
    }>).map((p) => ({
        id: p.id,
        id_nota: p.id_nota,
        id_producto: p.id_producto,
        descripcion: p.descripcion ?? null,
        producto_codigo: p.productos?.sku ?? null,
        producto_nombre: p.productos?.nombre ?? null,
        cantidad: p.cantidad,
        costo_acordado: p.costo_acordado,
        subtotal_partida: p.subtotal_partida,
        orden: p.orden,
    }))

    const { data: filasPagos, error: err3 } = await supabase
        .from('pagos_nota')
        .select('id, id_nota, fecha_pago, monto, metodo, referencia_bancaria, notas, creado_por, created_at')
        .eq('id_nota', id)
        .order('fecha_pago', { ascending: false })
    if (err3) return { success: false, error: err3.message }

    const pagos = (filasPagos ?? []) as PagoNota[]

    return { success: true, data: { ...aFilaNota(encabezado as unknown as FilaNotaCruda), partidas, pagos } }
}

// ── Productos activos para las partidas (selector interno del grid) ───────────
export interface ProductoParaPartida {
    id: string
    sku: string
    nombre: string
}

export async function listarProductosParaPartida(busqueda = ''): Promise<RespuestaLista<ProductoParaPartida>> {
    const supabase = await createClient()

    let query = supabase
        .from('productos')
        .select('id, sku, nombre')
        .eq('es_archivado', false)
        .eq('es_activo', true)

    const termino = busqueda.trim().replace(/[%_]/g, '')
    if (termino) {
        query = query.or(`nombre.ilike.%${termino}%,sku.ilike.%${termino}%,codigo_barras.ilike.%${termino}%`)
    }

    const { data, error } = await query.order('nombre', { ascending: true }).limit(30)
    if (error) return { success: false, error: error.message }
    return { success: true, data: (data ?? []) as ProductoParaPartida[] }
}

// ── Crear nota DIRECTA (folio NC-#### · partidas · total Σ costo×cantidad) ────
export async function crearNotaCompraDirecta(
    input: NotaCrearInput
): Promise<RespuestaDato<{ id: string; folio: string }>> {
    const parsed = notaCrearSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
    }
    const d = parsed.data

    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }

    const { data: folio, error: errFolio } = await supabase.rpc('generar_folio', { p_tipo: 'nota_compra' })
    if (errFolio || !folio) {
        return { success: false, error: errFolio?.message ?? 'No se pudo generar el folio de la nota.' }
    }

    const idPendiente = await idEstadoPagoPorClave(supabase, 'pendiente')
    if (!idPendiente) {
        return { success: false, error: 'El catálogo de estados de pago no está disponible.' }
    }

    const total = d.partidas.reduce(
        (acc, partida) => acc.plus(new Decimal(aNumero(partida.costo_acordado)).times(aEntero(partida.cantidad))),
        new Decimal(0)
    ).toNumber()

    const { data: creada, error: errInsert } = await supabase
        .from('notas_compra')
        .insert({
            folio,
            id_proveedor: d.id_proveedor,
            origen: 'directa',
            fecha_nota: d.fecha_nota,
            estado_fisico: 'por_recibir',
            id_estado_pago: idPendiente,
            total,
            saldo_pendiente: total,
            numero_factura_proveedor: aNull(d.numero_factura_proveedor),
            referencia_proveedor: aNull(d.referencia_proveedor),
            notas: aNull(d.notas),
            creado_por: sesion.userId,
        })
        .select('id, folio')
        .single()
    if (errInsert) return { success: false, error: traducirErrorNotaCompra(errInsert.code, errInsert.message) }

    // Partidas (secuencial · orden 1..n)
    for (let i = 0; i < d.partidas.length; i++) {
        const p = d.partidas[i]
        const costo = aNumero(p.costo_acordado)
        const cantidad = aEntero(p.cantidad)
        const { error: errP } = await supabase.from('partidas_nota').insert({
            id_nota: creada.id,
            id_producto: p.id_producto,
            cantidad,
            costo_acordado: costo,
            subtotal_partida: new Decimal(costo).times(cantidad).toNumber(),
            orden: i + 1,
        })
        if (errP) {
            return { success: false, error: traducirErrorNotaCompra(errP.code, errP.message) }
        }
    }

    return { success: true, data: { id: creada.id, folio: creada.folio } }
}

// ── Editar nota directa (solo por_recibir y sin pagos · partidas por diffs) ────
export async function editarNotaCompra(id: string, input: NotaEditarInput): Promise<RespuestaAccion> {
    const parsed = notaEditarSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
    }
    const d = parsed.data

    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }

    const { data: actual, error: errActual } = await supabase
        .from('notas_compra')
        .select('id, es_cancelada, estado_fisico, saldo_pendiente, total')
        .eq('id', id)
        .maybeSingle()
    if (errActual) return { success: false, error: errActual.message }
    if (!actual) return { success: false, error: 'La nota no existe o no tienes acceso.' }

    if (actual.es_cancelada) return { success: false, error: 'No se puede editar una nota cancelada.' }
    if (actual.estado_fisico !== 'por_recibir') {
        return { success: false, error: 'Solo se edita una nota por recibir (recibidas las gestiona Almacén/Entradas).' }
    }
    if (actual.saldo_pendiente < actual.total) {
        return { success: false, error: 'No se puede editar una nota con pagos registrados.' }
    }

    const total = d.partidas.reduce(
        (acc, partida) => acc.plus(new Decimal(aNumero(partida.costo_acordado)).times(aEntero(partida.cantidad))),
        new Decimal(0)
    ).toNumber()

    const { error: errU } = await supabase
        .from('notas_compra')
        .update({
            id_proveedor: d.id_proveedor,
            fecha_nota: d.fecha_nota,
            total,
            saldo_pendiente: total,
            numero_factura_proveedor: aNull(d.numero_factura_proveedor),
            referencia_proveedor: aNull(d.referencia_proveedor),
            notas: aNull(d.notas),
            actualizado_por: sesion.userId,
        })
        .eq('id', id)
    if (errU) return { success: false, error: traducirErrorNotaCompra(errU.code, errU.message) }

    // Partidas: reemplazo (delete + insert) — el DELETE de partidas lo permite el RLS `editar`
    const { error: errDel } = await supabase.from('partidas_nota').delete().eq('id_nota', id)
    if (errDel) return { success: false, error: traducirErrorNotaCompra(errDel.code, errDel.message) }

    for (let i = 0; i < d.partidas.length; i++) {
        const p = d.partidas[i]
        const costo = aNumero(p.costo_acordado)
        const cantidad = aEntero(p.cantidad)
        const { error: errP } = await supabase.from('partidas_nota').insert({
            id_nota: id,
            id_producto: p.id_producto,
            cantidad,
            costo_acordado: costo,
            subtotal_partida: new Decimal(costo).times(cantidad).toNumber(),
            orden: i + 1,
        })
        if (errP) return { success: false, error: traducirErrorNotaCompra(errP.code, errP.message) }
    }

    return { success: true }
}

// ── Registrar pago (historial append-only · deriva saldo/estado) ───────────────
export async function registrarPagoNota(id: string, input: PagoNotaInput): Promise<RespuestaAccion> {
    const parsed = pagoNotaSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
    }
    const monto = aNumero(parsed.data.monto)

    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }

    const { data: actual, error: errActual } = await supabase
        .from('notas_compra')
        .select('id, es_cancelada, saldo_pendiente, total')
        .eq('id', id)
        .maybeSingle()
    if (errActual) return { success: false, error: errActual.message }
    if (!actual) return { success: false, error: 'La nota no existe o no tienes acceso.' }

    if (actual.es_cancelada) return { success: false, error: 'No se puede pagar una nota cancelada.' }
    if (actual.saldo_pendiente <= 0) return { success: false, error: 'La nota ya está pagada.' }
    if (monto > actual.saldo_pendiente) {
        return { success: false, error: `El monto supera el saldo pendiente (${actual.saldo_pendiente.toFixed(2)}).` }
    }

    const { error: errPago } = await supabase.from('pagos_nota').insert({
        id_nota: id,
        monto,
        metodo: parsed.data.metodo,
        referencia_bancaria: aNull(parsed.data.referencia_bancaria),
        notas: aNull(parsed.data.notas),
        creado_por: sesion.userId,
    })
    if (errPago) return { success: false, error: traducirErrorNotaCompra(errPago.code, errPago.message) }

    const nuevoSaldo = new Decimal(actual.saldo_pendiente).minus(monto).toNumber()
    const claveNueva: EstadoPagoClave = nuevoSaldo === 0 ? 'pagada' : 'parcial'
    const idEstado = await idEstadoPagoPorClave(supabase, claveNueva)
    if (!idEstado) return { success: false, error: 'El catálogo de estados de pago no está disponible.' }

    const { error: errU } = await supabase
        .from('notas_compra')
        .update({ saldo_pendiente: nuevoSaldo, id_estado_pago: idEstado, actualizado_por: sesion.userId })
        .eq('id', id)
    if (errU) return { success: false, error: traducirErrorNotaCompra(errU.code, errU.message) }

    return { success: true }
}

// ── Cancelar nota (motivo · sin pagos · sin recibida) ──────────────────────────
export async function cancelarNotaCompra(id: string, input: NotaCancelarInput): Promise<RespuestaAccion> {
    const parsed = notaCancelarSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
    }

    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }

    const { data: actual, error: errActual } = await supabase
        .from('notas_compra')
        .select('id, es_cancelada, estado_fisico, saldo_pendiente, total')
        .eq('id', id)
        .maybeSingle()
    if (errActual) return { success: false, error: errActual.message }
    if (!actual) return { success: false, error: 'La nota no existe o no tienes acceso.' }

    if (actual.es_cancelada) return { success: false, error: 'La nota ya está cancelada.' }
    if (actual.estado_fisico !== 'por_recibir') {
        return { success: false, error: 'No se cancela una nota ya recibida (gestiona la devolución con el flujo).' }
    }
    if (actual.saldo_pendiente < actual.total) {
        return { success: false, error: 'No se puede cancelar una nota con pagos registrados.' }
    }

    const { error } = await supabase
        .from('notas_compra')
        .update({
            es_cancelada: true,
            motivo_cancelacion: parsed.data.motivo.trim(),
            actualizado_por: sesion.userId,
        })
        .eq('id', id)

    if (error) return { success: false, error: traducirErrorNotaCompra(error.code, error.message) }
    return { success: true }
}
