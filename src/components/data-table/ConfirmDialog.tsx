"use client"

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIRM DIALOG — Confirmación de acciones destructivas (Radix AlertDialog)
// Guía 0.8 — Decisión 3: AlertDialog, no Dialog (accesibilidad + sin cierre overlay)
// Props controladas por el padre: open/onOpenChange/onConfirm
// onConfirm → Promise<{error?}> → toast de resultado (ui/sonner.tsx)
// ═══════════════════════════════════════════════════════════════════════════════

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"
import { TriangleAlert, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ConfirmDialogProps {
    /** Título del diálogo (ej: "Eliminar producto") */
    titulo: string
    /** Descripción con detalle de lo irreversible (ej: "El movimiento de historial quedará registrado") */
    descripcion: string
    /** Texto del botón de acción (default: "Eliminar") */
    confirmLabel?: string
    /** Texto del botón cancelar (default: "Cancelar") */
    cancelLabel?: string
    /** Variante visual — destructive es el caso seguro (Decisión 3). 'warning'
     *  es una severidad media (ampliación aditiva FIX 24 Ago 2026): operaciones
     *  que afectan varios registros pero no son irreversibles. */
    variant?: "destructive" | "default" | "outline" | "warning"
    /** Mientras es true: botones deshabilitados + Loader2 en confirmar */
    isLoading?: boolean
    /** Controlado por el padre */
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Devuelve {error?} — si hay error, toast.error; si no, toast.success */
    onConfirm: () => Promise<{ error: string | null }> | { error: string | null }
    /** Texto del toast de éxito (default: "Acción completada") — ⭐ MEJORA 20 Ago:
     *  permite un mensaje específico por acción sin duplicar toasts (el padre
     *  deja de tostear por su cuenta y pasa el mensaje aquí). */
    successMessage?: string
}

export function ConfirmDialog({
    titulo,
    descripcion,
    confirmLabel = "Eliminar",
    cancelLabel = "Cancelar",
    variant = "destructive",
    isLoading = false,
    open,
    onOpenChange,
    onConfirm,
    successMessage = "Acción completada",
}: ConfirmDialogProps) {
    // FIX 24 Ago 2026 — variante 'warning' (ampliación aditiva). Button no
    // expone 'warning', así que se compone sobre la base estructural de
    // 'destructive' (sólido + text-fg) y solo se cambia el fondo a --warning.
    // Usar 'destructive' como base es intencional: aporta la silueta de botón
    // de confirmación sin gradiente ni conflictos de hover. En CSS, bg-warning
    // vence a bg-destructive por orden alfabético de utilidades, y los
    // consumidores existentes (default/destructive/outline) no cambian.
    const esWarning = variant === "warning"

    async function handleConfirm() {
        try {
            // onConfirm puede ser sync o async — await cubre ambos
            const resultado = await onConfirm()

            if (resultado?.error) {
                toast.error(resultado.error)
            } else {
                toast.success(successMessage)
            }
        } catch {
            // Error inesperado (exception) → toast genérico de error
            toast.error("Ocurrió un error inesperado")
        }
    }

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="bg-surface-overlay border-border shadow-premium-lg">
                <AlertDialogHeader>
                    <div className="flex items-start gap-3">
                        <div
                            className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                                esWarning
                                    ? "bg-warning-bg text-warning"
                                    : "bg-destructive-bg text-destructive"
                            )}
                        >
                            <TriangleAlert className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div>
                            <AlertDialogTitle className="text-foreground">
                                {titulo}
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-muted-foreground">
                                {descripcion}
                            </AlertDialogDescription>
                        </div>
                    </div>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel asChild>
                        <Button variant="outline" disabled={isLoading}>
                            {cancelLabel}
                        </Button>
                    </AlertDialogCancel>
                    <AlertDialogAction asChild>
                        <Button
                            variant={esWarning ? "destructive" : variant}
                            className={cn(esWarning && "bg-warning")}
                            disabled={isLoading}
                            onClick={handleConfirm}
                            data-accion="confirmar"
                        >
                            {isLoading && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                            )}
                            {confirmLabel}
                        </Button>
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
