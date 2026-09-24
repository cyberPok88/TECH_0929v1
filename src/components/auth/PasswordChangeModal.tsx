'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PASSWORD CHANGE MODAL — Guía 0.11 · cambio de contraseña del usuario logueado
// Envuelve <PasswordChangeForm /> (el mismo componente de la Parte 3) en un
// Radix Dialog: la pantalla de perfil ya no expone el formulario siempre
// visible, lo abre bajo demanda con un botón.
//
// Patrón UserModal (0.9): el estado del form vive en PasswordChangeForm, que
// Radix monta SOLO mientras el Dialog está abierto (lo desmonta al cerrar) —
// cada apertura nace limpio y no hace falta resetearlo con efectos.
//
// La advertencia de riesgo usa el lenguaje del proyecto (contrato 0.11):
// si se pierde la nueva contraseña, la salida es la recuperación por correo.
// ═══════════════════════════════════════════════════════════════════════════════

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PasswordChangeForm } from './PasswordChangeForm'

interface PasswordChangeModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function PasswordChangeModal({ open, onOpenChange }: PasswordChangeModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Cambiar contraseña</DialogTitle>
                    <DialogDescription>
                        Actualiza la contraseña de tu cuenta. La sesión actual se mantiene
                        activa durante el cambio.
                    </DialogDescription>
                </DialogHeader>

                {/* ── Advertencia de riesgo ───────────────────────────── */}
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    Si olvidas tu nueva contraseña, tendrás que usar la recuperación por
                    correo para volver a entrar. Guarda la nueva contraseña en un lugar
                    seguro.
                </div>

                {/* El form nace limpio en cada apertura (Radix desmonta el
                    contenido al cerrar) — ver header del componente. */}
                <PasswordChangeForm />
            </DialogContent>
        </Dialog>
    )
}
