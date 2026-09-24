import { z } from 'zod'

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDACIONES — CLIENTES (Guía 1.3)
// Dos schemas (alta/edición): saldo_inicial SOLO en alta (D20 · PLAN §3).
// Forma PURA: opcionales viajan como '' y la conversión a null/number la hace la
// Server Action (patrón 1.1). Reglas condicionales del PLAN §3:
//   · tipo_persona = 'moral' → razon_social requerida
//   · rfc presente → formato válido + id_regimen_fiscal requerido
//   · tiene_credito → limite_credito y dias_credito enteros > 0
//   · grids: máximo UNA es_default_fiscal / UNA es_default_envio / UN es_principal
// ═══════════════════════════════════════════════════════════════════════════════

const REGEX_RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/
const REGEX_CP = /^\d{5}$/

// ── Hijas (grids N del modal · ANATOMÍA §4) ────────────────────────────────────
export const direccionSchema = z.object({
    id: z.string(), // '' = nueva (sin id en BD)
    tipo: z.enum(['matriz', 'sucursal', 'envio', 'almacen', 'otro']),
    etiqueta: z.string().trim().max(80, 'La etiqueta es demasiado larga'),
    direccion: z.string().trim().min(1, 'La dirección es obligatoria').max(200, 'La dirección es demasiado larga'),
    colonia: z.string().trim().max(120, 'La colonia es demasiado larga'),
    ciudad: z.string().trim().max(120, 'La ciudad es demasiado larga'),
    estado: z.string().trim().max(120, 'El estado es demasiado largo'),
    codigo_postal: z
        .string()
        .trim()
        .max(5, 'El código postal tiene 5 dígitos')
        .refine((v) => v === '' || REGEX_CP.test(v), 'El código postal debe tener 5 dígitos'),
    es_default_fiscal: z.boolean(),
    es_default_envio: z.boolean(),
    es_activo: z.boolean(),
})

export const contactoSchema = z.object({
    id: z.string(), // '' = nuevo (sin id en BD)
    tipo: z.enum(['general', 'ventas', 'cobranza', 'soporte', 'direccion', 'otro']),
    nombre: z.string().trim().min(1, 'El nombre del contacto es obligatorio').max(120, 'El nombre es demasiado largo'),
    telefono: z.string().trim().max(50, 'El teléfono es demasiado largo'),
    email: z.string().trim().max(120, 'El correo es demasiado largo'),
    notas: z.string().trim().max(500, 'Las notas son demasiado largas'),
    es_principal: z.boolean(),
    es_activo: z.boolean(),
})

export type DireccionInput = z.infer<typeof direccionSchema>
export type ContactoInput = z.infer<typeof contactoSchema>

// ── Refinamientos compartidos por alta y edición ───────────────────────────────
function refinarCliente(
    val: {
        tipo_persona: string
        razon_social: string
        rfc: string
        id_regimen_fiscal: string
        tiene_credito: boolean
        limite_credito: string
        dias_credito: string
        direcciones: { es_default_fiscal: boolean; es_default_envio: boolean; es_activo: boolean }[]
        contactos: { tipo: string; es_principal: boolean; es_activo: boolean }[]
    },
    ctx: z.RefinementCtx
) {
    // R1 — persona moral exige razón social.
    if (val.tipo_persona === 'moral' && !val.razon_social.trim()) {
        ctx.addIssue({ code: 'custom', path: ['razon_social'], message: 'Con persona moral indica la razón social.' })
    }
    // R2 — con RFC, formato + régimen obligatorio (CFDI base · PLAN §3).
    if (val.rfc) {
        if (!REGEX_RFC.test(val.rfc.toUpperCase())) {
            ctx.addIssue({ code: 'custom', path: ['rfc'], message: 'El RFC no tiene el formato válido (12 o 13 caracteres).' })
        }
        if (!val.id_regimen_fiscal) {
            ctx.addIssue({ code: 'custom', path: ['id_regimen_fiscal'], message: 'Con RFC capturado, elige el régimen fiscal.' })
        }
    }
    // R3 — crédito exige límite y días (enteros > 0) — CHECK BD ck_clientes_credito.
    if (val.tiene_credito) {
        const limite = val.limite_credito === '' ? NaN : Number(val.limite_credito)
        const dias = val.dias_credito === '' ? NaN : Number(val.dias_credito)
        if (!(Number.isFinite(limite) && limite > 0)) {
            ctx.addIssue({ code: 'custom', path: ['limite_credito'], message: 'Con crédito indica un límite mayor a 0.' })
        }
        if (!(Number.isInteger(dias) && dias > 0)) {
            ctx.addIssue({ code: 'custom', path: ['dias_credito'], message: 'Con crédito indica los días de plazo (entero mayor a 0).' })
        }
    }
    // R4 — unicidades de los grids (UNIQUE parciales b2): un default fiscal, un
    // default de envío, un contacto principal por tipo.
    const fiscales = val.direcciones.filter((d) => d.es_default_fiscal && d.es_activo)
    if (fiscales.length > 1) {
        ctx.addIssue({ code: 'custom', path: ['direcciones'], message: 'Solo una dirección puede ser el default fiscal.' })
    }
    const envios = val.direcciones.filter((d) => d.es_default_envio && d.es_activo)
    if (envios.length > 1) {
        ctx.addIssue({ code: 'custom', path: ['direcciones'], message: 'Solo una dirección puede ser el default de envío.' })
    }
    const principalPorTipo = new Set<string>()
    for (const c of val.contactos) {
        if (c.es_principal && c.es_activo) {
            if (principalPorTipo.has(c.tipo)) {
                ctx.addIssue({ code: 'custom', path: ['contactos'], message: 'Solo un contacto principal por tipo.' })
                break
            }
            principalPorTipo.add(c.tipo)
        }
    }
    // correo con formato si viene: la SA lo valida al transformar (aEmail, patrón 1.1)
}

// ── ALTA (incluye saldo_inicial — D20) ─────────────────────────────────────────
export const clienteAltaSchema = z
    .object({
        nombre_comercial: z.string().trim().min(1, 'El nombre comercial es obligatorio').max(120, 'El nombre comercial es demasiado largo'),
        tipo_persona: z.enum(['fisica', 'moral']),
        razon_social: z.string().trim().max(200, 'La razón social es demasiado larga'),
        id_marca_comercial: z.string().trim().min(1, 'Elige la marca comercial').max(36, 'Marca no válida'),
        id_tipo_cliente: z.string().trim().min(1, 'Elige el tipo de cliente').max(36, 'Tipo de cliente no válido'),
        id_lista_precio: z.string().trim().min(1, 'Elige la lista de precios').max(36, 'Lista no válida'),
        id_canal_venta: z.string().trim().max(36, 'Canal no válido'),
        id_ruta_cobro: z.string().trim().max(36, 'Ruta no válida'),
        id_vendedor_asignado: z.string().trim().max(36, 'Vendedor no válido'),
        tiene_credito: z.boolean(),
        limite_credito: z.string().trim().max(16, 'Límite no válido'),
        dias_credito: z.string().trim().max(6, 'Plazo no válido'),
        saldo_inicial: z.string().trim().max(16, 'Saldo inicial no válido'),
        rfc: z.string().trim().max(13, 'El RFC es demasiado largo'),
        id_regimen_fiscal: z.string().trim().max(36, 'Régimen fiscal no válido'),
        id_uso_cfdi: z.string().trim().max(36, 'Uso de CFDI no válido'),
        notas: z.string().trim().max(1000, 'Las notas son demasiado largas'),
        es_activo: z.boolean(),
        direcciones: z.array(direccionSchema),
        contactos: z.array(contactoSchema),
    })
    .superRefine((val, ctx) => {
        refinarCliente(val, ctx)
        if (val.saldo_inicial && !/^-?\d+(\.\d{1,4})?$/.test(val.saldo_inicial)) {
            ctx.addIssue({ code: 'custom', path: ['saldo_inicial'], message: 'El saldo inicial no es un monto válido.' })
        }
        // validar medio de contacto dentro del refine (tel o email al menos uno)
        val.contactos.forEach((c, i) => {
            if (c.es_activo && !c.telefono.trim() && !c.email.trim()) {
                ctx.addIssue({ code: 'custom', path: ['contactos', i], message: 'Cada contacto activo necesita teléfono o correo.' })
            }
        })
    })

export type ClienteAltaInput = z.infer<typeof clienteAltaSchema>

// ── EDICIÓN (sin saldo_inicial — inmutable tras crear, D20) ────────────────────
export const clienteEditarSchema = z
    .object({
        nombre_comercial: z.string().trim().min(1, 'El nombre comercial es obligatorio').max(120, 'El nombre comercial es demasiado largo'),
        tipo_persona: z.enum(['fisica', 'moral']),
        razon_social: z.string().trim().max(200, 'La razón social es demasiado larga'),
        id_marca_comercial: z.string().trim().min(1, 'Elige la marca comercial').max(36, 'Marca no válida'),
        id_tipo_cliente: z.string().trim().min(1, 'Elige el tipo de cliente').max(36, 'Tipo de cliente no válido'),
        id_lista_precio: z.string().trim().min(1, 'Elige la lista de precios').max(36, 'Lista no válida'),
        id_canal_venta: z.string().trim().max(36, 'Canal no válido'),
        id_ruta_cobro: z.string().trim().max(36, 'Ruta no válida'),
        id_vendedor_asignado: z.string().trim().max(36, 'Vendedor no válido'),
        tiene_credito: z.boolean(),
        limite_credito: z.string().trim().max(16, 'Límite no válido'),
        dias_credito: z.string().trim().max(6, 'Plazo no válido'),
        rfc: z.string().trim().max(13, 'El RFC es demasiado largo'),
        id_regimen_fiscal: z.string().trim().max(36, 'Régimen fiscal no válido'),
        id_uso_cfdi: z.string().trim().max(36, 'Uso de CFDI no válido'),
        notas: z.string().trim().max(1000, 'Las notas son demasiado largas'),
        es_activo: z.boolean(),
        direcciones: z.array(direccionSchema),
        contactos: z.array(contactoSchema),
        removedDirecciones: z.array(z.string().max(36)).default([]),
        removedContactos: z.array(z.string().max(36)).default([]),
    })
    .superRefine((val, ctx) => {
        refinarCliente(val, ctx)
        val.contactos.forEach((c, i) => {
            if (c.es_activo && !c.telefono.trim() && !c.email.trim()) {
                ctx.addIssue({ code: 'custom', path: ['contactos', i], message: 'Cada contacto activo necesita teléfono o correo.' })
            }
        })
    })

export type ClienteEditarInput = z.infer<typeof clienteEditarSchema>

// ── Alta rápida (contrato hacia 1.7/1.8/1.9 · espejo 1.1 crearProveedorRapido) ─
// Captura mínima: nombre + marca. Defaults en el servidor: tipo PUBLICO · lista
// es_lista_default · persona física (bd-clientes b5 y SA de la Parte 3).
export const clienteRapidoSchema = z.object({
    nombre_comercial: z.string().trim().min(1, 'El nombre comercial es obligatorio').max(120, 'El nombre comercial es demasiado largo'),
    id_marca_comercial: z.string().trim().min(1, 'Elige la marca comercial').max(36, 'Marca no válida'),
})

export type ClienteRapidoInput = z.infer<typeof clienteRapidoSchema>
