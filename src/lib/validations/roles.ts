import { z } from 'zod'

// Base compartida por alta y edición.
// clave NO vive aquí: es exclusiva del alta (inmutable — R1).
const baseRol = {
    nombre: z
        .string()
        .trim()
        .min(1, 'El nombre es obligatorio')
        .max(80, 'El nombre es demasiado largo'),
    // CHECK (nivel_jerarquico > 0) — 1 = mayor jerarquía (R2).
    nivel_jerarquico: z
        .coerce
        .number()
        .int('El nivel debe ser un número entero')
        .positive('El nivel debe ser mayor que 0'),
    descripcion: z
        .string()
        .trim()
        .max(500, 'La descripción es demasiado larga')
        .optional(),
}

// Alta: base + clave (única, inmutable, normalizada a slug minúsculas — R1).
export const rolCrearSchema = z.object({
    ...baseRol,
    clave: z
        .string()
        .trim()
        .toLowerCase()
        .min(2, 'La clave debe tener al menos 2 caracteres')
        .max(50, 'La clave es demasiado larga')
        .regex(/^[a-z0-9_-]+$/, 'Solo minúsculas, números, guion y guion bajo; sin espacios'),
})

// Edición: solo la base. La clave no viaja (R1).
export const rolEditarSchema = z.object({
    ...baseRol,
})

export type RolCrearInput = z.infer<typeof rolCrearSchema>
export type RolEditarInput = z.infer<typeof rolEditarSchema>
