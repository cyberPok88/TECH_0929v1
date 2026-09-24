'use client'

// ============================================================================
// PASSWORD CHANGE FORM — Cambio de contraseña en sesión (Guía 0.11 Parte 3)
// Smart Client: react-hook-form + zodResolver + Server Action.
// Reutiliza PasswordRequirements (Guía 0.5) para el checklist en vivo.
//
// Al éxito: toast.success (Toaster global de la 0.6) + reset del formulario.
// El usuario sigue en /dashboard/perfil — no se cierra sesión.
// ============================================================================

import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordRequirements } from './PasswordRequirements'
import { passwordSchema, validarPassword } from '@/lib/validations/password'
import { cambiarPasswordAction } from '@/lib/actions/password'

// ── Schema — actual sin validación de política (solo obligatorio), nueva con
//    passwordSchema (política completa), confirm igual a nueva.
const cambioSchema = z.object({
    actual: z.string().min(1, 'Escribe tu contraseña actual'),
    nueva: passwordSchema,
    confirm: z.string(),
}).refine((d) => d.nueva === d.confirm, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm'],
}).refine((d) => d.actual !== d.nueva, {
    message: 'La nueva contraseña debe ser distinta a la actual',
    path: ['nueva'],
})

type CambioValues = z.infer<typeof cambioSchema>

export function PasswordChangeForm() {
    const [mostrarActual, setMostrarActual] = useState(false)
    const [mostrarNueva, setMostrarNueva] = useState(false)

    const {
        register,
        handleSubmit,
        reset,
        control,
        formState: { errors, isSubmitting },
    } = useForm<CambioValues>({ resolver: zodResolver(cambioSchema) })

    const nuevaActual = useWatch({ control, name: 'nueva' }) ?? ''
    const validation = validarPassword(nuevaActual)

    const onSubmit = async (data: CambioValues) => {
        const res = await cambiarPasswordAction(data.actual, data.nueva)
        if (!res.success) {
            toast.error(res.error)
            return
        }
        toast.success('Contraseña actualizada')
        // reset() después del éxito para que el spinner termine su ciclo
        // natural (isSubmitting → false, luego se limpian los campos).
        reset()
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>

            {/* ── Contraseña actual ─────────────────────────────────── */}
            <div className="space-y-2">
                <Label htmlFor="actual">Contraseña actual</Label>
                <div className="relative">
                    <Input
                        id="actual"
                        type={mostrarActual ? 'text' : 'password'}
                        autoComplete="current-password"
                        aria-invalid={!!errors.actual}
                        {...register('actual')}
                    />
                    <button
                        type="button"
                        onClick={() => setMostrarActual((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={mostrarActual ? 'Ocultar contraseña actual' : 'Mostrar contraseña actual'}
                    >
                        {mostrarActual ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                </div>
                {errors.actual && (
                    <p className="text-xs text-destructive">{errors.actual.message}</p>
                )}
            </div>

            {/* ── Nueva contraseña ──────────────────────────────────── */}
            <div className="space-y-2">
                <Label htmlFor="nueva">Nueva contraseña</Label>
                <div className="relative">
                    <Input
                        id="nueva"
                        type={mostrarNueva ? 'text' : 'password'}
                        autoComplete="new-password"
                        aria-invalid={!!errors.nueva}
                        {...register('nueva')}
                    />
                    <button
                        type="button"
                        onClick={() => setMostrarNueva((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={mostrarNueva ? 'Ocultar nueva contraseña' : 'Mostrar nueva contraseña'}
                    >
                        {mostrarNueva ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                </div>
                {errors.nueva && (
                    <p className="text-xs text-destructive">{errors.nueva.message}</p>
                )}
            </div>

            {/* Checklist en vivo — mismo componente de PasswordRequirements */}
            <PasswordRequirements
                validation={validation}
                show={nuevaActual.length > 0}
            />

            {/* ── Confirmación ──────────────────────────────────────── */}
            <div className="space-y-2">
                <Label htmlFor="confirm">Confirmar nueva contraseña</Label>
                <Input
                    id="confirm"
                    type={mostrarNueva ? 'text' : 'password'}
                    autoComplete="new-password"
                    aria-invalid={!!errors.confirm}
                    {...register('confirm')}
                />
                {errors.confirm && (
                    <p className="text-xs text-destructive">{errors.confirm.message}</p>
                )}
            </div>

            <div className="pt-2">
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Guardando…
                        </>
                    ) : (
                        'Actualizar contraseña'
                    )}
                </Button>
            </div>
        </form>
    )
}
