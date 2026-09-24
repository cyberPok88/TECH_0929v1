// ═══════════════════════════════════════════════════════════════════════════════
// SERVER ACTIONS — ENTRADAS (Guía 1.6 · 18 Sep 2026)
// 'use server': obligatorio · retornan objetos tipados — NUNCA throw.
//   listarEntradas (colas por estado · paginación servidor) · listarMotivosRechazo ·
//   listarCausasDivergencia · [P2: crear/editar] · [P3: revisión] · [P4: nota] ·
//   [P5: acondicionamiento] · [P6: alta] · [P7: divergencias]
// ═══════════════════════════════════════════════════════════════════════════════

'use server'

import Decimal from 'decimal.js'

import { createClient } from '@/lib/supabase/server'
import { entradaSchema, type EntradaInput } from '@/lib/validations/entradas'
import type {
    CausaDivergencia,
    CotejoLinea,
    ConfirmarAltaInput,
    DevolucionEntrada,
    Divergencia,
    Entrada,
    FiltrosEntradas,
    AvanceRevisionInput,
    MotivoRechazo,
    PartidaConAvance,
    PartidaEntrada,
    PartidaResuelta,
    RespuestaAccion,
    RespuestaDato,
    RespuestaLista,
    ResultadoRevision,
    CategoriaCapturable,
} from '@/types/entradas'
import type { AtributoEsquema } from '@/types/catalogos'

// ── Forma cruda del embed PostgREST (aplanada por aFila) ────────────────────────
interface FilaEntradaCruda {
    id: string
    folio: string
    id_proveedor: string
    proveedores: { nombre_comercial: string | null } | null
    fecha: string
    estado: string
    resultado_rev: string | null
    es_sin_revision: boolean
    origen: string
    id_nota: string | null
    notas: string | null
    fecha_fin_rev: string | null
    fecha_fin_acond: string | null
    fecha_fin_almacen: string | null
    creado_por: string | null
    usuarios: { nombre_completo: string | null } | null
    created_at: string
    // ⭐ MEJORA 20 Sep 2026 — embeds para los agregados de las tablas por fase
    partidas_entrada: { cantidad_original: number; cantidad_vigente: number; costo_acordado: number }[] | null
    devoluciones_entrada: { cantidad: number }[] | null
    notas_compra: { folio: string } | null
}

function aFila(f: FilaEntradaCruda): Entrada {
    const partidas = f.partidas_entrada ?? []
    const partidas_count = partidas.length
    const piezas_total = partidas.reduce((s, p) => s + Number(p.cantidad_original ?? 0), 0)
    // «Final» = lo que queda después del ajuste (Σ vigente). Igual a `piezas_total` si aún no
    // se ajustó: por eso la columna consulta `devPendiente()` antes de mostrarlo.
    const piezas_vigentes = partidas.reduce((s, p) => s + Number(p.cantidad_vigente ?? 0), 0)
    const monto_total = partidas.reduce(
        (s, p) => s + Number(p.cantidad_vigente ?? 0) * Number(p.costo_acordado ?? 0),
        0
    )
    const devolucion_total = (f.devoluciones_entrada ?? []).reduce(
        (s, d) => s + Number(d.cantidad ?? 0),
        0
    )
    return {
        id: f.id,
        folio: f.folio,
        id_proveedor: f.id_proveedor,
        proveedor_nombre: f.proveedores?.nombre_comercial ?? null,
        fecha: f.fecha,
        estado: f.estado as Entrada['estado'],
        resultado_rev: (f.resultado_rev as Entrada['resultado_rev']) ?? null,
        es_sin_revision: f.es_sin_revision,
        origen: f.origen as Entrada['origen'],
        id_nota: f.id_nota,
        notas: f.notas,
        fecha_fin_rev: f.fecha_fin_rev,
        fecha_fin_acond: f.fecha_fin_acond,
        fecha_fin_almacen: f.fecha_fin_almacen,
        creado_por: f.creado_por,
        creador_nombre: f.usuarios?.nombre_completo ?? null,
        created_at: f.created_at,
        partidas_count,
        piezas_total,
        piezas_vigentes,
        monto_total,
        devolucion_total,
        nota_folio: f.notas_compra?.folio ?? null,
    }
}

/** Colas de trabajo por estado (cada rol filtra su cola desde la misma vista). */
export async function listarEntradas(
    filtros: FiltrosEntradas,
    pagina = 1,
    tamano = 25
): Promise<RespuestaLista<Entrada>> {
    const supabase = await createClient()
    let q = supabase
        .from('entradas')
        .select(
            'id, folio, id_proveedor, proveedores(nombre_comercial), fecha, estado, resultado_rev, es_sin_revision, origen, id_nota, notas, fecha_fin_rev, fecha_fin_acond, fecha_fin_almacen, creado_por, usuarios!entradas_creado_por_fkey(nombre_completo), created_at, partidas_entrada(cantidad_original, cantidad_vigente, costo_acordado), devoluciones_entrada(cantidad), notas_compra(folio)',
            { count: 'exact' }
        )
        .order('fecha', { ascending: false })

    if (filtros.estado) q = q.eq('estado', filtros.estado)
    if (filtros.fecha_desde) q = q.gte('fecha', filtros.fecha_desde)
    // `fecha` lleva hora: comparar contra el día suelto dejaba fuera TODO el día "hasta".
    if (filtros.fecha_hasta) q = q.lte('fecha', `${filtros.fecha_hasta}T23:59:59.999`)

    // ⭐ MEJORA 22 Sep 2026 — la búsqueda cubre FOLIO **o PROVEEDOR** (lo pedía el
    // PLAN_CRUD §6 y solo miraba folio). PostgREST NO deja filtrar por una tabla
    // embebida dentro de un `or` — probado contra el servidor real: PGRST100
    // «failed to parse logic tree» —, así que primero se resuelven los ids de los
    // proveedores que coinciden (1 consulta chica, tope 50) y el `or` de la consulta
    // principal queda con folio + esos ids: el conteo y la paginación siguen exactos.
    if (filtros.busqueda) {
        // `,` `(` `)` `"` `\` arman el árbol lógico de PostgREST: si el usuario los
        // teclea rompen la consulta (400). Se limpian antes de interpolar.
        const termino = filtros.busqueda.trim().replace(/[,()"\\]/g, ' ').trim()
        if (termino) {
            const { data: proveedores } = await supabase
                .from('proveedores')
                .select('id')
                .ilike('nombre_comercial', `%${termino}%`)
                .limit(50)
            const ids = (proveedores ?? []).map((p) => p.id as string)
            q = q.or(
                ids.length > 0
                    ? `folio.ilike.%${termino}%,id_proveedor.in.(${ids.join(',')})`
                    : `folio.ilike.%${termino}%`
            )
        }
    }

    const desde = (pagina - 1) * tamano
    const { data, error, count } = await q.range(desde, desde + tamano - 1)
    if (error) return { success: false, error: error.message }
    return { success: true, data: (data as unknown as FilaEntradaCruda[]).map(aFila), total: count ?? 0 }
}

/** Catálogo de motivos de rechazo (wizard de revisión). */
export async function listarMotivosRechazo(): Promise<RespuestaDato<MotivoRechazo[]>> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('motivos_rechazo')
        .select('id, clave, nombre, requiere_porcentaje')
        .eq('es_activo', true)
        .order('orden', { ascending: true })
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as MotivoRechazo[] }
}

/** Catálogo de causas de divergencia (cotejo de almacén). */
export async function listarCausasDivergencia(): Promise<RespuestaDato<CausaDivergencia[]>> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('causas_divergencia')
        .select('id, clave, nombre')
        .eq('es_activo', true)
        .order('orden', { ascending: true })
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as CausaDivergencia[] }
}

// ── Sesión activa (patrón 1.4) ────────────────────────────────────────────────
async function sesionActiva(
    supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ userId: string } | { error: string }> {
    const { data: sesion } = await supabase.auth.getUser()
    if (!sesion.user) return { error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }
    return { userId: sesion.user.id }
}

/** Alta de entrada (cabecera + partidas). Folio ING · estado recién_creada. */
export async function crearEntrada(
    input: EntradaInput
): Promise<RespuestaDato<{ id: string; folio: string }>> {
    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }

    const parsed = entradaSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }

    const { data: folio, error: errFolio } = await supabase.rpc('generar_folio', { p_tipo: 'ING' })
    if (errFolio) return { success: false, error: errFolio.message }

    const { data: entrada, error: errEntrada } = await supabase
        .from('entradas')
        .insert({
            folio,
            id_proveedor: parsed.data.id_proveedor,
            es_sin_revision: parsed.data.es_sin_revision,
            origen: parsed.data.origen,
            notas: parsed.data.notas || null,
            creado_por: sesion.userId,
        })
        .select('id, folio')
        .single()
    if (errEntrada) return { success: false, error: errEntrada.message }

    const partidas = parsed.data.partidas.map((p, i) => ({
        id_entrada: entrada.id,
        partida: i + 1,
        id_categoria: p.id_categoria || null,
        atributos: p.atributos ?? {},
        cantidad_original: Number(p.cantidad_original),
        cantidad_vigente: Number(p.cantidad_original),
        costo_acordado: Number(p.costo_acordado),
        estado_partida: 'PENDIENTE',
        creado_por: sesion.userId,
    }))
    const { error: errPartidas } = await supabase.from('partidas_entrada').insert(partidas)
    if (errPartidas) return { success: false, error: errPartidas.message }

    return { success: true, data: { id: entrada.id, folio: entrada.folio } }
}

/** Edición de entrada — SOLO en `recien_creada` (antes de que alguien revise). */
export async function editarEntrada(
    id: string,
    input: EntradaInput
): Promise<RespuestaAccion> {
    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }

    const { data: actual } = await supabase
        .from('entradas')
        .select('estado')
        .eq('id', id)
        .single()
    if (!actual) return { success: false, error: 'La entrada no existe.' }
    if (actual.estado !== 'recien_creada') {
        return { success: false, error: 'No se puede editar: ya avanzó en el flujo.' }
    }

    const parsed = entradaSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }

    const { error: errCab } = await supabase
        .from('entradas')
        .update({
            id_proveedor: parsed.data.id_proveedor,
            es_sin_revision: parsed.data.es_sin_revision,
            origen: parsed.data.origen,
            notas: parsed.data.notas || null,
            actualizado_por: sesion.userId,
        })
        .eq('id', id)
    if (errCab) return { success: false, error: errCab.message }

    // Reemplazo de partidas (solo en recién_creada — no hay revisión aún).
    const { error: errDel } = await supabase.from('partidas_entrada').delete().eq('id_entrada', id)
    if (errDel) return { success: false, error: errDel.message }
    const partidas = parsed.data.partidas.map((p, i) => ({
        id_entrada: id,
        partida: i + 1,
        id_categoria: p.id_categoria || null,
        atributos: p.atributos ?? {},
        cantidad_original: Number(p.cantidad_original),
        cantidad_vigente: Number(p.cantidad_original),
        costo_acordado: Number(p.costo_acordado),
        estado_partida: 'PENDIENTE',
        creado_por: sesion.userId,
    }))
    const { error: errPartidas } = await supabase.from('partidas_entrada').insert(partidas)
    if (errPartidas) return { success: false, error: errPartidas.message }

    return { success: true }
}

/** Partidas de una entrada (línea declarada). */
export async function listarPartidasEntrada(idEntrada: string): Promise<RespuestaLista<PartidaEntrada>> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('partidas_entrada')
        .select('id, id_entrada, partida, id_categoria, categorias_producto(nombre), atributos, cantidad_original, cantidad_vigente, costo_acordado, estado_partida, devoluciones_entrada(cantidad, fecha_ajuste)')
        .eq('id_entrada', idEntrada)
        .order('partida', { ascending: true })
    if (error) return { success: false, error: error.message }
    const filas = ((data ?? []) as unknown as {
        id: string
        id_entrada: string
        partida: number
        id_categoria: string | null
        categorias_producto: { nombre: string } | null
        atributos: Record<string, unknown> | null
        cantidad_original: number
        cantidad_vigente: number
        costo_acordado: number
        estado_partida: string
        devoluciones_entrada: { cantidad: number; fecha_ajuste: string | null }[] | null
    }[]).map((p) => ({
        id: p.id,
        id_entrada: p.id_entrada,
        partida: p.partida,
        id_categoria: p.id_categoria,
        categoria_nombre: p.categorias_producto?.nombre ?? null,
        atributos: p.atributos ?? {},
        cantidad_original: p.cantidad_original,
        cantidad_vigente: p.cantidad_vigente,
        costo_acordado: p.costo_acordado,
        estado_partida: p.estado_partida as PartidaEntrada['estado_partida'],
        // DEV real de la partida (puede haber varias filas) + si ya se ajustó alguna.
        dev_cantidad: (p.devoluciones_entrada ?? []).reduce((s, d) => s + Number(d.cantidad ?? 0), 0),
        dev_ajustada: (p.devoluciones_entrada ?? []).some((d) => d.fecha_ajuste !== null),
    }))
    return { success: true, data: filas }
}

/** Partidas de una entrada CON su avance de revisión (acordeón de Revisión · 20 Sep).
 *  revisadas = Σ aprobadas (`partidas_resueltas`) + Σ devueltas (`devoluciones_entrada`). */
export async function listarPartidasConAvance(idEntrada: string): Promise<RespuestaLista<PartidaConAvance>> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('partidas_entrada')
        .select('id, partida, id_categoria, categorias_producto(nombre), atributos, cantidad_original, estado_partida')
        .eq('id_entrada', idEntrada)
        .order('partida', { ascending: true })
    if (error) return { success: false, error: error.message }

    const filas = (data ?? []) as unknown as {
        id: string
        partida: number
        id_categoria: string | null
        categorias_producto: { nombre: string } | null
        atributos: Record<string, unknown> | null
        cantidad_original: number
        estado_partida: string
    }[]
    const ids = filas.map((f) => f.id)
    const [{ data: resueltas }, { data: devoluciones }] = await Promise.all([
        ids.length
            ? supabase
                  .from('partidas_resueltas')
                  .select('id_partida_entrada, cantidad_aprobada')
                  .in('id_partida_entrada', ids)
            : Promise.resolve({ data: [] }),
        ids.length
            ? supabase
                  .from('devoluciones_entrada')
                  .select('id_partida_entrada, cantidad')
                  .in('id_partida_entrada', ids)
            : Promise.resolve({ data: [] }),
    ])
    const okPorPartida = new Map<string, number>()
    for (const r of (resueltas ?? []) as { id_partida_entrada: string; cantidad_aprobada: number }[]) {
        okPorPartida.set(r.id_partida_entrada, (okPorPartida.get(r.id_partida_entrada) ?? 0) + Number(r.cantidad_aprobada))
    }
    const malPorPartida = new Map<string, number>()
    for (const d of (devoluciones ?? []) as { id_partida_entrada: string; cantidad: number }[]) {
        malPorPartida.set(d.id_partida_entrada, (malPorPartida.get(d.id_partida_entrada) ?? 0) + Number(d.cantidad))
    }

    return {
        success: true,
        data: filas.map((f) => {
            const revisadas = (okPorPartida.get(f.id) ?? 0) + (malPorPartida.get(f.id) ?? 0)
            return {
                id: f.id,
                partida: f.partida,
                id_categoria: f.id_categoria,
                categoria_nombre: f.categorias_producto?.nombre ?? null,
                atributos: f.atributos ?? {},
                cantidad_original: Number(f.cantidad_original),
                revisadas,
                restantes: Math.max(0, Number(f.cantidad_original) - revisadas),
                estado_partida: f.estado_partida as PartidaEntrada['estado_partida'],
            }
        }),
    }
}

/** Categorías capturables (esquema no vacío — HDD/M.2/SSD/RAM): el select de recepción
 *  y el esquema que revisión renderiza para resolver el SKU por huella. Regla D16
 *  (MODELO_DATOS §7.3.2): esquema propio, o el de la raíz si la sub no define uno. */
export async function listarCategoriasCapturables(): Promise<RespuestaLista<CategoriaCapturable>> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('categorias_producto')
        .select('id, nombre, id_categoria_padre, esquema_atributos')
        .eq('es_activo', true)
        .order('nombre', { ascending: true })
    if (error) return { success: false, error: error.message }

    const filas = (data ?? []) as unknown as {
        id: string
        nombre: string
        id_categoria_padre: string | null
        esquema_atributos: AtributoEsquema[] | null
    }[]

    const esquemaDe = (f: (typeof filas)[number]): AtributoEsquema[] => {
        if (f.esquema_atributos && f.esquema_atributos.length > 0) return f.esquema_atributos
        if (f.id_categoria_padre) {
            const padre = filas.find((x) => x.id === f.id_categoria_padre)
            return (padre?.esquema_atributos ?? []) as AtributoEsquema[]
        }
        return []
    }

    const capturables = filas
        .filter((f) => esquemaDe(f).length > 0)
        .map((f) => ({ id: f.id, nombre: f.nombre, esquema: esquemaDe(f) }))
    return { success: true, data: capturables }
}

/** Alta rápida de producto (marcado pendiente_enriquecimiento). Usa catálogos default. */
export async function crearProductoRapido(input: {
    id_categoria: string
    id_marca: string | null
    nombre: string
    atributos: Record<string, unknown>
}): Promise<RespuestaDato<{ id: string; sku: string }>> {
    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }

    const [{ data: unidad }, { data: impuesto }, { data: folio, error: errFolio }] = await Promise.all([
        supabase.from('unidades_medida').select('id').eq('es_activo', true).limit(1).maybeSingle(),
        supabase.from('impuestos').select('id').limit(1).maybeSingle(),
        supabase.rpc('generar_folio', { p_tipo: 'producto' }),
    ])
    if (errFolio) return { success: false, error: errFolio.message }
    if (!unidad || !impuesto) return { success: false, error: 'Faltan catálogos de unidad o impuesto.' }

    const { data, error } = await supabase
        .from('productos')
        .insert({
            sku: folio,
            nombre: input.nombre,
            id_categoria: input.id_categoria,
            id_marca: input.id_marca,
            atributos: input.atributos,
            id_unidad_medida: unidad.id,
            id_impuesto: impuesto.id,
            precio_base: 0,
            costo_promedio: 0,
            stock_actual: 0,
            stock_minimo: 0,
            requiere_revision: true,
            maneja_numero_serie: false,
            pendiente_enriquecimiento: true,
            creado_por: sesion.userId,
        })
        .select('id, sku')
        .single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: { id: data.id, sku: data.sku } }
}

/** Resultado de la revisión (aprobadas por SKU + devoluciones por motivo). */
export async function listarResultadoRevision(idEntrada: string): Promise<RespuestaDato<ResultadoRevision>> {
    const supabase = await createClient()
    const { data: partidas } = await supabase.from('partidas_entrada').select('id').eq('id_entrada', idEntrada)
    const ids = (partidas ?? []).map((p) => p.id)
    const [{ data: aprobadas }, { data: devoluciones }] = await Promise.all([
        ids.length
            ? supabase
                  .from('partidas_resueltas')
                  .select('id, id_partida_entrada, id_marca, marcas_producto(nombre), id_producto, productos(sku, nombre), cantidad_aprobada, atributos')
                  .in('id_partida_entrada', ids)
            : Promise.resolve({ data: [] }),
        supabase
            .from('devoluciones_entrada')
            // ⭐ MEJORA 22 Sep 2026 (12) — la DEV dice de qué PARTIDA y de qué PRODUCTO declarado
            // (categoría + atributos de recepción = la huella) se devuelve, y cuándo se ajustó.
            // Embed anidado (devoluciones → partidas_entrada → categorias_producto): sin SQL nuevo.
            .select(
                'id, id_entrada, id_partida_entrada, id_motivo, motivos_rechazo(nombre), cantidad, porcentaje_salud, ns, estado, fecha_ajuste, created_at, partidas_entrada(partida, categorias_producto(nombre), atributos)'
            )
            .eq('id_entrada', idEntrada),
    ])
    const aprobadasFlat = ((aprobadas ?? []) as unknown as {
        id: string
        id_partida_entrada: string
        id_marca: string | null
        marcas_producto: { nombre: string | null } | null
        id_producto: string | null
        productos: { sku: string | null; nombre: string | null } | null
        cantidad_aprobada: number
        atributos: Record<string, unknown>
    }[]).map((r) => ({
        id: r.id,
        id_partida_entrada: r.id_partida_entrada,
        id_marca: r.id_marca,
        marca_nombre: r.marcas_producto?.nombre ?? null,
        id_producto: r.id_producto,
        producto_sku: r.productos?.sku ?? null,
        producto_nombre: r.productos?.nombre ?? null,
        cantidad_aprobada: r.cantidad_aprobada,
        atributos: r.atributos,
    }))
    const devolucionesFlat = ((devoluciones ?? []) as unknown as {
        id: string
        id_entrada: string
        id_partida_entrada: string
        id_motivo: string
        motivos_rechazo: { nombre: string } | null
        cantidad: number
        porcentaje_salud: number | null
        ns: string | null
        estado: string
        fecha_ajuste: string | null
        created_at: string
        partidas_entrada: {
            partida: number | null
            categorias_producto: { nombre: string | null } | null
            atributos: Record<string, unknown> | null
        } | null
    }[]).map((d) => ({
        id: d.id,
        id_entrada: d.id_entrada,
        id_partida_entrada: d.id_partida_entrada,
        id_motivo: d.id_motivo,
        motivo_nombre: d.motivos_rechazo?.nombre ?? null,
        cantidad: d.cantidad,
        porcentaje_salud: d.porcentaje_salud,
        ns: d.ns,
        estado: d.estado as DevolucionEntrada['estado'],
        fecha_ajuste: d.fecha_ajuste,
        created_at: d.created_at,
        partida_numero: d.partidas_entrada?.partida ?? null,
        categoria_nombre: d.partidas_entrada?.categorias_producto?.nombre ?? null,
        atributos: d.partidas_entrada?.atributos ?? {},
    }))
    return {
        success: true,
        data: {
            aprobadas: aprobadasFlat as PartidaResuelta[],
            devoluciones: devolucionesFlat as DevolucionEntrada[],
        },
    }
}

/** ⭐ Guardar AVANCE de revisión de una partida (usuario 20 Sep: no es "lote"):
 *  agrupa PASA por huella · NO_PASA por motivo · cierra partidas y entrada. */
export async function guardarAvanceRevision(input: AvanceRevisionInput): Promise<RespuestaAccion> {
    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }

    const { data: entrada } = await supabase.from('entradas').select('estado').eq('id', input.id_entrada).single()
    if (!entrada) return { success: false, error: 'La entrada no existe.' }
    if (!['recien_creada', 'lista_para_revision', 'en_revision'].includes(entrada.estado)) {
        return { success: false, error: 'La entrada ya avanzó: no se puede revisar.' }
    }
    if (input.piezas.length === 0) return { success: false, error: 'El lote está vacío.' }

    // Transición a en_revision (primera toma).
    if (entrada.estado !== 'en_revision') {
        await supabase.from('transiciones_etapa').insert({
            id_entrada: input.id_entrada,
            desde_estado: entrada.estado,
            hacia_estado: 'en_revision',
            actor_id: sesion.userId,
            notas: 'Tomó la entrada para revisión',
            creado_por: sesion.userId,
        })
    }

    const pasa = input.piezas.filter((p) => p.resultado === 'PASA')
    const noPasa = input.piezas.filter((p) => p.resultado === 'NO_PASA')

    // ⭐ Evolución V5 (20 Sep): PASA agrupadas por (partida, MARCA, atributos) →
    // `partidas_resueltas` guarda la HUELLA (`id_marca` + `atributos`); el SKU
    // (`id_producto`) queda NULL y lo asigna ALMACÉN al cotejar.
    const gruposPasa = new Map<
        string,
        { idPartida: string; idMarca: string; atributos: Record<string, string>; count: number }
    >()
    for (const p of pasa) {
        const k = `${p.id_partida_entrada}|${p.id_marca}|${JSON.stringify(p.atributos ?? {})}`
        const g =
            gruposPasa.get(k) ??
            ({ idPartida: p.id_partida_entrada, idMarca: p.id_marca, atributos: p.atributos ?? {}, count: 0 } as const as {
                idPartida: string
                idMarca: string
                atributos: Record<string, string>
                count: number
            })
        g.count += 1
        gruposPasa.set(k, g)
    }
    for (const g of gruposPasa.values()) {
        const { data: existentes } = await supabase
            .from('partidas_resueltas')
            .select('id, cantidad_aprobada, atributos')
            .eq('id_partida_entrada', g.idPartida)
            .eq('id_marca', g.idMarca)
        const existente = (existentes ?? []).find(
            (r) => JSON.stringify((r.atributos as Record<string, unknown>) ?? {}) === JSON.stringify(g.atributos)
        )
        if (existente) {
            await supabase
                .from('partidas_resueltas')
                .update({ cantidad_aprobada: Number(existente.cantidad_aprobada) + g.count })
                .eq('id', existente.id)
        } else {
            await supabase.from('partidas_resueltas').insert({
                id_partida_entrada: g.idPartida,
                id_marca: g.idMarca,
                atributos: g.atributos,
                cantidad_aprobada: g.count,
                creado_por: sesion.userId,
                // id_producto NULL — lo resuelve ALMACÉN por huella.
            })
        }
    }

    // NS de piezas PASA (serializadas) — sin SKU (lo asigna Almacén).
    for (const p of pasa) {
        if (p.ns) {
            await supabase.from('numeros_serie').insert({
                ns: p.ns,
                id_entrada: input.id_entrada,
                creado_por: sesion.userId,
            })
        }
    }

    // NO_PASA agrupadas por (partida, motivo) → devoluciones_entrada.
    const gruposNoPasa = new Map<string, { count: number; salud: number | null }>()
    for (const p of noPasa) {
        const k = `${p.id_partida_entrada}|${p.id_motivo ?? ''}`
        const g = gruposNoPasa.get(k) ?? { count: 0, salud: null }
        g.count += 1
        if (p.porcentaje_salud != null) g.salud = p.porcentaje_salud
        gruposNoPasa.set(k, g)
    }
    for (const [k, g] of gruposNoPasa) {
        const [idPartida, idMotivo] = k.split('|')
        const { data: existente } = await supabase
            .from('devoluciones_entrada')
            .select('id, cantidad')
            .eq('id_partida_entrada', idPartida)
            .eq('id_motivo', idMotivo)
            .maybeSingle()
        if (existente) {
            await supabase
                .from('devoluciones_entrada')
                .update({ cantidad: Number(existente.cantidad) + g.count })
                .eq('id', existente.id)
        } else {
            await supabase.from('devoluciones_entrada').insert({
                id_entrada: input.id_entrada,
                id_partida_entrada: idPartida,
                id_motivo: idMotivo || null,
                cantidad: g.count,
                porcentaje_salud: g.salud,
                estado: 'por_cotejar',
                creado_por: sesion.userId,
            })
        }
    }

    // Cierre de partida (aprobadas + devueltas >= original → OK | MAL).
    const partidasAfectadas = new Set(input.piezas.map((p) => p.id_partida_entrada))
    for (const idPartida of partidasAfectadas) {
        const { data: partida } = await supabase.from('partidas_entrada').select('cantidad_original').eq('id', idPartida).single()
        if (!partida) continue
        const [{ data: resueltas }, { data: devs }] = await Promise.all([
            supabase.from('partidas_resueltas').select('cantidad_aprobada').eq('id_partida_entrada', idPartida),
            supabase.from('devoluciones_entrada').select('cantidad').eq('id_partida_entrada', idPartida),
        ])
        const totalOk = (resueltas ?? []).reduce((s, r) => s + Number(r.cantidad_aprobada), 0)
        const totalMal = (devs ?? []).reduce((s, d) => s + Number(d.cantidad), 0)
        if (totalOk + totalMal >= Number(partida.cantidad_original)) {
            await supabase.from('partidas_entrada').update({ estado_partida: totalMal > 0 ? 'MAL' : 'OK' }).eq('id', idPartida)
        }
    }

    // Cierre automático de la entrada (fn_cerrar_revision).
    await supabase.rpc('fn_cerrar_revision', { p_id_entrada: input.id_entrada })

    return { success: true }
}

/** id del estado de pago "pendiente" (espejo del helper local de 1.4). */
async function idEstadoPagoPendiente(
    supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
    const { data } = await supabase.from('estados_pago').select('id').eq('clave', 'pendiente').limit(1).maybeSingle()
    return data?.id ?? null
}

/** Compone la línea soft (categoría + atributos `en_entrada`/`derivado_de`) para la nota del flujo. */
function lineaSoftDe(
    categoria: { nombre: string | null; esquema_atributos: AtributoEsquema[] | null } | null,
    atributos: Record<string, unknown> | null
): string {
    const nombre = categoria?.nombre ?? 'Sin categoría'
    const esquema = categoria?.esquema_atributos ?? []
    const valores = esquema
        .filter((a) => (a.en_entrada || a.derivado_de) && !a.valor_default)
        .map((a) => atributos?.[a.clave])
        .filter((v) => v !== null && v !== undefined && v !== '')
    return [nombre, ...valores.map(String)].join(' ')
}

/** Ajustar DEV (valida) + generar nota de compra por las aprobadas. Transaccional. */
export async function ajustarYGenerarNota(
    idEntrada: string
): Promise<RespuestaDato<{ id: string; folio: string }>> {
    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }

    const { data: entrada } = await supabase
        .from('entradas')
        .select('id_proveedor, estado, id_nota')
        .eq('id', idEntrada)
        .single()
    if (!entrada) return { success: false, error: 'La entrada no existe.' }
    if (!['revisada_sin_dev', 'con_dev'].includes(entrada.estado)) {
        return { success: false, error: 'La entrada aún no está lista para ajustar/nota.' }
    }
    if (entrada.id_nota) return { success: false, error: 'Esta entrada ya tiene nota de compra.' }

    // Partidas declaradas (línea soft: categoría + atributos). La nota NO usa el SKU
    // (se resuelve en Almacén, decisión 17): describe la línea tal como se recibió.
    const { data: partidas } = await supabase
        .from('partidas_entrada')
        .select('id, id_categoria, categorias_producto(nombre, esquema_atributos), atributos, cantidad_original, costo_acordado')
        .eq('id_entrada', idEntrada)

    // Marcar devoluciones como ajustadas + cantidad_vigente por partida.
    const { data: devoluciones } = await supabase
        .from('devoluciones_entrada')
        .select('id, id_partida_entrada, cantidad')
        .eq('id_entrada', idEntrada)
        .eq('estado', 'por_cotejar')
    for (const d of (devoluciones ?? [])) {
        await supabase
            .from('devoluciones_entrada')
            .update({ estado: 'ajustada', ajustado_por: sesion.userId, fecha_ajuste: new Date().toISOString() })
            .eq('id', d.id)
    }
    const devPorPartida = new Map<string, number>()
    for (const d of (devoluciones ?? [])) {
        devPorPartida.set(d.id_partida_entrada, (devPorPartida.get(d.id_partida_entrada) ?? 0) + Number(d.cantidad))
    }
    // Líneas de la nota = partidas declaradas con piezas vigentes (aprobadas), como LÍNEA SOFT.
    const filas = (partidas ?? []) as unknown as Array<{
        id: string
        categorias_producto: { nombre: string | null; esquema_atributos: AtributoEsquema[] | null } | null
        atributos: Record<string, unknown> | null
        cantidad_original: number
        costo_acordado: number
    }>
    const lineas = filas
        .map((p) => {
            const dev = devPorPartida.get(p.id) ?? 0
            const vigente = Math.max(0, Number(p.cantidad_original) - dev)
            return {
                id_partida: p.id,
                descripcion: lineaSoftDe(p.categorias_producto, p.atributos),
                cantidad: vigente,
                costo_acordado: Number(p.costo_acordado),
            }
        })
        .filter((l) => l.cantidad > 0)

    // Persistir cantidad_vigente (original inmutable · vigente derivada).
    for (const l of lineas) {
        await supabase
            .from('partidas_entrada')
            .update({ cantidad_vigente: l.cantidad })
            .eq('id', l.id_partida)
    }

    if (lineas.length === 0) {
        return { success: false, error: 'No hay piezas aprobadas para generar la nota.' }
    }

    // Generar la nota de compra (folio NC · partidas por línea soft valorizada a costo).
    const { data: folio, error: errFolio } = await supabase.rpc('generar_folio', { p_tipo: 'nota_compra' })
    if (errFolio || !folio) return { success: false, error: errFolio?.message ?? 'No se pudo generar el folio.' }
    const idPendiente = await idEstadoPagoPendiente(supabase)
    if (!idPendiente) return { success: false, error: 'El catálogo de estados de pago no está disponible.' }

    const total = lineas
        .reduce((acc, l) => acc.plus(new Decimal(l.costo_acordado).times(l.cantidad)), new Decimal(0))
        .toNumber()

    const { data: nota, error: errNota } = await supabase
        .from('notas_compra')
        .insert({
            folio,
            id_proveedor: entrada.id_proveedor,
            origen: 'flujo',
            id_entrada: idEntrada,
            fecha_nota: new Date().toISOString().slice(0, 10),
            estado_fisico: 'por_recibir',
            id_estado_pago: idPendiente,
            total,
            saldo_pendiente: total,
            creado_por: sesion.userId,
        })
        .select('id, folio')
        .single()
    if (errNota) return { success: false, error: errNota.message }

    for (let i = 0; i < lineas.length; i++) {
        const l = lineas[i]
        const { error: errP } = await supabase.from('partidas_nota').insert({
            id_nota: nota.id,
            id_producto: null,
            descripcion: l.descripcion,
            cantidad: l.cantidad,
            costo_acordado: l.costo_acordado,
            subtotal_partida: new Decimal(l.costo_acordado).times(l.cantidad).toNumber(),
            orden: i + 1,
        })
        if (errP) return { success: false, error: errP.message }
    }

    // Ligar la nota a la entrada + marcar ajustada.
    await supabase.from('entradas').update({ id_nota: nota.id, estado: 'ajustada' }).eq('id', idEntrada)

    return { success: true, data: { id: nota.id, folio: nota.folio } }
}

/** Tomar para acondicionamiento (ajustada · o recién_creada sin revisión) → en_acondicionamiento. */
export async function tomarAcondicionamiento(idEntrada: string): Promise<RespuestaAccion> {
    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }

    const { data: entrada } = await supabase.from('entradas').select('estado, es_sin_revision').eq('id', idEntrada).single()
    if (!entrada) return { success: false, error: 'La entrada no existe.' }
    const puedeTomar = entrada.estado === 'ajustada' || (entrada.estado === 'recien_creada' && entrada.es_sin_revision)
    if (!puedeTomar) return { success: false, error: 'La entrada no está por acondicionar.' }

    const { error } = await supabase.from('transiciones_etapa').insert({
        id_entrada: idEntrada,
        desde_estado: entrada.estado,
        hacia_estado: 'en_acondicionamiento',
        actor_id: sesion.userId,
        creado_por: sesion.userId,
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
}

/** Completar acondicionamiento → en_almacén (listo para cotejo). */
export async function completarAcondicionamiento(idEntrada: string): Promise<RespuestaAccion> {
    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }

    const { data: entrada } = await supabase.from('entradas').select('estado').eq('id', idEntrada).single()
    if (!entrada) return { success: false, error: 'La entrada no existe.' }
    if (entrada.estado !== 'en_acondicionamiento') return { success: false, error: 'La entrada no está en acondicionamiento.' }

    const { error } = await supabase.from('transiciones_etapa').insert({
        id_entrada: idEntrada,
        desde_estado: 'en_acondicionamiento',
        hacia_estado: 'en_almacen',
        actor_id: sesion.userId,
        creado_por: sesion.userId,
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
}

/** Abrir cotejo de alta: la HUELLA por grupo aprobado (el SKU lo resuelve el almacenista). */
export async function abrirCotejoAlta(idEntrada: string): Promise<RespuestaDato<{ lineas: CotejoLinea[] }>> {
    const supabase = await createClient()
    const { data: partidas } = await supabase
        .from('partidas_entrada')
        .select('id, id_categoria, costo_acordado')
        .eq('id_entrada', idEntrada)
    const porPartida = new Map<string, { id_categoria: string | null; costo: number }>()
    for (const p of (partidas ?? [])) {
        porPartida.set(p.id, { id_categoria: p.id_categoria, costo: Number(p.costo_acordado) })
    }
    const ids = (partidas ?? []).map((p) => p.id)
    const { data: resueltas } = ids.length
        ? await supabase
              .from('partidas_resueltas')
              .select(
                  'id, id_partida_entrada, id_marca, marcas_producto(nombre), id_producto, productos(sku, nombre), cantidad_aprobada, atributos'
              )
              .in('id_partida_entrada', ids)
        : { data: [] }
    const lineas = ((resueltas ?? []) as unknown as {
        id: string
        id_partida_entrada: string
        id_marca: string | null
        marcas_producto: { nombre: string | null } | null
        id_producto: string | null
        productos: { sku: string | null; nombre: string | null } | null
        cantidad_aprobada: number
        atributos: Record<string, unknown>
    }[]).map((r) => ({
        id_partida_resuelta: r.id,
        id_categoria: porPartida.get(r.id_partida_entrada)?.id_categoria ?? null,
        id_marca: r.id_marca,
        marca_nombre: r.marcas_producto?.nombre ?? null,
        atributos: r.atributos ?? {},
        id_producto: r.id_producto,
        sku: r.productos?.sku ?? '',
        nombre: r.productos?.nombre ?? '',
        cantidad_aprobada: Number(r.cantidad_aprobada),
        costo_acordado: porPartida.get(r.id_partida_entrada)?.costo ?? 0,
    }))
    return { success: true, data: { lineas } }
}

/** Confirmar alta: lote + movimiento entrada por línea (único punto que sube stock) + nota recibida. */
export async function confirmarAlta(input: ConfirmarAltaInput): Promise<RespuestaAccion> {
    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }

    const { data: entrada } = await supabase.from('entradas').select('estado, id_nota').eq('id', input.id_entrada).single()
    if (!entrada) return { success: false, error: 'La entrada no existe.' }
    if (entrada.estado !== 'en_almacen') return { success: false, error: 'La entrada no está por cotejar.' }
    if (input.lineas.length === 0) return { success: false, error: 'No hay líneas por ingresar.' }

    for (const l of input.lineas) {
        // ⭐ El almacenista resolvió el SKU: se persiste en la huella (partidas_resueltas).
        if (l.id_partida_resuelta) {
            await supabase
                .from('partidas_resueltas')
                .update({ id_producto: l.id_producto })
                .eq('id', l.id_partida_resuelta)
        }
        if (l.cantidad_fisica <= 0) continue
        const { data: lote, error: errLote } = await supabase
            .from('lotes')
            .insert({
                id_producto: l.id_producto,
                cantidad_original: l.cantidad_fisica,
                cantidad_disponible: l.cantidad_fisica,
                costo_unitario: l.costo_acordado,
                fecha_entrada: new Date().toISOString(),
                origen_tabla: 'entradas',
                origen_id: input.id_entrada,
                creado_por: sesion.userId,
            })
            .select('id')
            .single()
        if (errLote) return { success: false, error: errLote.message }

        const { data: producto } = await supabase.from('productos').select('stock_actual').eq('id', l.id_producto).single()
        const stockAnterior = Number(producto?.stock_actual ?? 0)
        const { error: errMov } = await supabase.from('movimientos_inventario').insert({
            id_producto: l.id_producto,
            id_lote: lote.id,
            tipo_movimiento: 'entrada',
            cantidad: l.cantidad_fisica,
            stock_anterior: stockAnterior,
            stock_resultante: stockAnterior + l.cantidad_fisica,
            costo_unitario: l.costo_acordado,
            origen_tabla: 'lote',
            origen_id: lote.id,
            creado_por: sesion.userId,
        })
        if (errMov) return { success: false, error: errMov.message }
    }

    if (entrada.id_nota) {
        await supabase.from('notas_compra').update({ estado_fisico: 'recibida' }).eq('id', entrada.id_nota)
    }
    await supabase.rpc('fn_confirmar_alta', { p_id_entrada: input.id_entrada })

    return { success: true }
}

/** Reportar divergencia en cotejo → bloquea la entrada (tr_divergencias_bloqueo). */
export async function generarDivergencia(input: {
    id_entrada: string
    cantidad_esperada: number
    cantidad_encontrada: number
    id_causa: string
    responsable?: string
}): Promise<RespuestaAccion> {
    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }

    const { error } = await supabase.from('divergencias').insert({
        id_entrada: input.id_entrada,
        cantidad_esperada: input.cantidad_esperada,
        cantidad_encontrada: input.cantidad_encontrada,
        id_causa: input.id_causa,
        responsable: input.responsable || null,
        estado: 'abierta',
        creado_por: sesion.userId,
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
}

/** Divergencias (todas · la última primero). */
export async function listarDivergencias(): Promise<RespuestaLista<Divergencia>> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('divergencias')
        .select(
            'id, id_entrada, entradas(folio), cantidad_esperada, cantidad_encontrada, id_causa, causas_divergencia(nombre), responsable, cantidad_autorizada, estado, creado_por, created_at'
        )
        .order('created_at', { ascending: false })
        .limit(500)
    if (error) return { success: false, error: error.message }
    const filas = ((data ?? []) as unknown as {
        id: string
        id_entrada: string
        entradas: { folio: string } | null
        cantidad_esperada: number
        cantidad_encontrada: number
        id_causa: string
        causas_divergencia: { nombre: string } | null
        responsable: string | null
        cantidad_autorizada: number | null
        estado: string
        creado_por: string | null
        created_at: string
    }[]).map((d) => ({
        id: d.id,
        id_entrada: d.id_entrada,
        entrada_folio: d.entradas?.folio ?? null,
        cantidad_esperada: d.cantidad_esperada,
        cantidad_encontrada: d.cantidad_encontrada,
        id_causa: d.id_causa,
        causa_nombre: d.causas_divergencia?.nombre ?? null,
        responsable: d.responsable,
        cantidad_autorizada: d.cantidad_autorizada,
        estado: d.estado as Divergencia['estado'],
        creado_por: d.creado_por,
        created_at: d.created_at,
    }))
    return { success: true, data: filas as Divergencia[] }
}

/** Resolver divergencia (admin): escribe el alta con la cantidad autorizada + confirmada. */
export async function resolverDivergencia(
    idDivergencia: string,
    lineas: ConfirmarAltaInput['lineas']
): Promise<RespuestaAccion> {
    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }

    const { data: divergencia } = await supabase
        .from('divergencias')
        .select('id_entrada, estado')
        .eq('id', idDivergencia)
        .single()
    if (!divergencia) return { success: false, error: 'La divergencia no existe.' }
    if (divergencia.estado !== 'abierta') return { success: false, error: 'La divergencia ya fue resuelta.' }

    for (const l of lineas) {
        if (l.id_partida_resuelta) {
            await supabase
                .from('partidas_resueltas')
                .update({ id_producto: l.id_producto })
                .eq('id', l.id_partida_resuelta)
        }
        if (l.cantidad_fisica <= 0) continue
        const { data: lote, error: errLote } = await supabase
            .from('lotes')
            .insert({
                id_producto: l.id_producto,
                cantidad_original: l.cantidad_fisica,
                cantidad_disponible: l.cantidad_fisica,
                costo_unitario: l.costo_acordado,
                fecha_entrada: new Date().toISOString(),
                origen_tabla: 'entradas',
                origen_id: divergencia.id_entrada,
                creado_por: sesion.userId,
            })
            .select('id')
            .single()
        if (errLote) return { success: false, error: errLote.message }

        const { data: producto } = await supabase.from('productos').select('stock_actual').eq('id', l.id_producto).single()
        const stockAnterior = Number(producto?.stock_actual ?? 0)
        const { error: errMov } = await supabase.from('movimientos_inventario').insert({
            id_producto: l.id_producto,
            id_lote: lote.id,
            tipo_movimiento: 'entrada',
            cantidad: l.cantidad_fisica,
            stock_anterior: stockAnterior,
            stock_resultante: stockAnterior + l.cantidad_fisica,
            costo_unitario: l.costo_acordado,
            origen_tabla: 'lote',
            origen_id: lote.id,
            creado_por: sesion.userId,
        })
        if (errMov) return { success: false, error: errMov.message }
    }

    await supabase.from('divergencias').update({ estado: 'resuelta' }).eq('id', idDivergencia)
    await supabase.rpc('fn_confirmar_alta', { p_id_entrada: divergencia.id_entrada })

    return { success: true }
}
