'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIRMAR ACCION DIALOG — kit 0.8 (PROMOCIÓN 04 Sep 2026 · actualizar-guia)
// Origen: local de Proveedores 1.1 (Guía 1.1 · P4). 2º consumidor: Productos 1.2
// (Parte 5 · masivas/archivar). Contrato: GUIAS/08 Esquema del Kit.
//
// Misma mecánica que los modales del proyecto (instancia SIEMPRE montada, cierre
// normal por `open` vía onOpenChange — nunca desmontar ni auto-cierre de Radix a
// mitad de la animación): después de confirmar/cancelar la página sigue operativa.
//
// Se usa en vez del ConfirmDialog del kit (AlertDialog) para acciones de
// confirmación: el auto-cierre del AlertDialogAction dejaba el overlay colgado
// (página "congelada" hasta recargar). El diálogo NO cierra solo: al terminar
// emite onOpenChange(false) y el padre controla el estado (patrón 0.9/0.10).
//
// Props: controlado por el padre (open/onOpenChange) · onConfirm devuelve
// { error: string | null } · toasts de resultado internos (successMessage).
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { TriangleAlert, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ConfirmarAccionDialogProps {
    open: boolean
    titulo: string
    descripcion: string
    confirmLabel?: string
    cancelLabel?: string
    /** 'destructive' (retiro/borrado) o 'default' (toggle). */
    variant?: 'destructive' | 'default'
    /** Toast de éxito tras confirmar (default: "Acción completada"). */
    successMessage?: string
    onOpenChange: (open: boolean) => void
    onConfirm: () => Promise<{ error: string | null }>
}

export function ConfirmarAccionDialog({
    open,
    titulo,
    descripcion,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    variant = 'default',
    successMessage = 'Acción completada',
    onOpenChange,
    onConfirm,
}: ConfirmarAccionDialogProps) {
    const [enviando, setEnviando] = useState(false)

    const confirmar = async () => {
        setEnviando(true)
        try {
            const resultado = await onConfirm()
            if (resultado?.error) {
                toast.error(resultado.error)
                return
            }
            toast.success(successMessage)
            onOpenChange(false)
        } catch {
            toast.error('Ocurrió un error inesperado')
        } finally {
            setEnviando(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(o) => !enviando && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-start gap-3">
                        <div
                            className={
                                variant === 'destructive'
                                    ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive-bg text-destructive'
                                    : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning-bg text-warning'
                            }
                        >
                            <TriangleAlert className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <div>
                            <DialogTitle>{titulo}</DialogTitle>
                            <DialogDescription>{descripcion}</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>
                <DialogFooter className="gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={enviando}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        type="button"
                        variant={variant}
                        onClick={() => void confirmar()}
                        disabled={enviando}
                        data-accion="confirmar"
                    >
                        {enviando && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                        )}
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
