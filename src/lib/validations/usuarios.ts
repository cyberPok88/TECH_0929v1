import { z } from 'zod'

import { passwordSchema } from '@/lib/validations/password'

// Base compartida por alta y edición.
// email y password NO viven aquí: son exclusivos del alta (ver los schemas).
const baseUsuario = {
    nombre_completo: z
        .string()
        .trim()
        .min(1, 'El nombre es obligatorio')
        .max(120, 'El nombre es demasiado largo'),
    telefono: z
        .string()
        .trim()
        .max(50, 'El teléfono es demasiado largo')
        .optional(),
    id_rol: z.string().uuid('Selecciona un rol'),
    es_activo: z.boolean(),
}

// Alta: base + correo + contraseña (esta última reutiliza el espejo de la 0.5).
export const usuarioCrearSchema = z.object({
    ...baseUsuario,
    email: z.string().trim().email('Correo electrónico no válido'),
    password: passwordSchema,
})

// Edición: solo la base. El correo es de solo lectura (Decisión 7) y no viaja.
export const usuarioEditarSchema = z.object({
    ...baseUsuario,
})

export type UsuarioCrearInput = z.infer<typeof usuarioCrearSchema>
export type UsuarioEditarInput = z.infer<typeof usuarioEditarSchema>
