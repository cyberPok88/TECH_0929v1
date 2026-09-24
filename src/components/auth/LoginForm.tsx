'use client'

// ============================================================================
// LOGIN FORM — Orquestador del flujo de login y registro
// Client Component: dos useForm (react-hook-form) + zodResolver.
// Smart Component: escribe en el auth-store con setSesion al éxito.
// El modo 'register' solo existe si la BD dice que no hay usuarios (prop).
//
// Guía 0.11 Parte 5 (rediseño Aura):
//   · Sin card propia — el <BrandPanel> es el vidrio (Bloque 3 de esta parte)
//   · Labels uppercase, inputs con --surface-overlay, CTA con sheen
//   · Enlace real a /login/recuperar (fuera del alert placeholder de la 0.5)
//   · Checkbox "Recordarme" visual (spec §4 — sin persistencia extra)
//   · Prop avisoInicial (del Server) con banda arriba del título del panel
//   · Vista "Revisa tu correo" adapta al mismo lenguaje
// ============================================================================

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, Eye, EyeOff, Loader2, ArrowRight, MailCheck, AlertCircle } from 'lucide-react'
import { PasswordRequirements } from './PasswordRequirements'
import { useAuthStoreBase } from '@/lib/stores/auth-store'
import { iniciarSesionAction, registrarseAction } from '@/lib/actions/auth'
import { MIN_PASSWORD_LENGTH, validarPassword, passwordSchema } from '@/lib/validations/password'
import { cn } from '@/lib/utils'

// ── Schemas ─────────────────────────────────────────────────────────────────
// passwordSchema (Parte 3) es la política que Supabase Auth valida — se reutiliza.
const loginSchema = z.object({
    email: z.string().email('Correo electrónico inválido'),
    password: z.string().min(1, 'La contraseña es obligatoria'),
})
const registerSchema = z.object({
    nombre: z.string().min(2, 'Escribe tu nombre completo'),
    email: z.string().email('Correo electrónico inválido'),
    password: passwordSchema,
    confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm'],
})
type LoginValues = z.infer<typeof loginSchema>
type RegisterValues = z.infer<typeof registerSchema>

// ── Contrato de aviso (deriva el Server desde searchParams) ─────────────────
export type AvisoInicial = { tipo: 'success' | 'error'; texto: string }

interface LoginFormProps {
    mostrarRegistro: boolean
    avisoInicial?: AvisoInicial | null
}

export function LoginForm({ mostrarRegistro, avisoInicial = null }: LoginFormProps) {
    const router = useRouter()
    const setSesion = useAuthStoreBase((s) => s.setSesion)

    const loginForm = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })
    const registerForm = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) })

    const [mode, setMode] = useState<'login' | 'register'>('login')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [showRequirements, setShowRequirements] = useState(false)
    const [confirmacionEnviada, setConfirmacionEnviada] = useState(false)
    const [aviso, setAviso] = useState<AvisoInicial | null>(avisoInicial)

    const password = useWatch({ control: registerForm.control, name: 'password' }) ?? ''
    const confirm = useWatch({ control: registerForm.control, name: 'confirm' }) ?? ''
    const passwordValidation = validarPassword(password)

    const switchMode = (newMode: 'login' | 'register') => {
        setMode(newMode)
        loginForm.reset()
        registerForm.reset()
        setError('')
        setShowPassword(false)
        setShowConfirm(false)
        setShowRequirements(false)
        setConfirmacionEnviada(false)
        setAviso(null)
    }

    const handleLogin = async (data: LoginValues) => {
        setIsLoading(true)
        setError('')
        try {
            const res = await iniciarSesionAction(data.email, data.password)
            if (!res.success) { setError(res.error); return }
            if (!('sesion' in res)) { setError('Respuesta inesperada del servidor.'); return }
            setSesion(res.sesion)
            router.push('/dashboard')
        } catch {
            setError('Error de conexión. Intenta nuevamente.')
        } finally {
            setIsLoading(false)
        }
    }

    const handleRegister = async (data: RegisterValues) => {
        setIsLoading(true)
        setError('')
        try {
            const res = await registrarseAction(data.nombre, data.email, data.password)
            if (!res.success) { setError(res.error); return }
            if ('requiereConfirmacion' in res) { setConfirmacionEnviada(true); return }
            setSesion(res.sesion)
            router.push('/dashboard')
        } catch {
            setError('Error de conexión. Intenta nuevamente.')
        } finally {
            setIsLoading(false)
        }
    }

    // ── Vista "Revisa tu correo" (Confirm email ON) ────────────────────────
    if (confirmacionEnviada) {
        return (
            <>
                <style dangerouslySetInnerHTML={{ __html: LOGIN_CSS }} />
                <div className="login-confirm">
                    <div className="login-confirm-icon">
                        <MailCheck size={22} />
                    </div>
                    <h2>Revisa tu correo</h2>
                    <p>
                        Enviamos un enlace de confirmación a tu dirección. Confírmalo antes
                        de iniciar sesión por primera vez.
                    </p>
                    <button
                        type="button"
                        className="login-btn login-btn-ghost"
                        onClick={() => switchMode('login')}
                    >
                        Volver a iniciar sesión
                    </button>
                </div>
            </>
        )
    }

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: LOGIN_CSS }} />

            {/* Banda de aviso — arriba de todo (evento de aterrizaje) */}
            {aviso && (
                <div
                    role="status"
                    className={cn(
                        'login-aviso',
                        aviso.tipo === 'success' ? 'login-aviso-success' : 'login-aviso-error'
                    )}
                >
                    {aviso.tipo === 'success'
                        ? <CheckCircle2 size={16} />
                        : <AlertCircle size={16} />}
                    <span>{aviso.texto}</span>
                </div>
            )}

            {/* ── MODO LOGIN ────────────────────────────────────────────── */}
            {mode === 'login' && (
                <form onSubmit={loginForm.handleSubmit(handleLogin)} noValidate>
                    <div className="login-field">
                        <label htmlFor="email-login">Correo electrónico</label>
                        <div className="login-wrap">
                            <input
                                id="email-login"
                                type="email"
                                placeholder="tu@empresa.com"
                                autoComplete="email"
                                disabled={isLoading}
                                autoFocus
                                {...loginForm.register('email')}
                            />
                        </div>
                        {loginForm.formState.errors.email && (
                            <p className="login-field-error">
                                {loginForm.formState.errors.email.message}
                            </p>
                        )}
                    </div>

                    <div className="login-field">
                        <label htmlFor="password-login">Contraseña</label>
                        <div className="login-wrap">
                            <input
                                id="password-login"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Tu contraseña"
                                autoComplete="current-password"
                                disabled={isLoading}
                                {...loginForm.register('password')}
                            />
                            <button
                                type="button"
                                className="login-eye"
                                onClick={() => setShowPassword((v) => !v)}
                                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        {loginForm.formState.errors.password && (
                            <p className="login-field-error">
                                {loginForm.formState.errors.password.message}
                            </p>
                        )}
                    </div>

                    {/* Fila "Recordarme" (visual — spec §4) + enlace real a recuperar */}
                    <div className="login-row">
                        <label className="login-remember">
                            <input type="checkbox" />
                            <span>Recordarme</span>
                        </label>
                        <Link href="/login/recuperar" className="login-link">
                            ¿Olvidaste tu contraseña?
                        </Link>
                    </div>

                    {error && (
                        <p role="alert" className="login-error-server">{error}</p>
                    )}

                    <button type="submit" className="login-btn" disabled={isLoading}>
                        {isLoading
                            ? <><Loader2 size={17} className="login-spin" />Verificando…</>
                            : <>Entrar al sistema<ArrowRight size={17} /></>
                        }
                    </button>

                    {mostrarRegistro && (
                        <p className="login-register-cta">
                            ¿Sin cuenta?{' '}
                            <button type="button" onClick={() => switchMode('register')}>
                                Regístrate
                            </button>
                        </p>
                    )}
                </form>
            )}

            {/* ── MODO REGISTRO ─────────────────────────────────────────── */}
            {mode === 'register' && (
                <form onSubmit={registerForm.handleSubmit(handleRegister)} noValidate>
                    <div className="login-field">
                        <label htmlFor="nombre">Nombre completo</label>
                        <div className="login-wrap">
                            <input
                                id="nombre"
                                type="text"
                                placeholder="Tu nombre"
                                autoComplete="name"
                                disabled={isLoading}
                                autoFocus
                                {...registerForm.register('nombre')}
                            />
                        </div>
                        {registerForm.formState.errors.nombre && (
                            <p className="login-field-error">
                                {registerForm.formState.errors.nombre.message}
                            </p>
                        )}
                    </div>

                    <div className="login-field">
                        <label htmlFor="email-register">Correo electrónico</label>
                        <div className="login-wrap">
                            <input
                                id="email-register"
                                type="email"
                                placeholder="tu@empresa.com"
                                autoComplete="email"
                                disabled={isLoading}
                                {...registerForm.register('email')}
                            />
                        </div>
                        {registerForm.formState.errors.email && (
                            <p className="login-field-error">
                                {registerForm.formState.errors.email.message}
                            </p>
                        )}
                    </div>

                    <div className="login-field">
                        <label htmlFor="password-register">Contraseña</label>
                        <div className="login-wrap">
                            <input
                                id="password-register"
                                type={showPassword ? 'text' : 'password'}
                                placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                                autoComplete="new-password"
                                disabled={isLoading}
                                onFocus={() => setShowRequirements(true)}
                                {...registerForm.register('password')}
                            />
                            <button
                                type="button"
                                className="login-eye"
                                onClick={() => setShowPassword((v) => !v)}
                                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        <PasswordRequirements
                            validation={passwordValidation}
                            show={showRequirements && password.length > 0}
                        />
                        {registerForm.formState.errors.password && (
                            <p className="login-field-error">
                                {registerForm.formState.errors.password.message}
                            </p>
                        )}
                    </div>

                    <div className="login-field">
                        <label htmlFor="confirm">Confirmar contraseña</label>
                        <div className="login-wrap">
                            <input
                                id="confirm"
                                type={showConfirm ? 'text' : 'password'}
                                placeholder="Repite tu contraseña"
                                autoComplete="new-password"
                                disabled={isLoading}
                                className={cn(confirm && confirm !== password && 'login-input-error')}
                                {...registerForm.register('confirm')}
                            />
                            <button
                                type="button"
                                className="login-eye"
                                onClick={() => setShowConfirm((v) => !v)}
                                aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                tabIndex={-1}
                            >
                                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        {confirm && confirm !== password && (
                            <p className="login-field-error">Las contraseñas no coinciden.</p>
                        )}
                        {registerForm.formState.errors.confirm && !(confirm && confirm !== password) && (
                            <p className="login-field-error">
                                {registerForm.formState.errors.confirm.message}
                            </p>
                        )}
                    </div>

                    {error && (
                        <p role="alert" className="login-error-server">{error}</p>
                    )}

                    <button
                        type="submit"
                        className="login-btn"
                        disabled={isLoading || !passwordValidation.isValid}
                    >
                        {isLoading
                            ? <><Loader2 size={17} className="login-spin" />Creando cuenta…</>
                            : <>Crear cuenta<ArrowRight size={17} /></>
                        }
                    </button>

                    <p className="login-register-cta">
                        ¿Ya tienes cuenta?{' '}
                        <button type="button" onClick={() => switchMode('login')}>
                            Inicia sesión
                        </button>
                    </p>
                </form>
            )}
        </>
    )
}

// ── CSS inline del formulario (spec §4) ─────────────────────────────────────
// Prefijo `login-*` para no colisionar con clases del proyecto. Los estilos
// aquí replican el HTML de referencia (login-nuevo.html) traducido a scope
// del componente.
const LOGIN_CSS = `
.login-aviso { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 20px; padding: 12px 14px; border-radius: var(--radius); font-size: 13px; line-height: 1.4; animation: login-slide .3s ease-out; }
.login-aviso-success { background: oklch(var(--success) / 0.14); border: 1px solid oklch(var(--success) / 0.35); color: oklch(var(--success)); }
.login-aviso-error { background: oklch(var(--destructive) / 0.14); border: 1px solid oklch(var(--destructive) / 0.38); color: oklch(var(--destructive)); }
.login-aviso svg { flex-shrink: 0; margin-top: 1px; }
@keyframes login-slide { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }

.login-field { margin-top: 20px; }
.login-field label { display: block; font-size: 12px; font-weight: 600; letter-spacing: .05em; margin-bottom: 8px; text-transform: uppercase; color: oklch(var(--muted-fg)); }
.login-wrap { position: relative; }
.login-field input { width: 100%; height: 48px; background: oklch(var(--surface-2)); border: 1px solid oklch(var(--fg) / 0.20); border-radius: var(--radius); padding: 0 44px 0 15px; font: inherit; font-size: 14.5px; color: oklch(var(--fg)); outline: none; transition: border-color .15s ease, box-shadow .15s ease, background .15s ease; }
.login-field input::placeholder { color: oklch(var(--muted-fg) / 0.6); }
.login-field input:focus { border-color: oklch(var(--primary)); background: oklch(var(--surface-raised)); box-shadow: 0 0 0 3px oklch(var(--primary) / 0.20), 0 0 30px oklch(var(--primary) / 0.15); }
.login-field input.login-input-error { border-color: oklch(var(--destructive)); }
.login-field input:disabled { opacity: .55; cursor: not-allowed; }
.login-field-error { margin-top: 6px; font-size: 12px; color: oklch(var(--destructive)); }

.login-eye { position: absolute; right: 13px; top: 50%; transform: translateY(-50%); background: none; border: 0; padding: 4px; cursor: pointer; color: oklch(var(--muted-fg)); transition: color .15s ease; display: flex; }
.login-eye:hover { color: oklch(var(--fg)); }

.login-row { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; }
.login-remember { display: flex; align-items: center; gap: 8px; font-size: 13px; color: oklch(var(--muted-fg)); cursor: pointer; user-select: none; }
.login-remember input { accent-color: oklch(var(--primary)); width: 15px; height: 15px; cursor: pointer; }
.login-link { color: oklch(var(--primary)); text-decoration: none; font: inherit; font-size: 13px; font-weight: 500; transition: opacity .15s ease; }
.login-link:hover { opacity: .8; text-decoration: underline; }

.login-error-server { margin-top: 14px; font-size: 13px; padding: 10px 12px; border-radius: var(--radius); background: oklch(var(--destructive) / 0.14); border: 1px solid oklch(var(--destructive) / 0.3); color: oklch(var(--destructive)); }

.login-btn { margin-top: 22px; width: 100%; height: 50px; display: inline-flex; align-items: center; justify-content: center; gap: 10px; background: linear-gradient(135deg, oklch(var(--primary)), oklch(var(--primary) / 0.78)); color: oklch(var(--primary-fg)); border: 0; border-radius: var(--radius); font: inherit; font-size: 15px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; cursor: pointer; position: relative; overflow: hidden; transition: transform .12s ease, box-shadow .12s ease, filter .12s ease; }
.login-btn::before { content: ''; position: absolute; inset: 0; background: linear-gradient(105deg, transparent 40%, oklch(var(--primary-fg) / 0.18) 50%, transparent 60%); transform: translateX(-130%); transition: transform .5s ease; }
.login-btn:hover:not(:disabled)::before { transform: translateX(130%); }
.login-btn:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-2px); box-shadow: 0 12px 32px oklch(var(--primary) / 0.4); }
.login-btn:hover:not(:disabled) svg { transform: translateX(4px); }
.login-btn:active:not(:disabled) { transform: translateY(0); }
.login-btn:disabled { opacity: .55; cursor: not-allowed; }
.login-btn svg { transition: transform .15s ease; }
.login-btn-ghost { background: transparent; color: oklch(var(--fg)); border: 1px solid oklch(var(--fg) / 0.2); }
.login-btn-ghost:hover:not(:disabled) { background: oklch(var(--fg) / 0.06); filter: none; box-shadow: none; }
.login-spin { animation: login-spin 1s linear infinite; }
@keyframes login-spin { to { transform: rotate(360deg); } }

.login-register-cta { margin-top: 20px; text-align: center; font-size: 13.5px; color: oklch(var(--muted-fg)); }
.login-register-cta button { background: none; border: 0; padding: 0; cursor: pointer; font: inherit; font-weight: 700; color: oklch(var(--primary)); }
.login-register-cta button:hover { text-decoration: underline; }

.login-confirm { padding: 8px 0; text-align: center; }
.login-confirm .login-confirm-icon { display: inline-flex; padding: 12px; border-radius: 50%; background: oklch(var(--success) / 0.14); color: oklch(var(--success)); margin-bottom: 14px; }
.login-confirm h2 { font-family: Orbitron, sans-serif; font-size: 17px; font-weight: 800; color: oklch(var(--fg)); margin-bottom: 8px; }
.login-confirm p { font-size: 13.5px; color: oklch(var(--muted-fg)); line-height: 1.6; margin-bottom: 20px; }
`
