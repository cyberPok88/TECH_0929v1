// ═══════════════════════════════════════════════════════════════════════════════
// VALIDACIONES — INVENTARIO (Guía 1.5 · 17 Sep 2026)
// Forma PURA (patrón 1.1): opcionales viajan como ''. Reglas (PLAN Inventario ·
// bd-inventario):
//   · salida manual: producto obligatorio · cantidad entera > 0 · motivo en las
//     claves · NS libre (solo visible si el producto maneja serie)
//   · conteo: fecha AAAA-MM-DD · ubicación obligatoria · al menos UN renglón ·
//     renglón: producto obligatorio · cantidad contada > 0
// La validación contra el stock disponible (salida) y la diferencia (conteo) es
// regla de negocio de la Server Action, no de forma.
// ═══════════════════════════════════════════════════════════════════════════════

import { z } from 'zod'

const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/
const MOTIVOS_SALIDA = ['merma_tardia', 'correccion_inversa', 'otro'] as const

// ── Salida manual (movimiento `salida` que consume lotes FIFO) ─────────────────
export const salidaManualSchema = z.object({
    id_producto: z.string().min(1, 'Elige el producto que sale.'),
    cantidad: z
        .string()
        .min(1, 'Indica la cantidad.')
        .refine((v) => /^\d+$/.test(v), 'La cantidad debe ser un entero.')
        .refine((v) => Number(v) > 0, 'La cantidad debe ser mayor a 0.'),
    motivo: z.enum(MOTIVOS_SALIDA, { errorMap: () => ({ message: 'Elige el motivo de la salida.' }) }),
    numero_serie: z.string().trim().max(100, 'El número de serie es demasiado largo.'),
    notas: z.string().trim().max(500, 'Las notas son demasiado largas.'),
})

// ── Renglón del conteo (línea: producto · cantidad contada) ────────────────────
export const renglonConteoSchema = z.object({
    id: z.string(), // '' = nueva
    id_producto: z.string().min(1, 'Elige el producto del renglón.'),
    cantidad_contada: z
        .string()
        .min(1, 'Indica la cantidad contada.')
        .refine((v) => /^\d+$/.test(v), 'La cantidad debe ser un entero.')
        .refine((v) => Number(v) > 0, 'La cantidad contada debe ser mayor a 0.'),
})

function refinarConteo(
    val: { fecha_conteo: string; renglones: { id_producto: string }[] },
    ctx: z.RefinementCtx
) {
    if (val.renglones.length === 0) {
        ctx.addIssue({
            code: 'custom',
            path: ['renglones'],
            message: 'Agrega al menos un renglón con su producto.',
        })
    }
    if (val.fecha_conteo && !REGEX_FECHA.test(val.fecha_conteo)) {
        ctx.addIssue({ code: 'custom', path: ['fecha_conteo'], message: 'La fecha debe tener formato AAAA-MM-DD.' })
    }
}

// ── Conteo de inventario físico (borrador — crear/editar comparten forma) ──────
export const conteoSchema = z
    .object({
        fecha_conteo: z.string().min(1, 'Indica la fecha del conteo.'),
        id_ubicacion: z.string().min(1, 'Elige la ubicación del conteo.'),
        notas: z.string().trim().max(500, 'Las notas son demasiado largas.'),
        renglones: z.array(renglonConteoSchema).min(1, 'Agrega al menos un renglón.'),
    })
    .superRefine(refinarConteo)

export type SalidaManualInput = z.infer<typeof salidaManualSchema>
export type RenglonConteoInput = z.infer<typeof renglonConteoSchema>
export type ConteoInput = z.infer<typeof conteoSchema>
