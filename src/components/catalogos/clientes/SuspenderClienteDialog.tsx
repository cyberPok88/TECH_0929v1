'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// SUSPENDER CLIENTE DIALOG — motivo obligatorio (Guía 1.3 · Parte 6 · Smart)
// D23: el bloqueo operativo impide vender/cobrar al cliente (lo leen 1.8/1.9).
// Fecha y usuario los pone el servidor (suspenderCliente) — CHECK de b1.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { suspenderCliente } from '@/lib/actions/clientes'

interface SuspenderClienteDialogProps {
    open: boolean
    clienteId: string | null
    nombreCliente: string
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

export function SuspenderClienteDialog({
    open,
    clienteId,
    nombreCliente,
    onOpenChange,
    onSuccess,
}: SuspenderClienteDialogProps) {
    const [motivo, setMotivo] = useState('')
    const [enviando, setEnviando] = useState(false)
    const [errorServidor, setErrorServidor] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return
        void Promise.resolve().then(() => {
            setMotivo('')
            setErrorServidor(null)
        })
    }, [open])

    const confirmar = async () => {
        if (!clienteId) return
        setEnviando(true)
        setErrorServidor(null)
        try {
            const res = await suspenderCliente(clienteId, motivo)
            if (!res.success) {
                setErrorServidor(res.error ?? 'No se pudo suspender el cliente.')
                return
            }
            toast.success('Cliente suspendido')
            onSuccess()
            onOpenChange(false)
        } finally {
            setEnviando(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(o) => !enviando && onOpenChange(o)}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Suspender cliente</DialogTitle>
                    <DialogDescription>
                        {nombreCliente} no podrá comprar ni se ofrecerá en ventas/cobros hasta
                        que levantes la suspensión. Motivo obligatorio.
                    </DialogDescription>
                </DialogHeader>

                {errorServidor && (
                    <div
                        role="alert"
                        className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                        <span>{errorServidor}</span>
                    </div>
                )}

                <div className="space-y-2">
                    <Label htmlFor="motivo_suspension">Motivo *</Label>
                    <Textarea
                        id="motivo_suspension"
                        rows={3}
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        disabled={enviando}
                        placeholder="Ej. saldo vencido mayor a 60 días"
                        autoFocus
                    />
                    <p className="text-xs text-muted-foreground">
                        Queda registrado en la bitácora del cliente (evento &quot;suspensión&quot;).
                    </p>
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={enviando}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        disabled={enviando || !motivo.trim()}
                        onClick={() => void confirmar()}
                    >
                        {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                        Suspender
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
