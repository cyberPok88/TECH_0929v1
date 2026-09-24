'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// CAMBIAR ROL EN MASA — Guía 0.9 · ⭐ ENRIQUECIMIENTO 02 Sep 2026
// Diálogo bulk: reasigna el rol a los N usuarios seleccionados (Toolbar del Shell).
// Cero BD nueva: UPDATE id_rol bajo RLS (usuarios_admin_update exige admin).
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { toast } from '@/components/ui/sonner'
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
import { Button } from '@/components/ui/button'
import { cambiarRolUsuarios } from '@/lib/actions/usuarios'
import type { UsuarioLista, RolOpcion } from '@/types/usuarios'

interface CambiarRolDialogProps {
    usuarios: UsuarioLista[]
    roles: RolOpcion[]
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

export function CambiarRolDialog({
    usuarios,
    roles,
    open,
    onOpenChange,
    onSuccess,
}: CambiarRolDialogProps) {
    const [idRol, setIdRol] = useState('')
    const [enviando, setEnviando] = useState(false)

    async function confirmar() {
        if (!idRol || usuarios.length === 0) return
        setEnviando(true)
        try {
            const res = await cambiarRolUsuarios(usuarios.map((u) => u.id), idRol)
            if (!res.success) {
                toast.error(res.error ?? 'No se pudo cambiar el rol.')
                return
            }
            toast.success(`Rol actualizado para ${usuarios.length} usuario(s)`)
            setIdRol('')
            onOpenChange(false)
            onSuccess()
        } finally {
            setEnviando(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Cambiar rol</DialogTitle>
                    <DialogDescription>
                        Se cambiará el rol de {usuarios.length} usuario(s):{' '}
                        <span className="font-medium">
                            {usuarios.map((u) => u.nombre_completo).join(', ')}
                        </span>
                    </DialogDescription>
                </DialogHeader>

                <Select value={idRol} onValueChange={setIdRol}>
                    <SelectTrigger aria-label="Nuevo rol">
                        <SelectValue placeholder="Selecciona el nuevo rol" />
                    </SelectTrigger>
                    <SelectContent>
                        {roles.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                                {r.nombre}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={enviando}>
                        Cancelar
                    </Button>
                    <Button onClick={confirmar} disabled={!idRol || enviando}>
                        Cambiar rol
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
