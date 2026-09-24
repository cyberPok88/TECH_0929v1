'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ROLE MODAL — Guía 0.10 · Smart Component (Parte 3: crear + editar + duplicar)
// Un solo modal con prop `mode` (Decisión). 'crear' abre vacío; 'duplicar'
// pre-carga nombre "Copia de …" + nivel + descripción con clave VACÍA (R1) y
// permisos del origen (por prop); 'editar' precarga los datos con la clave de
// solo lectura (R1) y se BLOQUEA si es_editable = false (R3).
//
// ⭐ FIX 02 Sep 2026 — el estado vive en RoleModalContenido, que se monta
// CONDICIONALMENTE con `{open && ...}` (mismo FIX 4 de la 0.9: Radix desmonta
// el DOM del DialogContent, pero NO el componente React hijo del <Dialog>).
// Cada apertura nace limpio (la regla react-hooks/set-state-in-effect lo
// prohíbe — mismo patrón que la 0.9).
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Lock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/sonner'

import { rolCrearSchema, rolEditarSchema } from '@/lib/validations/roles'
import type { RolCrearInput, RolEditarInput } from '@/lib/validations/roles'
import { crearRol, editarRol } from '@/lib/actions/roles'
import type { RolLista, PermisoPayload } from '@/types/roles'

interface RoleModalProps {
    mode: 'crear' | 'editar' | 'duplicar'
    rol?: RolLista | null
    permisos?: PermisoPayload[]
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

const CREAR_INICIAL: RolCrearInput = {
    clave: '',
    nombre: '',
    nivel_jerarquico: 1,
    descripcion: '',
}

const EDITAR_INICIAL: RolEditarInput = {
    nombre: '',
    nivel_jerarquico: 1,
    descripcion: '',
}

export function RoleModal({ mode, rol, permisos, open, onOpenChange, onSuccess }: RoleModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/*
                ⭐ FIX 02 Sep 2026 — montaje CONDICIONAL del contenido (mismo FIX 4
                de la 0.9): con `{open && ...}` el estado (enviando/errorServidor)
                y el reset del form nacen limpios en cada apertura. Radix NO
                desmonta el componente React hijo del <Dialog> al cerrar.
            */}
            {open && (
                <RoleModalContenido
                    mode={mode}
                    rol={rol}
                    permisos={permisos}
                    onOpenChange={onOpenChange}
                    onSuccess={onSuccess}
                />
            )}
        </Dialog>
    )
}

interface RoleModalContenidoProps {
    mode: 'crear' | 'editar' | 'duplicar'
    rol?: RolLista | null
    permisos?: PermisoPayload[]
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

// El estado vive aquí, montado SOLO cuando el Dialog está abierto (montaje
// condicional). Cada apertura nace limpio: no hay estado que limpiar.
function RoleModalContenido({ mode, rol, permisos, onOpenChange, onSuccess }: RoleModalContenidoProps) {
    const crearForm = useForm<RolCrearInput>({
        resolver: zodResolver(rolCrearSchema),
        defaultValues: CREAR_INICIAL,
    })
    const editarForm = useForm<RolEditarInput>({
        resolver: zodResolver(rolEditarSchema),
        defaultValues: EDITAR_INICIAL,
    })

    const [enviando, setEnviando] = useState(false)
    const [errorServidor, setErrorServidor] = useState('')

    // Al montar (cada apertura): según el modo, sembrar el origen (duplicar),
    // precargar (editar) o dejar vacío (crear). reset() no dispara
    // react-hooks/set-state-in-effect.
    useEffect(() => {
        if (mode === 'duplicar' && rol) {
            crearForm.reset({
                clave: '',
                nombre: `Copia de ${rol.nombre}`,
                nivel_jerarquico: rol.nivel_jerarquico,
                descripcion: rol.descripcion ?? '',
            })
        } else if (mode === 'crear') {
            crearForm.reset(CREAR_INICIAL)
        } else if (mode === 'editar' && rol) {
            editarForm.reset({
                nombre: rol.nombre,
                nivel_jerarquico: rol.nivel_jerarquico,
                descripcion: rol.descripcion ?? '',
            })
        }
    }, [mode, rol, crearForm, editarForm])

    const cerrar = () => onOpenChange(false)

    const onCrear = async (data: RolCrearInput) => {
        setEnviando(true)
        setErrorServidor('')
        try {
            const res = await crearRol(data, mode === 'duplicar' ? permisos : undefined)
            if (!res.success) {
                setErrorServidor(res.error ?? 'No se pudo crear el rol.')
                return
            }
            toast.success(mode === 'duplicar' ? 'Rol duplicado' : 'Rol creado')
            onSuccess()
            onOpenChange(false)
        } catch {
            setErrorServidor('Error de conexión. Intenta de nuevo.')
        } finally {
            setEnviando(false)
        }
    }

    const onEditar = async (data: RolEditarInput) => {
        if (!rol) return
        setEnviando(true)
        setErrorServidor('')
        try {
            const res = await editarRol(rol.id, data)
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

    // Rol de sistema en edición → bloqueado (R3). La defensa real está en la Server Action.
    if (mode === 'editar' && rol && !rol.es_editable) {
        return (
            <DialogContent className="sm:max-w-[440px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Lock className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                        Rol de sistema
                    </DialogTitle>
                    <DialogDescription>
                        «{rol.nombre}» es un rol de sistema y no se puede modificar desde esta pantalla.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button type="button" onClick={cerrar}>
                        Cerrar
                    </Button>
                </DialogFooter>
            </DialogContent>
        )
    }

    return (
        <DialogContent className="sm:max-w-[520px]">
            {mode === 'editar' ? (
                <form onSubmit={editarForm.handleSubmit(onEditar)} className="space-y-4" noValidate>
                    <DialogHeader>
                        <DialogTitle>Editar rol</DialogTitle>
                        <DialogDescription>
                            Actualiza los datos del rol. La clave no puede cambiarse.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2">
                        <Label htmlFor="edit_nombre">Nombre</Label>
                        <Input
                            id="edit_nombre"
                            autoFocus
                            disabled={enviando}
                            {...editarForm.register('nombre')}
                        />
                        {editarForm.formState.errors.nombre && (
                            <p className="text-xs text-destructive">
                                {editarForm.formState.errors.nombre.message}
                            </p>
                        )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="edit_clave">Clave</Label>
                            {/* Solo lectura (R1): NO registrado, no viaja en el submit. */}
                            <Input
                                id="edit_clave"
                                value={rol?.clave ?? ''}
                                readOnly
                                disabled
                                className="opacity-70"
                            />
                            <p className="text-xs text-muted-foreground">
                                La clave es un contrato en código y no puede cambiarse.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit_nivel">Nivel jerárquico</Label>
                            <Input
                                id="edit_nivel"
                                type="number"
                                min={1}
                                step={1}
                                disabled={enviando}
                                {...editarForm.register('nivel_jerarquico', { valueAsNumber: true })}
                            />
                            {editarForm.formState.errors.nivel_jerarquico && (
                                <p className="text-xs text-destructive">
                                    {editarForm.formState.errors.nivel_jerarquico.message}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit_descripcion">
                            Descripción <span className="text-muted-foreground">(opcional)</span>
                        </Label>
                        <Textarea
                            id="edit_descripcion"
                            rows={3}
                            disabled={enviando}
                            {...editarForm.register('descripcion')}
                        />
                        {editarForm.formState.errors.descripcion && (
                            <p className="text-xs text-destructive">
                                {editarForm.formState.errors.descripcion.message}
                            </p>
                        )}
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
            ) : (
                <form onSubmit={crearForm.handleSubmit(onCrear)} className="space-y-4" noValidate>
                    <DialogHeader>
                        <DialogTitle>{mode === 'duplicar' ? 'Duplicar rol' : 'Nuevo rol'}</DialogTitle>
                        <DialogDescription>
                            {mode === 'duplicar'
                                ? 'Copia del rol original. Define una clave nueva y ajusta lo que necesites.'
                                : 'Crea un rol nuevo. Nace sin permisos: configúralos después desde el editor.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2">
                        <Label htmlFor="nombre">Nombre</Label>
                        <Input id="nombre" autoFocus disabled={enviando} {...crearForm.register('nombre')} />
                        {crearForm.formState.errors.nombre && (
                            <p className="text-xs text-destructive">
                                {crearForm.formState.errors.nombre.message}
                            </p>
                        )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="clave">Clave</Label>
                            <Input
                                id="clave"
                                autoComplete="off"
                                disabled={enviando}
                                {...crearForm.register('clave')}
                            />
                            <p className="text-xs text-muted-foreground">
                                Minúsculas, sin espacios. Es un contrato en código y no se cambia después.
                            </p>
                            {crearForm.formState.errors.clave && (
                                <p className="text-xs text-destructive">
                                    {crearForm.formState.errors.clave.message}
                                </p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="nivel_jerarquico">Nivel jerárquico</Label>
                            <Input
                                id="nivel_jerarquico"
                                type="number"
                                min={1}
                                step={1}
                                disabled={enviando}
                                {...crearForm.register('nivel_jerarquico', { valueAsNumber: true })}
                            />
                            <p className="text-xs text-muted-foreground">
                                1 = mayor jerarquía. La semilla usa 1/20/30/40/50/60/70.
                            </p>
                            {crearForm.formState.errors.nivel_jerarquico && (
                                <p className="text-xs text-destructive">
                                    {crearForm.formState.errors.nivel_jerarquico.message}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="descripcion">
                            Descripción <span className="text-muted-foreground">(opcional)</span>
                        </Label>
                        <Textarea
                            id="descripcion"
                            rows={3}
                            disabled={enviando}
                            {...crearForm.register('descripcion')}
                        />
                        {crearForm.formState.errors.descripcion && (
                            <p className="text-xs text-destructive">
                                {crearForm.formState.errors.descripcion.message}
                            </p>
                        )}
                    </div>

                    {mode === 'duplicar' && permisos && permisos.length > 0 && (
                        <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
                            Se copiarán los {permisos.length} permisos del rol original junto con el alta.
                        </p>
                    )}

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
                            ) : mode === 'duplicar' ? (
                                'Crear copia'
                            ) : (
                                'Crear rol'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            )}
        </DialogContent>
    )
}
