'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// VER FICHA — Guía 0.9 · ⭐ ENRIQUECIMIENTO 02 Sep 2026
// Ficha read-only del usuario (patrón "Ver" de los CRUDs 1.0+): datos + rol +
// estado + fechas + badge "Admin principal". Cero BD nueva.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ReactNode } from 'react'
import { Crown } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Pildora } from '@/components/data-table'
import { formatearFechaHora } from '@/lib/utils/formatters'
import { estadoDeUsuario, TEXTO_ESTADO, TONO_ESTADO } from '@/types/usuarios'
import type { UsuarioLista } from '@/types/usuarios'

interface UserDetailModalProps {
    usuario: UsuarioLista | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

function Fila({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
    return (
        <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
            <span className="text-muted-foreground">{etiqueta}</span>
            <span className="font-medium">{children}</span>
        </div>
    )
}

export function UserDetailModal({ usuario, open, onOpenChange }: UserDetailModalProps) {
    if (!usuario) return null
    const estado = estadoDeUsuario(usuario)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {usuario.nombre_completo}
                        {usuario.es_admin_principal && (
                            <span
                                role="img"
                                aria-label="Admin principal"
                                title="Admin principal"
                                className="inline-flex items-center text-primary"
                            >
                                <Crown className="h-3.5 w-3.5" aria-hidden="true" />
                            </span>
                        )}
                    </DialogTitle>
                    <DialogDescription>Ficha del usuario · solo lectura</DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-3 py-2">
                    <Fila etiqueta="Correo">{usuario.email}</Fila>
                    <Fila etiqueta="Teléfono">{usuario.telefono ?? '—'}</Fila>
                    <Fila etiqueta="Rol">{usuario.rol_nombre}</Fila>
                    <Fila etiqueta="Estado">
                        <Pildora texto={TEXTO_ESTADO[estado]} tono={TONO_ESTADO[estado]} />
                    </Fila>
                    <Fila etiqueta="Creado el">{formatearFechaHora(usuario.created_at)}</Fila>
                    <Fila etiqueta="Actualizado el">{formatearFechaHora(usuario.updated_at)}</Fila>
                </div>
            </DialogContent>
        </Dialog>
    )
}
