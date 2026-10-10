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
import { describirError, describirErrorTexto } from '@/lib/utils/errores'
import { entradaSchema, type EntradaInput } from '@/lib/validations/entradas'
import type {
    BandejaLiberada,
    CausaDivergencia,
    CotejoLinea,
    ConfirmarAltaInput,
    DevolucionEntrada,
    Divergencia,
    Entrada,
    EstadoEntrada,
    EstadoTanda,
    FiltrosEntradas,
    HuellaResuelta,
    AvanceRevisionInput,
    LiberarAvanceInput,
    MotivoRechazo,
    PartidaConAvance,
    PartidaEntrada,
    PartidaResuelta,
    PiezaRevision,
    ProductoDeLaPartidaNs,
    LecturaNs,
    ResultadoConsultaNs,
    RespuestaAccion,
    RespuestaDato,
    RespuestaLista,
    ResultadoRevision,
    TandaGrupo,
    TandaLiberada,
    CategoriaCapturable,
    CategoriaEntrada,
    HuellaDevuelta,
    EtapasDeIngreso,
    LiberacionDeIngreso,
} from '@/types/entradas'
// ⭐ FIX 25 Sep 2026 — valor (no tipo): la misma puerta que consulta la UI.
import { puedeLiberar, puedeAjustarNota } from '@/types/entradas'
// ⭐ MEJORA 29 (25 Sep 2026) — la huella canónica y la clave de línea: **fuente única** del
// emparejamiento (la usan el guardado, la lectura y el desglose). Antes vivía privada aquí.
import { huellaCanonica, claveLinea } from '@/types/entradas'
import type { AtributoEsquema } from '@/types/catalogos'
// ⭐ FIX 05 Oct 2026 — el alta rápida BUSCA por huella antes de crear (una sola definición del
// contrato de huella: la de 1.2, no una copia local).
import { buscarProductosPorAtributos } from '@/lib/actions/productos'

// ⭐ MEJORA 26 (24 Sep 2026) — una escritura denegada por RLS **no siempre duele**: PostgREST
// devuelve `success` cuando el `USING` de la política filtra la fila (el UPDATE afecta 0 filas) y
// la app cree que guardó. Las escrituras críticas piden `.select('id')` y pasan por aquí, para que
// «no se escribió nada» se convierta en un error visible en vez de un dato perdido.
function sinEscritura(filas: { id?: string }[] | null, que: string): string | null {
    if (!filas || filas.length === 0) {
        return `No se pudo ${que}: la fila no existe o tu rol no tiene permiso sobre esta etapa.`
    }
    return null
}

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
    // ⭐ MEJORA 24 Sep 2026 — `partidas_resueltas` anidado: Σ aprobadas (el avance REAL de la
    // etapa de Revisión). Un solo nivel más del mismo embed que ya usa el desglose.
    partidas_entrada:
        | {
              cantidad_original: number
              cantidad_vigente: number
              costo_acordado: number
              partidas_resueltas:
                  | { cantidad_aprobada: number; id_marca: string | null; atributos: Record<string, unknown> | null }[]
                  | null
              /** ⭐ MEJORA 29 — la huella de cada DEV: una partida puede rendir una línea que SOLO
               *  tenga DEV (nada aprobado) y el contador «Partidas» tiene que contarla. */
              devoluciones_entrada:
                  | { id_marca: string | null; atributos: Record<string, unknown> | null }[]
                  | null
          }[]
        | null
    devoluciones_entrada: { cantidad: number }[] | null
    /** ⭐ MEJORA 25 — embed inverso: las tandas que ya salieron de esta entrada. */
    liberaciones_entrada: { cantidad: number }[] | null
    notas_compra: { folio: string } | null
}

/** `YYYY-MM-DD` en hora LOCAL.
 *  ⚠️ NO se usa `toISOString()`: convierte a UTC y un `new Date()` de la tarde en México
 *  (UTC−6) cae en el día siguiente → el corte de antigüedad se comería el día de más. */
function aYMD(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function aFila(f: FilaEntradaCruda): Entrada {
    const partidas = f.partidas_entrada ?? []
    // ⭐ MEJORA 28 (25 Sep 2026 · decisión 22.h) — **«Partidas» son las LÍNEAS que el usuario ve**:
    // una por huella resuelta, y la declarada mientras no haya huellas. Antes contaba las
    // DECLARADAS, así que una partida que la revisión abría en dos marcas seguía diciendo «1» en
    // el padre y en el desglose hasta Acondicionamiento. El usuario: *«sigo viendo que en detalles
    // solo una partida cuando ahí ya debieron nacer 2»*.
    const partidas_count = partidas.reduce((s, p) => {
        // ⭐ MEJORA 29 (25 Sep 2026) — las líneas son la **UNIÓN** de las huellas aprobadas y las que
        // SOLO tienen DEV: una pieza mala de una marca que no aprobó nada también es una línea del
        // desglose. Antes se contaban las aprobadas y esa línea nacía sin que el padre la contara.
        const claves = new Set<string>()
        for (const r of p.partidas_resueltas ?? []) claves.add(claveLinea(r.id_marca, r.atributos))
        for (const d of p.devoluciones_entrada ?? []) claves.add(claveLinea(d.id_marca, d.atributos))
        return s + Math.max(1, claves.size)
    }, 0)
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
    // ⭐ MEJORA 24 Sep 2026 (Fase 2) — lo APROBADO por el técnico (Σ cantidad_aprobada).
    const piezas_aprobadas = partidas.reduce(
        (s, p) => s + (p.partidas_resueltas ?? []).reduce((t, r) => t + Number(r.cantidad_aprobada ?? 0), 0),
        0
    )
    // ⭐ MEJORA 25 — lo ya LIBERADO a acondicionamiento (tandas creadas, en cualquier estado).
    const piezas_liberadas = (f.liberaciones_entrada ?? []).reduce(
        (s, l) => s + Number(l.cantidad ?? 0),
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
        piezas_aprobadas,
        piezas_liberadas,
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
            'id, folio, id_proveedor, proveedores(nombre_comercial), fecha, estado, resultado_rev, es_sin_revision, origen, id_nota, notas, fecha_fin_rev, fecha_fin_acond, fecha_fin_almacen, creado_por, usuarios!entradas_creado_por_fkey(nombre_completo), created_at, partidas_entrada(cantidad_original, cantidad_vigente, costo_acordado, partidas_resueltas(cantidad_aprobada, id_marca, atributos), devoluciones_entrada(id_marca, atributos)), devoluciones_entrada(cantidad), liberaciones_entrada(cantidad), notas_compra(folio)',
            { count: 'exact' }
        )
        // ⭐ MEJORA 24 Sep 2026 (usuario) — «el más reciente primero», y **determinista**.
        // `fecha` sola no basta: las entradas del MISMO día quedaban en el orden arbitrario que
        // devolviera Postgres (el 22/09 hay tres y el 24/09 dos). El desempate por `folio` (los
        // folios son consecutivos y crecientes) fija el más reciente arriba de cada día.

    // ⭐ MEJORA 24 Sep 2026 (Fase 2 · Revisión) — `filtros.orden` decide, y las claves giran juntas
    // (si no, dentro de un mismo día el desempate contradiría al orden).
    //
    //  · `cola` (PUESTO DE TRABAJO) — DOS niveles: **arriba lo que le falta a la etapa**
    //    (`fecha_fin_rev` nula → `nullsfirst`) y **abajo lo ya cerrado**; dentro del primer nivel
    //    manda la antigüedad, así que lo que más espera va primero. Cubre las tres prioridades que
    //    pidió el usuario —el recién creado que nadie tomó, el que se empezó y no se terminó, y el
    //    que ya tiene tiempo— y deja las cerradas al final.
    //    Se usa `fecha_fin_rev` (el fin de la REVISIÓN) y no `estado` porque `estado` es `text`
    //    (medido en `information_schema`): PostgREST solo lo ordenaría alfabéticamente, que no es la
    //    prioridad del flujo. Un corte por ESTADO fino exigiría un objeto de BD (vista o columna
    //    generada con `case`) — carril ANEXIÓN-BD, declarado como pendiente de decisión.
    //  · `recientes` (default, LISTADO de consulta) — del más reciente al más viejo, determinista.
    //    Sintaxis validada contra el API real (HTTP 200) con **control negativo**: un modificador
    //    inventado devuelve `400 PGRST100` — la prueba puede fallar.
    q =
        filtros.orden === 'cola'
            ? q.order('fecha_fin_rev', { ascending: true, nullsFirst: true })
                  .order('fecha', { ascending: true })
                  .order('folio', { ascending: true })
            : q.order('fecha', { ascending: false }).order('folio', { ascending: false })

    if (filtros.estado) q = q.eq('estado', filtros.estado)
    // ⭐ MEJORA 24 Sep 2026 (Fase 2 · Revisión) — la cola de una ETAPA no es un estado suelto:
    // «A revisar» son tres (`recien_creada` · `lista_para_revision` · `en_revision`). Si el
    // conjunto viene con elementos manda él; `estado` sigue sirviendo para los filtros de catálogo.
    if (filtros.estados && filtros.estados.length > 0) q = q.in('estado', filtros.estados)
    // ⭐ Antigüedad mínima — «lo que lleva ≥ N días esperando». Es el filtro que hace VISIBLE el
    // problema reportado (una entrada puede llevar 3 días en cola diciendo «Recién creada»).
    // Se corta al FIN DEL DÍA del límite por la misma razón que el rango «hasta»: `fecha` lleva hora.
    if (filtros.antiguedad_min && filtros.antiguedad_min > 0) {
        const limite = new Date()
        limite.setDate(limite.getDate() - filtros.antiguedad_min)
        q = q.lte('fecha', `${aYMD(limite)}T23:59:59.999`)
    }
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
    if (error) return { success: false, error: describirError(error) }
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
    if (error) return { success: false, error: describirError(error) }
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
    if (error) return { success: false, error: describirError(error) }
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
    if (errFolio) return { success: false, error: describirError(errFolio) }

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
    if (errEntrada) return { success: false, error: describirError(errEntrada) }

    const partidas = parsed.data.partidas.map((p, i) => ({
        id_entrada: entrada.id,
        partida: i + 1,
        id_categoria: p.id_categoria || null,
        atributos: p.atributos ?? {},
        // ⭐ MEJORA 28 Sep 2026 (D1) — **la bandera que enciende el concentrado de NS en Revisión.**
        // Hasta hoy la app NO tenía ningún escritor de esta columna: nacía en `false` y el wizard de
        // revisión no pedía los NS jamás. La captura la puerta, aquí.
        lleva_ns: p.lleva_ns,
        cantidad_original: Number(p.cantidad_original),
        cantidad_vigente: Number(p.cantidad_original),
        costo_acordado: Number(p.costo_acordado),
        estado_partida: 'PENDIENTE',
        creado_por: sesion.userId,
    }))
    const { error: errPartidas } = await supabase.from('partidas_entrada').insert(partidas)
    if (errPartidas) return { success: false, error: describirError(errPartidas) }

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
    if (errCab) return { success: false, error: describirError(errCab) }

    // Reemplazo de partidas (solo en recién_creada — no hay revisión aún).
    const { error: errDel } = await supabase.from('partidas_entrada').delete().eq('id_entrada', id)
    if (errDel) return { success: false, error: describirError(errDel) }
    const partidas = parsed.data.partidas.map((p, i) => ({
        id_entrada: id,
        partida: i + 1,
        id_categoria: p.id_categoria || null,
        atributos: p.atributos ?? {},
        // ⭐ MEJORA 28 Sep 2026 (D1) — reemplazo de partidas en `recien_creada`: la bandera viene del
        // modal (que la releyó de la BD), así que editar no la pierde.
        lleva_ns: p.lleva_ns,
        cantidad_original: Number(p.cantidad_original),
        cantidad_vigente: Number(p.cantidad_original),
        costo_acordado: Number(p.costo_acordado),
        estado_partida: 'PENDIENTE',
        creado_por: sesion.userId,
    }))
    const { error: errPartidas } = await supabase.from('partidas_entrada').insert(partidas)
    if (errPartidas) return { success: false, error: describirError(errPartidas) }

    return { success: true }
}

/** Partidas de una entrada (línea declarada). */
export async function listarPartidasEntrada(idEntrada: string): Promise<RespuestaLista<PartidaEntrada>> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('partidas_entrada')
        .select('id, id_entrada, partida, lleva_ns, id_categoria, categorias_producto(nombre), atributos, cantidad_original, cantidad_vigente, costo_acordado, estado_partida, devoluciones_entrada(cantidad, fecha_ajuste)')
        .eq('id_entrada', idEntrada)
        .order('partida', { ascending: true })
    if (error) return { success: false, error: describirError(error) }
    const filas = ((data ?? []) as unknown as {
        id: string
        id_entrada: string
        partida: number
        lleva_ns: boolean
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
        // ⭐ MEJORA 28 Sep 2026 — la bandera de D1 también aquí: es la que el modal de edición
        // devuelve tal cual la recibió (sin ella, editar apagaba el concentrado de NS).
        lleva_ns: p.lleva_ns ?? false,
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

/** Partidas de una entrada CON su avance de revisión y la HUELLA que produjo la etapa.
 *
 *  ⭐ MEJORA 24 Sep 2026 (Fase 2 · Revisión) — el desglose del técnico necesita, por partida:
 *    · `aprobadas` y `dev_cantidad` **separadas** (antes `revisadas` las sumaba, y por eso el
 *      desglose no podía decir «2 malas»: la cifra se perdía en el agregado);
 *    · `dev_ajustada` (por cotejar ↔ ajustada), que es el estado de la DEV;
 *    · `huellas`: la información que el técnico **construyó** — marca + atributos por grupo
 *      aprobado. Devuelve TODAS: una partida puede rendir más de una huella y elegir una sería
 *      mentir sobre lo aprobado. */
export async function listarPartidasConAvance(idEntrada: string): Promise<RespuestaLista<PartidaConAvance>> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('partidas_entrada')
        .select('id, partida, lleva_ns, id_categoria, categorias_producto(nombre), atributos, cantidad_original, cantidad_vigente, costo_acordado, estado_partida')
        .eq('id_entrada', idEntrada)
        .order('partida', { ascending: true })
    if (error) return { success: false, error: describirError(error) }

    const filas = (data ?? []) as unknown as {
        id: string
        partida: number
        lleva_ns: boolean
        id_categoria: string | null
        categorias_producto: { nombre: string } | null
        atributos: Record<string, unknown> | null
        cantidad_original: number
        cantidad_vigente: number
        costo_acordado: number
        estado_partida: string
    }[]
    const ids = filas.map((f) => f.id)
    const [{ data: resueltas }, { data: devoluciones }, { data: liberaciones }, { data: reclasificaciones }] =
        await Promise.all([
        ids.length
            ? supabase
                  .from('partidas_resueltas')
                  .select(
                      'id, id_partida_entrada, id_marca, marcas_producto(nombre), cantidad_aprobada, atributos'
                  )
                  .in('id_partida_entrada', ids)
            : Promise.resolve({ data: [] }),
        ids.length
            ? supabase
                  .from('devoluciones_entrada')
                  // ⭐ MEJORA 29 — la DEV trae su HUELLA (marca + atributos): sin ella no se puede
                  // pegar a su línea y habría que repartirla a ciegas.
                  .select('id_partida_entrada, cantidad, fecha_ajuste, id_marca, atributos, marcas_producto(nombre)')
                  .in('id_partida_entrada', ids)
            : Promise.resolve({ data: [] }),
        // ⭐ MEJORA 25 — lo ya LIBERADO (tandas creadas, en cualquier estado). Es lo que convierte
        // «20 aprobadas» en «de esas 20, 10 ya salieron a limpieza».
        supabase
            .from('liberaciones_entrada')
            .select('id_partida_resuelta, cantidad')
            .eq('id_entrada', idEntrada),
        /**
         * ⭐ MEJORA 52 (07 Oct 2026) — **lo que SALIÓ de cada partida por RECLASIFICACIÓN.** Sin esto el
         * desglose no cuadra: `RECIBIDAS 5 · DEV — · FINAL 4` dejaba **una pieza sin explicar** (no se
         * fue con el proveedor: se fue a la partida de su capacidad). Cuenta `pendiente` **y** `ajustada`:
         * el hecho ocurrió desde el guardado (lo `pendiente` es lo que espera a Recepción).
         */
        supabase
            .from('reclasificaciones_entrada')
            .select('id_partida_origen, id_partida_destino, cantidad, estado')
            .eq('id_entrada', idEntrada),
    ])

    /** Σ reclasificada que salió por partida — el tramo que faltaba para que el desglose cierre. */
    const reclasificadoPorPartida = new Map<string, number>()
    const reclasificadoEntraPorPartida = new Map<string, number>()
    /** ⭐ Y las que **todavía esperan a Recepción** (`pendiente`): es lo que él tiene que ver. */
    const reclasPendientePorPartida = new Map<string, number>()
    for (const r of (reclasificaciones ?? []) as unknown as {
        id_partida_origen: string
        id_partida_destino: string
        cantidad: number
        estado: string
    }[]) {
        const c = Number(r.cantidad ?? 0)
        reclasificadoPorPartida.set(r.id_partida_origen, (reclasificadoPorPartida.get(r.id_partida_origen) ?? 0) + c)
        reclasificadoEntraPorPartida.set(
            r.id_partida_destino,
            (reclasificadoEntraPorPartida.get(r.id_partida_destino) ?? 0) + c
        )
        if (r.estado === 'pendiente') {
            reclasPendientePorPartida.set(
                r.id_partida_origen,
                (reclasPendientePorPartida.get(r.id_partida_origen) ?? 0) + c
            )
        }
    }

    // Σ liberada por GRUPO (`partidas_resueltas.id`) — la unidad de liberación.
    const liberadoPorGrupo = new Map<string, number>()
    for (const l of (liberaciones ?? []) as unknown as {
        id_partida_resuelta: string
        cantidad: number
    }[]) {
        liberadoPorGrupo.set(
            l.id_partida_resuelta,
            (liberadoPorGrupo.get(l.id_partida_resuelta) ?? 0) + Number(l.cantidad ?? 0)
        )
    }

    // ⭐ MEJORA 29 (25 Sep 2026) — la DEV llega **atribuida por huella**: la marca de la pieza
    // devuelta ya no se tira al guardar. Se agrupa por partida y por huella; lo que **no empareje**
    // con una huella aprobada no se reparte ni se suma al bulto: nace como línea propia (abajo).
    type DevHuella = {
        cantidad: number
        ajustada: boolean
        id_marca: string | null
        atributos: Record<string, unknown>
        marca_nombre: string | null
    }
    const malPorPartida = new Map<string, { cantidad: number; ajustada: boolean }>()
    const devPorPartida = new Map<string, Map<string, DevHuella>>()
    for (const d of (devoluciones ?? []) as unknown as {
        id_partida_entrada: string
        cantidad: number
        fecha_ajuste: string | null
        id_marca: string | null
        atributos: Record<string, unknown> | null
        marcas_producto: { nombre: string | null } | null
    }[]) {
        const porClave = devPorPartida.get(d.id_partida_entrada) ?? new Map<string, DevHuella>()
        const k = claveLinea(d.id_marca, d.atributos)
        const acc = porClave.get(k) ?? {
            cantidad: 0,
            ajustada: false,
            id_marca: d.id_marca,
            atributos: d.atributos ?? {},
            marca_nombre: d.marcas_producto?.nombre ?? null,
        }
        acc.cantidad += Number(d.cantidad)
        acc.ajustada = acc.ajustada || d.fecha_ajuste !== null
        porClave.set(k, acc)
        devPorPartida.set(d.id_partida_entrada, porClave)

        // El total de la PARTIDA sigue siendo de la partida: es la Σ de sus líneas.
        const total = malPorPartida.get(d.id_partida_entrada) ?? { cantidad: 0, ajustada: false }
        total.cantidad += Number(d.cantidad)
        total.ajustada = total.ajustada || d.fecha_ajuste !== null
        malPorPartida.set(d.id_partida_entrada, total)
    }
    /** Las huellas que SÍ tienen algo aprobado — para saber qué DEV se quedó sin línea. */
    const clavesConAprobadas = new Map<string, Set<string>>()

    const okPorPartida = new Map<string, number>()
    const liberadoPorPartida = new Map<string, number>()
    const huellasPorPartida = new Map<string, HuellaResuelta[]>()
    for (const r of (resueltas ?? []) as unknown as {
        id: string
        id_partida_entrada: string
        id_marca: string | null
        marcas_producto: { nombre: string | null } | null
        cantidad_aprobada: number
        atributos: Record<string, unknown> | null
    }[]) {
        okPorPartida.set(
            r.id_partida_entrada,
            (okPorPartida.get(r.id_partida_entrada) ?? 0) + Number(r.cantidad_aprobada)
        )
        const liberado = liberadoPorGrupo.get(r.id) ?? 0
        if (liberado > 0) {
            liberadoPorPartida.set(
                r.id_partida_entrada,
                (liberadoPorPartida.get(r.id_partida_entrada) ?? 0) + liberado
            )
        }
        const kHuella = claveLinea(r.id_marca, r.atributos)
        clavesConAprobadas.set(
            r.id_partida_entrada,
            (clavesConAprobadas.get(r.id_partida_entrada) ?? new Set<string>()).add(kHuella)
        )
        // ⭐ MEJORA 29 — su DEV, si la pieza mala fue de ESTA huella.
        const devHuella = devPorPartida.get(r.id_partida_entrada)?.get(kHuella)
        const lista = huellasPorPartida.get(r.id_partida_entrada) ?? []
        lista.push({
            id_partida_resuelta: r.id,
            id_marca: r.id_marca,
            marca_nombre: r.marcas_producto?.nombre ?? null,
            atributos: r.atributos ?? {},
            cantidad_aprobada: Number(r.cantidad_aprobada),
            cantidad_liberada: liberado,
            cantidad_devuelta: devHuella?.cantidad ?? 0,
            dev_ajustada: devHuella?.ajustada ?? false,
        })
        huellasPorPartida.set(r.id_partida_entrada, lista)
    }

    // Lo que NO emparejó con ninguna huella aprobada: **su propia línea** (0 aprobadas + n malas).
    // Es el caso que antes era invisible: una marca que no aprobó nada y aun así tiene DEV.
    const devsSueltosPorPartida = new Map<string, HuellaDevuelta[]>()
    for (const [idPartida, porClave] of devPorPartida) {
        const aprobadas = clavesConAprobadas.get(idPartida) ?? new Set<string>()
        const sueltos: HuellaDevuelta[] = []
        for (const [k, v] of porClave) {
            if (aprobadas.has(k)) continue
            sueltos.push({
                id_marca: v.id_marca,
                marca_nombre: v.marca_nombre,
                atributos: v.atributos,
                cantidad: v.cantidad,
                ajustada: v.ajustada,
            })
        }
        if (sueltos.length > 0) devsSueltosPorPartida.set(idPartida, sueltos)
    }

    return {
        success: true,
        data: filas.map((f) => {
            const aprobadas = okPorPartida.get(f.id) ?? 0
            const dev = malPorPartida.get(f.id)
            const revisadas = aprobadas + (dev?.cantidad ?? 0)
            return {
                id: f.id,
                partida: f.partida,
                // ⭐ MEJORA 35 — **la bandera que enciende las pantallas de escaneo del wizard**. Faltaba
                // en este mapeo: sin ella el wizard nunca sabía que la partida lleva NS (el bug que hacía
                // que «no pasara nada» al guardar).
                lleva_ns: f.lleva_ns ?? false,
                id_categoria: f.id_categoria,
                categoria_nombre: f.categorias_producto?.nombre ?? null,
                atributos: f.atributos ?? {},
                cantidad_original: Number(f.cantidad_original),
                cantidad_vigente: Number(f.cantidad_vigente),
                costo_acordado: Number(f.costo_acordado),
                aprobadas,
                dev_cantidad: dev?.cantidad ?? 0,
                dev_ajustada: dev?.ajustada ?? false,
                huellas: huellasPorPartida.get(f.id) ?? [],
                // ⭐ MEJORA 29 — las huellas que solo tienen DEV: líneas propias del desglose.
                devs: devsSueltosPorPartida.get(f.id) ?? [],
                liberadas: liberadoPorPartida.get(f.id) ?? 0,
                revisadas,
                /**
                 * ⭐ MEJORA 52 (07 Oct 2026) — **LO QUE FALTA POR REVISAR se mide contra el FINAL.**
                 *
                 * Con `cantidad_original`, una partida a la que se le fue **1 pieza por reclasificación**
                 * seguía diciendo «falta 1 por revisar» **para siempre** (caso real `ING-0002`: 5
                 * declaradas, 4 revisadas, la 5ª en su propia partida) — el dueño lo cazó:
                 * *«ya se revisaron los 5 porque uno pasó a una nueva partida pero sigue diciendo que
                 * falta 1»*.
                 *
                 * ⚠️ Y el caso normal NO cambia: durante la revisión la DEV todavía no se aplica (se
                 * aplica al emitir la nota), así que `vigente === original` salvo cuando hubo una
                 * reclasificación — que es justo lo que esto arregla.
                 */
                restantes: Math.max(0, Number(f.cantidad_vigente) - revisadas),
                /** ⭐ MEJORA 52 — el tramo que faltaba: lo que se fue a la partida de su capacidad. */
                reclasificadas: reclasificadoPorPartida.get(f.id) ?? 0,
                /** ⭐ Y lo que LLEGÓ (la partida nacida): así `0 + entran = final` también cierra. */
                reclasificadas_entran: reclasificadoEntraPorPartida.get(f.id) ?? 0,
                /** ⭐ Y cuántas **esperan a Recepción**: es lo que tiene que VER antes de la nota. */
                reclasificadas_pendientes: reclasPendientePorPartida.get(f.id) ?? 0,
                estado_partida: f.estado_partida as PartidaEntrada['estado_partida'],
            }
        }),
    }
}

/**
 * ⭐ MEJORA 28 Sep 2026 — **la bandera de NS también la puede encender el TÉCNICO.**
 *
 * D1 dice que la bandera la decide la puerta (Recepción) y así se captura al crear la entrada. Pero
 * la bandera nació **sin ningún escritor** en la app, así que todo lo que ya había entrado al flujo
 * quedó en `false` — y con `editarEntrada` cerrado a `recien_creada`, esas partidas no tenían por
 * dónde corregirse: el concentrado de NS no se pedía nunca. El técnico es quien tiene la pieza en la
 * mano y descubre que trae serial, así que la puerta se abre **en Revisión, mientras la entrada se
 * está revisando** (decisión del usuario, 28 Sep 2026).
 *
 * `partidas_entrada_update` (RLS por etapa, MEJORA 26) ya permite `revision/editar`: no se toca
 * ninguna política. Sí se exige el estado: fuera de la ventana de revisión la bandera ya no significa
 * nada y se rechaza con el motivo a la vista.
 */
export async function marcarPartidaLlevaNs(
    idPartida: string,
    llevaNs: boolean
): Promise<RespuestaAccion> {
    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }

    const { data: fila } = await supabase
        .from('partidas_entrada')
        .select('id, partida, id_entrada, estado_partida, entradas(estado)')
        .eq('id', idPartida)
        .single()
    if (!fila) return { success: false, error: 'La partida no existe.' }
    // El cliente sin tipos devuelve la relación como arreglo: se estrecha a mano (patrón de la casa).
    const partida = fila as unknown as {
        id: string
        partida: number
        id_entrada: string
        estado_partida: string
        entradas: { estado: string } | null
    }

    const estado = partida.entradas?.estado ?? ''
    /**
     * ⭐ MEJORA 29 Sep 2026 — **la ventana es «mientras queden TANDAS por guardar», no un estado del
     * documento.** La regla anterior miraba solo el estado de la entrada y dejaba fuera el caso real:
     * un documento que ya cerró su revisión (`con_dev` · `revisada_sin_dev`) con una partida todavía
     * `PENDIENTE` — exactamente cuando al técnico le quedan piezas y descubre que traen serial.
     * En Revisión la bandera **cambia lo que se pedirá al guardar**, así que solo tiene sentido
     * mientras haya un guardado por delante.
     */
    const EN_REVISION = ['recien_creada', 'lista_para_revision', 'en_revision']
    const CERRADA_CON_PARTIDA_ABIERTA = ['revisada_sin_dev', 'con_dev']
    const partidaAbierta = partida.estado_partida === 'PENDIENTE'
    if (
        !EN_REVISION.includes(estado) &&
        !(CERRADA_CON_PARTIDA_ABIERTA.includes(estado) && partidaAbierta)
    ) {
        return {
            success: false,
            error: 'Esta partida ya cerró su revisión: la bandera de número de serie ya no cambia lo que se pide al guardar.',
        }
    }

    const { data: upd, error } = await supabase
        .from('partidas_entrada')
        .update({ lleva_ns: llevaNs })
        .eq('id', idPartida)
        .select('id')
    if (error) return { success: false, error: describirError(error) }
    // La RLS puede filtrar la fila en silencio: si no volvió ninguna, NO se escribió.
    const errFilas = sinEscritura(upd, 'cambiar la bandera de número de serie de la partida')
    if (errFilas) return { success: false, error: errFilas }

    return { success: true }
}

/**
 * ⭐ MEJORA 29 Sep 2026 — **el CONTROL DE NS del puesto de Almacén.**
 *
 * El escenario que lo justifica (`docs/bd-entradas.md` · M35): vuelve un disco con su serial —una
 * garantía, o el proveedor intentando colar la pieza que ya se le devolvió— y hay que decir **de
 * dónde vino y qué pasó con él**. Antes eso solo se podía averiguar abriendo entradas una por una.
 *
 * ⚠️ Lo que esta consulta **no** puede decir, y por eso se declara en vez de disimularse:
 *   · **la marca del NS** — el concentrado no la sabe (una partida rinde varias filas de producto y
 *     el serial no las distingue: corrección del usuario en la M35). Por eso el producto se informa
 *     a nivel **PARTIDA**, que es el nivel que sí lo sabe;
 *   · **`numeros_serie.id_producto`** — hoy nadie lo escribe, ni el alta; el SKU se deriva de la
 *     partida (`partidas_resueltas.id_producto`, que resuelve Almacén por huella);
 *   · **cuándo salió** (Ventas 1.8) y **dónde está** (que 1.5 lleve el NS en el lote) — enchufes
 *     declarados de otros módulos, no huecos de esta pantalla.
 *
 * `encontrado: false` viaja como **éxito**: «este serial no está en el concentrado» es una respuesta
 * (y una útil: un disco que se devolvió tampoco está en stock), no un error de la consulta.
 */
export async function consultarNumeroSerie(nsCrudo: string): Promise<RespuestaDato<ResultadoConsultaNs>> {
    const ns = nsCrudo.trim()
    if (!ns) return { success: false, error: 'Escanea o escribe un número de serie.' }

    const supabase = await createClient()
    const { data, error } = await supabase
        .from('numeros_serie')
        .select(
            'id, ns, resultado, id_partida_entrada, creado_por, created_at, entradas(folio, fecha, estado, proveedores(nombre_comercial)), usuarios(nombre_completo)'
        )
        .eq('ns', ns)
        .maybeSingle()
    if (error) return { success: false, error: describirError(error) }
    if (!data) return { success: true, data: { ns, encontrado: false } }

    const fila = data as unknown as {
        id: string
        ns: string
        resultado: 'PASA' | 'NO_PASA'
        id_partida_entrada: string | null
        creado_por: string | null
        created_at: string
        entradas: {
            folio: string
            fecha: string
            estado: EstadoEntrada
            proveedores: { nombre_comercial: string } | null
        } | null
        usuarios: { nombre_completo: string } | null
    }

    /** Lo que esa PARTIDA rindió. Vacío = todavía no pasó Almacén (o rindió varias huellas). */
    let partida: number | null = null
    let categoria: string | null = null
    let productos: ProductoDeLaPartidaNs[] = []
    if (fila.id_partida_entrada) {
        const { data: p } = await supabase
            .from('partidas_entrada')
            .select(
                'partida, categorias_producto(nombre), partidas_resueltas(cantidad_aprobada, productos(sku, nombre))'
            )
            .eq('id', fila.id_partida_entrada)
            .maybeSingle()
        const conPartida = p as unknown as {
            partida: number
            categorias_producto: { nombre: string } | null
            partidas_resueltas:
                | { cantidad_aprobada: number; productos: { sku: string; nombre: string } | null }[]
                | null
        } | null
        if (conPartida) {
            partida = conPartida.partida
            categoria = conPartida.categorias_producto?.nombre ?? null
            productos = (conPartida.partidas_resueltas ?? [])
                .filter((r) => r.productos !== null)
                .map((r) => ({
                    sku: r.productos!.sku,
                    nombre: r.productos!.nombre,
                    cantidad_aprobada: Number(r.cantidad_aprobada),
                }))
        }
    }

    /**
     * ⭐ MEJORA 52 (07 Oct 2026) — **LA LECTURA de esta pieza.** El dueño lo pidió así: *«si queremos
     * saber datos de un dato específico se escanea el NS y nos muestra los 40 datos de la lectura»*.
     * El NS es la **llave**; `lecturas_disco` es **el archivo de la pieza** (append-only: si el disco se
     * leyó dos veces, se trae **la última** y las anteriores quedan como historia).
     * ⚠️ Se busca por `id_numero_serie` (la liga fuerte) y, si faltara, por el `ns` del firmware.
     */
    const { data: lectura } = await supabase
        .from('lecturas_disco')
        .select(
            'ns, ns_windows, modelo, firmware, marca_detectada, marca_confianza, capacidad_gb, rpm, interfaz, es_nvme, horas_uso, encendidos, temperatura_c, salud_veredicto, salud_puntaje, apto, apto_para_decidir, requiere_revision, salud_motivos, sectores_reasignados, sectores_pendientes, sectores_no_corregibles, errores_crc, motor, leido_el, leido_por, lectura_cruda'
        )
        .or(`id_numero_serie.eq.${fila.id ?? 'null'},ns.eq.${fila.ns}`)
        .order('leido_el', { ascending: false })
        .limit(1)
        .maybeSingle()

    return {
        success: true,
        data: {
            ns: fila.ns,
            encontrado: true,
            resultado: fila.resultado,
            folio: fila.entradas?.folio,
            estado_entrada: fila.entradas?.estado,
            proveedor: fila.entradas?.proveedores?.nombre_comercial ?? null,
            fecha_entrada: fila.entradas?.fecha,
            partida,
            categoria,
            capturado_por: fila.usuarios?.nombre_completo ?? null,
            capturado_at: fila.created_at,
            productos,
            lectura: (lectura as unknown as LecturaNs | null) ?? null,
        },
    }
}

/** Categorías capturables (esquema no vacío — HDD/M.2/SSD/RAM): el select de recepción
 *  y el esquema que revisión renderiza para resolver el SKU por huella. Regla D16
 *  (MODELO_DATOS §7.3.2): esquema propio, o el de la raíz si la sub no define uno.
 *  ⭐ MEJORA 44 — trae `requiere_lector`: si la revisión de esa categoría se hace con el
 *  LECTOR DE DISCOS (SMART/salud). Reemplaza la detección por NOMBRE, que era frágil. */
export async function listarCategoriasCapturables(): Promise<RespuestaLista<CategoriaCapturable>> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('categorias_producto')
        .select('id, nombre, id_categoria_padre, esquema_atributos, requiere_lector')
        .eq('es_activo', true)
        .order('nombre', { ascending: true })
    if (error) return { success: false, error: describirError(error) }

    const filas = (data ?? []) as unknown as {
        id: string
        nombre: string
        id_categoria_padre: string | null
        esquema_atributos: AtributoEsquema[] | null
        requiere_lector: boolean | null
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
        .map((f) => ({
            id: f.id,
            nombre: f.nombre,
            esquema: esquemaDe(f),
            // `?? false` es el respaldo del contrato: la columna es NOT NULL, pero un
            // select que la omita NO debe encender el lector por accidente.
            requiere_lector: f.requiere_lector ?? false,
        }))
    return { success: true, data: capturables }
}

/**
 * ⭐ 05 Oct 2026 (ANEXIÓN-BD `g12_a3_b1`) — **LAS 18 categorías del modal de Recepción**, con lo que
 * cada flujo necesita para filtrarlas:
 *   · el flujo de **mercancía NO nueva** ofrece las que tienen `requiere_revision_pieza` (hoy **4**:
 *     HDD · RAM · SSD · M.2) — y por eso el control de categoría **vuelve a ser chips** (de **36px**: densidad de escritorio, FIX 2 del mismo día);
 *   · el de **mercancía nueva**, **las 18 activas** (Familias + Tipos), **agrupadas por Familia**.
 *
 * Devuelve el **esquema efectivo** (propio, o el de la Familia si el Tipo no define uno — regla D16),
 * `requiere_lector` (MEJORA 44) y `tiene_hijas` (para rotular «sin detallar» las Familias que también
 * son opción).
 *
 * ⚠️ El filtro por flujo se hace **en la UI**: es un catálogo **cerrado de 18 filas** ⇒ **una sola
 * lectura** y conmutar el flujo **no cuesta un viaje** (SPEC §10 Gate 2). La regla «el servidor manda»
 * es para listados paginados, no para un catálogo cerrado.
 * ⚠️ `listarCategoriasCapturables()` (arriba) **NO se toca**: la Revisión la sigue consumiendo igual.
 * ⚠️ El flag se lee **de la columna**: prohibido comparar el NOMBRE (el proyecto ya pagó ese defecto
 * con la detección del lector).
 */
export async function listarCategoriasParaEntrada(): Promise<RespuestaLista<CategoriaEntrada>> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('categorias_producto')
        .select('id, nombre, id_categoria_padre, esquema_atributos, requiere_lector, requiere_revision_pieza')
        .eq('es_activo', true)
        .order('nombre', { ascending: true })
    if (error) return { success: false, error: describirError(error) }

    const filas = (data ?? []) as unknown as {
        id: string
        nombre: string
        id_categoria_padre: string | null
        esquema_atributos: AtributoEsquema[] | null
        requiere_lector: boolean | null
        requiere_revision_pieza: boolean | null
    }[]

    /** Esquema EFECTIVO: el propio, o el de la Familia (D16). */
    const esquemaDe = (f: (typeof filas)[number]): AtributoEsquema[] => {
        if (f.esquema_atributos && f.esquema_atributos.length > 0) return f.esquema_atributos
        if (f.id_categoria_padre) {
            const padre = filas.find((x) => x.id === f.id_categoria_padre)
            return (padre?.esquema_atributos ?? []) as AtributoEsquema[]
        }
        return []
    }

    const categorias: CategoriaEntrada[] = filas
        .map((f) => ({
            id: f.id,
            nombre: f.nombre,
            id_categoria_padre: f.id_categoria_padre,
            esquema: esquemaDe(f),
            requiere_lector: f.requiere_lector ?? false,
            // `?? false` es el respaldo del contrato: la columna es NOT NULL, pero un select que la
            // omita NO debe meter una categoría en el flujo NO nueva por accidente.
            requiere_revision_pieza: f.requiere_revision_pieza ?? false,
            tiene_hijas: filas.some((h) => h.id_categoria_padre === f.id),
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

    return { success: true, data: categorias, total: categorias.length }
}

/** Alta rápida de producto (marcado pendiente_enriquecimiento). Usa catálogos default.
 *
 *  ⭐ FIX 05 Oct 2026 — **BUSCA ANTES DE CREAR: la huella es identidad, no una sugerencia.**
 *  Antes, pulsar «Crear producto» N veces creaba N productos: **nada miraba si ya existía uno con
 *  las mismas etiquetas** (así nacieron los duplicados `P-000001`/`P-000003`, dos SKU con la misma
 *  huella). La huella son **los atributos `en_huella` del esquema de la categoría**, que es el mismo
 *  contrato que consume `buscarProductosPorAtributos`.
 *  ⚠️ La búsqueda exige **marca**: marca + categoría son parte de la huella, y sin marca el match
 *  traería el producto de otro fabricante con los mismos atributos.
 *  Devuelve `existente: true` cuando reutilizó uno — la UI lo dice en vez de mentir con «creado».
 */
export async function crearProductoRapido(input: {
    id_categoria: string
    id_marca: string | null
    nombre: string
    atributos: Record<string, unknown>
    /**
     * ⭐ MEJORA 52 (07 Oct 2026) — **`maneja_numero_serie` ya NO nace `false` fijo.**
     *
     * Antes esta función lo escribía `false` a mano ⇒ un **DISCO** creado desde el cotejo nacía
     * diciendo que **no maneja serie**, y eso no es cosmético: el flag lo leen **Ventas**
     * (`ventas.ts`) y la **salida de inventario** (`RegistrarSalidaDialog`) ⇒ el disco **salía sin
     * pedir su NS**. Medido: el único producto vivo (un HDD) tenía `false`.
     *
     * El valor real lo declara la **puerta**: `partidas_entrada.lleva_ns` (la mercancía de este ERP
     * trae serial casi siempre, y el flujo NUEVO lo apaga). Cuando el llamador no lo sabe, el
     * respaldo es **`true`** — asumir que no lleva serie es lo que rompía.
     */
    maneja_numero_serie?: boolean
}): Promise<RespuestaDato<{ id: string; sku: string; existente: boolean }>> {
    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }

    // ── Find: ¿ya hay un producto con ESTA huella? ─────────────────────────────────
    if (input.id_marca) {
        const { data: cat } = await supabase
            .from('categorias_producto')
            .select('esquema_atributos')
            .eq('id', input.id_categoria)
            .maybeSingle()
        const esquema = ((cat?.esquema_atributos ?? []) as AtributoEsquema[])
        const huella: Record<string, string> = {}
        for (const a of esquema) {
            if (!a.en_huella) continue
            const v = input.atributos[a.clave]
            if (v !== undefined && v !== null && String(v) !== '') huella[a.clave] = String(v)
        }
        if (Object.keys(huella).length > 0) {
            const ya = await buscarProductosPorAtributos({
                id_categoria: input.id_categoria,
                id_marca: input.id_marca,
                atributos: huella,
            })
            const candidatos = ya.success ? (ya.data ?? []) : []
            if (candidatos.length > 0) {
                return { success: true, data: { id: candidatos[0].id, sku: candidatos[0].sku, existente: true } }
            }
        }
    }

    const [{ data: unidad }, { data: impuesto }, { data: folio, error: errFolio }] = await Promise.all([
        supabase.from('unidades_medida').select('id').eq('es_activo', true).limit(1).maybeSingle(),
        supabase.from('impuestos').select('id').limit(1).maybeSingle(),
        supabase.rpc('generar_folio', { p_tipo: 'producto' }),
    ])
    if (errFolio) return { success: false, error: describirError(errFolio) }
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
            // ⭐ MEJORA 52 — el dato de la PUERTA (`lleva_ns`); si el llamador no lo sabe, `true`.
            maneja_numero_serie: input.maneja_numero_serie ?? true,
            pendiente_enriquecimiento: true,
            creado_por: sesion.userId,
        })
        .select('id, sku')
        .single()
    if (error) {
        // ⭐ 05 Oct 2026 — **la BD es la autoridad.** Si el índice único `uq_productos_clave_huella`
        // rebotó el INSERT es porque YA existe un producto con la misma huella **normalizada** que
        // el match crudo no vio («480gb» vs «480GB», «i5-12400» vs «i5 12400»). En vez de mostrar el
        // error crudo, se resuelve por la CLAVE —la misma regla de la BD— y se reutiliza.
        // (El 23505 también lo levantan `sku` y `codigo_barras`: por eso se confirma con la búsqueda
        //  por clave antes de decidir; si no aparece, el error se propaga tal cual.)
        if (error.code === '23505') {
            const { data: existente } = await supabase.rpc('producto_por_clave_huella', {
                p_id_categoria: input.id_categoria,
                p_id_marca: input.id_marca,
                p_atributos: input.atributos,
            })
            const fila = (Array.isArray(existente) ? existente[0] : null) as
                | { id: string; sku: string }
                | null
            if (fila) {
                return { success: true, data: { id: fila.id, sku: fila.sku, existente: true } }
            }
        }
        return { success: false, error: describirError(error) }
    }
    return { success: true, data: { id: data.id, sku: data.sku, existente: false } }
}

/** Resultado de la revisión (aprobadas por SKU + devoluciones por motivo). */
export async function listarResultadoRevision(idEntrada: string): Promise<RespuestaDato<ResultadoRevision>> {
    const supabase = await createClient()
    const { data: partidas } = await supabase.from('partidas_entrada').select('id').eq('id_entrada', idEntrada)
    const ids = (partidas ?? []).map((p) => p.id)
    const [{ data: aprobadas }, { data: devoluciones }, { data: liberaciones }] = await Promise.all([
        ids.length
            ? supabase
                  .from('partidas_resueltas')
                  .select('id, id_partida_entrada, id_marca, marcas_producto(nombre), id_producto, productos(sku, nombre), cantidad_aprobada, atributos')
                  .in('id_partida_entrada', ids)
            : Promise.resolve({ data: [] }),
        supabase
            .from('devoluciones_entrada')
            // ⭐ MEJORA 23 Sep 2026 (12) — la DEV dice de qué PARTIDA y de qué PRODUCTO declarado
            // (categoría + atributos de recepción = la huella) se devuelve, y cuándo se ajustó.
            // Embed anidado (devoluciones → partidas_entrada → categorias_producto): sin SQL nuevo.
            .select(
                'id, id_entrada, id_partida_entrada, id_motivo, motivos_rechazo(nombre), cantidad, porcentaje_salud, ns, estado, fecha_ajuste, created_at, partidas_entrada(partida, categorias_producto(nombre), atributos)'
            )
            .eq('id_entrada', idEntrada),
        // ⭐ MEJORA 25 — lo ya liberado: el acondicionamiento clásico solo trabaja el SALDO.
        supabase
            .from('liberaciones_entrada')
            .select('id_partida_resuelta, cantidad')
            .eq('id_entrada', idEntrada),
    ])

    const liberadoPorGrupo = new Map<string, number>()
    for (const l of (liberaciones ?? []) as unknown as {
        id_partida_resuelta: string
        cantidad: number
    }[]) {
        liberadoPorGrupo.set(
            l.id_partida_resuelta,
            (liberadoPorGrupo.get(l.id_partida_resuelta) ?? 0) + Number(l.cantidad ?? 0)
        )
    }

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
        cantidad_liberada: liberadoPorGrupo.get(r.id) ?? 0,
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
/**
 * ⭐ MEJORA 52 (07 Oct 2026) — **LA PARTIDA DE LA CAPACIDAD MEDIDA** (la reclasificación).
 *
 * El caso, del dueño: *«pueden decir que son de 1TB pero vienen 2 de 500GB, **por eso se revisa**»*.
 * La pieza **entra** — no se rechaza: se va a la partida de **su** capacidad, y **cada partida resuelve
 * su SKU** (su ejemplo: *«quedarán 4 HDD 2TB y 1 HDD 3TB»*).
 *
 * ① **Si ya hay una partida de esa capacidad en la entrada, se usa ESA** — aunque sea declarada (es la
 *    regla que él pidió: *«validar si las otras partidas tienen de esa capacidad»*).
 * ② **Si no existe, NACE**: hereda `costo_acordado` y `lleva_ns` de la de origen (**decisión D3**),
 *    y nace con **`cantidad_original = 0`** (**decisión b**: *no venía en la nota del proveedor*) y
 *    `origen = 'reclasificacion'`, que es lo que la hace **visible como nacida** y lo que **relaja los
 *    CHECK** de cantidad solo para ella (`g18_m53b`).
 * ⚠️ Su **`cantidad_vigente` la mueve RECEPCIÓN al validar** (la pieza llega a 0 y sube a 1): entre el
 * guardado y la validación la propuesta está **`pendiente`** y **la nota no se puede emitir**.
 */
async function asegurarPartidaDeCapacidad(
    supabase: Awaited<ReturnType<typeof createClient>>,
    opts: { idEntrada: string; idPartidaOrigen: string; capacidadMedida: string; creadoPor: string }
): Promise<{ id: string; nueva: boolean } | { error: string }> {
    const { data: origen } = await supabase
        .from('partidas_entrada')
        .select('id, id_entrada, id_categoria, atributos, costo_acordado, lleva_ns')
        .eq('id', opts.idPartidaOrigen)
        .single()
    if (!origen) return { error: 'La partida de origen de la reclasificación no existe.' }

    const { data: hermanas } = await supabase
        .from('partidas_entrada')
        .select('id, partida, atributos')
        .eq('id_entrada', origen.id_entrada)
        .eq('id_categoria', origen.id_categoria)

    /** ① ¿ya hay una partida de ESA capacidad? (declarada o nacida, da igual: la pieza va con las suyas). */
    const ya = (hermanas ?? []).find(
        (p) => String((p.atributos as Record<string, unknown> | null)?.capacidad ?? '') === opts.capacidadMedida
    )
    if (ya) return { id: ya.id as string, nueva: false }

    /** ② Nace. El número es el siguiente de la entrada; el resto se hereda (D3) o nace en cero (b). */
    const siguiente = Math.max(0, ...(hermanas ?? []).map((p) => Number(p.partida ?? 0))) + 1
    const { data: nueva, error } = await supabase
        .from('partidas_entrada')
        .insert({
            id_entrada: origen.id_entrada,
            partida: siguiente,
            id_categoria: origen.id_categoria,
            atributos: {
                ...((origen.atributos as Record<string, unknown> | null) ?? {}),
                capacidad: opts.capacidadMedida,
            },
            cantidad_original: 0,
            cantidad_vigente: 0,
            costo_acordado: origen.costo_acordado,
            lleva_ns: origen.lleva_ns,
            estado_partida: 'PENDIENTE',
            origen: 'reclasificacion',
            creado_por: opts.creadoPor,
        })
        .select('id')
        .single()
    if (error || !nueva) {
        return { error: describirError(error) ?? 'No se pudo crear la partida de la capacidad medida.' }
    }
    return { id: nueva.id as string, nueva: true }
}

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

    /**
     * ⭐ MEJORA 52 (07 Oct 2026) — **LA RECLASIFICACIÓN, en el acto de guardar.**
     *
     * Las piezas que el técnico marcó («**Crear partida**» — su decisión, tomada **al leer**, cuando vio
     * el aviso rojo) **no son de la partida que revisó**: cada una se va a la partida de **SU** capacidad
     * (la que ya exista en la entrada, o una que **nace** heredando costo y `lleva_ns`).
     *
     * ⚠️ **El re-apunte va ACÁ, antes del tope y del agrupado**, y no en la UI: así su **huella**, su
     * **NS** y su **evidencia** cuelgan del DESTINO, que es donde la pieza de verdad está — y el wizard
     * sigue sin escribir nada (la regla del panel: *«esto NO escribe en la base»*).
     *
     * ⚠️ Y **no se pierde la decisión**: cada re-apunte deja una fila **`pendiente`** en
     * `reclasificaciones_entrada`, que **RECEPCIÓN valida al cerrar la revisión** (decisión D4). Hasta
     * entonces la nota **no se puede emitir**.
     */
    type Reclasificada = { idPartidaOrigen: string; idPartidaDestino: string; pieza: PiezaRevision }
    const reclasificadas: Reclasificada[] = []
    const destinos = new Map<string, string>()
    for (const p of input.piezas) {
        if (p.reclasificar !== true || !p.desvio) continue
        const origen = p.id_partida_entrada
        const llave = `${origen}|${p.desvio.medida}`
        let idDestino = destinos.get(llave)
        if (!idDestino) {
            const r = await asegurarPartidaDeCapacidad(supabase, {
                idEntrada: input.id_entrada,
                idPartidaOrigen: origen,
                capacidadMedida: p.desvio.medida,
                creadoPor: sesion.userId,
            })
            if ('error' in r) return { success: false, error: r.error }
            idDestino = r.id
            destinos.set(llave, idDestino)
        }
        reclasificadas.push({ idPartidaOrigen: origen, idPartidaDestino: idDestino, pieza: p })
        p.id_partida_entrada = idDestino
    }
    /**
     * ⭐ **D5 — el NS de una pieza reclasificada apunta a la partida NUEVA.** No se adivina: la pieza
     * **trae su NS** (el de la lectura del panel), así que se sabe sin depender del orden del concentrado.
     */
    const nsReclasificados = new Map<string, string>()
    for (const r of reclasificadas) {
        if (r.pieza.ns) nsReclasificados.set(r.pieza.ns, r.idPartidaDestino)
    }
    /**
     * ⭐ FIX 08 Oct 2026 — **LA PROPUESTA SE REGISTRA *ANTES* DE MOVER EL VIGENTE.**
     *
     * El **orden es el FIX**, no un detalle de estilo: el candado de la BD
     * (`fn_partidas_vigente_guard` · migración `g18_m53c`) solo permite que una partida **crezca por
     * encima de lo declarado** si las piezas que llegaron **están declaradas** en
     * `reclasificaciones_entrada`. Moviendo el vigente primero, el candado no las ve y **rechaza el
     * guardado entero** (`23514`) — que es exactamente el defecto medido el 08 Oct 2026: la
     * reclasificación cuyo destino era una partida **declarada** (la entrada ya tenía una partida de
     * esa capacidad) **no se podía guardar** y el turno del técnico se caía.
     *
     * Es el mismo esqueleto que la DEV: la fila guarda **la constancia del desvío**
     * (`capacidad_declarada` vs `capacidad_medida`), la pieza (`atributos` · marca · NS) y las dos
     * partidas, en `pendiente` hasta que **Recepción la valida** (D4) — y **mientras haya una
     * pendiente la nota no se puede emitir**.
     *
     * ⚠️ **Sin transacción en PostgREST:** si algo falla después, la propuesta queda `pendiente` sin
     * mover el vigente. No se esconde: `ajustarYGenerarNota` recalcula con la **fórmula absoluta**,
     * así que el estado converge al validarla.
     */
    if (reclasificadas.length > 0) {
        const { error: errRec } = await supabase.from('reclasificaciones_entrada').insert(
            reclasificadas.map((r) => ({
                id_entrada: input.id_entrada,
                id_partida_origen: r.idPartidaOrigen,
                id_partida_destino: r.idPartidaDestino,
                cantidad: 1,
                ns: r.pieza.ns ?? null,
                id_marca: r.pieza.id_marca,
                atributos: r.pieza.atributos,
                capacidad_declarada: r.pieza.desvio?.declarada ?? '',
                capacidad_medida: r.pieza.desvio?.medida ?? '',
                estado: 'pendiente',
                creado_por: sesion.userId,
            }))
        )
        if (errRec) return { success: false, error: describirError(errRec) }
    }
    /**
     * ⭐ MEJORA 52 — **el «final» de las dos partidas se mueve ACÁ, no al emitir la nota.**
     *
     * ⚠️ El porqué, medido: la pieza **ya salió** del origen (el técnico lo decidió y se registró en su
     * partida) ⇒ si el origen siguiera diciendo 5 con 4 aprobadas, la Revisión mostraría **4 de 5** y
     * **la entrada nunca cerraría** (y la nota se emite solo al cerrar). Además el ajuste de la nota
     * recalcula el vigente con la **misma fórmula absoluta** (`original − DEV + llegan − salen`), así que
     * **re-afirma el mismo número**: no hay doble movimiento.
     *
     * ⚠️ La **validación de Recepción** sigue siendo la que manda: la propuesta queda `pendiente`, y
     * **sin validarla no se emite la nota** (decisión D4). Si Recepción la rechazara, se revierte.
     */
    if (reclasificadas.length > 0) {
        const salenPorPartida = new Map<string, number>()
        const lleganPorPartida = new Map<string, number>()
        for (const r of reclasificadas) {
            salenPorPartida.set(r.idPartidaOrigen, (salenPorPartida.get(r.idPartidaOrigen) ?? 0) + 1)
            lleganPorPartida.set(r.idPartidaDestino, (lleganPorPartida.get(r.idPartidaDestino) ?? 0) + 1)
        }
        const idsTocadas = new Set([...salenPorPartida.keys(), ...lleganPorPartida.keys()])
        const { data: vigentesActuales } = await supabase
            .from('partidas_entrada')
            .select('id, cantidad_vigente')
            .in('id', [...idsTocadas])
        for (const p of vigentesActuales ?? []) {
            const nueva =
                Math.max(0, Number(p.cantidad_vigente ?? 0)) +
                (lleganPorPartida.get(p.id as string) ?? 0) -
                (salenPorPartida.get(p.id as string) ?? 0)
            const { data: updVig, error: errVig } = await supabase
                .from('partidas_entrada')
                .update({ cantidad_vigente: Math.max(0, nueva) })
                .eq('id', p.id)
                .select('id')
            if (errVig) return { success: false, error: describirError(errVig) }
            const errFilasVig = sinEscritura(updVig, 'mover la cantidad vigente por la reclasificación')
            if (errFilasVig) return { success: false, error: errFilasVig }
        }
    }

    /**
     * ⭐ MEJORA 44 (30 Sep 2026) — **LA SALUD SIN AVAL NO MANDA UNA DEVOLUCIÓN.**
     *
     * El número de salud sale de TRES fuentes y no son equivalentes: `hdsentinel` (el taller) y
     * `nvme` (el propio disco) deciden; `formula` —el respaldo de la casa, que **ARRANCA EN 100** y
     * resta puntos por daño— NO. Si HDSentinel no tiene el disco en su reporte, la fórmula dice
     * «100 %, pasa» por defecto, y al revés: un disco con daño real puntuado por la fórmula mandaba
     * una devolución con un número que el taller nunca avaló.
     *
     * La regla vive acá y no solo en la UI por la misma razón que el tope de la MEJORA 25: **la UI
     * protege al técnico de sí mismo, el servidor protege el dato.** Un `SALUD_BAJA` sobre un disco
     * sin aval es una devolución inventada; si el técnico quiere devolverlo igual, tiene los tres
     * motivos A MANO (`DANO_FISICO` · `NO_FUNCIONA` · `EMPAQUE_DANADO`), que sí son su palabra y no
     * la de una fórmula.
     */
    const MOTIVOS_CON_SALUD = new Set(['SALUD_BAJA'])
    if (input.lecturas?.length) {
        /**
         * ⚠️ SE AGRUPA POR PARTIDA, NO POR NS. La pieza ya no lleva `ns` (MEJORA 35: el NS vive en el
         * concentrado de la tanda, no en la pieza), así que emparejar pieza↔lectura por NS sería un
         * guard que **nunca se dispara**. Lo que sí se puede afirmar: si en esta tanda se devuelve por
         * salud y **EN ESA PARTIDA** ninguna lectura tiene aval, ese `SALUD_BAJA` salió de la fórmula.
         */
        const idsMotivo = [...new Set(input.piezas.map((p) => p.id_motivo).filter((x): x is string => !!x))]
        const { data: filasMotivo } = idsMotivo.length
            ? await supabase.from('motivos_rechazo').select('id, clave').in('id', idsMotivo)
            : { data: [] as { id: string; clave: string | null }[] }
        const claveDeMotivo = new Map<string, string>(
            ((filasMotivo ?? []) as { id: string; clave: string | null }[]).map((m) => [m.id, m.clave ?? ''])
        )

        // Partidas de esta tanda donde NINGUNA lectura pudo decidir.
        const partidasSinAval = new Set<string>()
        for (const idPartida of new Set(input.piezas.map((p) => p.id_partida_entrada))) {
            const delGrupo = input.lecturas.filter((l) => l.id_partida_entrada === idPartida)
            if (delGrupo.length > 0 && delGrupo.every((l) => l.apto_para_decidir !== true)) {
                partidasSinAval.add(idPartida)
            }
        }

        const culpable = input.piezas.find(
            (p) =>
                p.resultado === 'NO_PASA' &&
                !!p.id_motivo &&
                MOTIVOS_CON_SALUD.has(claveDeMotivo.get(p.id_motivo) ?? '') &&
                partidasSinAval.has(p.id_partida_entrada)
        )
        if (culpable) {
            const l = input.lecturas.find((x) => x.id_partida_entrada === culpable.id_partida_entrada)
            return {
                success: false,
                error:
                    'La salud de ese disco NO está avalada por HDSentinel' +
                    `${l?.salud_puntaje != null ? ` (${l.salud_puntaje} %` : ' ('}` +
                    `${l?.salud_veredicto ? `, fuente: ${l.salud_veredicto}` : ', fuente: la fórmula propia del agente'}` +
                    '). El agente la calculó con su fórmula, que arranca en 100: esa devolución no se puede ' +
                    'registrar así. Si el disco está dañado, rechazalo a mano (Daño físico / No funciona / ' +
                    'Empaque dañado) y queda tu palabra en vez de un número sin aval.',
            }
        }
    }

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

    // ⭐ MEJORA 25 (24 Sep 2026) — TOPE EN SERVIDOR. El wizard ya corta en el cliente
    // (`items.length >= restantes`), pero eso solo protege al técnico de sí mismo: dos técnicos
    // con la MISMA partida abierta podían guardar 30 y 30 sobre 50 restantes y dejar **60
    // aprobadas de 50**. La V5 sí lo validaba en servidor (`20_Revision.gs · guardarPartida`:
    // *«La partida N ya quedó completa (revisada por otro técnico)»*); el ERP solo lo tenía en la
    // UI. Se recalcula el avance REAL de cada partida tocada antes de escribir nada.
    // ⚠️ Es una relectura, no un candado: dos guardados EXACTAMENTE simultáneos aún podrían pasar
    // los dos (haría falta un `for update` en una función, como `fn_liberar_avance`). Se declara.
    const deltaPorPartida = new Map<string, { ok: number; mal: number }>()
    /**
     * ⭐ MEJORA 28 Sep 2026 (D1/D2) — **qué partidas de este turno se identifican por NS.** Se llena
     * en la MISMA relectura del tope (no cuesta un viaje más) y decide, antes de escribir: si alguna
     * la lleva, el concentrado es obligatorio y tiene que cuadrar.
     */
    const partidasConNs = new Set<string>()
    for (const p of pasa) {
        const acc = deltaPorPartida.get(p.id_partida_entrada) ?? { ok: 0, mal: 0 }
        acc.ok += 1
        deltaPorPartida.set(p.id_partida_entrada, acc)
    }
    for (const p of noPasa) {
        const acc = deltaPorPartida.get(p.id_partida_entrada) ?? { ok: 0, mal: 0 }
        acc.mal += 1
        deltaPorPartida.set(p.id_partida_entrada, acc)
    }
    for (const [idPartida, delta] of deltaPorPartida) {
        const [{ data: partida }, { data: resueltas }, { data: devs }] = await Promise.all([
            supabase
                .from('partidas_entrada')
                .select('cantidad_original, cantidad_vigente, partida, lleva_ns, origen')
                .eq('id', idPartida)
                .single(),
            supabase.from('partidas_resueltas').select('cantidad_aprobada').eq('id_partida_entrada', idPartida),
            supabase.from('devoluciones_entrada').select('cantidad').eq('id_partida_entrada', idPartida),
        ])
        if (!partida) continue
        if (partida.lleva_ns) partidasConNs.add(idPartida)
        /**
         * ⭐ MEJORA 52 — **una partida NACIDA por reclasificación no tiene tope.** No hay nada declarado
         * que respetar (`cantidad_original = 0`): sus piezas **no vienen de la nota del proveedor**, llegan
         * por la decisión del técnico (y la valida Recepción). El tope sigue intacto para las declaradas,
         * que es lo que protege de revisar 60 piezas de 50.
         */
        if (partida.origen === 'reclasificacion') continue
        const yaOk = (resueltas ?? []).reduce((s, r) => s + Number(r.cantidad_aprobada ?? 0), 0)
        const yaMal = (devs ?? []).reduce((s, d) => s + Number(d.cantidad ?? 0), 0)
        /**
         * ⭐ MEJORA 52 — el tope también va contra el **FINAL** de la partida, no contra lo declarado:
         * de lo contrario una partida a la que se le fue una pieza por reclasificación **aceptaría una
         * más** (5 declaradas, 4 en casa… y `original − revisadas` = 1). ⚠️ La UI manda el mismo número
         * (`restantes`), pero **el servidor protege el dato**: los dos tienen que coincidir.
         */
        const vigente = Number(partida.cantidad_vigente)
        const restantes = Math.max(0, vigente - yaOk - yaMal)
        if (delta.ok + delta.mal > restantes) {
            return {
                success: false,
                error:
                    restantes === 0
                        ? `La partida ${partida.partida} ya quedó completa (la revisó otro técnico). Actualiza tu cola.`
                        : `Solo quedan ${restantes} pieza(s) por revisar en la partida ${partida.partida}; tu turno trae ${delta.ok + delta.mal}. Reduce tu lote.`,
            }
        }
    }

    // ⭐ Evolución V5 (20 Sep): PASA agrupadas por (partida, MARCA, atributos) →
    // `partidas_resueltas` guarda la HUELLA (`id_marca` + `atributos`); el SKU
    // (`id_producto`) queda NULL y lo asigna ALMACÉN al cotejar.
    const gruposPasa = new Map<
        string,
        { idPartida: string; idMarca: string; atributos: Record<string, string | string[]>; count: number }
    >()
    for (const p of pasa) {
        const k = `${p.id_partida_entrada}|${p.id_marca}|${huellaCanonica(p.atributos)}`
        const g =
            gruposPasa.get(k) ??
            ({ idPartida: p.id_partida_entrada, idMarca: p.id_marca, atributos: p.atributos ?? {}, count: 0 } as const as {
                idPartida: string
                idMarca: string
                atributos: Record<string, string | string[]>
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
            (r) => huellaCanonica(r.atributos as Record<string, unknown> | null) === huellaCanonica(g.atributos)
        )
        if (existente) {
            const { data: upd, error: errUpd } = await supabase
                .from('partidas_resueltas')
                .update({ cantidad_aprobada: Number(existente.cantidad_aprobada) + g.count })
                .eq('id', existente.id)
                .select('id')
            if (errUpd) return { success: false, error: describirError(errUpd) }
            const errFilas = sinEscritura(upd, 'sumar el avance del grupo aprobado')
            if (errFilas) return { success: false, error: errFilas }
        } else {
            const { error: errIns } = await supabase.from('partidas_resueltas').insert({
                id_partida_entrada: g.idPartida,
                id_marca: g.idMarca,
                atributos: g.atributos,
                cantidad_aprobada: g.count,
                creado_por: sesion.userId,
                // id_producto NULL — lo resuelve ALMACÉN por huella.
            })
            if (errIns) return { success: false, error: describirError(errIns) }
        }
    }

    /**
     * ⚠️ **La propuesta de reclasificación YA se registró arriba** — ver «LA PROPUESTA SE REGISTRA
     * *ANTES* DE MOVER EL VIGENTE». Se movió a propósito: el candado de la BD (`g18_m53c`) exige que
     * las piezas que llegaron existan como filas **antes** de que el vigente crezca. No volver a
     * insertarla acá.
     */

    /**
     * ⭐ MEJORA 35 (27 Sep 2026) — **el CONCENTRADO de la tanda**: los NS que el técnico escaneó en las
     * dos pantallas, con su partida y su resultado (PASA / NO_PASA). El NS **no es un dato de la pieza**:
     * es el concentrado de la ENTRADA — y por eso el `UNIQUE` de `ns` impide que un disco rechazado
     * vuelva a entrar. Se escribe en UNA inserción con la tanda (D2: sin NS no hay guardado).
     * La marca y el motivo NO se guardan aquí: el NS no los conoce (corrección del usuario, 27 Sep).
     */
    /**
     * ⭐ MEJORA 44 — `ns` → `id` de `numeros_serie`: lo que permite ligar cada LECTURA con su PIEZA
     * (se llena con el insert de arriba y se usa abajo, en el mismo acto de guardado).
     */
    const idsNs = new Map<string, string>()

    if (input.ns) {
        /**
         * ⭐ MEJORA 28 Sep 2026 — **D2, aplicada en el SERVIDOR.** El concentrado no es un adorno de la
         * UI: si la partida del turno se identifica por NS y no llega, NO se escribe (misma doctrina que
         * el tope de la MEJORA 25 — la UI protege al técnico de sí mismo, el servidor protege el dato).
         * Y **cuadra exacto**: un NS por pieza aprobada y otro por cada devuelta. Un concentrado más
         * largo que el turno es basura que el `UNIQUE` de `ns` volvería irreversible.
         * El tope del cliente ya lo impide; esto lo hace imposible por cualquier puerta.
         */
        if (input.ns.pasa.length !== pasa.length || input.ns.noPasa.length !== noPasa.length) {
            return {
                success: false,
                error: `El concentrado no cuadra con el turno: ${input.ns.pasa.length} NS aprobados contra ${pasa.length} pieza(s) aprobadas y ${input.ns.noPasa.length} NS devueltos contra ${noPasa.length} devuelta(s).`,
            }
        }
        const todosNs = [...input.ns.pasa, ...input.ns.noPasa].map((ns) => ns.trim())
        if (todosNs.some((ns) => !ns)) {
            return { success: false, error: 'Hay un NS vacío en el concentrado.' }
        }
        if (new Set(todosNs).size !== todosNs.length) {
            return { success: false, error: 'Hay un NS repetido dentro del mismo concentrado.' }
        }
        // La partida se atribuye SOLO cuando la tanda entera es de una. Si el técnico revisó piezas de
        // dos partidas, el NS queda colgando de la ENTRADA (NULL) antes que inventar a cuál pertenece (L6).
        // ⭐ MEJORA 52 — pero si la tanda se partió por una **reclasificación**, las piezas que SÍ son de
        // esta partida siguen siendo de una sola: se calcula sobre las que se quedan, y los NS de las
        // reclasificadas van a SU partida (D5, abajo) porque la pieza trae su NS.
        const piezasQueSeQuedan = input.piezas.filter(
            (p) => !reclasificadas.some((r) => r.pieza === p)
        )
        const partidasTanda = new Set(piezasQueSeQuedan.map((p) => p.id_partida_entrada))
        const idPartidaTanda = partidasTanda.size === 1 ? [...partidasTanda][0] : null
        const filasNs = [
            ...input.ns.pasa.map((ns) => ({ ns: ns.trim(), resultado: 'PASA' })),
            ...input.ns.noPasa.map((ns) => ({ ns: ns.trim(), resultado: 'NO_PASA' })),
        ].map((f) => ({
            ns: f.ns,
            id_entrada: input.id_entrada,
            id_partida_entrada: nsReclasificados.get(f.ns) ?? idPartidaTanda,
            resultado: f.resultado,
            creado_por: sesion.userId,
        }))
        if (filasNs.length) {
            // ⭐ MEJORA 44 — se piden los ids de vuelta para poder LIGAR cada lectura con su pieza.
            const { data: nsCreados, error: errNs } = await supabase
                .from('numeros_serie')
                .insert(filasNs)
                .select('id, ns')
            if (errNs) return { success: false, error: describirError(errNs) }
            for (const r of nsCreados ?? []) idsNs.set(r.ns, r.id)
        }

        /**
         * ⭐ MEJORA 44 (30 Sep 2026) — **la LECTURA del disco** entra como EVIDENCIA en el mismo acto
         * que la tanda y el concentrado. `lecturas_disco` es append-only: no se actualiza ni se borra.
         * ⚠ `id_partida_resuelta` queda NULL en esta pasada (ligar cada lectura a su grupo de huella es
         * un refinamiento pendiente); la lectura SÍ queda ligada a su entrada, partida, NS y marca.
         * ⚠ Si el puesto no tiene agente, `input.lecturas` no viene y no pasa nada: nunca bloquea.
         */
        if (input.lecturas?.length) {
            const filasLecturas = input.lecturas
                .filter((l) => l.ns)
                .map((l) => ({
                    id_entrada: input.id_entrada,
                    id_partida_entrada: l.id_partida_entrada,
                    id_numero_serie: idsNs.get(l.ns) ?? null,
                    id_marca: l.id_marca ?? null,
                    ns: l.ns,
                    ns_windows: l.ns_windows ?? null,
                    lun: l.lun ?? null,
                    disco_fisico: l.disco_fisico ?? null,
                    bahia: l.bahia ?? null,
                    modelo: l.modelo ?? null,
                    firmware: l.firmware ?? null,
                    capacidad_gb: l.capacidad_gb ?? null,
                    rpm: l.rpm ?? null,
                    interfaz: l.interfaz ?? null,
                    es_nvme: l.es_nvme ?? false,
                    horas_uso: l.horas_uso ?? null,
                    encendidos: l.encendidos ?? null,
                    temperatura_c: l.temperatura_c ?? null,
                    salud_veredicto: l.salud_veredicto ?? null,
                    salud_puntaje: l.salud_puntaje ?? null,
                    salud_en_falla: l.salud_en_falla ?? false,
                    salud_motivos: (l.salud_motivos ?? []) as never,
                    apto: l.apto ?? null,
                    // ⭐ MEJORA 44 — el AVAL de la salud (ver `g18_m44_aval_salud`).
                    apto_para_decidir: l.apto_para_decidir ?? false,
                    requiere_revision: l.requiere_revision ?? false,
                    sectores_reasignados: l.sectores_reasignados ?? null,
                    sectores_pendientes: l.sectores_pendientes ?? null,
                    sectores_no_corregibles: l.sectores_no_corregibles ?? null,
                    errores_crc: l.errores_crc ?? null,
                    motor: l.motor ?? 'desconocido',
                    smart_raw: (l.smart_raw ?? null) as never,
                    // ⭐ MEJORA 52 (07 Oct 2026) — las 2 columnas que YA existían y quedaban NULL
                    // (el agente ya mandaba la marca sugerida y su confianza: se tiraban) + la
                    // evidencia completa del agente (`g18_m52_lectura_cruda_agente`).
                    marca_detectada: l.marca_detectada ?? null,
                    marca_confianza: l.marca_confianza ?? null,
                    lectura_cruda: (l.lectura_cruda ?? null) as never,
                    origen: 'revision',
                    leido_por: sesion.userId,
                    creado_por: sesion.userId,
                }))
            if (filasLecturas.length) {
                const { error: errLecturas } = await supabase.from('lecturas_disco').insert(filasLecturas)
                if (errLecturas) return { success: false, error: describirError(errLecturas) }
            }
        }
    } else {
        /**
         * ⭐ MEJORA 28 Sep 2026 — **sin concentrado solo se puede guardar si NINGUNA partida del turno
         * lleva NS.** Si alguna lo lleva, el guardado se detiene con el motivo a la vista en vez de
         * escribir una tanda sin constancia (D2).
         */
        if (partidasConNs.size > 0) {
            return {
                success: false,
                error: 'Esta partida se identifica por número de serie: faltan los NS del turno. Vuelve a guardar y escanéalos.',
            }
        }
        // ⚠️ Respaldo LEGADO: piezas capturadas con `ns` propio antes de la MEJORA 35.
        for (const p of pasa) {
            if (p.ns) {
                const { error: errNs } = await supabase.from('numeros_serie').insert({
                    ns: p.ns,
                    id_entrada: input.id_entrada,
                    creado_por: sesion.userId,
                })
                if (errNs) return { success: false, error: describirError(errNs) }
            }
        }
    }

    // ⭐ MEJORA 29 (25 Sep 2026) — NO_PASA agrupadas por **(partida, motivo, HUELLA)**: la marca y
    // los atributos de la pieza mala **ya no se tiran**. Antes la clave era `(partida, motivo)` y
    // dos marcas distintas del mismo motivo se fundían en una fila sin marca: el desglose no podía
    // decir a qué producto pertenecía la DEV y la línea con DEV no mostraba su avance. `claveLinea`
    // es la MISMA con la que se empareja al leer y la misma que usan los PASA.
    const gruposNoPasa = new Map<
        string,
        {
            idPartida: string
            idMotivo: string
            idMarca: string
            atributos: Record<string, string | string[]>
            count: number
            salud: number | null
        }
    >()
    for (const p of noPasa) {
        const k = `${p.id_partida_entrada}|${p.id_motivo ?? ''}|${claveLinea(p.id_marca, p.atributos)}`
        const g = gruposNoPasa.get(k) ?? {
            idPartida: p.id_partida_entrada,
            idMotivo: p.id_motivo ?? '',
            idMarca: p.id_marca,
            atributos: p.atributos ?? {},
            count: 0,
            salud: null,
        }
        g.count += 1
        if (p.porcentaje_salud != null) g.salud = p.porcentaje_salud
        gruposNoPasa.set(k, g)
    }
    for (const g of gruposNoPasa.values()) {
        // Se buscan las DEV de ese (partida, motivo) y se empareja la HUELLA en JS con la clave
        // canónica. `maybeSingle()` mentía aquí: con dos marcas distintas del mismo motivo devuelve
        // error («multiple rows») en vez de la fila que toca.
        const { data: existentes } = await supabase
            .from('devoluciones_entrada')
            .select('id, cantidad, id_marca, atributos')
            .eq('id_partida_entrada', g.idPartida)
            .eq('id_motivo', g.idMotivo)
        const existente = (
            (existentes ?? []) as unknown as {
                id: string
                cantidad: number
                id_marca: string | null
                atributos: Record<string, unknown> | null
            }[]
        ).find((d) => claveLinea(d.id_marca, d.atributos) === claveLinea(g.idMarca, g.atributos))
        if (existente) {
            const { data: upd, error: errUpd } = await supabase
                .from('devoluciones_entrada')
                .update({ cantidad: Number(existente.cantidad) + g.count })
                .eq('id', existente.id)
                .select('id')
            if (errUpd) return { success: false, error: describirError(errUpd) }
            const errFilas = sinEscritura(upd, 'sumar la DEV del mismo motivo')
            if (errFilas) return { success: false, error: errFilas }
        } else {
            const { error: errIns } = await supabase.from('devoluciones_entrada').insert({
                id_entrada: input.id_entrada,
                id_partida_entrada: g.idPartida,
                id_motivo: g.idMotivo || null,
                cantidad: g.count,
                porcentaje_salud: g.salud,
                estado: 'por_cotejar',
                // ⭐ MEJORA 29 — la huella de la pieza devuelta (antes se perdía).
                id_marca: g.idMarca,
                atributos: g.atributos,
                creado_por: sesion.userId,
            })
            if (errIns) return { success: false, error: describirError(errIns) }
        }
    }

    /**
     * Cierre de partida (`aprobadas + devueltas >= FINAL` → `OK | MAL`).
     *
     * ⭐ FIX 08 Oct 2026 — **el cierre se mide contra `cantidad_vigente`, no contra
     * `cantidad_original`.** Es el tramo que faltaba de la MEJORA 52: el **tope de servidor** y el
     * **`restantes`** de la vista (`listarPartidasConAvance`) ya se medían contra el final, pero el
     * cierre se quedó en lo declarado ⇒ una partida a la que la **reclasificación** le quitó una
     * pieza **nunca** alcanzaba su `cantidad_original` y quedaba `PENDIENTE` **para siempre**.
     * `fn_cerrar_revision` exige **0 partidas `PENDIENTE`**, así que la entrada **nunca cerraba la
     * revisión** y la nota era **inalcanzable** (medido el 08 Oct 2026 en `ING-0008`: 5 declaradas,
     * 4 revisadas + 1 en su partida nueva ⇒ la entrada se quedaba en `en_revision` con `restantes = 0`).
     *
     * ⚠️ **El caso normal NO cambia:** durante la revisión la DEV todavía no se aplica
     * (`ajustarYGenerarNota` la aplica al emitir la nota), así que `vigente === original` salvo que
     * haya habido una reclasificación — que es justo lo que esto arregla. La partida **nacida**
     * (`original = 0`, `vigente = lo que llegó`) cierra igual que antes.
     */
    const partidasAfectadas = new Set(input.piezas.map((p) => p.id_partida_entrada))
    for (const idPartida of partidasAfectadas) {
        const { data: partida } = await supabase.from('partidas_entrada').select('cantidad_vigente').eq('id', idPartida).single()
        if (!partida) continue
        const [{ data: resueltas }, { data: devs }] = await Promise.all([
            supabase.from('partidas_resueltas').select('cantidad_aprobada').eq('id_partida_entrada', idPartida),
            supabase.from('devoluciones_entrada').select('cantidad').eq('id_partida_entrada', idPartida),
        ])
        const totalOk = (resueltas ?? []).reduce((s, r) => s + Number(r.cantidad_aprobada), 0)
        const totalMal = (devs ?? []).reduce((s, d) => s + Number(d.cantidad), 0)
        if (totalOk + totalMal >= Number(partida.cantidad_vigente)) {
            const { data: upd, error: errPart } = await supabase
                .from('partidas_entrada')
                .update({ estado_partida: totalMal > 0 ? 'MAL' : 'OK' })
                .eq('id', idPartida)
                .select('id')
            if (errPart) return { success: false, error: describirError(errPart) }
            const errFilas = sinEscritura(upd, 'cerrar la partida (OK/MAL)')
            if (errFilas) return { success: false, error: errFilas }
        }
    }

    // Cierre automático de la entrada (fn_cerrar_revision).
    await supabase.rpc('fn_cerrar_revision', { p_id_entrada: input.id_entrada })

    return { success: true }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⭐ MEJORA 25 (24 Sep 2026 · decisión 22 del mapa) — LIBERACIÓN PARCIAL: LA TANDA
//
// El pedido: *«si ya se revisaron 20 discos o 10, se guarda y esos 10 ya pueden ser limpiados …
// y a almacén, para que esos 10 ya se puedan vender, en lo que el resto de la revisión concluye»*.
//
// La tanda es un camino PARALELO al de `entradas.estado`: la entrada **sigue en `en_revision`**
// mientras las tandas fluyen. Por eso estas acciones NO escriben `transiciones_etapa` — no hay
// transición del documento; hay movimiento de mercancía.
//
//   liberarAvance → por_limpiar → tomarTanda → en_limpieza → entregarTanda → en_almacen
//                 → confirmarAltaTanda → confirmada (lote + movimiento: el ÚNICO punto que sube stock)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Libera un conjunto de grupos aprobados como **UNA tanda** hacia Acondicionamiento.
 * Toda la validación (permiso, tope del saldo aprobado, consecutivo) vive en `fn_liberar_avance`:
 * es la única forma de que dos liberaciones simultáneas no se pisen.
 */
export async function liberarAvance(
    input: LiberarAvanceInput
): Promise<RespuestaDato<{ tanda: number }>> {
    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }

    const { data: entrada } = await supabase
        .from('entradas')
        .select('estado')
        .eq('id', input.id_entrada)
        .single()
    if (!entrada) return { success: false, error: 'La entrada no existe.' }
    // ⭐ FIX 25 Sep 2026 — la lista sale de `ESTADOS_LIBERABLES` (fuente única en `types/entradas`):
    // antes vivía SOLO aquí y la UI se pintaba con `liberables > 0`, así que ofrecía la acción en 7
    // entradas ya avanzadas y el servidor la rechazaba con este mismo mensaje.
    if (!puedeLiberar(entrada.estado as Entrada['estado'])) {
        return { success: false, error: 'La entrada ya avanzó: no se puede liberar desde la revisión.' }
    }
    if (input.items.length === 0) return { success: false, error: 'No hay grupos por liberar.' }

    const { data, error } = await supabase.rpc('fn_liberar_avance', {
        p_id_entrada: input.id_entrada,
        p_items: input.items,
        p_notas: input.notas ?? null,
    })
    if (error) return { success: false, error: describirError(error) }
    return { success: true, data: { tanda: Number(data) } }
}

/** El embed crudo de la tanda: una fila por GRUPO (varias filas = una tanda). */
interface FilaLiberacionCruda {
    id: string
    id_tanda: string
    tanda: number
    cantidad: number
    cantidad_confirmada: number | null
    estado: string
    fecha_liberacion: string
    liberado_por: string | null
    usuarios: { nombre_completo: string | null } | null
    entradas: {
        id: string
        folio: string
        proveedores: { nombre_comercial: string | null } | null
    } | null
    partidas_resueltas: {
        id: string
        id_marca: string | null
        marcas_producto: { nombre: string | null } | null
        atributos: Record<string, unknown> | null
        cantidad_aprobada: number
        id_producto: string | null
        productos: { sku: string | null } | null
        partidas_entrada: {
            partida: number | null
            id_categoria: string | null
            categorias_producto: { nombre: string | null } | null
            costo_acordado: number | null
        } | null
    } | null
}

const SELECT_TANDA =
    'id, id_tanda, tanda, cantidad, cantidad_confirmada, estado, fecha_liberacion, liberado_por, ' +
    'usuarios!liberaciones_entrada_liberado_por_fkey(nombre_completo), ' +
    'entradas(id, folio, proveedores(nombre_comercial)), ' +
    'partidas_resueltas(id, id_marca, marcas_producto(nombre), atributos, cantidad_aprobada, id_producto, productos(sku), ' +
    'partidas_entrada(partida, id_categoria, categorias_producto(nombre), costo_acordado))'

/** Agrupa las filas crudas por `id_tanda`: N grupos = una tanda. */
function aTandas(filas: FilaLiberacionCruda[]): TandaLiberada[] {
    const porTanda = new Map<string, TandaLiberada>()
    for (const f of filas) {
        const grupo: TandaGrupo = {
            id: f.id,
            id_partida_resuelta: f.partidas_resueltas?.id ?? '',
            partida_numero: f.partidas_resueltas?.partidas_entrada?.partida ?? null,
            id_categoria: f.partidas_resueltas?.partidas_entrada?.id_categoria ?? null,
            categoria_nombre: f.partidas_resueltas?.partidas_entrada?.categorias_producto?.nombre ?? null,
            id_marca: f.partidas_resueltas?.id_marca ?? null,
            marca_nombre: f.partidas_resueltas?.marcas_producto?.nombre ?? null,
            atributos: f.partidas_resueltas?.atributos ?? {},
            cantidad: Number(f.cantidad ?? 0),
            id_producto: f.partidas_resueltas?.id_producto ?? null,
            producto_sku: f.partidas_resueltas?.productos?.sku ?? null,
            costo_acordado: Number(f.partidas_resueltas?.partidas_entrada?.costo_acordado ?? 0),
            cantidad_confirmada: f.cantidad_confirmada === null ? null : Number(f.cantidad_confirmada),
        }
        const existente = porTanda.get(f.id_tanda)
        if (existente) {
            existente.grupos.push(grupo)
            existente.piezas += grupo.cantidad
            existente.piezas_confirmadas += grupo.cantidad_confirmada ?? 0
            continue
        }
        porTanda.set(f.id_tanda, {
            id_tanda: f.id_tanda,
            tanda: f.tanda,
            id_entrada: f.entradas?.id ?? '',
            entrada_folio: f.entradas?.folio ?? '',
            proveedor_nombre: f.entradas?.proveedores?.nombre_comercial ?? null,
            estado: f.estado as EstadoTanda,
            piezas: grupo.cantidad,
            piezas_confirmadas: grupo.cantidad_confirmada ?? 0,
            fecha_liberacion: f.fecha_liberacion,
            liberador_nombre: f.usuarios?.nombre_completo ?? null,
            grupos: [grupo],
        })
    }
    return [...porTanda.values()]
}

/**
 * La cola de TANDAS. Alimenta Acondicionamiento (por limpiar / en limpieza / listas para almacén)
 * y Almacén (`en_almacen`).
 *
 * ⚠️ Se devuelve la lista COMPLETA (tope 400 grupos ≈ cientos de tandas) y se agrupa en el
 * servidor: una tanda son N filas, así que paginar por fila podía PARTIR una tanda entre dos
 * páginas. El volumen real de una tanda es de un puñado por día; se declara como límite conocido.
 */
export async function listarTandas(estados?: EstadoTanda[]): Promise<RespuestaLista<TandaLiberada>> {
    const supabase = await createClient()
    let q = supabase
        .from('liberaciones_entrada')
        .select(SELECT_TANDA)
        // La cola de un puesto: lo que más espera, primero (mismo criterio que Revisión).
        .order('fecha_liberacion', { ascending: true })
        .order('tanda', { ascending: true })
        .limit(400)
    if (estados && estados.length > 0) q = q.in('estado', estados)

    const { data, error } = await q
    if (error) return { success: false, error: describirError(error) }

    const tandas = aTandas((data ?? []) as unknown as FilaLiberacionCruda[])
    return { success: true, data: tandas, total: tandas.length }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⭐ MEJORA 27 (25 Sep 2026 · decisión 22.g) — LA BANDEJA
//
// El usuario: *«como una bandeja donde si van entregando de revisión ahí se van agrupando si vienen
// de la misma entrada misma partida»*. Medido en `ING-0001`: la partida 1 liberó **dos tandas del
// mismo ADATA 1TB** (4 + 2) y la cola las mostraba como DOS filas del mismo producto.
//
// Se agrupa por **grupo (partida + huella) + estado**, no por partida: una partida puede rendir dos
// marcas (→ dos SKU) y `ING-0002` es exactamente ese caso — agrupar por partida las juntaría, y eso
// es lo que la decisión 22.e prohíbe. Y por estado, porque sólo se acciona sobre tandas que están en
// el mismo momento del trabajo.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Agrupa las tandas en bandejas.
 * ⚠️ **NO se exporta**: en un archivo `'use server'` **todo export tiene que ser una función
 * `async`** — Next/SWC rechaza lo demás con «Ecmascript file had an error» (y `tsc` NO lo ve, sólo
 * `build`). La puerta pública es `listarBandejas`.
 */
function aBandejas(tandas: TandaLiberada[]): BandejaLiberada[] {
    const porClave = new Map<string, BandejaLiberada>()
    for (const t of tandas) {
        for (const g of t.grupos) {
            const clave = `${g.id_partida_resuelta}|${t.estado}`
            const b = porClave.get(clave)
            if (b) {
                b.ids_tanda.push(t.id_tanda)
                b.tandas.push(t.tanda)
                b.piezas += g.cantidad
                b.piezas_confirmadas += g.cantidad_confirmada ?? 0
                if (t.fecha_liberacion < b.fecha_primera_liberacion) {
                    b.fecha_primera_liberacion = t.fecha_liberacion
                }
                continue
            }
            porClave.set(clave, {
                clave,
                id_partida_resuelta: g.id_partida_resuelta,
                id_entrada: t.id_entrada,
                entrada_folio: t.entrada_folio,
                proveedor_nombre: t.proveedor_nombre,
                estado: t.estado,
                ids_tanda: [t.id_tanda],
                tandas: [t.tanda],
                piezas: g.cantidad,
                piezas_confirmadas: g.cantidad_confirmada ?? 0,
                fecha_primera_liberacion: t.fecha_liberacion,
                partida_numero: g.partida_numero,
                id_categoria: g.id_categoria,
                categoria_nombre: g.categoria_nombre,
                id_marca: g.id_marca,
                marca_nombre: g.marca_nombre,
                atributos: g.atributos,
                id_producto: g.id_producto,
                producto_sku: g.producto_sku,
                costo_acordado: g.costo_acordado,
            })
        }
    }
    // La más antigua primero: es la que más espera (mismo criterio que el resto de las colas).
    return [...porClave.values()].sort(
        (a, b) =>
            a.fecha_primera_liberacion.localeCompare(b.fecha_primera_liberacion) ||
            a.entrada_folio.localeCompare(b.entrada_folio) ||
            (a.partida_numero ?? 0) - (b.partida_numero ?? 0)
    )
}

/**
 * La cola del acondicionador (y de Almacén): **bandejas**, no tandas sueltas.
 * Comparte la consulta con `listarTandas` — una sola lectura, dos agrupaciones.
 */
export async function listarBandejas(estados?: EstadoTanda[]): Promise<RespuestaLista<BandejaLiberada>> {
    const r = await listarTandas(estados)
    if (!r.success) return { success: false, error: r.error }
    const bandejas = aBandejas(r.data ?? [])
    return { success: true, data: bandejas, total: bandejas.length }
}

/**
 * Toma la bandeja para limpieza: `por_limpiar` → `en_limpieza`.
 *
 * ⭐ MEJORA 32 — **acotada a la HUELTA**, no a la tanda entera. `fn_liberar_avance` crea **UNA tanda
 * con N grupos**, así que el mismo `id_tanda` vive en varias bandejas hermanas: mover por `id_tanda`
 * arrastraba las otras marcas del mismo viaje. Reporte del usuario: *«al iniciar una tanda todas las
 * otras inician»*.
 */
export async function tomarBandeja(
    idPartidaResuelta: string,
    idsTanda: string[]
): Promise<RespuestaAccion> {
    return avanzarBandeja(idPartidaResuelta, idsTanda, 'por_limpiar', 'en_limpieza', {
        acondicionado_por: true,
        fecha_inicio_acond: true,
    })
}

/** Entrega la bandeja al almacén: `en_limpieza` → `en_almacen` (misma acotación por huella). */
export async function entregarBandeja(
    idPartidaResuelta: string,
    idsTanda: string[]
): Promise<RespuestaAccion> {
    return avanzarBandeja(idPartidaResuelta, idsTanda, 'en_limpieza', 'en_almacen', {
        entregado_por: true,
        fecha_entrega: true,
    })
}

/**
 * ⭐ MEJORA 32 (usuario) — **«Limpiar todas»**: toda la mercancía `por_limpiar` de UN ingreso pasa a
 * limpieza de una vez. Es el atajo del puesto — el mismo que la fase 2 estrenó con «Liberar todo (n)»:
 * sin él hay que abrir el modal banda por banda.
 */
export async function tomarTodoDeIngreso(idEntrada: string): Promise<RespuestaAccion> {
    return avanzarIngreso(idEntrada, 'por_limpiar', 'en_limpieza', {
        acondicionado_por: true,
        fecha_inicio_acond: true,
    })
}

/** ⭐ MEJORA 32 (usuario) — **«Terminar y entregar todo»**: toda la mercancía `en_limpieza` del ingreso. */
export async function entregarTodoDeIngreso(idEntrada: string): Promise<RespuestaAccion> {
    return avanzarIngreso(idEntrada, 'en_limpieza', 'en_almacen', {
        entregado_por: true,
        fecha_entrega: true,
    })
}

/** El avance masivo de un INGRESO: una sola escritura sobre todo lo que está en el estado de origen. */
async function avanzarIngreso(
    idEntrada: string,
    desde: EstadoTanda,
    hacia: EstadoTanda,
    actor: Partial<Record<'acondicionado_por' | 'entregado_por' | 'fecha_inicio_acond' | 'fecha_entrega', true>>
): Promise<RespuestaAccion> {
    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }

    const patch: Record<string, unknown> = { estado: hacia }
    if (actor.acondicionado_por) patch.acondicionado_por = sesion.userId
    if (actor.entregado_por) patch.entregado_por = sesion.userId
    if (actor.fecha_inicio_acond) patch.fecha_inicio_acond = new Date().toISOString()
    if (actor.fecha_entrega) patch.fecha_entrega = new Date().toISOString()

    const { data: upd, error } = await supabase
        .from('liberaciones_entrada')
        .update(patch)
        .eq('id_entrada', idEntrada)
        .eq('estado', desde)
        .select('id')
    if (error) return { success: false, error: describirError(error) }
    if (!upd || upd.length === 0) {
        return {
            success: false,
            error:
                desde === 'por_limpiar'
                    ? 'No hay nada por limpiar en este ingreso.'
                    : 'No hay nada en limpieza que entregar.',
        }
    }
    return { success: true }
}

/**
 * El avance de la bandeja, en un solo sitio: valida el estado de TODAS sus tandas y las mueve.
 * ⭐ MEJORA 32 — la bandeja se identifica por **(huella + sus tandas)**, NO por la tanda sola:
 * `fn_liberar_avance` crea una tanda con N grupos, así que mover por `id_tanda` arrastraba las
 * huellas hermanas del mismo viaje (el bug reportado).
 */
async function avanzarBandeja(
    idPartidaResuelta: string,
    idsTanda: string[],
    desde: EstadoTanda,
    hacia: EstadoTanda,
    actor: Partial<Record<'acondicionado_por' | 'entregado_por' | 'fecha_inicio_acond' | 'fecha_entrega', true>>
): Promise<RespuestaAccion> {
    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }
    if (idsTanda.length === 0) return { success: false, error: 'No hay tandas en la bandeja.' }

    const { data: filas } = await supabase
        .from('liberaciones_entrada')
        .select('estado')
        .in('id_tanda', idsTanda)
        .eq('id_partida_resuelta', idPartidaResuelta)
    if (!filas || filas.length === 0) return { success: false, error: 'Las tandas no existen.' }
    if (!filas.every((f) => f.estado === desde)) {
        return {
            success: false,
            error:
                desde === 'por_limpiar'
                    ? 'Alguna tanda de la bandeja ya está en proceso o cerrada.'
                    : 'Alguna tanda de la bandeja no está en limpieza.',
        }
    }

    const patch: Record<string, unknown> = { estado: hacia }
    if (actor.acondicionado_por) patch.acondicionado_por = sesion.userId
    if (actor.entregado_por) patch.entregado_por = sesion.userId
    if (actor.fecha_inicio_acond) patch.fecha_inicio_acond = new Date().toISOString()
    if (actor.fecha_entrega) patch.fecha_entrega = new Date().toISOString()

    const { data: upd, error } = await supabase
        .from('liberaciones_entrada')
        .update(patch)
        .in('id_tanda', idsTanda)
        .eq('id_partida_resuelta', idPartidaResuelta)
        .select('id')
    if (error) return { success: false, error: describirError(error) }
    const errFilas = sinEscritura(upd, 'avanzar la bandeja')
    if (errFilas) return { success: false, error: errFilas }
    return { success: true }
}

/**
 * Cotejo previo al alta de una bandeja: **una línea por grupo**, con la cantidad ACUMULADA de sus
 * tandas. Es lo que permite que el alta cree **un lote** por producto en vez de uno por tanda.
 */
export async function abrirCotejoBandeja(
    idsTanda: string[]
): Promise<RespuestaDato<{ lineas: CotejoLinea[] }>> {
    const supabase = await createClient()
    if (idsTanda.length === 0) return { success: false, error: 'No hay tandas en la bandeja.' }
    const { data, error } = await supabase
        .from('liberaciones_entrada')
        .select(
            'id, cantidad, estado, partidas_resueltas(id, id_marca, marcas_producto(nombre), atributos, id_producto, productos(sku, nombre), partidas_entrada(id_categoria, costo_acordado, lleva_ns))'
        )
        .in('id_tanda', idsTanda)
    if (error) return { success: false, error: describirError(error) }

    const porGrupo = new Map<string, CotejoLinea>()
    for (const f of (data ?? []) as unknown as {
        id: string
        cantidad: number
        partidas_resueltas: {
            id: string
            id_marca: string | null
            marcas_producto: { nombre: string | null } | null
            atributos: Record<string, unknown> | null
            id_producto: string | null
            productos: { sku: string | null; nombre: string | null } | null
            partidas_entrada: { id_categoria: string | null; costo_acordado: number | null; lleva_ns: boolean | null } | null
        } | null
    }[]) {
        const g = f.partidas_resueltas
        if (!g) continue
        const acc = porGrupo.get(g.id)
        if (acc) {
            acc.cantidad_aprobada += Number(f.cantidad ?? 0)
            acc.cantidad_pendiente += Number(f.cantidad ?? 0)
            continue
        }
        porGrupo.set(g.id, {
            id_partida_resuelta: g.id,
            id_categoria: g.partidas_entrada?.id_categoria ?? null,
            id_marca: g.id_marca,
            marca_nombre: g.marcas_producto?.nombre ?? null,
            atributos: g.atributos ?? {},
            id_producto: g.id_producto,
            sku: g.productos?.sku ?? '',
            nombre: g.productos?.nombre ?? '',
            // En una bandeja la cantidad a cotejar ES la liberada: no hay saldo que descontar.
            cantidad_aprobada: Number(f.cantidad ?? 0),
            cantidad_pendiente: Number(f.cantidad ?? 0),
            costo_acordado: Number(g.partidas_entrada?.costo_acordado ?? 0),
            // ⭐ MEJORA 52 — lo que declaró la puerta: el SKU que nazca de la bandeja lo hereda.
            lleva_ns: g.partidas_entrada?.lleva_ns ?? false,
        })
    }

    return { success: true, data: { lineas: [...porGrupo.values()] } }
}

/**
 * El alta de una **bandeja**: un lote + un movimiento **por grupo** (con la cantidad acumulada) y sus
 * tandas → `confirmada`.
 *
 * ⭐ **Reparto FIFO de `cantidad_confirmada`.** Si la cantidad física es menor que lo entregado, se
 * confirman las tandas **en orden** hasta consumirla y el resto **se queda en `en_almacen`** — no se
 * marca como confirmado lo que no llegó. Y es **reanudable**: sólo toca las que están en
 * `en_almacen`, así que reintentar tras un fallo a la mitad no duplica stock.
 */
export async function confirmarAltaBandeja(input: {
    ids_tanda: string[]
    lineas: {
        id_partida_resuelta: string
        id_producto: string
        cantidad_fisica: number
        costo_acordado: number
    }[]
}): Promise<RespuestaAccion> {
    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }
    if (input.ids_tanda.length === 0) return { success: false, error: 'No hay tandas en la bandeja.' }
    if (input.lineas.length === 0) return { success: false, error: 'No hay líneas por ingresar.' }

    const { data: filas } = await supabase
        .from('liberaciones_entrada')
        .select('id, id_entrada, estado, cantidad, id_partida_resuelta, tanda')
        .in('id_tanda', input.ids_tanda)
        .order('tanda', { ascending: true })
    if (!filas || filas.length === 0) return { success: false, error: 'Las tandas no existen.' }
    if (!filas.some((f) => f.estado === 'en_almacen')) {
        // ⭐ FIX 05 Oct 2026 — el mensaje dice el ESTADO real. Antes decía sólo «no está entregada
        // al almacén» y no había forma de saber qué pasaba: el caso vivo era una bandeja **ya
        // confirmada** a la que la UI le seguía ofreciendo «Cotejar» (AltaCatalogo elegía la
        // bandeja más antigua sin mirar su estado). Sólo se da de alta lo que está EN ALMACÉN.
        const estados = [...new Set(filas.map((f) => String(f.estado)))].join(', ')
        return {
            success: false,
            error:
                `Esta bandeja no se puede dar de alta: su estado es «${estados}» y sólo se da de alta ` +
                'lo que está en almacén (esperando cotejo). Si ya la confirmaste, aparece como «Ya en almacén».',
        }
    }
    const idEntrada = filas[0].id_entrada as string

    for (const l of input.lineas) {
        if (l.id_partida_resuelta) {
            const { data: upd, error: errSku } = await supabase
                .from('partidas_resueltas')
                .update({ id_producto: l.id_producto })
                .eq('id', l.id_partida_resuelta)
                .select('id')
            if (errSku) return { success: false, error: describirError(errSku) }
            const errFilas = sinEscritura(upd, 'persistir el SKU resuelto')
            if (errFilas) return { success: false, error: errFilas }
        }

        if (l.cantidad_fisica > 0) {
            const err = await escribirAlta(supabase, sesion.userId, {
                idEntrada,
                idProducto: l.id_producto,
                cantidad: l.cantidad_fisica,
                costo: l.costo_acordado,
            })
            if (err) return { success: false, error: err }
        }

        // FIFO: se confirman las tandas de ESE grupo en orden hasta consumir la cantidad física.
        let restante = l.cantidad_fisica
        for (const f of filas) {
            if (restante <= 0) break
            if (f.id_partida_resuelta !== l.id_partida_resuelta) continue
            const cantidad = Number(f.cantidad ?? 0)
            const toma = Math.min(restante, cantidad)
            if (toma <= 0) continue

            const { data: updTanda, error: errTanda } = await supabase
                .from('liberaciones_entrada')
                .update({
                    estado: 'confirmada',
                    cantidad_confirmada: toma,
                    confirmado_por: sesion.userId,
                    fecha_confirmacion: new Date().toISOString(),
                })
                .eq('id', f.id)
                .eq('estado', 'en_almacen') // ← reanudable: no re-confirma lo ya confirmado
                .select('id')
            if (errTanda) return { success: false, error: describirError(errTanda) }
            const errFilasTanda = sinEscritura(updTanda, 'confirmar la tanda de la bandeja')
            if (errFilasTanda) return { success: false, error: errFilasTanda }
            restante -= toma
        }
    }

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

/**
 * ⭐ MEJORA 28 (decisión 22.h) — la línea soft **con la marca**: «HDD Seagate PC 2TB 3.5"».
 * Es la evolución que el usuario pidió ver en la nota: la misma descripción declarada, más el
 * producto que la revisión determinó. El orden (`categoría · marca · atributos`) es el mismo que
 * usa `huellaDeclarada` en el desglose — la nota y la pantalla dicen lo mismo.
 */
function lineaSoftDeHuella(
    categoria: { nombre: string | null; esquema_atributos: AtributoEsquema[] | null } | null,
    atributos: Record<string, unknown> | null,
    marca: string | null
): string {
    const base = lineaSoftDe(categoria, atributos)
    if (!marca) return base
    const [nombre, ...resto] = base.split(' ')
    return [nombre, marca, ...resto].join(' ')
}

/** Ajustar DEV (valida) + generar nota de compra por las aprobadas. Transaccional.
 *  ⭐ MEJORA 26 — `cerrada` = la entrada quedó `confirmada` en el mismo acto porque no quedaba
 *  saldo por ingresar (todo salió por tandas). */
export async function ajustarYGenerarNota(
    idEntrada: string
): Promise<RespuestaDato<{ id: string; folio: string; cerrada: boolean }>> {
    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }

    const { data: entrada } = await supabase
        .from('entradas')
        .select('id_proveedor, estado, id_nota')
        .eq('id', idEntrada)
        .single()
    if (!entrada) return { success: false, error: 'La entrada no existe.' }
    // ⭐ MEJORA 28 — ORDEN CORREGIDO. Una entrada que ya tiene nota está en `ajustada`, así que
    // mirar el estado primero decía «aún no está lista» cuando la verdad era «ya se hizo»: el
    // usuario veía un mensaje engañoso al repetir la acción. Primero el hecho consumado.
    if (entrada.id_nota) return { success: false, error: 'Esta entrada ya tiene nota de compra.' }
    // Guard compartido con la UI (`puedeAjustarNota`): el botón y el servidor no pueden discrepar.
    if (!puedeAjustarNota(entrada.estado as Entrada['estado'], entrada.id_nota)) {
        return {
            success: false,
            error:
                'La entrada aún no está lista para ajustar/nota: se hace cuando la revisión cierra (y antes de generarla).',
        }
    }

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
        const { data: upd, error: errDev } = await supabase
            .from('devoluciones_entrada')
            .update({ estado: 'ajustada', ajustado_por: sesion.userId, fecha_ajuste: new Date().toISOString() })
            .eq('id', d.id)
            .select('id')
        if (errDev) return { success: false, error: describirError(errDev) }
        const errFilas = sinEscritura(upd, 'ajustar la devolución')
        if (errFilas) return { success: false, error: errFilas }
    }
    const devPorPartida = new Map<string, number>()
    for (const d of (devoluciones ?? [])) {
        devPorPartida.set(d.id_partida_entrada, (devPorPartida.get(d.id_partida_entrada) ?? 0) + Number(d.cantidad))
    }

    /**
     * ⭐ MEJORA 52 (07 Oct 2026) — **LA RECLASIFICACIÓN se valida EN ESTE ACTO, igual que la DEV.**
     *
     * Decisión del dueño: *«RECEPCIÓN valida el cambio»* y *«igual que una DEV: **no se puede hacer la
     * nota sin validar ese ajuste**»*. ⇒ Las propuestas que dejó la Revisión (`pendiente`) se **validan
     * acá** (`ajustada` + `ajustado_por` + `fecha_ajuste`) y **en este mismo momento** se mueve
     * `cantidad_vigente`: **baja en el origen y sube en el destino**.
     *
     * ⚠️ Es el movimiento que hace verdad su frase *«la nota original no miente: solo dejó de ser la
     * verdad»*: **`cantidad_original` NO se toca** (la partida declarada sigue diciendo lo que el
     * proveedor declaró) y la nacida lleva `cantidad_original = 0` ⇒ **la suma de los originales sigue
     * siendo lo declarado** y los **vigentes** dicen lo que de verdad entró (4 + 1).
     */
    const { data: reclas } = await supabase
        .from('reclasificaciones_entrada')
        .select('id, id_partida_origen, id_partida_destino, cantidad')
        .eq('id_entrada', idEntrada)
        .eq('estado', 'pendiente')
    for (const r of reclas ?? []) {
        const { data: upd, error: errRec } = await supabase
            .from('reclasificaciones_entrada')
            .update({
                estado: 'ajustada',
                ajustado_por: sesion.userId,
                fecha_ajuste: new Date().toISOString(),
            })
            .eq('id', r.id)
            .select('id')
        if (errRec) return { success: false, error: describirError(errRec) }
        const errFilasRec = sinEscritura(upd, 'validar la reclasificación')
        if (errFilasRec) return { success: false, error: errFilasRec }
    }
    const recSalen = new Map<string, number>()
    const recLlegan = new Map<string, number>()
    for (const r of reclas ?? []) {
        const c = Number(r.cantidad)
        recSalen.set(r.id_partida_origen, (recSalen.get(r.id_partida_origen) ?? 0) + c)
        recLlegan.set(r.id_partida_destino, (recLlegan.get(r.id_partida_destino) ?? 0) + c)
    }

    const filas = (partidas ?? []) as unknown as Array<{
        id: string
        categorias_producto: { nombre: string | null; esquema_atributos: AtributoEsquema[] | null } | null
        atributos: Record<string, unknown> | null
        cantidad_original: number
        costo_acordado: number
    }>

    // ── (1) La CANTIDAD VIGENTE sigue siendo de la PARTIDA declarada ────────────
    // `cantidad_original` es inmutable (R7) y el ajuste solo deriva la vigente. Esto NO cambia con
    // la decisión 22.h: la partida declarada sigue siendo la unidad del contrato con el proveedor.
    /**
     * ⭐ MEJORA 52 — **una sola fórmula para el «final» de la partida**, usada por el ajuste y por las
     * líneas de la nota: `original − DEV + lo que llega por reclasificación − lo que se va`.
     * La nacida arranca en `original = 0` y **sube** con lo que recibe (por eso `g18_m53b` relajó sus
     * CHECK); la declarada **baja** cuando una pieza suya resulta ser de otra capacidad.
     */
    const vigenteDe = (idPartida: string, original: number) =>
        Math.max(
            0,
            original -
                (devPorPartida.get(idPartida) ?? 0) +
                (recLlegan.get(idPartida) ?? 0) -
                (recSalen.get(idPartida) ?? 0)
        )
    const vigentes = filas.map((p) => ({
        id_partida: p.id,
        cantidad: vigenteDe(p.id, Number(p.cantidad_original)),
    }))
    for (const v of vigentes) {
        const { data: upd, error: errVig } = await supabase
            .from('partidas_entrada')
            .update({ cantidad_vigente: v.cantidad })
            .eq('id', v.id_partida)
            .select('id')
        if (errVig) return { success: false, error: describirError(errVig) }
        const errFilas = sinEscritura(upd, 'fijar la cantidad vigente de la partida')
        if (errFilas) return { success: false, error: errFilas }
    }

    // ── (2) Las LÍNEAS DE LA NOTA van por HUELLA ────────────────────────────────
    // ⭐ MEJORA 28 (25 Sep 2026 · decisión 22.h) — el usuario lo pidió con su ejemplo: una entrada
    // soft declarada como «10 HDD PC 2TB $200» que muta a «5 Seagate + 5 ADATA» debe facturarse
    // como DOS líneas. El proveedor cobra por lo que la mercancía ES, no por lo que se declaró.
    const { data: resueltas } = await supabase
        .from('partidas_resueltas')
        .select('id_partida_entrada, marcas_producto(nombre), cantidad_aprobada')
        .in(
            'id_partida_entrada',
            filas.map((f) => f.id)
        )
    const huellasPorPartida = new Map<string, { marca: string | null; cantidad: number }[]>()
    for (const r of (resueltas ?? []) as unknown as {
        id_partida_entrada: string
        marcas_producto: { nombre: string | null } | null
        cantidad_aprobada: number
    }[]) {
        const lista = huellasPorPartida.get(r.id_partida_entrada) ?? []
        lista.push({ marca: r.marcas_producto?.nombre ?? null, cantidad: Number(r.cantidad_aprobada) })
        huellasPorPartida.set(r.id_partida_entrada, lista)
    }

    const lineas = filas.flatMap((p) => {
        const vigente = vigenteDe(p.id, Number(p.cantidad_original))
        const hs = huellasPorPartida.get(p.id) ?? []
        const sumaHuellas = hs.reduce((s, h) => s + h.cantidad, 0)
        // Al CERRAR la revisión Σ aprobadas = vigente (una pieza está aprobada o devuelta, nunca en
        // el aire) — la nota solo se genera en ese momento. Si por lo que sea no cuadra, se cae a la
        // línea DECLARADA: una nota con el monto mal es peor que una nota sin el desglose fino.
        if (hs.length === 0 || sumaHuellas !== vigente) {
            return vigente > 0
                ? [
                      {
                          descripcion: lineaSoftDe(p.categorias_producto, p.atributos),
                          cantidad: vigente,
                          costo_acordado: Number(p.costo_acordado),
                      },
                  ]
                : []
        }
        return hs
            .filter((h) => h.cantidad > 0)
            .map((h) => ({
                descripcion: lineaSoftDeHuella(p.categorias_producto, p.atributos, h.marca),
                cantidad: h.cantidad,
                costo_acordado: Number(p.costo_acordado),
            }))
    })

    if (lineas.length === 0) {
        return { success: false, error: 'No hay piezas aprobadas para generar la nota.' }
    }

    // Generar la nota de compra (folio NC · partidas por línea soft valorizada a costo).
    const { data: folio, error: errFolio } = await supabase.rpc('generar_folio', { p_tipo: 'nota_compra' })
    if (errFolio || !folio) return { success: false, error: describirError(errFolio) ?? 'No se pudo generar el folio.' }
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
    if (errNota) return { success: false, error: describirError(errNota) }

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
        if (errP) return { success: false, error: describirError(errP) }
    }

    // Ligar la nota a la entrada + marcar ajustada.
    const { data: updEntrada, error: errEntrada } = await supabase
        .from('entradas')
        .update({ id_nota: nota.id, estado: 'ajustada' })
        .eq('id', idEntrada)
        .select('id')
    if (errEntrada) return { success: false, error: describirError(errEntrada) }
    const errLiga = sinEscritura(updEntrada, 'ligar la nota a la entrada')
    if (errLiga) return { success: false, error: errLiga }

    // ⭐ MEJORA 26 (24 Sep 2026 · decisión del usuario, opción A) — CIERRE DEL DOCUMENTO POR TANDAS.
    // Si ya no queda saldo por ingresar (`Σ aprobadas − Σ liberadas = 0`), la entrada nace ajustada
    // **y cerrada**: sus piezas entraron a stock por tandas y no hay nada que acondicionar ni
    // cotejar. Si queda saldo, la función no hace nada y el camino clásico sigue su curso.
    //
    // ⭐ FIX 25 Sep 2026 (usuario · ING-0002) — **el cierre ya no se puede disparar «gratis»**.
    // Antes bastaba `saldoPorIngresar === 0`, y una lista de cotejo **VACÍA también suma 0**: una
    // entrada recién revisada y **sin liberar** podía nacer cerrada por la puerta de atrás. El
    // usuario lo reportó como *«solo se generó la NC … no genera el cierre pues aún le faltan etapas
    // por completar»*.
    // Ahora se pide la ÚNICA razón legítima para cerrar AQUÍ (la diseñada en la MEJORA 26): que
    // **todo lo aprobado haya salido por TANDAS** (`Σ aprobadas > 0` y `Σ aprobadas − Σ liberadas = 0`).
    // ⚠️ Es **más estricta a propósito** que la de `fn_confirmar_alta`, que cierra con
    // `Σ aprobadas − Σ liberadas <= 0` (medido en su definición viva): una entrada con **nada
    // aprobado** —todo rechazado— no se cierra por esta puerta y sigue el camino clásico, donde el
    // alta **acepta 0 líneas** (R27). Cerrar de menos se recupera; cerrar de más, no.
    const avance = await listarPartidasConAvance(idEntrada)
    const aprobadas = (avance.data ?? []).reduce((s, p) => s + Number(p.aprobadas ?? 0), 0)
    const liberadas = (avance.data ?? []).reduce((s, p) => s + Number(p.liberadas ?? 0), 0)
    const todoPorTandas = avance.success && aprobadas > 0 && aprobadas - liberadas === 0
    const cotejo = await abrirCotejoAlta(idEntrada)
    const saldoPorIngresar = (cotejo.data?.lineas ?? []).reduce(
        (s, l) => s + Number(l.cantidad_pendiente ?? 0),
        0
    )
    // ⭐ MEJORA 33 (27 Sep 2026) — **LIBERAR NO ES INGRESAR.** `Σ aprobadas − Σ liberadas = 0` dice
    // que nada quedó por liberar, pero **no** que la mercancía haya entrado al stock: medido en
    // `ING-0001`, la entrada quedó `confirmada` —con `fecha_fin_almacen` y la nota en `recibida`—
    // **con 8 piezas `en_almacen` esperando cotejo y 0 lotes**. La misma regla vive en
    // `fn_confirmar_alta` (§0.17): ninguna tanda puede quedar sin `confirmada`.
    // Fail-closed: si la lectura falla (`count` null) NO se cierra — `-1 !== 0`.
    const { count: tandasSinConfirmar } = await supabase
        .from('liberaciones_entrada')
        .select('id', { count: 'exact', head: true })
        .eq('id_entrada', idEntrada)
        .neq('estado', 'confirmada')
    const todoIngresado = (tandasSinConfirmar ?? -1) === 0
    const cerrada = todoPorTandas && cotejo.success && saldoPorIngresar === 0 && todoIngresado
    if (cerrada) {
        const { error: errCierre } = await supabase.rpc('fn_confirmar_alta', { p_id_entrada: idEntrada })
        if (errCierre) return { success: false, error: describirError(errCierre) }
    }

    return { success: true, data: { id: nota.id, folio: nota.folio, cerrada } }
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
    if (error) return { success: false, error: describirError(error) }
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
    if (error) return { success: false, error: describirError(error) }
    return { success: true }
}

// ⭐ MEJORA 29 (25 Sep 2026) — `huellaCanonica` **se movió a `@/types/entradas`** (import arriba).
// El porqué NO se pierde, porque es la razón de que exista: la huella se compara por CONTENIDO y no
// por el string crudo — `atributos` es `jsonb` y Postgres **no conserva el orden de las claves**
// (las reordena por longitud y luego por bytes), así que el objeto que arma el cliente
// (`{tipo, capacidad, form_factor, rpm}`) nunca coincidía con el que devolvía PostgREST
// (`{rpm, tipo, capacidad, form_factor}`) y **cada guardado creaba una fila NUEVA de la MISMA
// huella** en `partidas_resueltas`. **Medido, no supuesto** — `ING-0008`, dos filas con
// `atributos::text` idéntico y la misma marca y partida (20 pzs 18:16 · 4 pzs 19:14): el mismo
// producto salía como **dos grupos** en el modal de liberación, en Acondicionamiento y en el cotejo
// de Almacén → dos lotes del mismo SKU.
// Ahora la comparten el **guardado**, la **lectura** y el **desglose** (MEJORA 29): una sola
// definición, porque dos maneras de canonicalizar son dos maneras de no emparejar.

/**
 * ⭐ MEJORA 25 — el ÚNICO sitio que sube stock: crea el lote y escribe el movimiento `entrada`.
 * Lo comparten el alta clásica (la que cierra la entrada) y el alta de una TANDA: si hubiera dos
 * copias, una de las dos rutas acabaría divergiendo — y ésta es la que mueve inventario.
 * Devuelve el mensaje de error, o `null` si salió bien.
 */
async function escribirAlta(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
    opts: { idEntrada: string; idProducto: string; cantidad: number; costo: number }
): Promise<string | null> {
    const { data: lote, error: errLote } = await supabase
        .from('lotes')
        .insert({
            id_producto: opts.idProducto,
            cantidad_original: opts.cantidad,
            cantidad_disponible: opts.cantidad,
            costo_unitario: opts.costo,
            fecha_entrada: new Date().toISOString(),
            origen_tabla: 'entradas',
            origen_id: opts.idEntrada,
            creado_por: userId,
        })
        .select('id')
        .single()
    if (errLote) return describirErrorTexto(errLote)

    const { data: producto } = await supabase
        .from('productos')
        .select('stock_actual')
        .eq('id', opts.idProducto)
        .single()
    const stockAnterior = Number(producto?.stock_actual ?? 0)
    const { error: errMov } = await supabase.from('movimientos_inventario').insert({
        id_producto: opts.idProducto,
        id_lote: lote.id,
        tipo_movimiento: 'entrada',
        cantidad: opts.cantidad,
        stock_anterior: stockAnterior,
        stock_resultante: stockAnterior + opts.cantidad,
        costo_unitario: opts.costo,
        origen_tabla: 'lote',
        origen_id: lote.id,
        creado_por: userId,
    })
    if (errMov) return describirErrorTexto(errMov)
    return null
}

/**
 * Abrir cotejo de alta: la HUELLA por grupo aprobado (el SKU lo resuelve el almacenista).
 *
 * ⭐ MEJORA 25 — `cantidad_pendiente` = `cantidad_aprobada − Σ liberado`. Es el número que el
 * almacenista coteja: si se usara `cantidad_aprobada`, las piezas que ya salieron por tanda
 * **subirían stock dos veces** al cerrar la entrada (decisión 22.b: la nota sí cobra todo).
 */
export async function abrirCotejoAlta(idEntrada: string): Promise<RespuestaDato<{ lineas: CotejoLinea[] }>> {
    const supabase = await createClient()
    const { data: partidas } = await supabase
        .from('partidas_entrada')
        .select('id, id_categoria, costo_acordado, lleva_ns')
        .eq('id_entrada', idEntrada)
    const porPartida = new Map<string, { id_categoria: string | null; costo: number; llevaNs: boolean }>()
    for (const p of (partidas ?? [])) {
        porPartida.set(p.id, {
            id_categoria: p.id_categoria,
            costo: Number(p.costo_acordado),
            // ⭐ MEJORA 52 — la declaración de la PUERTA, para que el alta no invente el flag del SKU.
            llevaNs: p.lleva_ns ?? false,
        })
    }
    const ids = (partidas ?? []).map((p) => p.id)
    const [{ data: resueltas }, { data: liberaciones }] = await Promise.all([
        ids.length
            ? supabase
                  .from('partidas_resueltas')
                  .select(
                      'id, id_partida_entrada, id_marca, marcas_producto(nombre), id_producto, productos(sku, nombre), cantidad_aprobada, atributos'
                  )
                  .in('id_partida_entrada', ids)
            : Promise.resolve({ data: [] }),
        supabase
            .from('liberaciones_entrada')
            .select('id_partida_resuelta, cantidad')
            .eq('id_entrada', idEntrada),
    ])
    const liberadoPorGrupo = new Map<string, number>()
    for (const l of (liberaciones ?? []) as unknown as {
        id_partida_resuelta: string
        cantidad: number
    }[]) {
        liberadoPorGrupo.set(
            l.id_partida_resuelta,
            (liberadoPorGrupo.get(l.id_partida_resuelta) ?? 0) + Number(l.cantidad ?? 0)
        )
    }
    const lineas = ((resueltas ?? []) as unknown as {
        id: string
        id_partida_entrada: string
        id_marca: string | null
        marcas_producto: { nombre: string | null } | null
        id_producto: string | null
        productos: { sku: string | null; nombre: string | null } | null
        cantidad_aprobada: number
        atributos: Record<string, unknown>
    }[]).map((r) => {
        const aprobada = Number(r.cantidad_aprobada)
        const liberada = liberadoPorGrupo.get(r.id) ?? 0
        return {
            id_partida_resuelta: r.id,
            id_categoria: porPartida.get(r.id_partida_entrada)?.id_categoria ?? null,
            id_marca: r.id_marca,
            marca_nombre: r.marcas_producto?.nombre ?? null,
            atributos: r.atributos ?? {},
            id_producto: r.id_producto,
            sku: r.productos?.sku ?? '',
            nombre: r.productos?.nombre ?? '',
            cantidad_aprobada: aprobada,
            cantidad_pendiente: Math.max(0, aprobada - liberada),
            costo_acordado: porPartida.get(r.id_partida_entrada)?.costo ?? 0,
            // ⭐ MEJORA 52 — lo que declaró la puerta: el SKU que nazca de acá lo hereda.
            lleva_ns: porPartida.get(r.id_partida_entrada)?.llevaNs ?? false,
        }
    })
    return { success: true, data: { lineas } }
}

/**
 * ⭐ MEJORA 27 Sep 2026 (Fase 1 · Recepción) — **LAS ETAPAS DE UN INGRESO** (solo lectura).
 *
 * *«Recepción es un puesto importante, prácticamente un usuario administrador que ve todas las
 * etapas … para que él pueda revisar cómo va evolucionando las cosas sin abandonar Entradas»*.
 *
 * Junta lo que las etapas ya saben y que ninguna acción devolvía **por entrada**:
 *   · **Acondicionamiento** — las liberaciones de ESTE ingreso, fila por fila (bandeja, piezas,
 *     estado y sus tres fechas). Es lo único que no existía: `listarBandejas` devuelve la **cola**
 *     del acondicionador, no las bandejas de un ingreso.
 *   · **Almacén** — las `CotejoLinea` que ya produce `abrirCotejoAlta` (**la misma definición**, no
 *     una copia: dos maneras de leer el cotejo serían dos maneras de mentir).
 *   · **Divergencias** — solo las de esta entrada.
 *
 * ⚠️ **Cero escritura.** Las etapas se consultan desde un puesto que no es el suyo: la RLS por etapa
 * (MEJORA 26) sigue siendo la única autoridad y este read no la rodea.
 * (Decisión ⑧ del mockup `toolbar-detalles-etapas-recepcion.html`, aprobado el 27 Sep 2026.)
 */
export async function listarEtapasDeIngreso(
    idEntrada: string
): Promise<RespuestaDato<EtapasDeIngreso>> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('liberaciones_entrada')
        .select(
            'id, tanda, cantidad, estado, fecha_liberacion, fecha_inicio_acond, fecha_entrega, fecha_confirmacion, partidas_resueltas(id_marca, atributos, marcas_producto(nombre), partidas_entrada(partida))'
        )
        .eq('id_entrada', idEntrada)
        .order('tanda', { ascending: true })
        .order('created_at', { ascending: true })
    if (error) return { success: false, error: describirError(error) }

    const acondicionamiento: LiberacionDeIngreso[] = ((data ?? []) as unknown as {
        id: string
        tanda: number | null
        cantidad: number
        estado: string
        fecha_liberacion: string | null
        fecha_inicio_acond: string | null
        fecha_entrega: string | null
        fecha_confirmacion: string | null
        partidas_resueltas: {
            atributos: Record<string, unknown> | null
            marcas_producto: { nombre: string | null } | null
            partidas_entrada: { partida: number } | null
        } | null
    }[]).map((l) => ({
        id: l.id,
        tanda: l.tanda,
        partida_numero: l.partidas_resueltas?.partidas_entrada?.partida ?? null,
        marca_nombre: l.partidas_resueltas?.marcas_producto?.nombre ?? null,
        atributos: l.partidas_resueltas?.atributos ?? {},
        cantidad: Number(l.cantidad ?? 0),
        estado: l.estado as LiberacionDeIngreso['estado'],
        fecha_liberacion: l.fecha_liberacion,
        fecha_inicio_acond: l.fecha_inicio_acond,
        fecha_entrega: l.fecha_entrega,
        fecha_confirmacion: l.fecha_confirmacion,
    }))

    const [cotejo, divergencias] = await Promise.all([
        abrirCotejoAlta(idEntrada),
        supabase
            .from('divergencias')
            .select(
                'id, id_entrada, cantidad_esperada, cantidad_encontrada, id_causa, causas_divergencia(nombre), responsable, cantidad_autorizada, estado, creado_por, created_at'
            )
            .eq('id_entrada', idEntrada)
            .order('created_at', { ascending: false }),
    ])

    const filasDiv = ((divergencias.data ?? []) as unknown as {
        id: string
        id_entrada: string
        cantidad_esperada: number
        cantidad_encontrada: number
        id_causa: string
        causas_divergencia: { nombre: string | null } | null
        responsable: string | null
        cantidad_autorizada: number | null
        estado: string
        creado_por: string | null
        created_at: string
    }[]).map((d) => ({
        id: d.id,
        id_entrada: d.id_entrada,
        // El folio no hace falta dentro del modal (ya se sabe de qué ingreso es): se deja nulo.
        entrada_folio: null,
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

    return {
        success: true,
        data: {
            acondicionamiento,
            cotejo: cotejo.success ? (cotejo.data?.lineas ?? []) : [],
            divergencias: filasDiv,
        },
    }
}

/**
 * Confirmar alta: lote + movimiento entrada por línea (único punto que sube stock) + nota recibida.
 *
 * ⭐ MEJORA 25 — acepta **cero líneas** cuando ya no queda saldo por dar de alta (todo salió por
 * tandas): en ese caso la entrada igual debe poder **cerrar**. Antes devolvía error y la entrada
 * quedaba atorada en `en_almacén` para siempre.
 */
export async function confirmarAlta(input: ConfirmarAltaInput): Promise<RespuestaAccion> {
    const supabase = await createClient()
    const sesion = await sesionActiva(supabase)
    if ('error' in sesion) return { success: false, error: sesion.error }

    const { data: entrada } = await supabase.from('entradas').select('estado, id_nota').eq('id', input.id_entrada).single()
    if (!entrada) return { success: false, error: 'La entrada no existe.' }
    if (entrada.estado !== 'en_almacen') return { success: false, error: 'La entrada no está por cotejar.' }

    if (input.lineas.length === 0) {
        // Cerrar sin líneas SOLO si de verdad no queda saldo (todo se dio de alta por tandas).
        const { data: cotejo } = await abrirCotejoAlta(input.id_entrada)
        const pendiente = (cotejo?.lineas ?? []).reduce((s, l) => s + Number(l.cantidad_pendiente ?? 0), 0)
        if (pendiente > 0) return { success: false, error: 'No hay líneas por ingresar.' }
    }

    for (const l of input.lineas) {
        // ⭐ El almacenista resolvió el SKU: se persiste en la huella (partidas_resueltas).
        if (l.id_partida_resuelta) {
            const { data: upd, error: errSku } = await supabase
                .from('partidas_resueltas')
                .update({ id_producto: l.id_producto })
                .eq('id', l.id_partida_resuelta)
                .select('id')
            if (errSku) return { success: false, error: describirError(errSku) }
            const errFilas = sinEscritura(upd, 'persistir el SKU resuelto')
            if (errFilas) return { success: false, error: errFilas }
        }
        if (l.cantidad_fisica <= 0) continue
        const err = await escribirAlta(supabase, sesion.userId, {
            idEntrada: input.id_entrada,
            idProducto: l.id_producto,
            cantidad: l.cantidad_fisica,
            costo: l.costo_acordado,
        })
        if (err) return { success: false, error: err }
    }

    // ⭐ MEJORA 26 — la nota pasa a `recibida` DENTRO de `fn_confirmar_alta` (SECURITY DEFINER):
    // la Server Action lo intentaba con la sesión del Almacenista, que no tiene permiso en
    // `/dashboard/compras` → el UPDATE afectaba 0 filas y la nota se quedaba en `por_recibir`.
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
    if (error) return { success: false, error: describirError(error) }
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
    if (error) return { success: false, error: describirError(error) }
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
            const { data: upd, error: errSku } = await supabase
                .from('partidas_resueltas')
                .update({ id_producto: l.id_producto })
                .eq('id', l.id_partida_resuelta)
                .select('id')
            if (errSku) return { success: false, error: describirError(errSku) }
            const errFilas = sinEscritura(upd, 'persistir el SKU resuelto')
            if (errFilas) return { success: false, error: errFilas }
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
        if (errLote) return { success: false, error: describirError(errLote) }

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
        if (errMov) return { success: false, error: describirError(errMov) }
    }

    const { data: divUpd, error: errDiv } = await supabase
        .from('divergencias')
        .update({ estado: 'resuelta' })
        .eq('id', idDivergencia)
        .select('id')
    if (errDiv) return { success: false, error: describirError(errDiv) }
    const errDivFilas = sinEscritura(divUpd, 'marcar la divergencia como resuelta')
    if (errDivFilas) return { success: false, error: errDivFilas }
    await supabase.rpc('fn_confirmar_alta', { p_id_entrada: divergencia.id_entrada })

    return { success: true }
}
