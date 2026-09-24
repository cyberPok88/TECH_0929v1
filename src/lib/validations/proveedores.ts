import { z } from 'zod'

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDACIONES — PROVEEDORES (Guía 1.1)
// Un solo schema para alta y edición: todos los campos son editables tras crear
// EXCEPTO codigo, que es autogenerado e inmutable y nunca participa del form
// (MAPA §5 #4 · PLAN §3).
//
// Forma PURA (input == output): los opcionales viajan como '' y la conversión a
// null la hace la Server Action (aNull/aRfc/aNum). Así el schema es
// zodResolver-compatible con ProveedorFormData sin fricción de tipos.
//
// Reglas condicionales (PLAN §3 · bd-proveedores §5 · logica-negocio R3/R5):
//   · rfc presente → formato válido + id_regimen_fiscal y codigo_postal requeridos
//   · terminos_pago = 'credito' → dias_credito entero > 0
// ═══════════════════════════════════════════════════════════════════════════════

const REGEX_RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/

export const proveedorSchema = z
    .object({
        nombre_comercial: z
            .string()
            .trim()
            .min(1, 'El nombre comercial es obligatorio')
            .max(120, 'El nombre comercial es demasiado largo'),
        razon_social: z.string().trim().max(200, 'La razón social es demasiado larga'),
        tipo: z.enum(['formal', 'informal', 'eventual']),
        rfc: z.string().trim().max(13, 'El RFC es demasiado largo'),
        id_regimen_fiscal: z.string().trim().max(36, 'Régimen fiscal no válido'),
        telefono: z.string().trim().max(50, 'El teléfono es demasiado largo'),
        email: z.string().trim().max(120, 'El correo es demasiado largo'),
        nombre_contacto: z.string().trim().max(120, 'El nombre de contacto es demasiado largo'),
        direccion: z.string().trim().max(200, 'La dirección es demasiado larga'),
        colonia: z.string().trim().max(120, 'La colonia es demasiado larga'),
        ciudad: z.string().trim().max(120, 'La ciudad es demasiado larga'),
        estado: z.string().trim().max(120, 'El estado es demasiado largo'),
        codigo_postal: z.string().trim().max(5, 'El código postal tiene 5 dígitos'),
        terminos_pago: z.enum(['contado', 'credito']),
        dias_credito: z.string().trim().max(6, 'Plazo no válido'),
        notas: z.string().trim().max(1000, 'Las notas son demasiado largas'),
        es_activo: z.boolean(),
    })
    .superRefine((val, ctx) => {
        // R3 — con RFC, los datos del domicilio fiscal son obligatorios (CFDI 4.0).
        if (val.rfc) {
            if (!REGEX_RFC.test(val.rfc.toUpperCase())) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['rfc'],
                    message: 'El RFC no tiene el formato válido (12 o 13 caracteres).',
                })
            }
            if (!val.id_regimen_fiscal) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['id_regimen_fiscal'],
                    message: 'Con RFC capturado, elige el régimen fiscal.',
                })
            }
            if (!val.codigo_postal) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['codigo_postal'],
                    message: 'Con RFC capturado, el código postal (domicilio fiscal) es obligatorio.',
                })
            }
        }
        if (val.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val.email)) {
            ctx.addIssue({
                code: 'custom',
                path: ['email'],
                message: 'Correo electrónico no válido.',
            })
        }
        // R5 — solo crédito exige plazo; entero > 0.
        if (val.terminos_pago === 'credito') {
            const dias = val.dias_credito === '' ? NaN : Number(val.dias_credito)
            if (!Number.isInteger(dias) || dias <= 0) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['dias_credito'],
                    message: 'Con crédito indica los días de plazo (número entero mayor a 0).',
                })
            }
        }
    })

export type ProveedorInput = z.infer<typeof proveedorSchema>

// ── Alta rápida (Flujo 01 §10.3.1 · contrato hacia 1.6 Entradas) ─────────────
// Captura mínima: solo nombre_comercial; tipo default 'formal' en la BD.
export const proveedorRapidoSchema = z.object({
    nombre_comercial: z
        .string()
        .trim()
        .min(1, 'El nombre comercial es obligatorio')
        .max(120, 'El nombre comercial es demasiado largo'),
})

export type ProveedorRapidoInput = z.infer<typeof proveedorRapidoSchema>
