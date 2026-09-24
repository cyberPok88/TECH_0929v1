// catalogos-config.ts — registro config-driven de pestañas del hub (Guía 1.0)
import type { ReactNode } from 'react'
import type { ClaveTabCatalogo, RespuestaAccion } from '@/types/catalogos'
import {
  listarImpuestos, crearImpuesto, editarImpuesto, cambiarEstadoImpuesto,
  listarUnidadesMedida, crearUnidadMedida, editarUnidadMedida, cambiarEstadoUnidadMedida,
  listarCanalesVenta, crearCanalVenta, editarCanalVenta, cambiarEstadoCanalVenta,
  listarMarcasComerciales, crearMarcaComercial, editarMarcaComercial, cambiarEstadoMarcaComercial,
  listarMarcasProducto, crearMarcaProducto, editarMarcaProducto, cambiarEstadoMarcaProducto,
  listarTiposCliente, crearTipoCliente, editarTipoCliente, cambiarEstadoTipoCliente,
  listarListasPrecio, crearListaPrecio, editarListaPrecio, cambiarEstadoListaPrecio,
  listarUbicacionesAlmacen, crearUbicacion, editarUbicacion, cambiarEstadoUbicacion,
} from '@/lib/actions/catalogos'
import { TIPOS_IMPUESTO } from '@/lib/validations/catalogos'

/** Campo del formulario genérico del mini-CRUD. `name` es la llave del payload. */
export interface CatalogoCampo {
  name: string
  label: string
  tipo: 'text' | 'number' | 'select' | 'switch'
  opciones?: { value: string; label: string }[]
  placeholder?: string
  /** Solo capturable en 'crear' (ej. clave). En 'editar' se muestra deshabilitado. */
  soloCrear?: boolean
}

export interface CatalogoColumna {
  key: string
  label: string
  align?: 'derecha' | 'centro'
  render?: (value: unknown) => ReactNode
}

export interface CatalogoAcciones {
  crear?: (input: Record<string, unknown>) => Promise<RespuestaAccion>
  editar?: (id: string, input: Record<string, unknown>) => Promise<RespuestaAccion>
  toggle?: (id: string, activo: boolean) => Promise<RespuestaAccion>
}

export interface CatalogoConfig {
  clave: ClaveTabCatalogo
  tituloSingular: string
  tituloPlural: string
  listar: () => Promise<{ success: boolean; data: unknown[] }>
  columnas: CatalogoColumna[]
  campos: CatalogoCampo[]
  /** Nombre de la columna booleana de estado (es_activo | es_activa). */
  campoActivo: 'es_activo' | 'es_activa'
  /** Campos que participan en la búsqueda local. */
  buscarEn: string[]
  /** Transforma la fila (BD) en valores del formulario (defaults de edición). */
  formDesdeRegistro: (fila: Record<string, unknown>) => Record<string, unknown>
  acciones: CatalogoAcciones
}

const activaColumna = { key: 'es_activo', label: 'Activo', render: (v: unknown) => (v ? 'Activo' : 'Inactivo') }
const activaBoolColumna = { key: 'es_activa', label: 'Activa', render: (v: unknown) => (v ? 'Activa' : 'Inactiva') }

const impuestosConfig: CatalogoConfig = {
  clave: 'impuestos',
  tituloSingular: 'impuesto',
  tituloPlural: 'impuestos',
  listar: listarImpuestos as CatalogoConfig['listar'],
  columnas: [
    { key: 'clave', label: 'Clave' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'tipo', label: 'Tipo' },
    { key: 'tasa', label: 'Tasa', align: 'derecha', render: (v) => `${Number(v) * 100}%` },
    activaColumna,
  ],
  campos: [
    { name: 'clave', label: 'Clave', tipo: 'text', placeholder: 'IVA_16', soloCrear: true },
    { name: 'nombre', label: 'Nombre', tipo: 'text' },
    { name: 'tipo', label: 'Tipo', tipo: 'select', opciones: TIPOS_IMPUESTO.map((t) => ({ value: t, label: t })) },
    { name: 'tasaPorciento', label: 'Tasa (%)', tipo: 'number', placeholder: '16' },
    { name: 'es_activo', label: 'Activo', tipo: 'switch' },
  ],
  campoActivo: 'es_activo',
  buscarEn: ['clave', 'nombre'],
  formDesdeRegistro: (f) => ({
    clave: String(f.clave ?? ''),
    nombre: String(f.nombre ?? ''),
    tipo: String(f.tipo ?? TIPOS_IMPUESTO[0]),
    tasaPorciento: Number(f.tasa ?? 0) * 100,
    es_activo: Boolean(f.es_activo),
  }),
  acciones: { crear: crearImpuesto, editar: editarImpuesto, toggle: cambiarEstadoImpuesto },
}

const unidadesMedidaConfig: CatalogoConfig = {
  clave: 'unidades_medida',
  tituloSingular: 'unidad de medida',
  tituloPlural: 'unidades de medida',
  listar: listarUnidadesMedida as CatalogoConfig['listar'],
  columnas: [
    { key: 'clave', label: 'Clave' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'abreviatura', label: 'Abrev.' },
    { key: 'clave_sat', label: 'Clave SAT' },
    activaColumna,
  ],
  campos: [
    { name: 'clave', label: 'Clave', tipo: 'text', placeholder: 'PZA', soloCrear: true },
    { name: 'nombre', label: 'Nombre', tipo: 'text' },
    { name: 'abreviatura', label: 'Abreviatura', tipo: 'text', placeholder: 'Pza' },
    { name: 'clave_sat', label: 'Clave SAT (opcional)', tipo: 'text', placeholder: 'H87' },
    { name: 'es_activo', label: 'Activo', tipo: 'switch' },
  ],
  campoActivo: 'es_activo',
  buscarEn: ['clave', 'nombre', 'abreviatura'],
  formDesdeRegistro: (f) => ({
    clave: String(f.clave ?? ''),
    nombre: String(f.nombre ?? ''),
    abreviatura: String(f.abreviatura ?? ''),
    clave_sat: f.clave_sat ? String(f.clave_sat) : '',
    es_activo: Boolean(f.es_activo),
  }),
  acciones: { crear: crearUnidadMedida, editar: editarUnidadMedida, toggle: cambiarEstadoUnidadMedida },
}

const canalesVentaConfig: CatalogoConfig = {
  clave: 'canales_venta',
  tituloSingular: 'canal de venta',
  tituloPlural: 'canales de venta',
  listar: listarCanalesVenta as CatalogoConfig['listar'],
  columnas: [
    { key: 'clave', label: 'Clave' },
    { key: 'nombre', label: 'Nombre' },
    activaColumna,
  ],
  campos: [
    { name: 'clave', label: 'Clave', tipo: 'text', soloCrear: true },
    { name: 'nombre', label: 'Nombre', tipo: 'text' },
    { name: 'es_activo', label: 'Activo', tipo: 'switch' },
  ],
  campoActivo: 'es_activo',
  buscarEn: ['clave', 'nombre'],
  formDesdeRegistro: (f) => ({ clave: String(f.clave ?? ''), nombre: String(f.nombre ?? ''), es_activo: Boolean(f.es_activo) }),
  acciones: { crear: crearCanalVenta, editar: editarCanalVenta, toggle: cambiarEstadoCanalVenta },
}

const marcasComercialesConfig: CatalogoConfig = {
  clave: 'marcas_comerciales',
  tituloSingular: 'marca comercial',
  tituloPlural: 'marcas comerciales',
  listar: listarMarcasComerciales as CatalogoConfig['listar'],
  columnas: [
    { key: 'clave', label: 'Clave' },
    { key: 'nombre_visible', label: 'Nombre' },
    { key: 'slug', label: 'Slug' },
    activaBoolColumna,
  ],
  campos: [
    { name: 'clave', label: 'Clave', tipo: 'text', placeholder: 'tech_computer', soloCrear: true },
    { name: 'nombre_visible', label: 'Nombre visible', tipo: 'text' },
    { name: 'slug', label: 'Slug', tipo: 'text', placeholder: 'tech-computer' },
    { name: 'color_hex', label: 'Color (hex, opcional)', tipo: 'text', placeholder: '#0ea5e9' },
    { name: 'descripcion', label: 'Descripción (opcional)', tipo: 'text' },
    { name: 'es_activa', label: 'Activa', tipo: 'switch' },
  ],
  campoActivo: 'es_activa',
  buscarEn: ['clave', 'nombre_visible', 'slug'],
  formDesdeRegistro: (f) => ({
    clave: String(f.clave ?? ''),
    nombre_visible: String(f.nombre_visible ?? ''),
    slug: String(f.slug ?? ''),
    color_hex: f.color_hex ? String(f.color_hex) : '',
    descripcion: f.descripcion ? String(f.descripcion) : '',
    es_activa: Boolean(f.es_activa),
  }),
  acciones: { crear: crearMarcaComercial, editar: editarMarcaComercial, toggle: cambiarEstadoMarcaComercial },
}

const marcasProductoConfig: CatalogoConfig = {
  clave: 'marcas_producto',
  tituloSingular: 'marca de producto',
  tituloPlural: 'marcas de producto',
  listar: listarMarcasProducto as CatalogoConfig['listar'],
  columnas: [
    { key: 'nombre', label: 'Nombre' },
    activaColumna,
  ],
  campos: [
    { name: 'nombre', label: 'Nombre', tipo: 'text', placeholder: 'Kingston' },
    { name: 'es_activo', label: 'Activo', tipo: 'switch' },
  ],
  campoActivo: 'es_activo',
  buscarEn: ['nombre'],
  formDesdeRegistro: (f) => ({ nombre: String(f.nombre ?? ''), es_activo: Boolean(f.es_activo) }),
  acciones: { crear: crearMarcaProducto, editar: editarMarcaProducto, toggle: cambiarEstadoMarcaProducto },
}

const ajusteColumna = { key: 'porcentaje_ajuste', label: 'Ajuste', align: 'derecha' as const, render: (v: unknown) => `${Number(v) * 100}%` }

const tiposClienteConfig: CatalogoConfig = {
  clave: 'tipos_cliente',
  tituloSingular: 'tipo de cliente',
  tituloPlural: 'tipos de cliente',
  listar: listarTiposCliente as CatalogoConfig['listar'],
  columnas: [
    { key: 'clave', label: 'Clave' },
    { key: 'nombre', label: 'Nombre' },
    ajusteColumna,
    activaColumna,
  ],
  campos: [
    { name: 'clave', label: 'Clave', tipo: 'text', placeholder: 'PUBLICO', soloCrear: true },
    { name: 'nombre', label: 'Nombre', tipo: 'text' },
    { name: 'porcentajeAjustePorciento', label: 'Ajuste (%)', tipo: 'number', placeholder: '30' },
    { name: 'descripcion', label: 'Descripción (opcional)', tipo: 'text' },
    { name: 'orden', label: 'Orden', tipo: 'number', placeholder: '0' },
    { name: 'es_activo', label: 'Activo', tipo: 'switch' },
  ],
  campoActivo: 'es_activo',
  buscarEn: ['clave', 'nombre'],
  formDesdeRegistro: (f) => ({
    clave: String(f.clave ?? ''),
    nombre: String(f.nombre ?? ''),
    porcentajeAjustePorciento: Number(f.porcentaje_ajuste ?? 0) * 100,
    descripcion: f.descripcion ? String(f.descripcion) : '',
    orden: Number(f.orden ?? 0),
    es_activo: Boolean(f.es_activo),
  }),
  acciones: { crear: crearTipoCliente, editar: editarTipoCliente, toggle: cambiarEstadoTipoCliente },
}

const listasPrecioConfig: CatalogoConfig = {
  clave: 'listas_precios',
  tituloSingular: 'lista de precios',
  tituloPlural: 'listas de precios',
  listar: listarListasPrecio as CatalogoConfig['listar'],
  columnas: [
    { key: 'clave', label: 'Clave' },
    { key: 'nombre', label: 'Nombre' },
    ajusteColumna,
    { key: 'es_lista_default', label: 'Default', render: (v) => (v ? 'Sí' : '') },
    activaColumna,
  ],
  campos: [
    { name: 'clave', label: 'Clave', tipo: 'text', placeholder: 'BASE', soloCrear: true },
    { name: 'nombre', label: 'Nombre', tipo: 'text' },
    { name: 'porcentajeAjustePorciento', label: 'Ajuste (%)', tipo: 'number', placeholder: '0' },
    { name: 'es_lista_default', label: 'Lista default', tipo: 'switch' },
    { name: 'es_activo', label: 'Activo', tipo: 'switch' },
  ],
  campoActivo: 'es_activo',
  buscarEn: ['clave', 'nombre'],
  formDesdeRegistro: (f) => ({
    clave: String(f.clave ?? ''),
    nombre: String(f.nombre ?? ''),
    porcentajeAjustePorciento: Number(f.porcentaje_ajuste ?? 0) * 100,
    es_lista_default: Boolean(f.es_lista_default),
    es_activo: Boolean(f.es_activo),
  }),
  acciones: { crear: crearListaPrecio, editar: editarListaPrecio, toggle: cambiarEstadoListaPrecio },
}

const ubicacionesAlmacenConfig: CatalogoConfig = {
  clave: 'ubicaciones_almacen',
  tituloSingular: 'ubicación',
  tituloPlural: 'ubicaciones',
  listar: listarUbicacionesAlmacen as CatalogoConfig['listar'],
  columnas: [
    { key: 'rack', label: 'Rack' },
    { key: 'nivel', label: 'Nivel' },
    { key: 'organizador', label: 'Organizador' },
    { key: 'charola', label: 'Charola' },
    activaColumna,
  ],
  campos: [
    { name: 'rack', label: 'Rack', tipo: 'text' },
    { name: 'nivel', label: 'Nivel', tipo: 'text' },
    { name: 'organizador', label: 'Organizador', tipo: 'text' },
    { name: 'charola', label: 'Charola', tipo: 'text' },
    { name: 'descripcion', label: 'Descripción (opcional)', tipo: 'text' },
    { name: 'es_activo', label: 'Activo', tipo: 'switch' },
  ],
  campoActivo: 'es_activo',
  buscarEn: ['rack', 'nivel', 'organizador', 'charola'],
  formDesdeRegistro: (f) => ({
    rack: String(f.rack ?? ''),
    nivel: String(f.nivel ?? ''),
    organizador: String(f.organizador ?? ''),
    charola: String(f.charola ?? ''),
    descripcion: f.descripcion ? String(f.descripcion) : '',
    es_activo: Boolean(f.es_activo),
  }),
  acciones: { crear: crearUbicacion, editar: editarUbicacion, toggle: cambiarEstadoUbicacion },
}

const configs: Partial<Record<ClaveTabCatalogo, CatalogoConfig>> = {
  impuestos: impuestosConfig,
  unidades_medida: unidadesMedidaConfig,
  canales_venta: canalesVentaConfig,
  marcas_comerciales: marcasComercialesConfig,
  marcas_producto: marcasProductoConfig,
  tipos_cliente: tiposClienteConfig,
  listas_precios: listasPrecioConfig,
  ubicaciones_almacen: ubicacionesAlmacenConfig,
  // P7 rutas_cobro: custom (selector cobrador) · P8 vendedores: solo lectura
}

export function configDeTab(clave: ClaveTabCatalogo): CatalogoConfig | undefined {
  return configs[clave]
}

/** Orden de la Toolbar "Nuevo": pide al mini-CRUD de una pestaña abrir su modal de crear. */
export interface SolicitudNueva {
  tab: ClaveTabCatalogo
  seq: number
}
