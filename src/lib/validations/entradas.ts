// ═══════════════════════════════════════════════════════════════════════════════
// VALIDACIONES — ENTRADAS (Guía 1.6 · 18 Sep 2026)
// Forma PURA (patrón 1.1): opcionales viajan como ''. Reglas (PLAN Entradas ·
// bd-entradas):
//   · entrada: proveedor obligatorio · ≥1 partida · partida: cantidad entera >0 ·
//     costo ≥0 · id_categoria de catálogo (select — nunca texto libre)
// La validación de negocio (cupo de revisión, cotejo físico, divergencia) es de la
// Server Action, no de forma.
// ═══════════════════════════════════════════════════════════════════════════════

import { z } from 'zod'

const COSTO_RE = /^\d+(\.\d{1,4})?$/
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export const partidaEntradaSchema = z.object({
    id: z.string(), // '' = nueva
    id_categoria: z
        .string()
        .min(1, 'Elige la categoría de la partida.')
        .refine((v) => UUID_RE.test(v), 'Categoría inválida.'),
    atributos: z.record(z.string(), z.string()),
    cantidad_original: z
        .string()
        .min(1, 'Indica la cantidad.')
        .refine((v) => /^\d+$/.test(v), 'La cantidad debe ser un entero.')
        .refine((v) => Number(v) > 0, 'La cantidad debe ser mayor a 0.'),
    costo_acordado: z
        .string()
        .min(1, 'Indica el costo acordado.')
        .refine((v) => COSTO_RE.test(v), 'El costo debe ser numérico (hasta 4 decimales).')
        .refine((v) => Number(v) >= 0, 'El costo no puede ser negativo.'),
})

function refinarEntrada(
    val: { id_proveedor: string; partidas: unknown[] },
    ctx: z.RefinementCtx
) {
    if (!val.id_proveedor) {
        ctx.addIssue({ code: 'custom', path: ['id_proveedor'], message: 'Elige el proveedor.' })
    }
    if (val.partidas.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['partidas'], message: 'Agrega al menos una partida.' })
    }
}

export const entradaSchema = z.object({
    id_proveedor: z.string(),
    es_sin_revision: z.boolean(),
    origen: z.enum(['flujo', 'directa'], { errorMap: () => ({ message: 'Origen inválido.' }) }),
    notas: z.string().trim().max(500, 'Las notas son demasiado largas.'),
    partidas: z.array(partidaEntradaSchema).min(1, 'Agrega al menos una partida.'),
}).superRefine(refinarEntrada)

export type EntradaInput = z.infer<typeof entradaSchema>
