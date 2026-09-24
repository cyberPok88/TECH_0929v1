'use client'

// ============================================================================
// RECUPERAR PASSWORD FORM — Guía 0.11 Parte 5 (rediseño Aura)
// Smart Client: lógica idéntica a v1 (iniciarRecuperacionAction + 2 estados).
// Cambios: estilos alineados con LoginForm (clases .login-*).
//
// La opacidad del mensaje de éxito ("Si el correo existe...") es la defensa
// contra enumeración — decisión de la Parte 1 B3.
// ============================================================================

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, ArrowLeft, MailCheck } from 'lucide-react'
import { iniciarRecuperacionAction } from '@/lib/actions/password'

const recuperarSchema = z.object({
    email: z.string().email('Correo electrónico inválido'),
})
type RecuperarValues = z.infer<typeof recuperarSchema>

export function RecuperarPasswordForm() {
    const [enviado, setEnviado] = useState(false)
    const [errorProveedor, setErrorProveedor] = useState<string | null>(null)

    const { register, handleSubmit, formState: { errors, isSubmitting } } =
        useForm<RecuperarValues>({ resolver: zodResolver(recuperarSchema) })

    const onSubmit = async (data: RecuperarValues) => {
        setErrorProveedor(null)
        const res = await iniciarRecuperacionAction(data.email)
        if (!res.success) {
            setErrorProveedor(
                'No pudimos enviar el correo en este momento. Intenta de nuevo en un minuto.'
            )
            return
        }
        setEnviado(true)
    }

    // Estado enviado — confirmación opaca (defensa contra enumeración)
    if (enviado) {
        return (
            <>
                <style dangerouslySetInnerHTML={{ __html: RESET_LOCAL_CSS }} />
                <div className="login-confirm">
                    <div className="login-confirm-icon">
                        <MailCheck size={22} />
                    </div>
                    <h2>Revisa tu correo</h2>
                    <p>
                        Si el correo que ingresaste está registrado, te enviamos un enlace
                        para restablecer tu contraseña. El enlace es de un solo uso y caduca
                        en aproximadamente una hora.
                    </p>
                    <Link
                        href="/login"
                        className="login-back-link"
                    >
                        <ArrowLeft size={14} />
                        Volver a iniciar sesión
                    </Link>
                </div>
            </>
        )
    }

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: RESET_LOCAL_CSS }} />
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <div className="login-field">
                    <label htmlFor="email-recuperar">Correo electrónico</label>
                    <div className="login-wrap">
                        <input
                            id="email-recuperar"
                            type="email"
                            autoComplete="email"
                            autoFocus
                            placeholder="tu.correo@ejemplo.com"
                            aria-invalid={!!errors.email}
                            {...register('email')}
                        />
                    </div>
                    {errors.email && (
                        <p className="login-field-error">{errors.email.message}</p>
                    )}
                </div>

                {errorProveedor && (
                    <p role="alert" className="login-error-server">{errorProveedor}</p>
                )}

                <button type="submit" className="login-btn" disabled={isSubmitting}>
                    {isSubmitting
                        ? <><Loader2 size={17} className="login-spin" />Enviando…</>
                        : <>Enviar enlace de recuperación</>
                    }
                </button>

                <Link href="/login" className="login-back-link">
                    <ArrowLeft size={14} />
                    Volver a iniciar sesión
                </Link>
            </form>
        </>
    )
}

// ── CSS local — replica LOGIN_CSS + agrega .login-back-link para navegar atrás
// (repetir el CSS aquí evita que el form dependa de que LoginForm esté montado)
const RESET_LOCAL_CSS = `
.login-field { margin-top: 20px; }
.login-field label { display: block; font-size: 12px; font-weight: 600; letter-spacing: .05em; margin-bottom: 8px; text-transform: uppercase; color: oklch(var(--muted-fg)); }
.login-wrap { position: relative; }
.login-field input { width: 100%; height: 48px; background: oklch(var(--surface-overlay) / 0.55); border: 1px solid oklch(var(--fg) / 0.12); border-radius: var(--radius); padding: 0 44px 0 15px; font: inherit; font-size: 14.5px; color: oklch(var(--fg)); outline: none; -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); transition: border-color .15s ease, box-shadow .15s ease, background .15s ease; }
.login-field input::placeholder { color: oklch(var(--muted-fg) / 0.6); }
.login-field input:focus { border-color: oklch(var(--primary)); background: oklch(var(--surface-raised) / 0.8); box-shadow: 0 0 0 3px oklch(var(--primary) / 0.18), 0 0 30px oklch(var(--primary) / 0.15); }
.login-field-error { margin-top: 6px; font-size: 12px; color: oklch(var(--primary)); }

.login-error-server { margin-top: 14px; font-size: 13px; padding: 10px 12px; border-radius: var(--radius); background: oklch(var(--primary) / 0.14); border: 1px solid oklch(var(--primary) / 0.3); color: oklch(var(--fg)); }

.login-btn { margin-top: 22px; width: 100%; height: 50px; display: inline-flex; align-items: center; justify-content: center; gap: 10px; background: linear-gradient(135deg, oklch(var(--primary)), oklch(var(--primary) / 0.78)); color: oklch(var(--primary-fg)); border: 0; border-radius: var(--radius); font: inherit; font-size: 15px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; cursor: pointer; position: relative; overflow: hidden; transition: transform .12s ease, box-shadow .12s ease, filter .12s ease; text-decoration: none; }
.login-btn:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-2px); box-shadow: 0 12px 32px oklch(var(--primary) / 0.4); }
.login-btn:disabled { opacity: .55; cursor: not-allowed; }
.login-spin { animation: login-spin 1s linear infinite; }
@keyframes login-spin { to { transform: rotate(360deg); } }

.login-back-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 18px; font-size: 13px; color: oklch(var(--muted-fg)); text-decoration: none; transition: color .15s ease; }
.login-back-link:hover { color: oklch(var(--fg)); }

.login-confirm { padding: 8px 0; text-align: center; }
.login-confirm .login-confirm-icon { display: inline-flex; padding: 12px; border-radius: 50%; background: oklch(var(--success) / 0.14); color: oklch(var(--success)); margin-bottom: 14px; }
.login-confirm h2 { font-family: Orbitron, sans-serif; font-size: 17px; font-weight: 800; color: oklch(var(--fg)); margin-bottom: 8px; }
.login-confirm p { font-size: 13.5px; color: oklch(var(--muted-fg)); line-height: 1.6; margin-bottom: 20px; }
`
