// ═══════════════════════════════════════════════════════════════════════════════
// VALIDACIONES — SISTEMA DE PLANTILLAS (Guía 2.1)
// Forma PURA (patrón de la casa): todo viaja como string desde el useForm.
// Reglas (docs/bd-plantillas.md §1 + PLAN §3):
//   · tipo:  clave con el MISMO regex del CHECK (^[a-z][a-z0-9_]*$) · nombre obligatorio
//            · audita_reimpresion solo si familia = 'valor'
//   · plantilla: id_tipo obligatorio · nombre · cuerpo no vacío · variables declaradas
//            (clave única, sin espacios) · notas_version opcional
// ═══════════════════════════════════════════════════════════════════════════════

import { z } from 'zod'

/** Mismo patrón que el CHECK `chk_tipo_clave_formato` de la BD. */
const REGEX_CLAVE = /^[a-z][a-z0-9_]*$/
const FAMILIAS = ['interno', 'valor'] as const

// ── Una variable declarada del cuerpo ─────────────────────────────────────────
export const variablePlantillaSchema = z.object({
    clave: z
        .string()
        .trim()
        .min(1, 'La variable necesita una clave.')
        .refine((v) => REGEX_CLAVE.test(v), 'Solo minúsculas, números y guion bajo (ej: folio).'),
    descripcion: z.string().trim().max(160, 'La descripción es demasiado larga.'),
})

const baseTipo = {
    clave: z
        .string()
        .trim()
        .min(1, 'La clave es obligatoria.')
        .max(40, 'La clave es demasiado larga.')
        .refine((v) => REGEX_CLAVE.test(v), 'Solo minúsculas, números y guion bajo (ej: nota_compra).'),
    nombre: z.string().trim().min(1, 'El nombre es obligatorio.').max(80, 'El nombre es demasiado largo.'),
    familia: z.enum(FAMILIAS, { message: 'Elige la familia del documento.' }),
    se_firma: z.boolean(),
    audita_reimpresion: z.boolean(),
    descripcion: z.string().trim().max(400, 'La descripción es demasiado larga.'),
    es_activo: z.boolean(),
}

/** ⭐ R2 — la coherencia familia/auditoría, en el mismo sentido que el CHECK de la BD. */
function refinarTipo(
    val: { familia: string; audita_reimpresion: boolean },
    ctx: z.RefinementCtx
) {
    if (val.familia === 'interno' && val.audita_reimpresion) {
        ctx.addIssue({
            code: 'custom',
            path: ['audita_reimpresion'],
            message: 'Un documento interno no audita su reimpresión.',
        })
    }
}

/** Alta y edición de un tipo. La `clave` no viaja en edición (es inmutable — R1). */
export const tipoDocumentoCrearSchema = z.object(baseTipo).superRefine(refinarTipo)

export const tipoDocumentoEditarSchema = z
    .object({
        nombre: baseTipo.nombre,
        familia: baseTipo.familia,
        se_firma: baseTipo.se_firma,
        audita_reimpresion: baseTipo.audita_reimpresion,
        descripcion: baseTipo.descripcion,
        es_activo: baseTipo.es_activo,
    })
    .superRefine(refinarTipo)

/** Estado del toggle (activar/desactivar). */
export const estadoSchema = z.object({
    id: z.string().min(1),
    activo: z.boolean(),
})

// ── Plantilla ─────────────────────────────────────────────────────────────────
const basePlantilla = {
    id_tipo: z.string().min(1, 'Elige el tipo de documento.'),
    nombre: z.string().trim().min(1, 'El nombre es obligatorio.').max(80, 'El nombre es demasiado largo.'),
    cuerpo: z.string().min(1, 'El cuerpo de la plantilla no puede estar vacío.'),
    variables: z.array(variablePlantillaSchema),
    notas_version: z.string().trim().max(400, 'Las notas son demasiado largas.'),
    es_activo: z.boolean(),
}

/** ⭐ R5 — el esquema declarado no puede repetir una clave. */
function refinarPlantilla(val: { variables: { clave: string }[] }, ctx: z.RefinementCtx) {
    const vistas = new Set<string>()
    val.variables.forEach((v, i) => {
        if (vistas.has(v.clave)) {
            ctx.addIssue({
                code: 'custom',
                path: ['variables', i, 'clave'],
                message: `La variable «${v.clave}» está declarada dos veces.`,
            })
        }
        vistas.add(v.clave)
    })
}

export const plantillaCrearSchema = z.object(basePlantilla).superRefine(refinarPlantilla)

/** Edición: el `id_tipo` no se cambia (se fija al crear). */
export const plantillaEditarSchema = z
    .object({
        nombre: basePlantilla.nombre,
        cuerpo: basePlantilla.cuerpo,
        variables: basePlantilla.variables,
        notas_version: basePlantilla.notas_version,
        es_activo: basePlantilla.es_activo,
    })
    .superRefine(refinarPlantilla)

/** Restaurar una versión anterior. */
export const restaurarVersionSchema = z.object({
    id: z.string().min(1),
    version: z.coerce.number().int().min(1, 'La versión no es válida.'),
})

// ── Tipos derivados (los consume la SA) ───────────────────────────────────────
export type VariablePlantillaInput = z.infer<typeof variablePlantillaSchema>
export type TipoDocumentoCrearInput = z.infer<typeof tipoDocumentoCrearSchema>
export type TipoDocumentoEditarInput = z.infer<typeof tipoDocumentoEditarSchema>
export type PlantillaCrearInput = z.infer<typeof plantillaCrearSchema>
export type PlantillaEditarInput = z.infer<typeof plantillaEditarSchema>
export type RestaurarVersionInput = z.infer<typeof restaurarVersionSchema>
