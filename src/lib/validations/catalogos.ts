// validations/catalogos.ts — Catálogos y Datos Maestros (Guía 1.0)
import { z } from 'zod'

const claveSchema = z
  .string({ required_error: 'La clave es obligatoria' })
  .min(1, 'La clave es obligatoria')
  .max(30, 'Máximo 30 caracteres')
  .regex(/^[A-Za-z0-9_]+$/, 'Solo letras, números y guion bajo')
  .transform((v) => v.toUpperCase())

const nombreSchema = z.string({ required_error: 'El nombre es obligatorio' }).min(1).max(120)

const activoSchema = z.boolean().default(true)

export const TIPOS_IMPUESTO = ['IVA', 'IEPS', 'ISR', 'EXENTO'] as const

// --- Impuestos ---
export const impuestoCrearSchema = z.object({
  clave: claveSchema,
  nombre: nombreSchema,
  tipo: z.enum(TIPOS_IMPUESTO, { required_error: 'Selecciona el tipo' }),
  tasaPorciento: z.coerce
    .number({ required_error: 'Captura la tasa' })
    .min(0, 'La tasa no puede ser negativa')
    .max(100, 'La tasa no puede pasar de 100'),
  es_activo: activoSchema,
})
export const impuestoEditarSchema = impuestoCrearSchema.omit({ clave: true })

export type ImpuestoCrearInput = z.infer<typeof impuestoCrearSchema>
export type ImpuestoEditarInput = z.infer<typeof impuestoEditarSchema>

// ===== P4 — validaciones de catálogos simples =====
// --- Unidades de medida ---
export const unidadMedidaCrearSchema = z.object({
  clave: claveSchema,
  nombre: nombreSchema,
  abreviatura: z.string({ required_error: 'La abreviatura es obligatoria' }).min(1).max(10),
  clave_sat: z.string().max(10).optional().or(z.literal('')),
  es_activo: activoSchema,
})
export const unidadMedidaEditarSchema = unidadMedidaCrearSchema.omit({ clave: true })

// --- Canales de venta ---
export const canalVentaCrearSchema = z.object({ clave: claveSchema, nombre: nombreSchema, es_activo: activoSchema })
export const canalVentaEditarSchema = canalVentaCrearSchema.omit({ clave: true })

// --- Marcas comerciales (es_activa · slug) ---
export const marcaComercialCrearSchema = z.object({
  clave: claveSchema,
  nombre_visible: nombreSchema,
  slug: z.string({ required_error: 'El slug es obligatorio' }).min(1).max(60).regex(/^[a-z0-9-]+$/, 'slug en minúsculas con guiones'),
  color_hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'hex #RRGGBB').optional().or(z.literal('')),
  descripcion: z.string().max(300).optional().or(z.literal('')),
  es_activa: activoSchema,
})
export const marcaComercialEditarSchema = marcaComercialCrearSchema.omit({ clave: true })

// --- Marcas de producto (sin clave) ---
export const marcaProductoCrearSchema = z.object({ nombre: nombreSchema, es_activo: activoSchema })
export const marcaProductoEditarSchema = marcaProductoCrearSchema

// ===== P5 — validaciones: tipos_cliente y listas_precios (% y default) =====
const ajustePorcientoSchema = z.coerce
  .number({ required_error: 'Captura el ajuste en %' })
  .min(-99, 'Mínimo -99%')
  .max(500, 'Máximo 500%')

export const tipoClienteCrearSchema = z.object({
  clave: claveSchema,
  nombre: nombreSchema,
  porcentajeAjustePorciento: ajustePorcientoSchema,
  descripcion: z.string().max(300).optional().or(z.literal('')),
  orden: z.coerce.number().int().min(0).default(0),
  es_activo: activoSchema,
})
export const tipoClienteEditarSchema = tipoClienteCrearSchema.omit({ clave: true })

export const listaPrecioCrearSchema = z.object({
  clave: claveSchema,
  nombre: nombreSchema,
  porcentajeAjustePorciento: ajustePorcientoSchema,
  es_lista_default: z.boolean().default(false),
  es_activo: activoSchema,
})
export const listaPrecioEditarSchema = listaPrecioCrearSchema.omit({ clave: true })
