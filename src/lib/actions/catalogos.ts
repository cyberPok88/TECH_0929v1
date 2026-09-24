// actions/catalogos.ts — Catálogos y Datos Maestros (Guía 1.0) — LECTURAS (P1)
'use server'

import { createClient } from '@/lib/supabase/server'
import type {
  ImpuestoFila, UnidadMedidaFila, CategoriaFila, CatalogoSimpleFila,
  MarcaComercialFila, MarcaProductoFila, TipoClienteFila, ListaPrecioFila,
  RutaCobroFila, UbicacionAlmacenFila, VendedorFila,
  RespuestaLista,
} from '@/types/catalogos'

async function cliente() { return createClient() }

// --- Impuestos ---
export async function listarImpuestos(): Promise<RespuestaLista<ImpuestoFila>> {
  const sb = await cliente()
  const { data, error } = await sb.from('impuestos').select('*').order('nombre', { ascending: true })
  if (error) return { success: false as never, data: [] } // nunca throw
  return { success: true, data: (data ?? []) as ImpuestoFila[] }
}

// --- Unidades de medida ---
export async function listarUnidadesMedida(): Promise<RespuestaLista<UnidadMedidaFila>> {
  const sb = await cliente()
  const { data, error } = await sb.from('unidades_medida').select('*').order('nombre', { ascending: true })
  if (error) return { success: false as never, data: [] }
  return { success: true, data: (data ?? []) as UnidadMedidaFila[] }
}

// --- Categorías y subcategorías (jerarquía: raíces primero) ---
export async function listarCategorias(): Promise<RespuestaLista<CategoriaFila>> {
  const sb = await cliente()
  const { data, error } = await sb.from('categorias_producto')
    .select('*').order('orden', { ascending: true })
  if (error) return { success: false as never, data: [] }
  return { success: true, data: (data ?? []) as CategoriaFila[] }
}

// --- Canales de venta ---
export async function listarCanalesVenta(): Promise<RespuestaLista<CatalogoSimpleFila>> {
  const sb = await cliente(); const { data, error } = await sb.from('canales_venta').select('*').order('nombre', { ascending: true })
  if (error) return { success: false as never, data: [] }
  return { success: true, data: (data ?? []) as CatalogoSimpleFila[] }
}

// --- Marcas comerciales ---
export async function listarMarcasComerciales(): Promise<RespuestaLista<MarcaComercialFila>> {
  const sb = await cliente(); const { data, error } = await sb.from('marcas_comerciales').select('*').order('nombre_visible', { ascending: true })
  if (error) return { success: false as never, data: [] }
  return { success: true, data: (data ?? []) as MarcaComercialFila[] }
}

// --- Marcas de producto (fabricante) ---
export async function listarMarcasProducto(): Promise<RespuestaLista<MarcaProductoFila>> {
  const sb = await cliente(); const { data, error } = await sb.from('marcas_producto').select('*').order('nombre', { ascending: true })
  if (error) return { success: false as never, data: [] }
  return { success: true, data: (data ?? []) as MarcaProductoFila[] }
}

// --- Tipos de cliente ---
export async function listarTiposCliente(): Promise<RespuestaLista<TipoClienteFila>> {
  const sb = await cliente(); const { data, error } = await sb.from('tipos_cliente').select('*').order('orden', { ascending: true })
  if (error) return { success: false as never, data: [] }
  return { success: true, data: (data ?? []) as TipoClienteFila[] }
}

// --- Listas de precios ---
export async function listarListasPrecio(): Promise<RespuestaLista<ListaPrecioFila>> {
  const sb = await cliente(); const { data, error } = await sb.from('listas_precios').select('*').order('clave', { ascending: true })
  if (error) return { success: false as never, data: [] }
  return { success: true, data: (data ?? []) as ListaPrecioFila[] }
}

// --- Rutas de cobro ---
export async function listarRutasCobro(): Promise<RespuestaLista<RutaCobroFila>> {
  const sb = await cliente(); const { data, error } = await sb.from('rutas_cobro').select('*').order('nombre', { ascending: true })
  if (error) return { success: false as never, data: [] }
  return { success: true, data: (data ?? []) as RutaCobroFila[] }
}

// --- Ubicaciones del almacén ---
export async function listarUbicacionesAlmacen(): Promise<RespuestaLista<UbicacionAlmacenFila>> {
  const sb = await cliente(); const { data, error } = await sb.from('ubicaciones_almacen')
    .select('*').order('rack', { ascending: true }).order('nivel', { ascending: true }).order('organizador', { ascending: true }).order('charola', { ascending: true })
  if (error) return { success: false as never, data: [] }
  return { success: true, data: (data ?? []) as UbicacionAlmacenFila[] }
}

// --- Vendedores (derivado read-only: usuarios con rol 'vendedor') ---
export async function listarVendedores(): Promise<RespuestaLista<VendedorFila>> {
  const sb = await cliente()
  const { data: rol } = await sb.from('roles').select('id').eq('clave', 'vendedor').maybeSingle()
  if (!rol) return { success: false as never, data: [] }
  const { data, error } = await sb
    .from('usuarios')
    .select('id, nombre_completo, email, es_activo')
    .eq('id_rol', rol.id)
    .eq('es_archivado', false)
    .order('nombre_completo', { ascending: true })
  if (error) return { success: false as never, data: [] }
  const filas = (data ?? []).map((u) => ({
    id: (u as { id: string }).id,
    nombre: (u as { nombre_completo: string }).nombre_completo,
    correo: (u as { email: string | null }).email,
    es_activo: (u as { es_activo: boolean }).es_activo,
  }))
  return { success: true, data: filas as VendedorFila[] }
}

// ===== P3 — verbos de escritura: Impuestos (Guía 1.0) =====
import { impuestoCrearSchema, impuestoEditarSchema } from '@/lib/validations/catalogos'
import type { RespuestaAccion } from '@/types/catalogos'

export async function crearImpuesto(input: unknown): Promise<RespuestaAccion> {
  const parsed = impuestoCrearSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const sb = await cliente()
  const { error } = await sb.from('impuestos').insert({
    clave: parsed.data.clave,
    nombre: parsed.data.nombre,
    tipo: parsed.data.tipo,
    tasa: parsed.data.tasaPorciento / 100,
    es_activo: parsed.data.es_activo,
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function editarImpuesto(id: string, input: unknown): Promise<RespuestaAccion> {
  const parsed = impuestoEditarSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const sb = await cliente()
  const { error } = await sb.from('impuestos').update({
    nombre: parsed.data.nombre,
    tipo: parsed.data.tipo,
    tasa: parsed.data.tasaPorciento / 100,
    es_activo: parsed.data.es_activo,
  }).eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function cambiarEstadoImpuesto(id: string, activo: boolean): Promise<RespuestaAccion> {
  const sb = await cliente()
  const { error } = await sb.from('impuestos').update({ es_activo: activo }).eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ===== P4 — verbos de escritura: catálogos simples =====
import { unidadMedidaCrearSchema, unidadMedidaEditarSchema,
         canalVentaCrearSchema, canalVentaEditarSchema,
         marcaComercialCrearSchema, marcaComercialEditarSchema,
         marcaProductoCrearSchema, marcaProductoEditarSchema } from '@/lib/validations/catalogos'

function primerError(r: { success: boolean; error?: unknown }) {
  if (r.success) return null
  return (r.error as { issues?: { message: string }[] })?.issues?.[0]?.message ?? 'Datos inválidos'
}

// --- Unidades de medida ---
export async function crearUnidadMedida(input: unknown): Promise<RespuestaAccion> {
  const parsed = unidadMedidaCrearSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: primerError(parsed) ?? 'Datos inválidos' }
  const sb = await cliente()
  const { error } = await sb.from('unidades_medida').insert({
    clave: parsed.data.clave, nombre: parsed.data.nombre, abreviatura: parsed.data.abreviatura,
    clave_sat: parsed.data.clave_sat || null, es_activo: parsed.data.es_activo,
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}
export async function editarUnidadMedida(id: string, input: unknown): Promise<RespuestaAccion> {
  const parsed = unidadMedidaEditarSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: primerError(parsed) ?? 'Datos inválidos' }
  const sb = await cliente()
  const { error } = await sb.from('unidades_medida').update({
    nombre: parsed.data.nombre, abreviatura: parsed.data.abreviatura, clave_sat: parsed.data.clave_sat || null,
  }).eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}
export async function cambiarEstadoUnidadMedida(id: string, activo: boolean): Promise<RespuestaAccion> {
  const sb = await cliente(); const { error } = await sb.from('unidades_medida').update({ es_activo: activo }).eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// --- Canales de venta ---
export async function crearCanalVenta(input: unknown): Promise<RespuestaAccion> {
  const parsed = canalVentaCrearSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: primerError(parsed) ?? 'Datos inválidos' }
  const sb = await cliente(); const { error } = await sb.from('canales_venta').insert({
    clave: parsed.data.clave, nombre: parsed.data.nombre, es_activo: parsed.data.es_activo,
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}
export async function editarCanalVenta(id: string, input: unknown): Promise<RespuestaAccion> {
  const parsed = canalVentaEditarSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: primerError(parsed) ?? 'Datos inválidos' }
  const sb = await cliente(); const { error } = await sb.from('canales_venta').update({
    nombre: parsed.data.nombre, es_activo: parsed.data.es_activo,
  }).eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}
export async function cambiarEstadoCanalVenta(id: string, activo: boolean): Promise<RespuestaAccion> {
  const sb = await cliente(); const { error } = await sb.from('canales_venta').update({ es_activo: activo }).eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// --- Marcas comerciales (es_activa) ---
export async function crearMarcaComercial(input: unknown): Promise<RespuestaAccion> {
  const parsed = marcaComercialCrearSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: primerError(parsed) ?? 'Datos inválidos' }
  const sb = await cliente(); const { error } = await sb.from('marcas_comerciales').insert({
    clave: parsed.data.clave, nombre_visible: parsed.data.nombre_visible, slug: parsed.data.slug,
    color_hex: parsed.data.color_hex || null, descripcion: parsed.data.descripcion || null,
    es_activa: parsed.data.es_activa,
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}
export async function editarMarcaComercial(id: string, input: unknown): Promise<RespuestaAccion> {
  const parsed = marcaComercialEditarSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: primerError(parsed) ?? 'Datos inválidos' }
  const sb = await cliente(); const { error } = await sb.from('marcas_comerciales').update({
    nombre_visible: parsed.data.nombre_visible, slug: parsed.data.slug,
    color_hex: parsed.data.color_hex || null, descripcion: parsed.data.descripcion || null,
    es_activa: parsed.data.es_activa,
  }).eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}
export async function cambiarEstadoMarcaComercial(id: string, activa: boolean): Promise<RespuestaAccion> {
  const sb = await cliente(); const { error } = await sb.from('marcas_comerciales').update({ es_activa: activa }).eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// --- Marcas de producto (fabricante) ---
export async function crearMarcaProducto(input: unknown): Promise<RespuestaAccion> {
  const parsed = marcaProductoCrearSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: primerError(parsed) ?? 'Datos inválidos' }
  const sb = await cliente(); const { error } = await sb.from('marcas_producto').insert({
    nombre: parsed.data.nombre, es_activo: parsed.data.es_activo,
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}
export async function editarMarcaProducto(id: string, input: unknown): Promise<RespuestaAccion> {
  const parsed = marcaProductoEditarSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: primerError(parsed) ?? 'Datos inválidos' }
  const sb = await cliente(); const { error } = await sb.from('marcas_producto').update({
    nombre: parsed.data.nombre, es_activo: parsed.data.es_activo,
  }).eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}
export async function cambiarEstadoMarcaProducto(id: string, activo: boolean): Promise<RespuestaAccion> {
  const sb = await cliente(); const { error } = await sb.from('marcas_producto').update({ es_activo: activo }).eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ===== P5 — verbos: tipos_cliente y listas_precios (% entero→0-1 · default única) =====
import { tipoClienteCrearSchema, tipoClienteEditarSchema,
         listaPrecioCrearSchema, listaPrecioEditarSchema } from '@/lib/validations/catalogos'

// --- Tipos de cliente ---
export async function crearTipoCliente(input: unknown): Promise<RespuestaAccion> {
  const parsed = tipoClienteCrearSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: primerError(parsed) ?? 'Datos inválidos' }
  const sb = await cliente()
  const { error } = await sb.from('tipos_cliente').insert({
    clave: parsed.data.clave, nombre: parsed.data.nombre,
    porcentaje_ajuste: parsed.data.porcentajeAjustePorciento / 100,
    descripcion: parsed.data.descripcion || null, orden: parsed.data.orden,
    es_activo: parsed.data.es_activo,
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}
export async function editarTipoCliente(id: string, input: unknown): Promise<RespuestaAccion> {
  const parsed = tipoClienteEditarSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: primerError(parsed) ?? 'Datos inválidos' }
  const sb = await cliente()
  const { error } = await sb.from('tipos_cliente').update({
    nombre: parsed.data.nombre, porcentaje_ajuste: parsed.data.porcentajeAjustePorciento / 100,
    descripcion: parsed.data.descripcion || null, orden: parsed.data.orden,
    es_activo: parsed.data.es_activo,
  }).eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}
export async function cambiarEstadoTipoCliente(id: string, activo: boolean): Promise<RespuestaAccion> {
  const sb = await cliente(); const { error } = await sb.from('tipos_cliente').update({ es_activo: activo }).eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// --- Listas de precios (default única: guardia en toggle y al marcar default) ---
export async function crearListaPrecio(input: unknown): Promise<RespuestaAccion> {
  const parsed = listaPrecioCrearSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: primerError(parsed) ?? 'Datos inválidos' }
  const sb = await cliente()
  if (parsed.data.es_lista_default) {
    await sb.from('listas_precios').update({ es_lista_default: false }).eq('es_lista_default', true)
  }
  const { error } = await sb.from('listas_precios').insert({
    clave: parsed.data.clave, nombre: parsed.data.nombre,
    porcentaje_ajuste: parsed.data.porcentajeAjustePorciento / 100,
    es_lista_default: parsed.data.es_lista_default, es_activo: parsed.data.es_activo,
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}
export async function editarListaPrecio(id: string, input: unknown): Promise<RespuestaAccion> {
  const parsed = listaPrecioEditarSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: primerError(parsed) ?? 'Datos inválidos' }
  const sb = await cliente()
  if (parsed.data.es_lista_default) {
    await sb.from('listas_precios').update({ es_lista_default: false }).eq('es_lista_default', true)
  }
  const { error } = await sb.from('listas_precios').update({
    nombre: parsed.data.nombre, porcentaje_ajuste: parsed.data.porcentajeAjustePorciento / 100,
    es_lista_default: parsed.data.es_lista_default, es_activo: parsed.data.es_activo,
  }).eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}
export async function cambiarEstadoListaPrecio(id: string, activo: boolean): Promise<RespuestaAccion> {
  const sb = await cliente()
  if (!activo) {
    const { data: fila } = await sb.from('listas_precios').select('es_lista_default').eq('id', id).maybeSingle()
    if (fila?.es_lista_default) return { success: false, error: 'No se puede desactivar la lista default: marca primero otra como default' }
  }
  const { error } = await sb.from('listas_precios').update({ es_activo: activo }).eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ===== P6 — verbos: categorías (jerarquía 2 niveles + esquema) =====
function texto(input: unknown, campo: string): string {
  return typeof (input as Record<string, unknown>)?.[campo] === 'string' ? String((input as Record<string, unknown>)[campo]).trim() : ''
}
function booleano(input: unknown, campo: string): boolean {
  return Boolean((input as Record<string, unknown>)?.[campo])
}
function numero(input: unknown, campo: string): number {
  const n = Number((input as Record<string, unknown>)?.[campo])
  return Number.isFinite(n) ? n : 0
}
function jsonArray(input: unknown, campo: string): unknown[] {
  const v = (input as Record<string, unknown>)?.[campo]
  return Array.isArray(v) ? v : []
}

export async function crearCategoria(input: unknown): Promise<RespuestaAccion> {
  const nombre = texto(input, 'nombre')
  if (!nombre) return { success: false, error: 'El nombre es obligatorio' }
  const idPadre = (input as Record<string, unknown>)?.id_categoria_padre
  const sb = await cliente()
  if (idPadre) {
    const { data: padre } = await sb.from('categorias_producto')
      .select('id_categoria_padre').eq('id', String(idPadre)).maybeSingle()
    if (padre?.id_categoria_padre) return { success: false, error: 'Máximo 2 niveles: no se puede anidar bajo una subcategoría' }
  }
  const { error } = await sb.from('categorias_producto').insert({
    nombre,
    descripcion: texto(input, 'descripcion') || null,
    orden: numero(input, 'orden'),
    id_categoria_padre: idPadre ? String(idPadre) : null,
    esquema_atributos: jsonArray(input, 'esquema_atributos'),
    es_activo: booleano(input, 'es_activo'),
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function editarCategoria(id: string, input: unknown): Promise<RespuestaAccion> {
  const nombre = texto(input, 'nombre')
  if (!nombre) return { success: false, error: 'El nombre es obligatorio' }
  const sb = await cliente()
  const { error } = await sb.from('categorias_producto').update({
    nombre,
    descripcion: texto(input, 'descripcion') || null,
    orden: numero(input, 'orden'),
    id_categoria_padre: (input as Record<string, unknown>)?.id_categoria_padre ? String((input as Record<string, unknown>).id_categoria_padre) : null,
    esquema_atributos: jsonArray(input, 'esquema_atributos'),
    es_activo: booleano(input, 'es_activo'),
  }).eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function cambiarEstadoCategoria(id: string, activo: boolean): Promise<RespuestaAccion> {
  const sb = await cliente()
  if (!activo) {
    const { data: hijos } = await sb.from('categorias_producto')
      .select('id').eq('id_categoria_padre', id).eq('es_activo', true)
    if (hijos && hijos.length > 0) return { success: false, error: 'Desactiva primero sus subcategorías' }
  }
  const { error } = await sb.from('categorias_producto').update({ es_activo: activo }).eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ===== P7 — verbos: rutas de cobro + ubicaciones del almacén =====
// Selector de cobradores: cualquier usuario activo (patrón D4 — sin filtro por rol).
export async function listarUsuariosActivos(): Promise<{ success: boolean; data: { id: string; nombre: string }[] }> {
  const sb = await cliente()
  const { data, error } = await sb.from('usuarios')
    .select('id, nombre_completo')
    .eq('es_activo', true)
    .eq('es_archivado', false)
    .order('nombre_completo', { ascending: true })
  if (error) return { success: false, data: [] }
  const filas = (data ?? []).map((u) => ({
    id: (u as { id: string }).id,
    nombre: (u as { nombre_completo: string }).nombre_completo,
  }))
  return { success: true, data: filas }
}

// --- Rutas de cobro ---
export async function crearRutaCobro(input: unknown): Promise<RespuestaAccion> {
  const nombre = texto(input, 'nombre')
  if (!nombre) return { success: false, error: 'El nombre es obligatorio' }
  const idCobrador = (input as Record<string, unknown>)?.id_cobrador_asignado
  const sb = await cliente()
  const { error } = await sb.from('rutas_cobro').insert({
    clave: texto(input, 'clave') || nombre,
    nombre,
    descripcion: texto(input, 'descripcion') || null,
    id_cobrador_asignado: idCobrador ? String(idCobrador) : null,
    es_activo: booleano(input, 'es_activo'),
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}
export async function editarRutaCobro(id: string, input: unknown): Promise<RespuestaAccion> {
  const nombre = texto(input, 'nombre')
  if (!nombre) return { success: false, error: 'El nombre es obligatorio' }
  const idCobrador = (input as Record<string, unknown>)?.id_cobrador_asignado
  const sb = await cliente()
  const { error } = await sb.from('rutas_cobro').update({
    nombre,
    descripcion: texto(input, 'descripcion') || null,
    id_cobrador_asignado: idCobrador ? String(idCobrador) : null,
    es_activo: booleano(input, 'es_activo'),
  }).eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}
export async function cambiarEstadoRutaCobro(id: string, activo: boolean): Promise<RespuestaAccion> {
  const sb = await cliente(); const { error } = await sb.from('rutas_cobro').update({ es_activo: activo }).eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// --- Ubicaciones del almacén (4 niveles) ---
export async function crearUbicacion(input: unknown): Promise<RespuestaAccion> {
  const r = { rack: texto(input, 'rack'), nivel: texto(input, 'nivel'), organizador: texto(input, 'organizador'), charola: texto(input, 'charola') }
  if (!r.rack || !r.nivel || !r.organizador || !r.charola) return { success: false, error: 'Rack, nivel, organizador y charola son obligatorios' }
  const sb = await cliente()
  const { error } = await sb.from('ubicaciones_almacen').insert({ ...r, descripcion: texto(input, 'descripcion') || null, es_activo: booleano(input, 'es_activo') })
  if (error) return { success: false, error: error.code === '23505' ? 'Esa ubicación ya existe' : error.message }
  return { success: true }
}
export async function editarUbicacion(id: string, input: unknown): Promise<RespuestaAccion> {
  const r = { rack: texto(input, 'rack'), nivel: texto(input, 'nivel'), organizador: texto(input, 'organizador'), charola: texto(input, 'charola') }
  if (!r.rack || !r.nivel || !r.organizador || !r.charola) return { success: false, error: 'Rack, nivel, organizador y charola son obligatorios' }
  const sb = await cliente()
  const { error } = await sb.from('ubicaciones_almacen').update({ ...r, descripcion: texto(input, 'descripcion') || null, es_activo: booleano(input, 'es_activo') }).eq('id', id)
  if (error) return { success: false, error: error.code === '23505' ? 'Esa ubicación ya existe' : error.message }
  return { success: true }
}
export async function cambiarEstadoUbicacion(id: string, activo: boolean): Promise<RespuestaAccion> {
  const sb = await cliente(); const { error } = await sb.from('ubicaciones_almacen').update({ es_activo: activo }).eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}
