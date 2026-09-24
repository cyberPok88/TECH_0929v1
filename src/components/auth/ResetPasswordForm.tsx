'use client'

// ============================================================================
// RESET PASSWORD FORM — Guía 0.11 Parte 5 (rediseño Aura)
// Smart Client: lógica idéntica a v1 (establecerNuevaPasswordAction + checklist).
// Cambios: estilos alineados con LoginForm.
// Al éxito redirige a /login?resetOk=1 (banda verde la muestra LoginForm).
// ============================================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { PasswordRequirements } from './PasswordRequirements'
import { passwordSchema, validarPassword } from '@/lib/validations/password'
import { establecerNuevaPasswordAction } from '@/lib/actions/password'

const resetSchema = z.object({
    password: passwordSchema,
    confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm'],
})
type ResetValues = z.infer<typeof resetSchema>

export function ResetPasswordForm() {
    const router = useRouter()
    const [mostrarPassword, setMostrarPassword] = useState(false)
    const [errorServidor, setErrorServidor] = useState<string | null>(null)

    const { register, handleSubmit, control, formState: { errors, isSubmitting } } =
        useForm<ResetValues>({ resolver: zodResolver(resetSchema) })

    const passwordActual = useWatch({ control, name: 'password' }) ?? ''
    const validation = validarPassword(passwordActual)

    const onSubmit = async (data: ResetValues) => {
        setErrorServidor(null)
        const res = await establecerNuevaPasswordAction(data.password)
        if (!res.success) {
            setErrorServidor(res.error)
            return
        }
        router.push('/login?resetOk=1')
    }

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: RESET_LOCAL_CSS }} />
            <form onSubmit={handleSubmit(onSubmit)} noValidate>

                <div className="login-field">
                    <label htmlFor="password-reset">Nueva contraseña</label>
                    <div className="login-wrap">
                        <input
                            id="password-reset"
                            type={mostrarPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            autoFocus
                            aria-invalid={!!errors.password}
                            {...register('password')}
                        />
                        <button
                            type="button"
                            className="login-eye"
                            onClick={() => setMostrarPassword((v) => !v)}
                            aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                            tabIndex={-1}
                        >
                            {mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                <PasswordRequirements
                    validation={validation}
                    show={passwordActual.length > 0}
                />

                <div className="login-field">
                    <label htmlFor="confirm-reset">Confirmar contraseña</label>
                    <div className="login-wrap">
                        <input
                            id="confirm-reset"
                            type={mostrarPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            aria-invalid={!!errors.confirm}
                            {...register('confirm')}
                        />
                    </div>
                    {errors.confirm && (
                        <p className="login-field-error">{errors.confirm.message}</p>
                    )}
                </div>

                {errorServidor && (
                    <p role="alert" className="login-error-server">{errorServidor}</p>
                )}

                <button type="submit" className="login-btn" disabled={isSubmitting}>
                    {isSubmitting
                        ? <><Loader2 size={17} className="login-spin" />Guardando…</>
                        : <>Establecer nueva contraseña</>
                    }
                </button>
            </form>
        </>
    )
}

const RESET_LOCAL_CSS = `
.login-field { margin-top: 20px; }
.login-field label { display: block; font-size: 12px; font-weight: 600; letter-spacing: .05em; margin-bottom: 8px; text-transform: uppercase; color: oklch(var(--muted-fg)); }
.login-wrap { position: relative; }
.login-field input { width: 100%; height: 48px; background: oklch(var(--surface-overlay) / 0.55); border: 1px solid oklch(var(--fg) / 0.12); border-radius: var(--radius); padding: 0 44px 0 15px; font: inherit; font-size: 14.5px; color: oklch(var(--fg)); outline: none; -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); transition: border-color .15s ease, box-shadow .15s ease, background .15s ease; }
.login-field input::placeholder { color: oklch(var(--muted-fg) / 0.6); }
.login-field input:focus { border-color: oklch(var(--primary)); background: oklch(var(--surface-raised) / 0.8); box-shadow: 0 0 0 3px oklch(var(--primary) / 0.18), 0 0 30px oklch(var(--primary) / 0.15); }
.login-field-error { margin-top: 6px; font-size: 12px; color: oklch(var(--primary)); }
.login-eye { position: absolute; right: 13px; top: 50%; transform: translateY(-50%); background: none; border: 0; padding: 4px; cursor: pointer; color: oklch(var(--muted-fg)); transition: color .15s ease; display: flex; }
.login-eye:hover { color: oklch(var(--fg)); }
.login-error-server { margin-top: 14px; font-size: 13px; padding: 10px 12px; border-radius: var(--radius); background: oklch(var(--primary) / 0.14); border: 1px solid oklch(var(--primary) / 0.3); color: oklch(var(--fg)); }
.login-btn { margin-top: 22px; width: 100%; height: 50px; display: inline-flex; align-items: center; justify-content: center; gap: 10px; background: linear-gradient(135deg, oklch(var(--primary)), oklch(var(--primary) / 0.78)); color: oklch(var(--primary-fg)); border: 0; border-radius: var(--radius); font: inherit; font-size: 15px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; cursor: pointer; transition: transform .12s ease, box-shadow .12s ease, filter .12s ease; }
.login-btn:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-2px); box-shadow: 0 12px 32px oklch(var(--primary) / 0.4); }
.login-btn:disabled { opacity: .55; cursor: not-allowed; }
.login-spin { animation: login-spin 1s linear infinite; }
@keyframes login-spin { to { transform: rotate(360deg); } }
`
