'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// USER MODAL — Guía 0.9 · Smart Component (Parte 3: crear + editar)
// Un solo modal con prop `mode` (Decisión 14). En 'editar' el correo es de solo
// lectura (Decisión 7) y no hay contraseña. En 'crear' muestra las credenciales
// UNA sola vez (Decisión 4).
//
// ⭐ FIX 02 Sep 2026 — el estado del formulario vive en UserModalContenido, que
// se monta CONDICIONALMENTE con `{open && ...}` (no basta el "remount" de Radix:
// el DialogContent desmonta su DOM, pero NO el componente React hijo del Dialog —
// ver la nota junto al montaje). Cada apertura nace limpio y no hace falta
// resetearlo con setState en un efecto (la regla
// react-hooks/set-state-in-effect lo prohíbe — FIX 19 Ago 2026, mismo patrón
// que el Bloque 4 de la Parte 2; el montaje condicional lo hace cierto).
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Copy, Check, RefreshCw, Loader2, KeyRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/sonner'

import { PasswordRequirements } from '@/components/auth/PasswordRequirements'
import { validarPassword } from '@/lib/validations/password'
import { usuarioCrearSchema, usuarioEditarSchema } from '@/lib/validations/usuarios'
import type { UsuarioCrearInput, UsuarioEditarInput } from '@/lib/validations/usuarios'
import { generarPassword } from '@/lib/utils/password-gen'
import { crearUsuario, editarUsuario } from '@/lib/actions/usuarios'
import type { RolOpcion, UsuarioLista } from '@/types/usuarios'

interface UserModalProps {
    mode: 'crear' | 'editar'
    usuario?: UsuarioLista | null
    roles: RolOpcion[]
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

const CREAR_INICIAL: UsuarioCrearInput = {
    nombre_completo: '',
    email: '',
    telefono: '',
    id_rol: '',
    password: '',
    es_activo: true,
}

const EDITAR_INICIAL: UsuarioEditarInput = {
    nombre_completo: '',
    telefono: '',
    id_rol: '',
    es_activo: true,
}

export function UserModal({ mode, usuario, roles, open, onOpenChange, onSuccess }: UserModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/*
                ⭐ FIX 02 Sep 2026 — montaje CONDICIONAL del contenido.
                La nota del FIX 19 Ago afirmaba que "Radix desmonta el contenido al
                cerrar" — eso es cierto para el DOM del DialogContent, pero NO para
                el componente React hijo del <Dialog>: UserModalContenido (con su
                estado credenciales/enviando/errorServidor) quedaba SIEMPRE montado
                y el panel "Usuario creado" reaparecía al reabrir tras un alta
                (mismo defecto conceptual que CatalogoModalBase · FIX 26 Ago 0.8).
                Con `{open && ...}` el contenido se monta SOLO con el modal abierto:
                cada apertura nace limpio, sin setState en efectos.
            */}
            {open && (
                <UserModalContenido
                    mode={mode}
                    usuario={usuario}
                    roles={roles}
                    onOpenChange={onOpenChange}
                    onSuccess={onSuccess}
                />
            )}
        </Dialog>
    )
}

interface UserModalContenidoProps {
    mode: 'crear' | 'editar'
    usuario?: UsuarioLista | null
    roles: RolOpcion[]
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

// El estado vive aquí, montado SOLO cuando el Dialog está abierto (Radix lo
// desmonta al cerrar). Cada apertura nace limpio: no hay estado que limpiar.
function UserModalContenido({ mode, usuario, roles, onOpenChange, onSuccess }: UserModalContenidoProps) {
    const crearForm = useForm<UsuarioCrearInput>({
        resolver: zodResolver(usuarioCrearSchema),
        defaultValues: CREAR_INICIAL,
    })
    const editarForm = useForm<UsuarioEditarInput>({
        resolver: zodResolver(usuarioEditarSchema),
        defaultValues: EDITAR_INICIAL,
    })

    const [enviando, setEnviando] = useState(false)
    const [errorServidor, setErrorServidor] = useState('')
    // Solo alta: credenciales mostradas UNA vez (Decisión 4).
    const [credenciales, setCredenciales] = useState<{ email: string; password: string } | null>(null)
    const [copiado, setCopiado] = useState(false)

    const password = useWatch({ control: crearForm.control, name: 'password' }) ?? ''
    const passwordValidation = validarPassword(password)

    // Al montar (cada apertura): según el modo, sembrar contraseña (alta) o
    // precargar (edición). reset() de react-hook-form no es un setState de React
    // propio, así que no dispara react-hooks/set-state-in-effect.
    useEffect(() => {
        if (mode === 'crear') {
            crearForm.reset({ ...CREAR_INICIAL, password: generarPassword() })
        } else if (usuario) {
            editarForm.reset({
                nombre_completo: usuario.nombre_completo,
                telefono: usuario.telefono ?? '',
                id_rol: usuario.id_rol,
                es_activo: usuario.es_activo,
            })
        }
    }, [mode, usuario, crearForm, editarForm])

    const regenerar = () => crearForm.setValue('password', generarPassword(), { shouldValidate: true })

    const copiar = async () => {
        if (!credenciales) return
        try {
            await navigator.clipboard.writeText(credenciales.password)
            setCopiado(true)
            setTimeout(() => setCopiado(false), 2000)
        } catch {
            toast.error('No se pudo copiar. Selecciónala manualmente.')
        }
    }

    const cerrar = () => onOpenChange(false)

    const onCrear = async (data: UsuarioCrearInput) => {
        setEnviando(true)
        setErrorServidor('')
        try {
            const res = await crearUsuario(data)
            if (!res.success) {
                setErrorServidor(res.error ?? 'No se pudo crear el usuario.')
                return
            }
            setCredenciales({ email: data.email.trim().toLowerCase(), password: data.password })
            toast.success('Usuario creado')
            onSuccess()
        } catch {
            setErrorServidor('Error de conexión. Intenta de nuevo.')
        } finally {
            setEnviando(false)
        }
    }

    const onEditar = async (data: UsuarioEditarInput) => {
        if (!usuario) return
        setEnviando(true)
        setErrorServidor('')
        try {
            const res = await editarUsuario(usuario.id, data)
            if (!res.success) {
                setErrorServidor(res.error ?? 'No se pudieron guardar los cambios.')
                return
            }
            toast.success('Cambios guardados')
            onSuccess()
            onOpenChange(false)
        } catch {
            setErrorServidor('Error de conexión. Intenta de nuevo.')
        } finally {
            setEnviando(false)
        }
    }

    return (
        <DialogContent className="sm:max-w-[520px]">
            {credenciales ? (
                // ── Panel de credenciales (solo tras un alta exitosa) ──
                <>
                    <DialogHeader>
                        <DialogTitle>Usuario creado</DialogTitle>
                        <DialogDescription>
                            Copia la contraseña ahora: no se volverá a mostrar. Compártela con la
                            persona para su primer acceso.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <div className="space-y-1">
                            <Label>Correo</Label>
                            <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
                                {credenciales.email}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label>Contraseña temporal</Label>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-sm">
                                    {credenciales.password}
                                </code>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={copiar}
                                    aria-label="Copiar contraseña"
                                >
                                    {copiado ? (
                                        <Check className="h-4 w-4 text-success" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" onClick={cerrar}>
                            Listo
                        </Button>
                    </DialogFooter>
                </>
            ) : mode === 'crear' ? (
                // ── Formulario de alta ──
                <form onSubmit={crearForm.handleSubmit(onCrear)} className="space-y-4" noValidate>
                    <DialogHeader>
                        <DialogTitle>Nuevo usuario</DialogTitle>
                        <DialogDescription>
                            Da de alta a una persona para que opere el sistema. El correo no podrá
                            cambiarse después.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2">
                        <Label htmlFor="nombre_completo">Nombre completo</Label>
                        <Input
                            id="nombre_completo"
                            autoFocus
                            disabled={enviando}
                            {...crearForm.register('nombre_completo')}
                        />
                        {crearForm.formState.errors.nombre_completo && (
                            <p className="text-xs text-destructive">
                                {crearForm.formState.errors.nombre_completo.message}
                            </p>
                        )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="email">Correo electrónico</Label>
                            <Input
                                id="email"
                                type="email"
                                autoComplete="off"
                                disabled={enviando}
                                {...crearForm.register('email')}
                            />
                            {crearForm.formState.errors.email && (
                                <p className="text-xs text-destructive">
                                    {crearForm.formState.errors.email.message}
                                </p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="telefono">
                                Teléfono <span className="text-muted-foreground">(opcional)</span>
                            </Label>
                            <Input
                                id="telefono"
                                type="tel"
                                disabled={enviando}
                                {...crearForm.register('telefono')}
                            />
                            {crearForm.formState.errors.telefono && (
                                <p className="text-xs text-destructive">
                                    {crearForm.formState.errors.telefono.message}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="id_rol">Rol</Label>
                        <Controller
                            control={crearForm.control}
                            name="id_rol"
                            render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange} disabled={enviando}>
                                    <SelectTrigger id="id_rol">
                                        <SelectValue placeholder="Selecciona un rol" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roles.map((r) => (
                                            <SelectItem key={r.id} value={r.id}>
                                                {r.nombre}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {crearForm.formState.errors.id_rol && (
                            <p className="text-xs text-destructive">
                                {crearForm.formState.errors.id_rol.message}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Contraseña temporal</Label>
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <KeyRound
                                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                                    aria-hidden="true"
                                />
                                <Input
                                    id="password"
                                    type="text"
                                    className="pl-9 font-mono"
                                    disabled={enviando}
                                    {...crearForm.register('password')}
                                />
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={regenerar}
                                disabled={enviando}
                                aria-label="Regenerar contraseña"
                            >
                                <RefreshCw className="h-4 w-4" />
                            </Button>
                        </div>
                        <PasswordRequirements validation={passwordValidation} show={password.length > 0} />
                        {crearForm.formState.errors.password && (
                            <p className="text-xs text-destructive">
                                {crearForm.formState.errors.password.message}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
                        <div>
                            <Label htmlFor="es_activo">Usuario activo</Label>
                            <p className="text-xs text-muted-foreground">Puede iniciar sesión desde el alta.</p>
                        </div>
                        <Controller
                            control={crearForm.control}
                            name="es_activo"
                            render={({ field }) => (
                                <Switch
                                    id="es_activo"
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    disabled={enviando}
                                />
                            )}
                        />
                    </div>

                    {errorServidor && (
                        <p className="rounded-lg border border-destructive/20 bg-destructive-bg px-4 py-2.5 text-sm text-destructive">
                            {errorServidor}
                        </p>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={cerrar} disabled={enviando}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={enviando || !passwordValidation.isValid}>
                            {enviando ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creando…
                                </>
                            ) : (
                                'Crear usuario'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            ) : (
                // ── Formulario de edición (correo de solo lectura, sin contraseña) ──
                <form onSubmit={editarForm.handleSubmit(onEditar)} className="space-y-4" noValidate>
                    <DialogHeader>
                        <DialogTitle>Editar usuario</DialogTitle>
                        <DialogDescription>
                            Actualiza los datos de la persona. El correo no puede cambiarse desde aquí.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2">
                        <Label htmlFor="edit_nombre_completo">Nombre completo</Label>
                        <Input
                            id="edit_nombre_completo"
                            autoFocus
                            disabled={enviando}
                            {...editarForm.register('nombre_completo')}
                        />
                        {editarForm.formState.errors.nombre_completo && (
                            <p className="text-xs text-destructive">
                                {editarForm.formState.errors.nombre_completo.message}
                            </p>
                        )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="edit_email">Correo electrónico</Label>
                            {/* Solo lectura (Decisión 7): NO registrado, no viaja en el submit. */}
                            <Input
                                id="edit_email"
                                type="email"
                                value={usuario?.email ?? ''}
                                readOnly
                                disabled
                                className="opacity-70"
                            />
                            <p className="text-xs text-muted-foreground">
                                El correo es la llave de acceso y no puede cambiarse aquí.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit_telefono">
                                Teléfono <span className="text-muted-foreground">(opcional)</span>
                            </Label>
                            <Input
                                id="edit_telefono"
                                type="tel"
                                disabled={enviando}
                                {...editarForm.register('telefono')}
                            />
                            {editarForm.formState.errors.telefono && (
                                <p className="text-xs text-destructive">
                                    {editarForm.formState.errors.telefono.message}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit_id_rol">Rol</Label>
                        <Controller
                            control={editarForm.control}
                            name="id_rol"
                            render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange} disabled={enviando}>
                                    <SelectTrigger id="edit_id_rol">
                                        <SelectValue placeholder="Selecciona un rol" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roles.map((r) => (
                                            <SelectItem key={r.id} value={r.id}>
                                                {r.nombre}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {editarForm.formState.errors.id_rol && (
                            <p className="text-xs text-destructive">
                                {editarForm.formState.errors.id_rol.message}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
                        <div>
                            <Label htmlFor="edit_es_activo">Usuario activo</Label>
                            <p className="text-xs text-muted-foreground">Si se desactiva, no podrá iniciar sesión.</p>
                        </div>
                        <Controller
                            control={editarForm.control}
                            name="es_activo"
                            render={({ field }) => (
                                <Switch
                                    id="edit_es_activo"
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    disabled={enviando}
                                />
                            )}
                        />
                    </div>

                    {errorServidor && (
                        <p className="rounded-lg border border-destructive/20 bg-destructive-bg px-4 py-2.5 text-sm text-destructive">
                            {errorServidor}
                        </p>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={cerrar} disabled={enviando}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={enviando}>
                            {enviando ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Guardando…
                                </>
                            ) : (
                                'Guardar cambios'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            )}
        </DialogContent>
    )
}
