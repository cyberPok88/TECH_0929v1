import { z } from 'zod'

import type { AtributoEsquema } from '@/types/catalogos'
import type { ValorAtributo } from '@/types/productos'

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDACIONES — PRODUCTOS (Guía 1.2)
// Schema base de forma pura (input == output del form) + motor de validación de
// los atributos técnicos contra el esquema de la categoría (D16 · plan §5).
// ═══════════════════════════════════════════════════════════════════════════════

export const productoSchema = z
    .object({
        nombre: z.string().trim().min(1, 'El nombre es obligatorio')
            .max(200, 'El nombre es demasiado largo'),
        descripcion: z.string().trim().max(2000, 'La descripción es demasiado larga'),
        codigo_barras: z.string().trim().max(64, 'El código de barras es demasiado largo'),
        id_categoria: z.string().trim().min(1, 'Elige la categoría del producto'),
        id_marca: z.string().trim().min(1, 'Elige o crea la marca (fabricante)'),
        id_unidad_medida: z.string().trim().min(1, 'Elige la unidad de medida'),
        id_impuesto: z.string().trim().min(1, 'Elige el impuesto'),
        precio_base: z.string().trim().max(18, 'Precio no válido'),
        precio_minimo: z.string().trim().max(18, 'Precio mínimo no válido'),
        stock_minimo: z.string().trim().max(18, 'Stock mínimo no válido'),
        id_ubicacion_default: z.string().trim(),
        requiere_revision: z.boolean(),
        maneja_numero_serie: z.boolean(),
        es_activo: z.boolean(),
        id_clave_prod_serv_sat: z.string().trim(),
        id_clave_unidad_sat: z.string().trim(),
        imagen_url: z.string().trim().max(500, 'URL de imagen demasiado larga'),
        notas: z.string().trim().max(1000, 'Las notas son demasiado largas'),
        atributos: z.record(z.string(), z.string()),
    })
    .superRefine((val, ctx) => {
        // Montos: '' se acepta (default 0 en BD) · si vienen, deben ser numéricos ≥ 0.
        for (const [campo, etiqueta] of [
            ['precio_base', 'Precio base'],
            ['precio_minimo', 'Precio mínimo'],
            ['stock_minimo', 'Stock mínimo'],
        ] as const) {
            const v = val[campo].trim()
            if (v === '') continue
            const n = Number(v)
            if (!Number.isFinite(n) || n < 0) {
                ctx.addIssue({ code: 'custom', path: [campo], message: `${etiqueta}: número no válido.` })
            }
        }
        const base = val.precio_base.trim() === '' ? 0 : Number(val.precio_base)
        const minimo = val.precio_minimo.trim() === '' ? null : Number(val.precio_minimo)
        if (minimo !== null && minimo > base) {
            ctx.addIssue({
                code: 'custom',
                path: ['precio_minimo'],
                message: 'El precio mínimo no puede superar el precio base.',
            })
        }
    })

export type ProductoInput = z.infer<typeof productoSchema>

// ── Alta rápida (contrato hacia 1.6 — captura mínima guiada por esquema) ───────
export const productoRapidoSchema = z.object({
    nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
    id_categoria: z.string().trim().optional(),
    id_marca: z.string().trim().optional(),
    id_unidad_medida: z.string().trim().min(1, 'Falta la unidad de medida'),
    id_impuesto: z.string().trim().min(1, 'Falta el impuesto'),
    codigo_barras: z.string().trim().max(64).nullable().optional(),
    requiere_revision: z.boolean().optional(),
    maneja_numero_serie: z.boolean().optional(),
    atributos: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
})

export type ProductoRapidoInput = z.infer<typeof productoRapidoSchema>

// ── Motor de atributos dinámicos (D16) ─────────────────────────────────────────
// Recorre las definiciones del esquema de la categoría y devuelve los errores.
// Regla "clave fuera del esquema": se tolera (extensiones futuras — MODELO §7.3.2).
// Un valor 'select' puede salirse de opciones: la lista es un catálogo de valores
// rápidos, no un candado. "otra…" guarda un valor propio (MEJORA 04 Sep · usuario);
// el Administrador además puede agregar la opción al esquema para que aparezca en la
// lista (AtributosDinamicos). El import CSV sí valida contra la lista (plan §9).
export function validarAtributosContraEsquema(
    atributos: Record<string, ValorAtributo>,
    esquema: AtributoEsquema[]
): string[] {
    const errores: string[] = []
    for (const def of esquema) {
        const valor = atributos[def.clave]
        const vacio = valor === undefined || valor === null || valor === ''
        if (def.requerido && vacio) {
            errores.push(`Falta el atributo requerido "${def.etiqueta}".`)
            continue
        }
        if (vacio) continue
        if (def.tipo === 'number' && !Number.isFinite(Number(valor))) {
            errores.push(`"${def.etiqueta}" debe ser un número.`)
        }
    }
    return errores
}

export function atributosValidos(
    atributos: Record<string, ValorAtributo>,
    esquema: AtributoEsquema[]
): boolean {
    return validarAtributosContraEsquema(atributos, esquema).length === 0
}

// ── Conversión de la forma cruda del formulario (todo string) ──────────────────
// El form entrega cada atributo como string (inputs de RHF); el tipo del esquema
// decide la conversión: 'number' → número · 'select'/'text' → texto recortado.
// Los vacíos se omiten. La Server Action usa el resultado para validar y guardar.
export function convertirAtributosCrudos(
    atributos: Record<string, string>,
    esquema: AtributoEsquema[]
): Record<string, ValorAtributo> {
    const salida: Record<string, ValorAtributo> = {}
    for (const def of esquema) {
        const crudo = (atributos[def.clave] ?? '').trim()
        if (crudo === '') continue
        salida[def.clave] = def.tipo === 'number' ? Number(crudo) : crudo
    }
    return salida
}
