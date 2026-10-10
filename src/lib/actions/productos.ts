'use server'

// ═══════════════════════════════════════════════════════════════════════════════
// SERVER ACTIONS — PRODUCTOS (Guía 1.2)
// 'use server' en la línea 1. Retornan objetos tipados — NUNCA throw.
// Parte 2: listarProductos · obtenerProducto · Parte 3: crearProducto ·
// listarMarcasPorCategoria · crearMarcaConCategorias · buscarClaveSAT.
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/server'
import { describirError, describirErrorTexto } from '@/lib/utils/errores'
import {
    convertirAtributosCrudos,
    productoSchema,
    validarAtributosContraEsquema,
} from '@/lib/validations/productos'
import type { AtributoEsquema } from '@/types/catalogos'
import type {
    ClaveSAT,
    FiltrosProductosActivos,
    OpcionCategoriaSelector,
    Producto,
    ProductoFiltros,
    ProductoOpcion,
    RespuestaAccion,
    RespuestaDato,
    RespuestaLista,
    ValorAtributo,
} from '@/types/productos'

// Forma cruda del embed PostgREST (igual que Parte 2).
interface FilaProductoCruda {
    id: string
    sku: string
    codigo_barras: string | null
    nombre: string
    modelo: string | null
    descripcion: string | null
    marca_fabricante: string | null
    id_marca: string | null
    id_categoria: string | null
    id_unidad_medida: string
    id_impuesto: string
    atributos: Record<string, unknown>
    precio_base: number
    precio_minimo: number | null
    costo_promedio: number
    stock_actual: number
    stock_minimo: number
    id_ubicacion_default: string | null
    maneja_numero_serie: boolean
    requiere_revision: boolean
    pendiente_enriquecimiento: boolean
    id_clave_prod_serv_sat: string | null
    id_clave_unidad_sat: string | null
    imagen_url: string | null
    notas: string | null
    es_activo: boolean
    es_archivado: boolean
    created_at: string
    updated_at: string
    creado_por: string | null
    actualizado_por: string | null
    marcas_producto: { nombre: string } | null
    categorias_producto: { nombre: string } | null
    unidades_medida: { nombre: string } | null
    impuestos: { clave: string; nombre: string } | null
    ubicaciones_almacen: { rack: string; nivel: string; organizador: string; charola: string } | null
    sat_claves_prod_serv: { descripcion: string } | null
    sat_claves_unidad: { nombre: string } | null
}

const COLUMNAS = [
    'id', 'sku', 'codigo_barras', 'nombre', 'modelo', 'descripcion', 'marca_fabricante',
    'id_marca', 'id_categoria', 'id_unidad_medida', 'id_impuesto', 'atributos',
    'precio_base', 'precio_minimo', 'costo_promedio', 'stock_actual', 'stock_minimo',
    'id_ubicacion_default', 'maneja_numero_serie', 'requiere_revision',
    'pendiente_enriquecimiento', 'id_clave_prod_serv_sat', 'id_clave_unidad_sat',
    'imagen_url', 'notas', 'es_activo', 'es_archivado', 'created_at', 'updated_at',
    'creado_por', 'actualizado_por',
    'marcas_producto(nombre)', 'categorias_producto(nombre)',
    'unidades_medida(nombre)', 'impuestos(clave,nombre)',
    'ubicaciones_almacen(rack,nivel,organizador,charola)',
    'sat_claves_prod_serv(descripcion)', 'sat_claves_unidad(nombre)',
].join(',')

function aFila(p: FilaProductoCruda): Producto {
    return {
        id: p.id,
        sku: p.sku,
        codigo_barras: p.codigo_barras,
        nombre: p.nombre,
        modelo: p.modelo,
        descripcion: p.descripcion,
        marca_fabricante: p.marca_fabricante,
        id_marca: p.id_marca,
        marca_nombre: p.marcas_producto?.nombre ?? null,
        id_categoria: p.id_categoria,
        categoria_nombre: p.categorias_producto?.nombre ?? null,
        unidad_nombre: p.unidades_medida?.nombre ?? null,
        impuesto_nombre: p.impuestos ? `${p.impuestos.nombre}` : null,
        ubicacion_texto: p.ubicaciones_almacen
            ? `${p.ubicaciones_almacen.rack} / ${p.ubicaciones_almacen.nivel} / ${p.ubicaciones_almacen.organizador} / ${p.ubicaciones_almacen.charola}`
            : null,
        sat_prod_descripcion: p.sat_claves_prod_serv?.descripcion ?? null,
        sat_unid_nombre: p.sat_claves_unidad?.nombre ?? null,
        id_unidad_medida: p.id_unidad_medida,
        id_impuesto: p.id_impuesto,
        atributos: p.atributos as Producto['atributos'],
        precio_base: p.precio_base,
        precio_minimo: p.precio_minimo,
        costo_promedio: p.costo_promedio,
        stock_actual: p.stock_actual,
        stock_minimo: p.stock_minimo,
        id_ubicacion_default: p.id_ubicacion_default,
        maneja_numero_serie: p.maneja_numero_serie,
        requiere_revision: p.requiere_revision,
        pendiente_enriquecimiento: p.pendiente_enriquecimiento,
        id_clave_prod_serv_sat: p.id_clave_prod_serv_sat,
        id_clave_unidad_sat: p.id_clave_unidad_sat,
        imagen_url: p.imagen_url,
        notas: p.notas,
        es_activo: p.es_activo,
        es_archivado: p.es_archivado,
        created_at: p.created_at,
        updated_at: p.updated_at,
        creado_por: p.creado_por,
        actualizado_por: p.actualizado_por,
    }
}

function aNull(v: string): string | null {
    const t = v.trim()
    return t ? t : null
}

/** Monto del formulario ('' → 0) — CHECK ≥ 0 ya validado por el schema. */
function aMonto(v: string): number {
    const t = v.trim()
    return t === '' ? 0 : Number(t)
}

/** Clave de unidad SAT derivada de la unidad de medida (MEJORA 04 Sep · usuario):
 * unidades_medida.clave_sat → sat_claves_unidad.clave (H87=Pieza, XBX=Caja…). Con
 * esto el formulario pregunta la unidad UNA sola vez (Inventario). */
async function resolverClaveUnidadSAT(
    supabase: Awaited<ReturnType<typeof createClient>>,
    idUnidadMedida: string
): Promise<string | null> {
    const { data: unidad } = await supabase
        .from('unidades_medida')
        .select('clave_sat')
        .eq('id', idUnidadMedida)
        .maybeSingle()
    const claveSat = (unidad as { clave_sat?: string | null } | null)?.clave_sat
    if (!claveSat) return null
    const { data: sat } = await supabase
        .from('sat_claves_unidad')
        .select('id')
        .eq('clave', claveSat)
        .maybeSingle()
    return (sat as { id?: string } | null)?.id ?? null
}

function traducirErrorProducto(codigo: string | undefined, mensaje: string): string {
    if (codigo === '23505') {
        /**
         * ⭐ FIX 08 Oct 2026 (VF del dueño) — **el `23505` NO siempre es el código de barras.**
         *
         * `productos` tiene **TRES** índices únicos —`productos_sku_key` · `productos_codigo_barras_unique`
         * (parcial) y `uq_productos_clave_huella` (parcial)— y este traductor culpaba **siempre** al
         * código de barras. El dueño lo reportó con sus palabras: *«me dice que ya hay un producto con
         * ese código de barras (**dato que no hemos visto**) y no es determinante para el SKU»* — la
         * colisión real era la **huella** (el mismo producto capturado dos veces). Un mensaje que
         * nombra el campo equivocado manda a revisar donde no es.
         *
         * ⇒ Se lee la **restricción** del mensaje del motor (PostgREST la incluye) y se dice la verdad.
         * Si el motor no la nombra, el mensaje enumera las tres sin mentir.
         */
        if (mensaje.includes('uq_productos_clave_huella')) {
            return 'Ya existe un producto con ESA MISMA HUELLA (misma categoría, marca y atributos). Búscalo en el catálogo en vez de crearlo otra vez.'
        }
        if (mensaje.includes('productos_codigo_barras_unique')) {
            return 'Ya existe un producto con ese código de barras.'
        }
        if (mensaje.includes('productos_sku_key')) return 'Ya existe un producto con ese SKU.'
        return 'Ese producto ya existe: el SKU, el código de barras o la huella están repetidos.'
    }
    if (codigo === '23503') return 'Alguna referencia seleccionada no existe (marca/categoría/impuesto).'
    if (codigo === '42501') return 'No tienes permiso para realizar esta acción.'
    return describirError({ message: mensaje, code: codigo }) ?? mensaje
}

/** Esquema efectivo de la categoría: el de la fila si no está vacío; si la fila es
 * subcategoría sin esquema, el de su raíz (regla D16 — MODELO_DATOS §7.3.2). */
async function esquemaDeCategoria(
    supabase: Awaited<ReturnType<typeof createClient>>,
    idCategoria: string
): Promise<{ esquema: AtributoEsquema[]; error: string | null }> {
    const { data: categoria, error } = await supabase
        .from('categorias_producto')
        .select('id_categoria_padre, esquema_atributos')
        .eq('id', idCategoria)
        .maybeSingle()
    if (error || !categoria) return { esquema: [], error: describirError(error) ?? 'La categoría no existe.' }
    const propio = (categoria.esquema_atributos ?? []) as AtributoEsquema[]
    if (propio.length > 0) return { esquema: propio, error: null }
    if (categoria.id_categoria_padre) {
        const { data: padre } = await supabase
            .from('categorias_producto')
            .select('esquema_atributos')
            .eq('id', categoria.id_categoria_padre)
            .maybeSingle()
        const heredado = ((padre?.esquema_atributos ?? []) as AtributoEsquema[]) ?? []
        return { esquema: heredado, error: null }
    }
    // Raíz sin esquema y sin hijos no tiene hoja capturable: categoría mal definida.
    return { esquema: [], error: null }
}

// ── Listar (Parte 2 · PLAN §4) ─────────────────────────────────────────────────
export async function listarProductos(
    filtros: ProductoFiltros
): Promise<RespuestaLista<Producto>> {
    const supabase = await createClient()

    let query = supabase.from('productos').select(COLUMNAS)

    if (filtros.estado === 'activo') {
        query = query.eq('es_archivado', false).eq('es_activo', true)
    } else if (filtros.estado === 'archivados') {
        query = query.eq('es_archivado', true)
    }

    if (filtros.solo_pendientes) query = query.eq('pendiente_enriquecimiento', true)

    if (filtros.id_marca) query = query.eq('id_marca', filtros.id_marca)

    if (filtros.id_categoria) {
        const { data: hijos } = await supabase
            .from('categorias_producto')
            .select('id')
            .eq('id_categoria_padre', filtros.id_categoria)
        const ids = [filtros.id_categoria, ...(hijos ?? []).map((h) => h.id)]
        query = query.in('id_categoria', ids)
    }

    const busqueda = filtros.busqueda.trim().replace(/[%_]/g, '')
    if (busqueda) {
        query = query.or(
            `nombre.ilike.%${busqueda}%,modelo.ilike.%${busqueda}%,sku.ilike.%${busqueda}%,codigo_barras.ilike.%${busqueda}%`
        )
    }

    const { data, error } = await query.order('nombre', { ascending: true })
    if (error) return { success: false, error: describirError(error) }

    const productos = ((data ?? []) as unknown as FilaProductoCruda[]).map(aFila)
    return { success: true, data: productos }
}

// ── Obtener uno (Parte 2 · ficha/deep link) ────────────────────────────────────
export async function obtenerProducto(id: string): Promise<RespuestaDato<Producto>> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('productos')
        .select(COLUMNAS)
        .eq('id', id)
        .maybeSingle()

    if (error) return { success: false, error: describirError(error) }
    if (!data) return { success: false, error: 'El producto no existe.' }

    return { success: true, data: aFila(data as unknown as FilaProductoCruda) }
}

// ── Crear (Parte 3 · folio P-###### · validación contra el esquema de la categoría)
export async function crearProducto(
    input: unknown
): Promise<RespuestaDato<{ id: string; sku: string; existente?: boolean }>> {
    const parsed = productoSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
    }
    const d = parsed.data

    const supabase = await createClient()
    const { data: sesion } = await supabase.auth.getUser()
    if (!sesion.user) return { success: false, error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }

    // Esquema de la categoría elegida + atributos convertidos y validados (D16).
    const { esquema, error: errEsquema } = await esquemaDeCategoria(supabase, d.id_categoria)
    if (errEsquema) return { success: false, error: errEsquema }
    const atributos = convertirAtributosCrudos(d.atributos, esquema)
    const erroresAtributos = validarAtributosContraEsquema(atributos, esquema)
    if (erroresAtributos.length > 0) {
        return { success: false, error: erroresAtributos[0] }
    }

    // Folio (b4): generar_folio es SECURITY DEFINER con EXECUTE para authenticated.
    const { data: sku, error: errFolio } = await supabase.rpc('generar_folio', {
        p_tipo: 'producto',
    })
    if (errFolio || !sku) {
        return {
            success: false,
            error: describirError(errFolio) ?? 'No se pudo generar el SKU del producto.',
        }
    }

    // Clave de unidad SAT derivada de la unidad de medida elegida (MEJORA 04 Sep).
    const claveUnidadSat = d.id_clave_unidad_sat.trim()
        ? aNull(d.id_clave_unidad_sat)
        : await resolverClaveUnidadSAT(supabase, d.id_unidad_medida)

    const { data: fila, error } = await supabase
        .from('productos')
        .insert({
            sku,
            codigo_barras: aNull(d.codigo_barras),
            nombre: d.nombre,
            modelo: aNull(d.modelo),
            descripcion: aNull(d.descripcion),
            id_marca: d.id_marca,
            id_categoria: d.id_categoria,
            id_unidad_medida: d.id_unidad_medida,
            id_impuesto: d.id_impuesto,
            atributos,
            precio_base: aMonto(d.precio_base),
            precio_minimo: d.precio_minimo.trim() === '' ? null : aMonto(d.precio_minimo),
            stock_minimo: aMonto(d.stock_minimo),
            id_ubicacion_default: aNull(d.id_ubicacion_default),
            maneja_numero_serie: d.maneja_numero_serie,
            requiere_revision: d.requiere_revision,
            id_clave_prod_serv_sat: aNull(d.id_clave_prod_serv_sat),
            id_clave_unidad_sat: claveUnidadSat,
            imagen_url: aNull(d.imagen_url),
            notas: aNull(d.notas),
            es_activo: d.es_activo,
            creado_por: sesion.user.id,
        })
        .select('id, sku')
        .single()

    if (error) {
        /**
         * ⭐ FIX 08 Oct 2026 (VF del dueño) — **si el rebote es la HUELLA, se REUTILIZA el producto.**
         *
         * Es la doctrina que el módulo ya tiene escrita en `crearProductoRapido` (R54): la BD es la
         * autoridad y el índice único `uq_productos_clave_huella` **es** la garantía. Rebotar con un
         * error dejaba al puesto atorado (el cotejo no podía cerrar el alta) y encima le hablaba de un
         * campo que nadie capturó. Se resuelve por la **CLAVE** —la misma regla de la BD— y se
         * devuelve el existente con `existente: true`, igual que el alta rápida: **el que abrió el
         * formulario lo deja seleccionado y sigue**.
         */
        if (error.code === '23505' && error.message.includes('uq_productos_clave_huella')) {
            const { data: existente } = await supabase.rpc('producto_por_clave_huella', {
                p_id_categoria: d.id_categoria,
                p_id_marca: d.id_marca,
                p_atributos: atributos,
            })
            const fila = (Array.isArray(existente) ? existente[0] : null) as
                | { id: string; sku: string }
                | null
            if (fila) return { success: true, data: { id: fila.id, sku: fila.sku, existente: true } }
        }
        return { success: false, error: traducirErrorProducto(error.code, error.message) }
    }
    return { success: true, data: { id: fila.id as string, sku: fila.sku as string } }
}

// ── Marcas válidas de una categoría (puente marcas_categorias · herencia raíz→sub)
export async function listarMarcasPorCategoria(
    idCategoria: string
): Promise<
    RespuestaLista<{ id: string; nombre: string; es_activo: boolean; alias: string[] }>
> {
    const supabase = await createClient()

    // Ámbito del puente: la categoría + (si es raíz) sus subs + (si es sub) su raíz.
    const { data: fila } = await supabase
        .from('categorias_producto')
        .select('id_categoria_padre')
        .eq('id', idCategoria)
        .maybeSingle()
    let ids = [idCategoria]
    if (fila?.id_categoria_padre) {
        ids.push(fila.id_categoria_padre)
    } else {
        const { data: hijos } = await supabase
            .from('categorias_producto')
            .select('id')
            .eq('id_categoria_padre', idCategoria)
        ids = [idCategoria, ...(hijos ?? []).map((h) => h.id)]
    }

    const { data, error } = await supabase
        .from('marcas_categorias')
        // ⭐ 09 Oct 2026 (`g12_a6_b1`) — `alias` viaja SIEMPRE: es lo que permite que el nombre con el
        // que el LECTOR nombra a la marca («WD») resuelva a la marca del catálogo («Western Digital»)
        // en vez de crear un duplicado. Ver `WizardRevision.asegurarMarca`.
        .select('marcas_producto(id, nombre, es_activo, alias)')
        .in('id_categoria', ids)
    if (error) return { success: false, error: describirError(error) }

    const vistos = new Map<string, { id: string; nombre: string; es_activo: boolean; alias: string[] }>()
    for (const filaRel of (data ?? []) as unknown as {
        marcas_producto:
            | { id: string; nombre: string; es_activo: boolean; alias: string[] | null }[]
            | { id: string; nombre: string; es_activo: boolean; alias: string[] | null }
            | null
    }[]) {
        const cruda = filaRel.marcas_producto
        const marca = Array.isArray(cruda) ? cruda[0] : cruda
        // `alias` es NOT NULL con default '{}' en la BD; el `?? []` es por el tipo del embed, no por dato.
        if (marca && !vistos.has(marca.id)) vistos.set(marca.id, { ...marca, alias: marca.alias ?? [] })
    }
    const marcas = [...vistos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))
    return { success: true, data: marcas }
}

// ── Las LÍNEAS de una MARCA (catálogo `lineas_producto` · MEJORA 52 · `g12_a5_b1`)
/**
 * ⭐ MEJORA 52 (07 Oct 2026) — **las píldoras de la LÍNEA**.
 *
 * El atributo `linea` (presente en los 33 Tipos, `en_huella: true`, **no requerido**) NO tiene sus
 * valores en el esquema: los saca del **catálogo**, **filtrados por la MARCA elegida** — porque las
 * líneas de Western Digital (Blue · Purple · Black…) **no aplican** a Seagate (Barracuda · IronWolf…).
 * Por eso el esquema marca ese atributo con `opciones_por_marca: true`.
 *
 * Se guarda el **NOMBRE** como texto (no el id): así `fn_clave_huella` sigue leyendo el valor del
 * esquema sin cambiar una línea.
 */
export async function listarLineasPorMarca(
    idMarca: string | null | undefined
): Promise<RespuestaLista<{ id: string; nombre: string }>> {
    if (!idMarca) return { success: true, data: [] }
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('lineas_producto')
        .select('id, nombre')
        .eq('id_marca', idMarca)
        .eq('es_activo', true)
        .order('nombre')
    if (error) return { success: false, error: describirError(error) }
    return {
        success: true,
        data: ((data ?? []) as { id: string; nombre: string }[]).map((l) => ({
            id: l.id,
            nombre: l.nombre,
        })),
    }
}

// ── Crear marca y vincularla a categorías (RPC b6 · marca al vuelo del flujo)
export async function crearMarcaConCategorias(
    nombre: string,
    idCategorias: string[]
): Promise<RespuestaDato<string>> {
    const nombreLimpio = nombre.trim()
    if (!nombreLimpio) return { success: false, error: 'El nombre de la marca es obligatorio.' }

    const supabase = await createClient()
    const { data: idMarca, error } = await supabase.rpc('registrar_marca_con_categorias', {
        p_nombre: nombreLimpio,
        p_id_categorias: idCategorias,
    })
    if (error) {
        if (error.code === 'P0001') return { success: false, error: describirError(error) }
        return { success: false, error: 'No se pudo crear la marca: sin permiso.' }
    }
    return { success: true, data: String(idMarca) }
}

// ── Buscador SAT (clave prod_serv o unidad) · contrato hacia Facturación V2
export async function buscarClaveSAT(
    query: string,
    tipo: 'prod_serv' | 'unidad'
): Promise<RespuestaLista<ClaveSAT>> {
    const supabase = await createClient()
    const tabla = tipo === 'unidad' ? 'sat_claves_unidad' : 'sat_claves_prod_serv'
    const q = query.trim().replace(/[%_]/g, '')
    if (!q) return { success: true, data: [] }

    const { data, error } = await supabase
        .from(tabla)
        .select('*')
        .or(`clave.ilike.%${q}%,${tipo === 'unidad' ? 'nombre' : 'descripcion'}.ilike.%${q}%`)
        .order('clave', { ascending: true })
        .limit(20)

    if (error) return { success: false, error: describirError(error) }
    const claves = (data ?? []).map((f) => ({
        id: (f as { id: string }).id,
        clave: (f as { clave: string }).clave,
        descripcion:
            (f as { descripcion?: string }).descripcion ?? (f as { nombre?: string }).nombre ?? '',
        nombre: (f as { nombre?: string }).nombre,
    })) as ClaveSAT[]
    return { success: true, data: claves }
}

// ── Editar (Parte 4 · sku inmutable: no participa del UPDATE · actualizado_por)
export async function editarProducto(
    id: string,
    input: unknown
): Promise<RespuestaAccion> {
    const parsed = productoSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
    }
    const d = parsed.data

    const supabase = await createClient()
    const { data: sesion } = await supabase.auth.getUser()
    if (!sesion.user) return { success: false, error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }

    // Esquema de la categoría elegida + atributos convertidos y validados (D16).
    const { esquema, error: errEsquema } = await esquemaDeCategoria(supabase, d.id_categoria)
    if (errEsquema) return { success: false, error: errEsquema }
    const atributos = convertirAtributosCrudos(d.atributos, esquema)
    const erroresAtributos = validarAtributosContraEsquema(atributos, esquema)
    if (erroresAtributos.length > 0) {
        return { success: false, error: erroresAtributos[0] }
    }

    // Clave de unidad SAT derivada de la unidad de medida elegida (MEJORA 04 Sep).
    const claveUnidadSat = d.id_clave_unidad_sat.trim()
        ? aNull(d.id_clave_unidad_sat)
        : await resolverClaveUnidadSAT(supabase, d.id_unidad_medida)

    const { error } = await supabase
        .from('productos')
        .update({
            codigo_barras: aNull(d.codigo_barras),
            nombre: d.nombre,
            modelo: aNull(d.modelo),
            descripcion: aNull(d.descripcion),
            id_marca: d.id_marca,
            id_categoria: d.id_categoria,
            id_unidad_medida: d.id_unidad_medida,
            id_impuesto: d.id_impuesto,
            atributos,
            precio_base: aMonto(d.precio_base),
            precio_minimo: d.precio_minimo.trim() === '' ? null : aMonto(d.precio_minimo),
            stock_minimo: aMonto(d.stock_minimo),
            id_ubicacion_default: aNull(d.id_ubicacion_default),
            maneja_numero_serie: d.maneja_numero_serie,
            requiere_revision: d.requiere_revision,
            id_clave_prod_serv_sat: aNull(d.id_clave_prod_serv_sat),
            id_clave_unidad_sat: claveUnidadSat,
            imagen_url: aNull(d.imagen_url),
            notas: aNull(d.notas),
            es_activo: d.es_activo,
            actualizado_por: sesion.user.id,
        })
        .eq('id', id)

    if (error) return { success: false, error: traducirErrorProducto(error.code, error.message) }
    return { success: true }
}

// ── Estados (Parte 5 · por lote de ids) ────────────────────────────────────────
// Toggle es_activo (lotes rotativos) y soft-delete es_archivado (jamás DELETE).
// La UI las protege con permisos: toggle=editar · archivar=eliminar (mapa §5).
export async function toggleActivoProducto(ids: string[], activo: boolean): Promise<RespuestaAccion> {
    if (ids.length === 0) return { success: false, error: 'Selecciona al menos un producto.' }
    const supabase = await createClient()
    const { error } = await supabase
        .from('productos')
        .update({ es_activo: activo })
        .in('id', ids)
    if (error) return { success: false, error: traducirErrorProducto(error.code, error.message) }
    return { success: true }
}

export async function archivarProducto(ids: string[], archivar: boolean): Promise<RespuestaAccion> {
    if (ids.length === 0) return { success: false, error: 'Selecciona al menos un producto.' }
    const supabase = await createClient()
    const { error } = await supabase
        .from('productos')
        .update({ es_archivado: archivar })
        .in('id', ids)
    if (error) return { success: false, error: traducirErrorProducto(error.code, error.message) }
    return { success: true }
}

// ── Marcar como enriquecido (Parte 6 · banner de la ficha · roles con editar) ──
export async function completarEnriquecimiento(id: string): Promise<RespuestaAccion> {
    const supabase = await createClient()
    const { data: sesion } = await supabase.auth.getUser()
    if (!sesion.user) return { success: false, error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }
    const { error } = await supabase
        .from('productos')
        .update({ pendiente_enriquecimiento: false, actualizado_por: sesion.user.id })
        .eq('id', id)
    if (error) return { success: false, error: traducirErrorProducto(error.code, error.message) }
    return { success: true }
}

// ── Sustitutos (Parte 7 · N:N bidireccional — 2 filas por par, b3) ────────────
export async function listarSustitutos(idProducto: string): Promise<RespuestaLista<ProductoOpcion>> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('productos_sustitutos')
        .select('id_producto_sustituto')
        .eq('id_producto', idProducto)
    if (error) return { success: false, error: describirError(error) }
    const ids = (data ?? []).map((f) => f.id_producto_sustituto as string)
    if (ids.length === 0) return { success: true, data: [] }
    const { data: productos, error: err2 } = await supabase
        .from('productos')
        .select('id, sku, nombre, id_categoria, atributos')
        .in('id', ids)
        .order('nombre', { ascending: true })
    if (err2) return { success: false, error: describirError(err2) }
    return { success: true, data: (productos ?? []) as unknown as ProductoOpcion[] }
}

export async function agregarSustituto(
    idProducto: string,
    idSustituto: string
): Promise<RespuestaAccion> {
    if (idProducto === idSustituto) {
        return { success: false, error: 'Un producto no puede ser sustituto de sí mismo.' }
    }
    const supabase = await createClient()
    const { data: sesion } = await supabase.auth.getUser()
    if (!sesion.user) return { success: false, error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }
    const { error } = await supabase.from('productos_sustitutos').insert([
        { id_producto: idProducto, id_producto_sustituto: idSustituto, creado_por: sesion.user.id },
        { id_producto: idSustituto, id_producto_sustituto: idProducto, creado_por: sesion.user.id },
    ])
    if (error) {
        if (error.code === '23505') return { success: false, error: 'Ya son sustitutos.' }
        return { success: false, error: traducirErrorProducto(error.code, error.message) }
    }
    return { success: true }
}

export async function quitarSustituto(
    idProducto: string,
    idSustituto: string
): Promise<RespuestaAccion> {
    const supabase = await createClient()
    const { error } = await supabase
        .from('productos_sustitutos')
        .delete()
        .or(
            `and(id_producto.eq.${idProducto},id_producto_sustituto.eq.${idSustituto}),` +
                `and(id_producto.eq.${idSustituto},id_producto_sustituto.eq.${idProducto})`
        )
    if (error) return { success: false, error: traducirErrorProducto(error.code, error.message) }
    return { success: true }
}

// ── Búsqueda por huella (Parte 7 · contrato hacia 1.6 — flujo §2.3.3 paso 3) ─
// Resolución EXACTA de SKU por huella canónica: categoría + marca + atributos
// en_huella (claves del esquema de la categoría). Activos, no archivados.
// El caller (1.6) lee el esquema de la categoría, extrae los en_huella y manda
// SOLO esos valores en `atributos`; aquí se filtra cada uno contra el jsonb.
export interface CriteriosBusquedaAtributos {
    id_categoria?: string
    id_marca?: string
    atributos?: Record<string, string | string[]>   // clave → valor (solo los en_huella capturados; `multi` ⇒ string[])
}

export async function buscarProductosPorAtributos(
    criterios: CriteriosBusquedaAtributos
): Promise<RespuestaLista<ProductoOpcion>> {
    const supabase = await createClient()

    let query = supabase
        .from('productos')
        .select('id, sku, nombre, id_categoria, atributos')
        .eq('es_archivado', false)
        .eq('es_activo', true)

    if (criterios.id_categoria) {
        const { data: hijos } = await supabase
            .from('categorias_producto')
            .select('id')
            .eq('id_categoria_padre', criterios.id_categoria)
        const ids = [criterios.id_categoria, ...(hijos ?? []).map((h) => h.id)]
        query = query.in('id_categoria', ids)
    }
    if (criterios.id_marca) query = query.eq('id_marca', criterios.id_marca)

    // Filtros por atributos en_huella (claves del esquema — valor exacto).
    const huella = criterios.atributos ?? {}
    for (const [clave, valor] of Object.entries(huella)) {
        if (valor) query = query.eq(`atributos->>${clave}`, valor)
    }

    /**
     * ⭐ FIX 09 Oct 2026 (decisión del dueño · *«tu recomendación»*) — **LA HUELLA INCOMPLETA NO
     * MATCHEA LO COMPLETO.**
     *
     * El defecto, medido: los filtros de arriba sólo miran **las claves que la huella TRAE**. Una
     * huella **sin `linea`** (el técnico no la eligió —es opcional, R59—) matcheaba igual un producto
     * **con** línea: `WD · PC · 2TB` sin línea encontraba el `WD · PC · 2TB · Purple`. Y el selector de
     * SKU **auto-selecciona cuando hay un solo candidato** ⇒ el sistema daba por bueno un producto
     * **sin haber determinado la línea**, en silencio. Contradice R59 (*«vacía no afecta la huella»*:
     * vacía es **una** huella, no comodín).
     *
     * ⇒ Una clave `en_huella` que la huella **no trae** se exige **ausente** también en el producto.
     * ⚠️ Se resuelve en JS y no con un `IS NULL` de PostgREST a propósito: la autoridad del modelo es
     * **`fn_clave_huella`**, que descarta los valores `null` **y los `''`** (`where valor is not null`)
     * ⇒ `''` y «ausente» son **la MISMA clave** y tienen que ser **el mismo match**. Un `IS NULL` en
     * SQL habría dejado afuera al producto guardado con `linea: ''`.
     *
     * ⚠️ **Lo que NO cambia:** la lista de candidatos sigue acotada a 50 (por nombre) **antes** de este
     * filtro, así que en un catálogo enorme y con una huella muy ambigua un match exacto podría quedar
     * fuera de la ventana. Es aceptable **porque la garantía no vive acá**: el alta de un producto
     * resuelve por la **CLAVE** con `producto_por_clave_huella` (R54) y **reutiliza** — nunca duplica.
     * La búsqueda es comodidad; la BD es la garantía.
     *
     * ⚠️ Y por eso es seguro endurecerla globalmente: sus únicos consumidores son los DOS caminos que
     * necesitan exactitud — el selector de SKU del alta y el find-or-create de `crearProductoRapido`.
     * **Ningún filtro del catálogo la usa.**
     */
    let clavesAusentes: string[] = []
    if (criterios.id_categoria) {
        const { data: cat } = await supabase
            .from('categorias_producto')
            .select('esquema_atributos')
            .eq('id', criterios.id_categoria)
            .maybeSingle()
        clavesAusentes = ((cat?.esquema_atributos ?? []) as AtributoEsquema[])
            .filter((a) => a.en_huella)
            .map((a) => a.clave)
            .filter((k) => !huella[k])
    }

    const { data, error } = await query.order('nombre', { ascending: true }).limit(50)
    if (error) return { success: false, error: describirError(error) }
    const candidatos = (data ?? []) as unknown as (ProductoOpcion & {
        atributos?: Record<string, unknown> | null
    })[]
    const sinValor = (v: unknown): boolean => v === undefined || v === null || String(v).trim() === ''
    const exactos = clavesAusentes.length
        ? candidatos.filter((p) => clavesAusentes.every((k) => sinValor(p.atributos?.[k])))
        : candidatos
    return { success: true, data: exactos as unknown as ProductoOpcion[] }
}

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORT CSV (Parte 8 · acción RBAC 'importar' — solo Administrador, b5)
// Wizard 3 pasos (dryRun sin folios → confirmar). Reglas del plan §9:
//  · Separador ';' (Excel MX) con auto-detección de ','
//  · Categorías deben existir ('Raíz / Sub'); si no → error por fila
//  · Marcas faltantes se AUTO-CREAN vinculadas a la categoría de la fila (RPC b6)
//  · Columnas extra → claves del esquema_atributos de la categoría
//  · codigo_barras como idempotencia (intra-CSV y vs BD)
//  · Batches de 100 · filas con error se omiten y se reportan
// ═══════════════════════════════════════════════════════════════════════════════

export interface ResultadoImportProductos {
    insertados: number
    errores: { fila: number; error: string }[]
    avisos: string[]
    marcasCreadas: string[]
    dryRun: boolean
}

function parsearCsv(texto: string): { separador: string; filas: string[][] } {
    // Auto-detección de separador por la primera línea.
    const primerSalto = texto.indexOf('\n')
    const primera = (primerSalto === -1 ? texto : texto.slice(0, primerSalto)).replace(/^\uFEFF/, '')
    const sep = (primera.match(/;/g) ?? []).length >= (primera.match(/,/g) ?? []).length ? ';' : ','

    const lineas = texto.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() !== '')
    const filas: string[][] = []
    for (const linea of lineas) {
        const campos: string[] = []
        let actual = ''
        let entreComillas = false
        for (let i = 0; i < linea.length; i++) {
            const ch = linea[i]
            if (ch === '"') {
                if (entreComillas && linea[i + 1] === '"') {
                    actual += '"'
                    i++
                } else {
                    entreComillas = !entreComillas
                }
            } else if (ch === sep && !entreComillas) {
                campos.push(actual)
                actual = ''
            } else {
                actual += ch
            }
        }
        campos.push(actual)
        filas.push(campos)
    }
    return { separador: sep, filas }
}

function aBooleanoImport(v: string): boolean | null {
    const t = v.trim().toLowerCase()
    if (['1', 'true', 'sí', 'si', 'yes'].includes(t)) return true
    if (['0', 'false', 'no', 'not'].includes(t)) return false
    return null
}

export async function importarProductosCSV(
    csvTexto: string,
    dryRun: boolean
): Promise<RespuestaDato<ResultadoImportProductos>> {
    const supabase = await createClient()

    const { filas } = parsearCsv(csvTexto)
    if (filas.length < 2) return { success: false, error: 'El archivo no tiene filas de datos.' }

    const encabezados = filas[0].map((h) => h.trim())
    const indice = (nombre: string) => encabezados.indexOf(nombre)

    const BASE = [
        'nombre', 'modelo', 'categoria', 'marca', 'unidad', 'impuesto', 'precio_base',
        'precio_minimo', 'stock_minimo', 'codigo_barras', 'requiere_revision',
        'maneja_numero_serie', 'descripcion', 'notas',
    ]
    const columnasExtra = encabezados.filter((h) => !BASE.includes(h))

    // Mapas de resolución (una carga).
    const [unidades, impuestos, categorias, marcasExistentes, barrasExistentes] = await Promise.all([
        supabase.from('unidades_medida').select('id, nombre').eq('es_activo', true),
        supabase.from('impuestos').select('id, nombre').eq('es_activo', true),
        supabase.from('categorias_producto').select('id, nombre, id_categoria_padre, esquema_atributos').eq('es_activo', true),
        supabase.from('marcas_producto').select('id, nombre').eq('es_activo', true),
        supabase.from('productos').select('codigo_barras').not('codigo_barras', 'is', null),
    ])

    const porNombreUnidad = new Map((unidades.data ?? []).map((u) => [String(u.nombre).toLowerCase(), u.id]))
    const porNombreImpuesto = new Map((impuestos.data ?? []).map((i) => [String(i.nombre).toLowerCase(), i.id]))
    const categoriasRows = categorias.data ?? []
    const porNombreCategoria = new Map(categoriasRows.map((c) => [String(c.nombre).toLowerCase(), c]))
    const idMarcaPorNombre = new Map((marcasExistentes.data ?? []).map((m) => [String(m.nombre).toLowerCase(), m.id]))
    const codigosEnBD = new Set((barrasExistentes.data ?? []).map((b) => String(b.codigo_barras).trim()).filter(Boolean))

    const errores: { fila: number; error: string }[] = []
    const avisos: string[] = []
    const marcasCreadas: string[] = []
    const codigosDelArchivo = new Set<string>()
    let insertados = 0

    const filasDatos = filas.slice(1)

    for (let idx = 0; idx < filasDatos.length; idx++) {
        const numeroFila = idx + 2 // 1-based incluyendo encabezados
        const valores = filasDatos[idx]
        const leer = (nombre: string) => {
            const i = indice(nombre)
            return i >= 0 && i < valores.length ? valores[i].trim() : ''
        }

        const nombre = leer('nombre')
        if (!nombre) {
            errores.push({ fila: numeroFila, error: 'Falta el nombre.' })
            continue
        }

        // Categoría: debe existir ('Almacenamiento / HDD' o 'HDD' o 'RAM').
        const categoriaTexto = leer('categoria')
        const piezasCategoria = categoriaTexto.split('/').map((p) => p.trim()).filter(Boolean)
        const subTexto = piezasCategoria.length > 1 ? piezasCategoria[piezasCategoria.length - 1] : categoriaTexto
        const filaCategoria = subTexto ? porNombreCategoria.get(subTexto.toLowerCase()) : undefined
        if (!filaCategoria) {
            errores.push({ fila: numeroFila, error: `La categoría "${categoriaTexto || '—'}" no existe (no se auto-crean categorías).` })
            continue
        }
        if (piezasCategoria.length === 1 && !filaCategoria.id_categoria_padre) {
            // Raíz sin hijos puede ser hoja (RAM); raíz con hijos debe indicar la sub.
            const tieneHijos = categoriasRows.some((c) => c.id_categoria_padre === filaCategoria.id)
            if (tieneHijos) {
                errores.push({ fila: numeroFila, error: `La categoría "${categoriaTexto}" tiene subcategorías: indica "Raíz / Sub".` })
                continue
            }
        }

        // Unidad e impuesto por nombre.
        const unidad = porNombreUnidad.get(leer('unidad').toLowerCase())
        const impuesto = porNombreImpuesto.get(leer('impuesto').toLowerCase())
        if (!unidad) { errores.push({ fila: numeroFila, error: `Unidad de medida "${leer('unidad')}" no encontrada.` }); continue }
        if (!impuesto) { errores.push({ fila: numeroFila, error: `Impuesto "${leer('impuesto')}" no encontrado.` }); continue }

        // Código de barras: idempotencia.
        const codigoBarras = leer('codigo_barras')
        if (codigoBarras) {
            const cb = codigoBarras.trim()
            if (codigosDelArchivo.has(cb) || codigosEnBD.has(cb)) {
                errores.push({ fila: numeroFila, error: `Código de barras "${cb}" ya existe (intra-CSV o en BD).` })
                continue
            }
            codigosDelArchivo.add(cb)
        }

        // Marca: existe o se auto-crea (RPC b6) — en dryRun solo se anuncia.
        const marcaNombre = leer('marca').trim()
        let idMarca = marcaNombre ? (idMarcaPorNombre.get(marcaNombre.toLowerCase()) ?? undefined) : undefined
        if (marcaNombre && !idMarca) {
            if (dryRun) {
                if (!marcasCreadas.includes(marcaNombre)) marcasCreadas.push(marcaNombre)
            } else {
                const rpc = await supabase.rpc('registrar_marca_con_categorias', {
                    p_nombre: marcaNombre,
                    p_id_categorias: [filaCategoria.id],
                })
                if (rpc.error) {
                    errores.push({ fila: numeroFila, error: `No se pudo crear la marca "${marcaNombre}".` })
                    continue
                }
                idMarca = String(rpc.data)
                idMarcaPorNombre.set(marcaNombre.toLowerCase(), idMarca)
                if (!marcasCreadas.includes(marcaNombre)) marcasCreadas.push(marcaNombre)
            }
        }

        // Atributos: columnas extra → claves del esquema de la categoría.
        const esquema = (filaCategoria.esquema_atributos ?? []) as AtributoEsquema[]
        const atributos: Record<string, ValorAtributo> = {}
        for (const columna of columnasExtra) {
            const valor = leer(columna)
            if (!valor) continue
            const def = esquema.find((d) => d.clave === columna)
            if (!def) {
                if (!avisos.includes(`Columna "${columna}" ignorada (no está en el esquema de la categoría).`)) {
                    avisos.push(`Columna "${columna}" ignorada (no está en el esquema de la categoría).`)
                }
                continue
            }
            // ⭐ 06 Oct 2026 — un `multi` entra por CSV con sus miembros unidos por `+`
            // (el MISMO separador de la huella). Se valida cada miembro contra la lista,
            // igual que un `select`.
            if (def.tipo === 'multi') {
                const miembros = valor.split('+').map((s) => s.trim()).filter(Boolean)
                const fuera = def.opciones ? miembros.filter((m) => !(def.opciones ?? []).includes(m)) : []
                if (fuera.length) {
                    errores.push({ fila: numeroFila, error: `"${columna}" = "${fuera.join(', ')}" no está en la lista de la categoría (agrégala en Catálogos).` })
                    continue
                }
                if (miembros.length) atributos[columna] = miembros
                continue
            }
            if (def.tipo === 'select' && def.opciones && !def.opciones.includes(valor)) {
                errores.push({ fila: numeroFila, error: `"${columna}" = "${valor}" no está en la lista de la categoría (agrégala en Catálogos).` })
                continue
            }
            atributos[columna] = def.tipo === 'number' ? Number(valor) : valor
        }

        // Flags opcionales con valores sí/no/1/0.
        const requiere = leer('requiere_revision')
        const maneja = leer('maneja_numero_serie')
        if (requiere && aBooleanoImport(requiere) === null) {
            errores.push({ fila: numeroFila, error: `requiere_revision "${requiere}" no válido (sí/no/1/0).` })
            continue
        }
        if (maneja && aBooleanoImport(maneja) === null) {
            errores.push({ fila: numeroFila, error: `maneja_numero_serie "${maneja}" no válido (sí/no/1/0).` })
            continue
        }

        const monto = (v: string) => (v === '' ? 0 : Number(v))
        const payload = {
            codigo_barras: codigoBarras || null,
            nombre,
            modelo: leer('modelo') || null,
            descripcion: leer('descripcion') || null,
            id_marca: idMarca ?? null,
            id_categoria: filaCategoria.id,
            id_unidad_medida: unidad,
            id_impuesto: impuesto,
            atributos,
            precio_base: monto(leer('precio_base')),
            precio_minimo: leer('precio_minimo') === '' ? null : monto(leer('precio_minimo')),
            stock_minimo: monto(leer('stock_minimo')),
            requiere_revision: requiere ? aBooleanoImport(requiere)! : true,
            maneja_numero_serie: maneja ? aBooleanoImport(maneja)! : false,
            notas: leer('notas') || null,
        }

        if (dryRun) {
            insertados++
            continue
        }

        // Real: folio P-###### (secuencial) e insert — fila con error se omite.
        const { data: sku, error: errFolio } = await supabase.rpc('generar_folio', { p_tipo: 'producto' })
        if (errFolio || !sku) {
            errores.push({ fila: numeroFila, error: 'No se pudo generar el SKU.' })
            continue
        }
        const { error: errInsert } = await supabase.from('productos').insert({ ...payload, sku })
        if (errInsert) {
            if (errInsert.code === '23505') {
                errores.push({ fila: numeroFila, error: `Código de barras "${codigoBarras || '?'}" duplicado.` })
            } else {
                errores.push({ fila: numeroFila, error: describirErrorTexto(errInsert) })
            }
            continue
        }
        insertados++
    }

    return {
        success: true,
        data: {
            insertados,
            errores,
            avisos,
            marcasCreadas,
            dryRun,
        },
    }
}

// ── Lista completa del subset SAT (desplegables de la sección Fiscal · MEJORA 04 Sep)
export async function listarClavesSAT(
    tipo: 'prod_serv' | 'unidad'
): Promise<RespuestaLista<ClaveSAT>> {
    const supabase = await createClient()
    const tabla = tipo === 'unidad' ? 'sat_claves_unidad' : 'sat_claves_prod_serv'
    const { data, error } = await supabase
        .from(tabla)
        .select('*')
        .order('clave', { ascending: true })
    if (error) return { success: false, error: describirError(error) }
    const claves = (data ?? []).map((f) => ({
        id: (f as { id: string }).id,
        clave: (f as { clave: string }).clave,
        descripcion: (f as { descripcion?: string }).descripcion ?? (f as { nombre?: string }).nombre ?? '',
        nombre: (f as { nombre?: string }).nombre,
    })) as ClaveSAT[]
    return { success: true, data: claves }
}

// ── Opciones de producto activas para selectores (anexión Guía 1.5 · 17 Sep 2026) ──
// Contrato del SelectorProducto (kit 0.8 · PROMOCIÓN 17 Sep). Espejo de
// listarProveedoresActivos (1.1). Antes la 1.4 tenía su copia en compras
// (listarProductosParaPartida) — el kit no depende del dominio compras.
//
// ⭐ 06 Oct 2026 (CASCADA del selector) — la firma pasa de `(busqueda = '')` a filtros:
// Familia → Tipo → atributos `en_huella`. Cada cambio = 1 llamada; el buscador de texto
// NO viaja (el selector sigue filtrando en cliente sobre las 50 que devuelve esta SA).
export async function listarProductosActivos(
    filtros: FiltrosProductosActivos = {}
): Promise<RespuestaLista<ProductoOpcion>> {
    const supabase = await createClient()

    let query = supabase
        .from('productos')
        .select('id, sku, nombre, id_categoria, atributos')
        .eq('es_archivado', false)
        .eq('es_activo', true)

    const termino = (filtros.busqueda ?? '').trim().replace(/[%_]/g, '')
    if (termino) {
        query = query.or(`nombre.ilike.%${termino}%,sku.ilike.%${termino}%,codigo_barras.ilike.%${termino}%`)
    }

    // Familia → sus Tipos (patrón de buscarProductosPorAtributos). ⚠️ La Familia agrupa y
    // NO recibe productos (R8): sin esta expansión, elegir SOLO Familia devolvería 0 filas
    // aunque sus Tipos tengan productos. Un Tipo no tiene hijos ⇒ la expansión es inocua.
    if (filtros.id_categoria) {
        const { data: hijos } = await supabase
            .from('categorias_producto')
            .select('id')
            .eq('id_categoria_padre', filtros.id_categoria)
        const ids = [filtros.id_categoria, ...(hijos ?? []).map((h) => h.id)]
        query = query.in('id_categoria', ids)
    }

    // Atributos `en_huella` del Tipo. El ESQUEMA decide el operador: un `select` es una
    // lista CERRADA ⇒ igualdad exacta (con `ilike`, «ATX» traería también «Micro-ATX» —
    // medido en el esquema real); el resto (`text` sin opciones) filtra por CONTENIDO con
    // `ilike` sobre `atributos->>clave` (decisión del dueño). Claves fuera del esquema se
    // ignoran: el contrato es «solo claves del esquema».
    const seleccionados = Object.entries(filtros.atributos ?? {}).filter(([, valor]) => valor !== '')
    if (seleccionados.length > 0 && filtros.id_categoria) {
        const { esquema } = await esquemaDeCategoria(supabase, filtros.id_categoria)
        for (const [clave, bruto] of seleccionados) {
            const definicion = esquema.find((a) => a.clave === clave)
            if (!definicion) continue
            // ⭐ 06 Oct 2026 — un criterio `multi` llega como ARRAY. La búsqueda por MIEMBRO de
            // un conjunto es la mejora diferida (D2 · índices por atributo): hoy se OMITE, en vez
            // de duplicar el normalizador en TS — la canonicalización vive en la BD y en un solo
            // lugar (`fn_valor_canonico`). La cascada del selector hoy no ofrece `multi`, así que
            // esta rama no se alcanza.
            if (Array.isArray(bruto)) continue
            const valor = bruto
            query =
                definicion.tipo === 'select' && (definicion.opciones ?? []).length > 0
                    ? query.eq(`atributos->>${clave}`, valor)
                    : query.ilike(`atributos->>${clave}`, `%${valor.replace(/[%_]/g, '')}%`)
        }
    }

    const { data, error } = await query.order('nombre', { ascending: true }).limit(50)
    if (error) return { success: false, error: describirError(error) }
    return { success: true, data: (data ?? []) as unknown as ProductoOpcion[] }
}

// ── Categorías de la CASCADA del selector (⭐ 06 Oct 2026) ─────────────────────
// SA PROPIA de la 1.2 (decisión del dueño): NO reusa `listarCategorias()` de la 1.0, que
// trae la fila entera del hub (`select '*'`, orden `orden`) — acá viaja lo mínimo para
// pintar la cascada: id · nombre · padre + los atributos `en_huella` del Tipo.
// La Familia no tiene esquema (R8: forzado a `[]`) ⇒ `atributos_huella` sale vacío sin
// forzarlo en código: una raíz SIN hijos sí puede ser categoría final (`ProductoModal`
// · `esquemaEfectivo`) y entonces su huella debe poder filtrarse.
export async function listarCategoriasSelector(): Promise<RespuestaLista<OpcionCategoriaSelector>> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('categorias_producto')
        .select('id, nombre, id_categoria_padre, esquema_atributos')
        .eq('es_activo', true)
        .order('nombre', { ascending: true })
    if (error) return { success: false, error: describirError(error) }

    const filas = (data ?? []) as unknown as {
        id: string
        nombre: string
        id_categoria_padre: string | null
        esquema_atributos: AtributoEsquema[] | null
    }[]

    return {
        success: true,
        data: filas.map((f) => ({
            id: f.id,
            nombre: f.nombre,
            id_categoria_padre: f.id_categoria_padre,
            // Un Tipo sin `en_huella` es válido: su fila de atributos no se renderiza.
            atributos_huella: (f.esquema_atributos ?? [])
                .filter((a) => a.en_huella)
                .map((a) => ({
                    clave: a.clave,
                    etiqueta: a.etiqueta,
                    tipo: a.tipo,
                    opciones: a.opciones,
                })),
        })),
    }
}
