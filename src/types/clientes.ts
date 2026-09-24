// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS DEL DOMINIO — CLIENTES (Guía 1.3)
// Espejo LITERAL de public.clientes + hijas (GUIAS/15/docs/bd-clientes.md §3).
// Los nombres snake_case son contrato con la BD: renombrar uno guarda el dato
// equivocado sin romper el build (CLAUDE.md, regla 4).
// ═══════════════════════════════════════════════════════════════════════════════

import type { TonoPildora } from '@/components/data-table'

// ── Vocabulario cerrado (CHECKs en BD · MODELO_DATOS §7.1) ─────────────────────
export type TipoPersona = 'fisica' | 'moral'
export type TipoDireccion = 'matriz' | 'sucursal' | 'envio' | 'almacen' | 'otro'
export type TipoContacto = 'general' | 'ventas' | 'cobranza' | 'soporte' | 'direccion' | 'otro'
export type TipoEventoBitacora =
    | 'alta' | 'edicion' | 'activacion' | 'desactivacion' | 'archivado' | 'restauracion'
    | 'suspension' | 'levantamiento'
    | 'direccion_alta' | 'direccion_edicion' | 'direccion_baja'
    | 'contacto_alta' | 'contacto_edicion' | 'contacto_baja'

// ── Fila del listado / ficha — lo que proyectan listar y obtener ───────────────
// Los nombres de display (marca_nombre/tipo_cliente_nombre/…) llegan aplanados desde
// los joins de la Server Action (la UI muestra nombres, no ids) — patrón 1.1/1.2.
export interface Cliente {
    id: string
    // Identidad
    codigo: string
    nombre_comercial: string
    razon_social: string | null
    tipo_persona: TipoPersona
    // Marca / cartera / comercial (embeds aplanados)
    id_marca_comercial: string
    marca_nombre: string | null
    id_tipo_cliente: string
    tipo_cliente_nombre: string | null
    id_lista_precio: string
    lista_precio_nombre: string | null
    id_canal_venta: string | null
    canal_venta_nombre: string | null
    id_ruta_cobro: string | null
    ruta_cobro_nombre: string | null
    id_vendedor_asignado: string | null
    vendedor_nombre: string | null
    // Crédito (D20)
    tiene_credito: boolean
    limite_credito: number | null
    dias_credito: number | null
    saldo_inicial: number
    saldo_actual: number
    // Fiscal
    rfc: string | null
    id_regimen_fiscal: string | null
    regimen_descripcion: string | null
    id_uso_cfdi: string | null
    // Control
    notas: string | null
    es_activo: boolean
    es_archivado: boolean
    es_suspendido: boolean
    motivo_suspension: string | null
    fecha_suspension: string | null
    id_usuario_suspension: string | null
    // Auditoría
    creado_por: string | null
    actualizado_por: string | null
    created_at: string
    updated_at: string
}

// ── Hijas (D9) — embeds de la ficha / grids del modal ──────────────────────────
export interface DireccionCliente {
    id: string
    tipo: TipoDireccion
    etiqueta: string | null
    direccion: string
    colonia: string | null
    ciudad: string | null
    estado: string | null
    codigo_postal: string | null
    es_default_fiscal: boolean
    es_default_envio: boolean
    es_activo: boolean
}

export interface ContactoCliente {
    id: string
    tipo: TipoContacto
    nombre: string
    telefono: string | null
    email: string | null
    notas: string | null
    es_principal: boolean
    es_activo: boolean
}

/** Ficha con hijas embebidas (obtenerCliente) — las 5 pestañas de la ficha [id]. */
export interface ClienteDetalle extends Cliente {
    direcciones: DireccionCliente[]
    contactos: ContactoCliente[]
}

// ── Opción del selector de cliente (contrato hacia 1.7/1.8/1.9) ────────────────
export interface ClienteOpcion {
    id: string
    codigo: string
    nombre_comercial: string
    rfc: string | null
}

// ── Evento de la bitácora (P8 · Historial) ─────────────────────────────────────
export interface EventoBitacoraCliente {
    id: string
    tipo_evento: TipoEventoBitacora
    entidad: 'clientes' | 'clientes_direcciones' | 'clientes_contactos'
    id_entidad: string | null
    descripcion: string
    id_usuario: string | null
    usuario_nombre: string | null
    created_at: string
}

// ── Estado derivado de la fila — vocabulario de la pantalla ────────────────────
// No es columna: se deriva. Orden de precedencia: archivado > suspendido > activo.
export type EstadoCliente = 'activo' | 'inactivo' | 'suspendido' | 'archivado'

export function estadoDeCliente(
    p: Pick<Cliente, 'es_activo' | 'es_archivado' | 'es_suspendido'>
): EstadoCliente {
    if (p.es_archivado) return 'archivado'
    if (p.es_suspendido) return 'suspendido'
    return p.es_activo ? 'activo' : 'inactivo'
}

// El mapa estado → tono vive AQUÍ, no en Pildora (patrón 0.9).
export const TONO_ESTADO_CLIENTE: Record<EstadoCliente, TonoPildora> = {
    activo: 'exito',
    inactivo: 'neutro',
    suspendido: 'peligro',
    archivado: 'advertencia',
}

export const TEXTO_ESTADO_CLIENTE: Record<EstadoCliente, string> = {
    activo: 'Activo',
    inactivo: 'Inactivo',
    suspendido: 'Suspendido',
    archivado: 'Archivado',
}

export const TONO_TIPO_PERSONA: Record<TipoPersona, TonoPildora> = {
    fisica: 'info',
    moral: 'advertencia',
}

export const TEXTO_TIPO_PERSONA: Record<TipoPersona, string> = {
    fisica: 'Física',
    moral: 'Moral',
}

// ── Estado del filtro — cuatro posiciones (PLAN §4 #9/#10 · usuario 04 Sep) ────
// 'todos' = DEFAULT del listado (decisión usuario: difiere del precedente 1.1/1.2).
// 'activos' = vigentes: NO archivado, NO suspendido, es_activo.
// Los desactivados (es_activo=false sin archivar/suspender) se ven solo en 'todos'.
export type EstadoFiltroCliente = 'todos' | 'activos' | 'suspendidos' | 'archivados'

// ── Estado de la barra de filtros (lo posee el catálogo, lo pinta ClienteFilters) ─
export interface FiltrosCliente {
    busqueda: string
    /** '' = todas las marcas */
    id_marca_comercial: string
    /** '' = todos los tipos */
    id_tipo_cliente: string
    /** '' = todos los vendedores (cartera) */
    id_vendedor_asignado: string
    estado: EstadoFiltroCliente
}

// ── Forma canónica del formulario del modal (secciones · ANATOMÍA §4) ──────────
// Valores crudos del formulario (RHF): opcionales como '' · montos/plazos como
// string ('' = vacío) · hijas con id '' cuando son nuevas. Los schemas de zod
// (validations/clientes.ts) transforman a string|undefined / number|null para la BD.
export interface DireccionFormData {
    /** '' = fila nueva (sin id en BD); con id = fila persistida (edición) */
    id: string
    tipo: TipoDireccion
    etiqueta: string
    direccion: string
    colonia: string
    ciudad: string
    estado: string
    codigo_postal: string
    es_default_fiscal: boolean
    es_default_envio: boolean
    es_activo: boolean
}

export interface ContactoFormData {
    /** '' = fila nueva; con id = fila persistida (edición) */
    id: string
    tipo: TipoContacto
    nombre: string
    telefono: string
    email: string
    notas: string
    es_principal: boolean
    es_activo: boolean
}

export interface ClienteFormData {
    // Identidad / comercial
    nombre_comercial: string
    tipo_persona: TipoPersona
    razon_social: string
    id_marca_comercial: string
    id_tipo_cliente: string
    id_lista_precio: string
    id_canal_venta: string
    id_ruta_cobro: string
    id_vendedor_asignado: string
    // Crédito
    tiene_credito: boolean
    limite_credito: string
    dias_credito: string
    /** SOLO alta (D20) — en edición el modal no lo muestra y el valor no viaja */
    saldo_inicial: string
    // Fiscal
    rfc: string
    id_regimen_fiscal: string
    id_uso_cfdi: string
    // Control
    notas: string
    es_activo: boolean
    // Hijas (grids N)
    direcciones: DireccionFormData[]
    contactos: ContactoFormData[]
}

/** Formulario vacío (alta). El codigo NUNCA se captura (autogenerado CLT-####). */
export function clienteFormDataVacio(): ClienteFormData {
    return {
        nombre_comercial: '',
        tipo_persona: 'fisica',
        razon_social: '',
        id_marca_comercial: '',
        id_tipo_cliente: '',
        id_lista_precio: '',
        id_canal_venta: '',
        id_ruta_cobro: '',
        id_vendedor_asignado: '',
        tiene_credito: false,
        limite_credito: '',
        dias_credito: '',
        saldo_inicial: '',
        rfc: '',
        id_regimen_fiscal: '',
        id_uso_cfdi: '',
        notas: '',
        es_activo: true,
        direcciones: [],
        contactos: [],
    }
}

/** Cliente (con hijas) → formulario (edición). codigo/saldo_actual NO viajan. */
export function clienteAFormData(detalle: ClienteDetalle): ClienteFormData {
    return {
        nombre_comercial: detalle.nombre_comercial,
        tipo_persona: detalle.tipo_persona,
        razon_social: detalle.razon_social ?? '',
        id_marca_comercial: detalle.id_marca_comercial,
        id_tipo_cliente: detalle.id_tipo_cliente,
        id_lista_precio: detalle.id_lista_precio,
        id_canal_venta: detalle.id_canal_venta ?? '',
        id_ruta_cobro: detalle.id_ruta_cobro ?? '',
        id_vendedor_asignado: detalle.id_vendedor_asignado ?? '',
        tiene_credito: detalle.tiene_credito,
        limite_credito: detalle.limite_credito === null ? '' : String(detalle.limite_credito),
        dias_credito: detalle.dias_credito === null || detalle.dias_credito === 0 ? '' : String(detalle.dias_credito),
        saldo_inicial: String(detalle.saldo_inicial),
        rfc: detalle.rfc ?? '',
        id_regimen_fiscal: detalle.id_regimen_fiscal ?? '',
        id_uso_cfdi: detalle.id_uso_cfdi ?? '',
        notas: detalle.notas ?? '',
        es_activo: detalle.es_activo,
        direcciones: detalle.direcciones.map((d) => ({
            id: d.id,
            tipo: d.tipo,
            etiqueta: d.etiqueta ?? '',
            direccion: d.direccion,
            colonia: d.colonia ?? '',
            ciudad: d.ciudad ?? '',
            estado: d.estado ?? '',
            codigo_postal: d.codigo_postal ?? '',
            es_default_fiscal: d.es_default_fiscal,
            es_default_envio: d.es_default_envio,
            es_activo: d.es_activo,
        })),
        contactos: detalle.contactos.map((c) => ({
            id: c.id,
            tipo: c.tipo,
            nombre: c.nombre,
            telefono: c.telefono ?? '',
            email: c.email ?? '',
            notas: c.notas ?? '',
            es_principal: c.es_principal,
            es_activo: c.es_activo,
        })),
    }
}

// ── Respuestas tipadas de las Server Actions (nunca throw — patrón 0.9) ───────
export interface RespuestaLista<T> {
    success: boolean
    error?: string
    data?: T[]
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
