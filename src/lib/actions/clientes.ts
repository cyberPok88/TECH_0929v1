// ═══════════════════════════════════════════════════════════════════════════════
// SERVER ACTIONS — CLIENTES (Guía 1.3)
// 'use server' en la línea del bloque: obligatorio. Retornan objetos tipados —
// NUNCA throw (patrón 0.9 · CONVENCIONES §5).
//   listarClientes · listarClientesActivos (contrato 1.7/1.8/1.9)
//   crearCliente · crearClienteRapido (contrato) · editarCliente
//   toggleActivoClientes · archivarClientes · suspenderCliente ·
//   levantarSuspensionCliente · cambiarVendedorClientes · listarBitacoraCliente
// ═══════════════════════════════════════════════════════════════════════════════

'use server'

import { createClient } from '@/lib/supabase/server'
import {
    clienteAltaSchema,
    clienteEditarSchema,
    clienteRapidoSchema,
} from '@/lib/validations/clientes'
import type {
    ClienteAltaInput,
    ClienteEditarInput,
    ClienteRapidoInput,
} from '@/lib/validations/clientes'
import type {
    Cliente,
    ClienteOpcion,
    ContactoCliente,
    DireccionCliente,
    EventoBitacoraCliente,
    FiltrosCliente,
    RespuestaAccion,
    RespuestaDato,
    RespuestaLista,
} from '@/types/clientes'

// Forma cruda del embed PostgREST (embeds aplanados por aFila).
// El hint usuarios!fk_clientes_vendedor desambigua las 4 FKs a usuarios (b1).
interface FilaClienteCruda {
    id: string
    codigo: string
    nombre_comercial: string
    razon_social: string | null
    tipo_persona: 'fisica' | 'moral'
    id_marca_comercial: string
    id_tipo_cliente: string
    id_lista_precio: string
    id_canal_venta: string | null
    id_ruta_cobro: string | null
    id_vendedor_asignado: string | null
    tiene_credito: boolean
    limite_credito: number | null
    dias_credito: number | null
    saldo_inicial: number
    saldo_actual: number
    rfc: string | null
    id_regimen_fiscal: string | null
    id_uso_cfdi: string | null
    notas: string | null
    es_activo: boolean
    es_archivado: boolean
    es_suspendido: boolean
    motivo_suspension: string | null
    fecha_suspension: string | null
    id_usuario_suspension: string | null
    creado_por: string | null
    actualizado_por: string | null
    created_at: string
    updated_at: string
    marcas_comerciales: { nombre_visible: string } | null
    tipos_cliente: { nombre: string } | null
    listas_precios: { nombre: string } | null
    canales_venta: { nombre: string } | null
    rutas_cobro: { nombre: string } | null
    usuarios: { nombre_completo: string } | null
    sat_regimenes_fiscales: { descripcion: string } | null
}

const COLUMNAS = [
    'id', 'codigo', 'nombre_comercial', 'razon_social', 'tipo_persona',
    'id_marca_comercial', 'id_tipo_cliente', 'id_lista_precio',
    'id_canal_venta', 'id_ruta_cobro', 'id_vendedor_asignado',
    'tiene_credito', 'limite_credito', 'dias_credito', 'saldo_inicial', 'saldo_actual',
    'rfc', 'id_regimen_fiscal', 'id_uso_cfdi',
    'notas', 'es_activo', 'es_archivado', 'es_suspendido',
    'motivo_suspension', 'fecha_suspension', 'id_usuario_suspension',
    'creado_por', 'actualizado_por', 'created_at', 'updated_at',
    'marcas_comerciales(nombre_visible)',
    'tipos_cliente(nombre)',
    'listas_precios(nombre)',
    'canales_venta(nombre)',
    'rutas_cobro(nombre)',
    'usuarios!fk_clientes_vendedor(nombre_completo)',
    'sat_regimenes_fiscales(descripcion)',
].join(',')

function aFila(p: FilaClienteCruda): Cliente {
    return {
        id: p.id,
        codigo: p.codigo,
        nombre_comercial: p.nombre_comercial,
        razon_social: p.razon_social,
        tipo_persona: p.tipo_persona,
        id_marca_comercial: p.id_marca_comercial,
        marca_nombre: p.marcas_comerciales?.nombre_visible ?? null,
        id_tipo_cliente: p.id_tipo_cliente,
        tipo_cliente_nombre: p.tipos_cliente?.nombre ?? null,
        id_lista_precio: p.id_lista_precio,
        lista_precio_nombre: p.listas_precios?.nombre ?? null,
        id_canal_venta: p.id_canal_venta,
        canal_venta_nombre: p.canales_venta?.nombre ?? null,
        id_ruta_cobro: p.id_ruta_cobro,
        ruta_cobro_nombre: p.rutas_cobro?.nombre ?? null,
        id_vendedor_asignado: p.id_vendedor_asignado,
        vendedor_nombre: p.usuarios?.nombre_completo ?? null,
        tiene_credito: p.tiene_credito,
        limite_credito: p.limite_credito,
        dias_credito: p.dias_credito,
        saldo_inicial: p.saldo_inicial,
        saldo_actual: p.saldo_actual,
        rfc: p.rfc,
        id_regimen_fiscal: p.id_regimen_fiscal,
        regimen_descripcion: p.sat_regimenes_fiscales?.descripcion ?? null,
        id_uso_cfdi: p.id_uso_cfdi,
        notas: p.notas,
        es_activo: p.es_activo,
        es_archivado: p.es_archivado,
        es_suspendido: p.es_suspendido,
        motivo_suspension: p.motivo_suspension,
        fecha_suspension: p.fecha_suspension,
        id_usuario_suspension: p.id_usuario_suspension,
        creado_por: p.creado_por,
        actualizado_por: p.actualizado_por,
        created_at: p.created_at,
        updated_at: p.updated_at,
    }
}

/** '' del formulario → null de BD (columna nullable). */
function aNull(v: string): string | null {
    const t = v.trim()
    return t ? t : null
}

/** RFC normalizado en mayúsculas (o null). */
function aRfc(v: string): string | null {
    const t = v.trim().toUpperCase()
    return t ? t : null
}

/** Entero (días): '' → null; entero > 0 validado ya por el schema → número. */
function aNum(v: string): number | null {
    if (v.trim() === '') return null
    const n = Number(v)
    return Number.isInteger(n) && n > 0 ? n : null
}

/** Monto (decimal 14,4): '' → null; número finito → número. */
function aMonto(v: string): number | null {
    if (v.trim() === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
}

function traducirErrorCliente(codigo: string | undefined, mensaje: string): string {
    if (codigo === '23505') return 'Ya existe un registro con ese código o RFC (misma marca).'
    if (codigo === '23503') return 'Uno de los valores seleccionados ya no existe (catálogo).'
    if (codigo === '23514') return 'El registro incumple una regla de negocio (crédito o suspensión).'
    if (codigo === '42501') return 'No tienes permiso para realizar esta acción.'
    return mensaje
}

// ── Listar clientes (filtros · default TODOS — decisión usuario 04 Sep) ───────
export async function listarClientes(
    filtros: FiltrosCliente
): Promise<RespuestaLista<Cliente>> {
    const supabase = await createClient()

    let query = supabase.from('clientes').select(COLUMNAS)

    if (filtros.estado === 'activos') {
        query = query.eq('es_archivado', false).eq('es_suspendido', false).eq('es_activo', true)
    } else if (filtros.estado === 'suspendidos') {
        query = query.eq('es_archivado', false).eq('es_suspendido', true)
    } else if (filtros.estado === 'archivados') {
        query = query.eq('es_archivado', true)
    }

    if (filtros.id_marca_comercial) query = query.eq('id_marca_comercial', filtros.id_marca_comercial)
    if (filtros.id_tipo_cliente) query = query.eq('id_tipo_cliente', filtros.id_tipo_cliente)
    if (filtros.id_vendedor_asignado) query = query.eq('id_vendedor_asignado', filtros.id_vendedor_asignado)

    const busqueda = filtros.busqueda.trim().replace(/[%_]/g, '')
    if (busqueda) {
        query = query.or(
            `nombre_comercial.ilike.%${busqueda}%,codigo.ilike.%${busqueda}%,rfc.ilike.%${busqueda}%`
        )
    }

    const { data, error } = await query.order('nombre_comercial', { ascending: true })
    if (error) return { success: false, error: error.message }

    const clientes = ((data ?? []) as unknown as FilaClienteCruda[]).map(aFila)
    return { success: true, data: clientes }
}

// ── Opciones para selectores (contrato → 1.7/1.8/1.9) — excluye suspendidos ──
export async function listarClientesActivos(): Promise<RespuestaLista<ClienteOpcion>> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('clientes')
        .select('id, codigo, nombre_comercial, rfc')
        .eq('es_archivado', false)
        .eq('es_suspendido', false)
        .eq('es_activo', true)
        .order('nombre_comercial', { ascending: true })

    if (error) return { success: false, error: error.message }
    return { success: true, data: (data ?? []) as ClienteOpcion[] }
}

// ── Crear cliente (folio CLT-#### + hijas D9 en cascada) ──────────────────────
export async function crearCliente(input: ClienteAltaInput): Promise<RespuestaAccion> {
    const parsed = clienteAltaSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
    }
    const d = parsed.data

    const supabase = await createClient()
    const { data: sesion } = await supabase.auth.getUser()
    if (!sesion.user) return { success: false, error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }

    const { data: codigo, error: errFolio } = await supabase.rpc('generar_folio', {
        p_tipo: 'cliente',
    })
    if (errFolio || !codigo) {
        return { success: false, error: errFolio?.message ?? 'No se pudo generar el código del cliente.' }
    }

    const { data: fila, error } = await supabase
        .from('clientes')
        .insert({
            codigo,
            nombre_comercial: d.nombre_comercial,
            tipo_persona: d.tipo_persona,
            razon_social: aNull(d.razon_social),
            id_marca_comercial: d.id_marca_comercial,
            id_tipo_cliente: d.id_tipo_cliente,
            id_lista_precio: d.id_lista_precio,
            id_canal_venta: aNull(d.id_canal_venta),
            id_ruta_cobro: aNull(d.id_ruta_cobro),
            id_vendedor_asignado: aNull(d.id_vendedor_asignado),
            tiene_credito: d.tiene_credito,
            limite_credito: d.tiene_credito ? aMonto(d.limite_credito) : null,
            dias_credito: d.tiene_credito ? aNum(d.dias_credito) : null,
            saldo_inicial: aMonto(d.saldo_inicial) ?? 0,
            rfc: aRfc(d.rfc),
            id_regimen_fiscal: aNull(d.id_regimen_fiscal),
            id_uso_cfdi: aNull(d.id_uso_cfdi),
            notas: aNull(d.notas),
            es_activo: d.es_activo,
        })
        .select('id')
        .single()

    if (error) return { success: false, error: traducirErrorCliente(error.code, error.message) }
    if (!fila) return { success: false, error: 'No se pudo crear el cliente.' }

    for (const dir of d.direcciones) {
        const { error: errDir } = await supabase.from('clientes_direcciones').insert({
            id_cliente: fila.id,
            tipo: dir.tipo,
            etiqueta: aNull(dir.etiqueta),
            direccion: dir.direccion,
            colonia: aNull(dir.colonia),
            ciudad: aNull(dir.ciudad),
            estado: aNull(dir.estado),
            codigo_postal: aNull(dir.codigo_postal),
            es_default_fiscal: dir.es_default_fiscal,
            es_default_envio: dir.es_default_envio,
            es_activo: dir.es_activo,
        })
        if (errDir) {
            return { success: false, error: `El cliente se creó pero falló una dirección: ${traducirErrorCliente(errDir.code, errDir.message)}` }
        }
    }
    for (const contacto of d.contactos) {
        const { error: errContacto } = await supabase.from('clientes_contactos').insert({
            id_cliente: fila.id,
            tipo: contacto.tipo,
            nombre: contacto.nombre,
            telefono: aNull(contacto.telefono),
            email: aNull(contacto.email),
            notas: aNull(contacto.notas),
            es_principal: contacto.es_principal,
            es_activo: contacto.es_activo,
        })
        if (errContacto) {
            return { success: false, error: `El cliente se creó pero falló un contacto: ${traducirErrorCliente(errContacto.code, errContacto.message)}` }
        }
    }

    return { success: true }
}

// ── Alta rápida (contrato → 1.7/1.8/1.9) ──────────────────────────────────────
export async function crearClienteRapido(
    input: ClienteRapidoInput
): Promise<RespuestaDato<{ id: string; codigo: string }>> {
    const parsed = clienteRapidoSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
    }

    const supabase = await createClient()
    const { data: sesion } = await supabase.auth.getUser()
    if (!sesion.user) return { success: false, error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }

    const { data: codigo, error: errFolio } = await supabase.rpc('generar_folio', {
        p_tipo: 'cliente',
    })
    if (errFolio || !codigo) {
        return { success: false, error: errFolio?.message ?? 'No se pudo generar el código del cliente.' }
    }

    const { data: tipoPublico } = await supabase
        .from('tipos_cliente')
        .select('id')
        .eq('clave', 'PUBLICO')
        .eq('es_activo', true)
        .maybeSingle()
    const { data: listaDefault } = await supabase
        .from('listas_precios')
        .select('id')
        .eq('es_lista_default', true)
        .eq('es_activo', true)
        .maybeSingle()

    const { data: fila, error } = await supabase
        .from('clientes')
        .insert({
            codigo,
            nombre_comercial: parsed.data.nombre_comercial,
            tipo_persona: 'fisica',
            id_marca_comercial: parsed.data.id_marca_comercial,
            id_tipo_cliente: tipoPublico?.id ?? null,
            id_lista_precio: listaDefault?.id ?? null,
            es_activo: true,
        })
        .select('id, codigo')
        .single()

    if (error) return { success: false, error: traducirErrorCliente(error.code, error.message) }
    if (!fila) return { success: false, error: 'No se pudo crear el cliente.' }

    return { success: true, data: { id: fila.id, codigo: fila.codigo } }
}

// ── Obtener uno con hijas (edición + ficha [id]) ──────────────────────────────
interface FilaClienteCrudaConHijas extends FilaClienteCruda {
    clientes_direcciones: {
        id: string; tipo: string; etiqueta: string | null; direccion: string
        colonia: string | null; ciudad: string | null; estado: string | null
        codigo_postal: string | null; es_default_fiscal: boolean
        es_default_envio: boolean; es_activo: boolean
    }[]
    clientes_contactos: {
        id: string; tipo: string; nombre: string; telefono: string | null
        email: string | null; notas: string | null; es_principal: boolean; es_activo: boolean
    }[]
}

export async function obtenerCliente(id: string): Promise<RespuestaDato<Cliente>> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('clientes')
        .select(`${COLUMNAS},clientes_direcciones(*),clientes_contactos(*)`)
        .eq('id', id)
        .maybeSingle()

    if (error) return { success: false, error: error.message }
    if (!data) return { success: false, error: 'El cliente no existe.' }

    const cruda = data as unknown as FilaClienteCrudaConHijas
    const base = aFila(cruda)
    const detalle = {
        ...base,
        direcciones: (cruda.clientes_direcciones ?? []).map((d) => ({
            id: d.id,
            tipo: d.tipo as DireccionCliente['tipo'],
            etiqueta: d.etiqueta,
            direccion: d.direccion,
            colonia: d.colonia,
            ciudad: d.ciudad,
            estado: d.estado,
            codigo_postal: d.codigo_postal,
            es_default_fiscal: d.es_default_fiscal,
            es_default_envio: d.es_default_envio,
            es_activo: d.es_activo,
        })),
        contactos: (cruda.clientes_contactos ?? []).map((c) => ({
            id: c.id,
            tipo: c.tipo as ContactoCliente['tipo'],
            nombre: c.nombre,
            telefono: c.telefono,
            email: c.email,
            notas: c.notas,
            es_principal: c.es_principal,
            es_activo: c.es_activo,
        })),
    }
    return { success: true, data: detalle }
}

// ── Editar cliente (hijas por diffs) ──────────────────────────────────────────
export async function editarCliente(
    id: string,
    input: ClienteEditarInput
): Promise<RespuestaAccion> {
    const parsed = clienteEditarSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos.' }
    }
    const d = parsed.data

    const supabase = await createClient()
    const { data: sesion } = await supabase.auth.getUser()
    if (!sesion.user) return { success: false, error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }

    const { error } = await supabase
        .from('clientes')
        .update({
            nombre_comercial: d.nombre_comercial,
            tipo_persona: d.tipo_persona,
            razon_social: aNull(d.razon_social),
            id_marca_comercial: d.id_marca_comercial,
            id_tipo_cliente: d.id_tipo_cliente,
            id_lista_precio: d.id_lista_precio,
            id_canal_venta: aNull(d.id_canal_venta),
            id_ruta_cobro: aNull(d.id_ruta_cobro),
            id_vendedor_asignado: aNull(d.id_vendedor_asignado),
            tiene_credito: d.tiene_credito,
            limite_credito: d.tiene_credito ? aMonto(d.limite_credito) : null,
            dias_credito: d.tiene_credito ? aNum(d.dias_credito) : null,
            rfc: aRfc(d.rfc),
            id_regimen_fiscal: aNull(d.id_regimen_fiscal),
            id_uso_cfdi: aNull(d.id_uso_cfdi),
            notas: aNull(d.notas),
            es_activo: d.es_activo,
            actualizado_por: sesion.user.id,
        })
        .eq('id', id)

    if (error) return { success: false, error: traducirErrorCliente(error.code, error.message) }

    for (const dir of d.direcciones) {
        if (dir.id === '') {
            const { error: errIns } = await supabase.from('clientes_direcciones').insert({
                id_cliente: id, tipo: dir.tipo, etiqueta: aNull(dir.etiqueta), direccion: dir.direccion,
                colonia: aNull(dir.colonia), ciudad: aNull(dir.ciudad), estado: aNull(dir.estado),
                codigo_postal: aNull(dir.codigo_postal), es_default_fiscal: dir.es_default_fiscal,
                es_default_envio: dir.es_default_envio, es_activo: dir.es_activo,
            })
            if (errIns) return { success: false, error: traducirErrorCliente(errIns.code, errIns.message) }
        } else {
            const { error: errUpd } = await supabase
                .from('clientes_direcciones')
                .update({
                    tipo: dir.tipo, etiqueta: aNull(dir.etiqueta), direccion: dir.direccion,
                    colonia: aNull(dir.colonia), ciudad: aNull(dir.ciudad), estado: aNull(dir.estado),
                    codigo_postal: aNull(dir.codigo_postal), es_default_fiscal: dir.es_default_fiscal,
                    es_default_envio: dir.es_default_envio, es_activo: dir.es_activo,
                })
                .eq('id', dir.id)
                .eq('id_cliente', id)
            if (errUpd) return { success: false, error: traducirErrorCliente(errUpd.code, errUpd.message) }
        }
    }
    for (const rid of d.removedDirecciones) {
        const { error: errDel } = await supabase
            .from('clientes_direcciones')
            .delete()
            .eq('id', rid)
            .eq('id_cliente', id)
        if (errDel) return { success: false, error: traducirErrorCliente(errDel.code, errDel.message) }
    }

    for (const contacto of d.contactos) {
        if (contacto.id === '') {
            const { error: errIns } = await supabase.from('clientes_contactos').insert({
                id_cliente: id, tipo: contacto.tipo, nombre: contacto.nombre,
                telefono: aNull(contacto.telefono), email: aNull(contacto.email),
                notas: aNull(contacto.notas), es_principal: contacto.es_principal,
                es_activo: contacto.es_activo,
            })
            if (errIns) return { success: false, error: traducirErrorCliente(errIns.code, errIns.message) }
        } else {
            const { error: errUpd } = await supabase
                .from('clientes_contactos')
                .update({
                    tipo: contacto.tipo, nombre: contacto.nombre,
                    telefono: aNull(contacto.telefono), email: aNull(contacto.email),
                    notas: aNull(contacto.notas), es_principal: contacto.es_principal,
                    es_activo: contacto.es_activo,
                })
                .eq('id', contacto.id)
                .eq('id_cliente', id)
            if (errUpd) return { success: false, error: traducirErrorCliente(errUpd.code, errUpd.message) }
        }
    }
    for (const rid of d.removedContactos) {
        const { error: errDel } = await supabase
            .from('clientes_contactos')
            .delete()
            .eq('id', rid)
            .eq('id_cliente', id)
        if (errDel) return { success: false, error: traducirErrorCliente(errDel.code, errDel.message) }
    }

    return { success: true }
}

// ── Activar / Desactivar por lote (permiso editar) ────────────────────────────
export async function toggleActivoClientes(
    ids: string[],
    activo: boolean
): Promise<RespuestaAccion> {
    if (ids.length === 0) return { success: false, error: 'Selecciona al menos un cliente.' }

    const supabase = await createClient()
    const { data: sesion } = await supabase.auth.getUser()
    if (!sesion.user) return { success: false, error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }

    const { error } = await supabase
        .from('clientes')
        .update({ es_activo: activo, actualizado_por: sesion.user.id })
        .in('id', ids)

    if (error) return { success: false, error: traducirErrorCliente(error.code, error.message) }
    return { success: true }
}

// ── Archivar / Reactivar por lote (soft-delete · permiso eliminar) ────────────
export async function archivarClientes(
    ids: string[],
    archivar: boolean
): Promise<RespuestaAccion> {
    if (ids.length === 0) return { success: false, error: 'Selecciona al menos un cliente.' }

    const supabase = await createClient()
    const { data: sesion } = await supabase.auth.getUser()
    if (!sesion.user) return { success: false, error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }

    const patch = archivar
        ? { es_archivado: true, es_activo: false, actualizado_por: sesion.user.id }
        : { es_archivado: false, es_activo: true, actualizado_por: sesion.user.id }

    const { error } = await supabase.from('clientes').update(patch).in('id', ids)

    if (error) return { success: false, error: traducirErrorCliente(error.code, error.message) }
    return { success: true }
}

// ── Suspender / Levantar (D23 · permiso editar) ───────────────────────────────
export async function suspenderCliente(
    id: string,
    motivo: string
): Promise<RespuestaAccion> {
    const m = motivo.trim()
    if (!m) return { success: false, error: 'El motivo de la suspensión es obligatorio.' }

    const supabase = await createClient()
    const { data: sesion } = await supabase.auth.getUser()
    if (!sesion.user) return { success: false, error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }

    const { error } = await supabase
        .from('clientes')
        .update({
            es_suspendido: true,
            motivo_suspension: m,
            fecha_suspension: new Date().toISOString(),
            id_usuario_suspension: sesion.user.id,
            actualizado_por: sesion.user.id,
        })
        .eq('id', id)

    if (error) return { success: false, error: traducirErrorCliente(error.code, error.message) }
    return { success: true }
}

export async function levantarSuspensionCliente(id: string): Promise<RespuestaAccion> {
    const supabase = await createClient()
    const { data: sesion } = await supabase.auth.getUser()
    if (!sesion.user) return { success: false, error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }

    const { error } = await supabase
        .from('clientes')
        .update({
            es_suspendido: false,
            motivo_suspension: null,
            fecha_suspension: null,
            id_usuario_suspension: null,
            actualizado_por: sesion.user.id,
        })
        .eq('id', id)

    if (error) return { success: false, error: traducirErrorCliente(error.code, error.message) }
    return { success: true }
}

// ── Reasignar vendedor (cartera · masiva) ─────────────────────────────────────
export async function cambiarVendedorClientes(
    ids: string[],
    idVendedor: string | null
): Promise<RespuestaAccion> {
    if (ids.length === 0) return { success: false, error: 'Selecciona al menos un cliente.' }

    const supabase = await createClient()
    const { data: sesion } = await supabase.auth.getUser()
    if (!sesion.user) return { success: false, error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }

    const { error } = await supabase
        .from('clientes')
        .update({ id_vendedor_asignado: idVendedor, actualizado_por: sesion.user.id })
        .in('id', ids)

    if (error) return { success: false, error: traducirErrorCliente(error.code, error.message) }
    return { success: true }
}

// ── Historial de eventos (bitácora append-only) ───────────────────────────────
export async function listarBitacoraCliente(
    idCliente: string
): Promise<RespuestaLista<EventoBitacoraCliente>> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('bitacora_cliente')
        .select(
            'id, tipo_evento, entidad, id_entidad, descripcion, id_usuario, created_at, usuarios(nombre_completo)'
        )
        .eq('id_cliente', idCliente)
        .order('created_at', { ascending: false })

    if (error) return { success: false, error: error.message }

    const eventos = ((data ?? []) as unknown as {
        id: string
        tipo_evento: EventoBitacoraCliente['tipo_evento']
        entidad: EventoBitacoraCliente['entidad']
        id_entidad: string | null
        descripcion: string
        id_usuario: string | null
        created_at: string
        usuarios: { nombre_completo: string } | null
    }[]).map((e) => ({
        id: e.id,
        tipo_evento: e.tipo_evento,
        entidad: e.entidad,
        id_entidad: e.id_entidad,
        descripcion: e.descripcion,
        id_usuario: e.id_usuario,
        usuario_nombre: e.usuarios?.nombre_completo ?? null,
        created_at: e.created_at,
    }))

    return { success: true, data: eventos }
}
