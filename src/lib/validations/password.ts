// ============================================================================
// VALIDADOR DE CONTRASEÑA
// Replica la política configurada en Supabase Auth (Decisión 13, Parte 0):
//   Authentication → Providers → Password
//     · Minimum password length  = 8
//     · Required characters      = Lowercase, uppercase, digits and symbols
//
// ⚠️ Esta validación es un ESPEJO, no la defensa. La regla real vive en el
//    Dashboard: quien llame al endpoint de signup fuera de la app se somete
//    a la política del proveedor, no a este archivo. Si los dos discrepan,
//    el que manda es el Dashboard — y el usuario vería un error confuso del
//    servidor en vez de la corrección inmediata en el formulario.
//
// Lógica pura — sin React, sin efectos secundarios, sin dependencias externas.
// ============================================================================

import { z } from 'zod'

// ── Política del proveedor ──────────────────────────────────────────────────
// Único lugar donde vive el número. Cambiarlo aquí SIN cambiarlo en el
// Dashboard desalinea la UI del servidor.
export const MIN_PASSWORD_LENGTH = 8

// ── Estado de cada requisito (feedback en vivo del checklist) ───────────────
export interface PasswordValidation {
    minLength: boolean
    hasUppercase: boolean
    hasLowercase: boolean
    hasNumber: boolean
    hasSymbol: boolean
    isValid: boolean
}

// Símbolos aceptados por Supabase Auth en su set "symbols".
const SYMBOL_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/

/**
 * Evalúa una contraseña contra los requisitos configurados en Supabase Auth.
 * El objetivo es que el error aparezca en la UI ANTES del request al servidor.
 */
export function validarPassword(password: string): PasswordValidation {
    const minLength    = password.length >= MIN_PASSWORD_LENGTH
    const hasUppercase = /[A-ZÁÉÍÓÚÑ]/.test(password)
    const hasLowercase = /[a-záéíóúñ]/.test(password)
    const hasNumber    = /[0-9]/.test(password)
    const hasSymbol    = SYMBOL_REGEX.test(password)

    return {
        minLength,
        hasUppercase,
        hasLowercase,
        hasNumber,
        hasSymbol,
        isValid: minLength && hasUppercase && hasLowercase && hasNumber && hasSymbol,
    }
}

// ── Schema Zod — lo usa react-hook-form en el LoginForm (Parte 4) ───────────
// Un solo refine con mensaje genérico: el detalle de QUÉ falta lo muestra el
// checklist en vivo (PasswordRequirements), no el mensaje de error del campo.
export const passwordSchema = z
    .string()
    .min(MIN_PASSWORD_LENGTH, `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`)
    .refine(
        value => validarPassword(value).isValid,
        'Debe incluir mayúscula, minúscula, número y símbolo'
    )

// ── Etiquetas del checklist ─────────────────────────────────────────────────
// PasswordRequirements.tsx las itera — agregar un requisito nuevo aquí lo
// agrega automáticamente al componente visual.
export const PASSWORD_REQUIREMENTS = [
    { key: 'minLength',    label: `Mínimo ${MIN_PASSWORD_LENGTH} caracteres` },
    { key: 'hasUppercase', label: 'Una letra mayúscula' },
    { key: 'hasLowercase', label: 'Una letra minúscula' },
    { key: 'hasNumber',    label: 'Un número' },
    { key: 'hasSymbol',    label: 'Un símbolo (!@#$%…)' },
] as const
