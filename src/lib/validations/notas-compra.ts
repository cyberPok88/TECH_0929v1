// ═══════════════════════════════════════════════════════════════════════════════
// VALIDACIONES — NOTAS DE COMPRA (Guía 1.4 · rediseño)
// Forma PURA (patrón 1.1): opcionales viajan como '' · partidas como arreglo de
// strings. Reglas (PLAN NotasCompra · bd-notas-compra):
//   · id_proveedor obligatorio · al menos UNA partida
//   · partida: producto obligatorio · cantidad entera > 0 · costo ≥ 0
//   · pago: monto > 0 · metodo en las 5 claves · referencia requerida si no es
//     efectivo · fecha válida · motivo de cancelación ≥ 5
// CFDI 4.0: preparado en BD, NO en el formulario (sin campos aquí).
// ═══════════════════════════════════════════════════════════════════════════════

import { z } from 'zod'

const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/
const REGEX_MONTO = /^(0|[1-9]\d*)(\.\d{1,4})?$/
const METODOS = ['efectivo', 'transferencia', 'tarjeta', 'cheque', 'otro'] as const

// ── Partida del grid (línea de la nota) ────────────────────────────────────────
export const partidaNotaSchema = z.object({
    id: z.string(), // '' = nueva
    id_producto: z.string().min(1, 'Elige el producto de la partida.'),
    cantidad: z
        .string()
        .min(1, 'Indica la cantidad.')
        .refine((v) => /^\d+$/.test(v), 'La cantidad debe ser un entero.')
        .refine((v) => Number(v) > 0, 'La cantidad debe ser mayor a 0.'),
    costo_acordado: z
        .string()
        .min(1, 'Indica el costo.')
        .refine((v) => REGEX_MONTO.test(v), 'El costo no es un monto válido.')
        .refine((v) => Number(v) >= 0, 'El costo no puede ser negativo.'),
})

function refinarNota(
    val: { fecha_nota: string; partidas: { id_producto: string }[] },
    ctx: z.RefinementCtx
) {
    if (val.partidas.length === 0) {
        ctx.addIssue({
            code: 'custom',
            path: ['partidas'],
            message: 'Agrega al menos una partida con su producto.',
        })
    }
    // fecha_nota se valida aquí (formato AAAA-MM-DD).
    if (val.fecha_nota && !REGEX_FECHA.test(val.fecha_nota)) {
        ctx.addIssue({ code: 'custom', path: ['fecha_nota'], message: 'La fecha debe tener formato AAAA-MM-DD.' })
    }
}

const baseNota = {
    id_proveedor: z.string().min(1, 'Elige el proveedor.'),
    fecha_nota: z.string().min(1, 'Indica la fecha de la nota.'),
    numero_factura_proveedor: z.string().trim().max(80, 'El número de documento es demasiado largo.'),
    referencia_proveedor: z.string().trim().max(20, 'La referencia tiene un máximo de 20 caracteres.'),
    notas: z.string().trim().max(2000, 'Las notas son demasiado largas.'),
    partidas: z.array(partidaNotaSchema).min(1, 'Agrega al menos una partida.'),
}

/** Alta y edición comparten forma; la SA decide qué se puede editar (estados). */
export const notaCrearSchema = z.object(baseNota).superRefine(refinarNota)
export const notaEditarSchema = z.object(baseNota).superRefine(refinarNota)

/** Pago: monto > 0 · método · referencia obligatoria si no es efectivo. */
export const pagoNotaSchema = z.object({
    monto: z
        .string()
        .min(1, 'Indica el monto del pago.')
        .refine((v) => REGEX_MONTO.test(v), 'El monto no es válido.')
        .refine((v) => Number(v) > 0, 'El monto debe ser mayor a 0.'),
    metodo: z.enum(METODOS, { errorMap: () => ({ message: 'Elige el método de pago.' }) }),
    referencia_bancaria: z.string().trim().max(80, 'La referencia es demasiado larga.'),
    notas: z.string().trim().max(300, 'Las notas del pago son demasiado largas.'),
}).superRefine((val, ctx) => {
    if (val.metodo !== 'efectivo' && val.referencia_bancaria.trim() === '') {
        ctx.addIssue({
            code: 'custom',
            path: ['referencia_bancaria'],
            message: 'Con ese método indica la referencia del pago.',
        })
    }
})

/** Cancelación: motivo obligatorio (mín. 5). */
export const notaCancelarSchema = z.object({
    motivo: z
        .string()
        .trim()
        .min(5, 'Indica el motivo de la cancelación (mínimo 5 caracteres).')
        .max(300, 'El motivo es demasiado largo.'),
})

export type PartidaNotaInput = z.infer<typeof partidaNotaSchema>
export type NotaCrearInput = z.infer<typeof notaCrearSchema>
export type NotaEditarInput = z.infer<typeof notaEditarSchema>
export type PagoNotaInput = z.infer<typeof pagoNotaSchema>
export type NotaCancelarInput = z.infer<typeof notaCancelarSchema>
