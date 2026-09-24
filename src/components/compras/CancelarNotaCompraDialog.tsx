'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// CANCELAR NOTA COMPRA — Cancelación documental (Guía 1.4 · rediseño)
// Soft (sin DELETE): `es_cancelada` + motivo · reglas server: sin pagos y sin
// `recibida` · irreversible · el trigger excluye la nota del saldo del proveedor.
//
// Acepta 1..N notas (FIX VF 05 Sep): el listado cancela desde la selección
// (toolbar o ⋮) con un motivo ÚNICO para todas; la ficha pasa una sola.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cancelarNotaCompra } from '@/lib/actions/notas-compra'

interface NotaCancelable {
    id: string
    folio: string
}

interface CancelarNotaCompraDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** 1..N notas a cancelar — todas con el mismo motivo. */
    notas: NotaCancelable[] | null
    onGuardado?: () => void
}

export function CancelarNotaCompraDialog({ open, onOpenChange, notas, onGuardado }: CancelarNotaCompraDialogProps) {
    const [motivo, setMotivo] = useState('')
    const [cargando, setCargando] = useState(false)
    const [errorServidor, setErrorServidor] = useState<string | null>(null)

    const cantidad = notas?.length ?? 0
    const etiquetaFolios = cantidad === 1 ? (notas?.[0]?.folio ?? '') : `${cantidad} notas`

    const alAbrir = (abierto: boolean) => {
        onOpenChange(abierto)
        if (abierto) {
            setMotivo('')
            setErrorServidor(null)
        }
    }

    const manejarEnvio = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!notas || notas.length === 0) return
        setCargando(true)
        setErrorServidor(null)
        const resultados = await Promise.all(
            notas.map((n) => cancelarNotaCompra(n.id, { motivo }))
        )
        setCargando(false)
        const fallo = resultados.find((r) => !r.success)
        if (fallo) {
            setErrorServidor(fallo.error ?? 'No se pudieron cancelar todas las notas.')
            return
        }
        toast.success(
            cantidad === 1
                ? `Nota ${notas[0].folio} cancelada`
                : `${cantidad} notas canceladas`
        )
        onGuardado?.()
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={alAbrir}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Cancelar {etiquetaFolios}</DialogTitle>
                    <DialogDescription>
                        {cantidad === 1
                            ? 'La nota deja de ser exigible al proveedor y su saldo se excluye del «por pagar».'
                            : 'Las notas dejan de ser exigibles y sus saldos se excluyen del «por pagar» del proveedor.'}{' '}
                        <strong>Esta acción no se puede deshacer.</strong>
                    </DialogDescription>
                </DialogHeader>

                {cantidad > 1 && (
                    <p className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
                        Se cancelarán: {notas?.map((n) => n.folio).join(' · ')}
                    </p>
                )}

                <form onSubmit={manejarEnvio} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">
                            Motivo de la cancelación *
                        </Label>
                        <Input
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            placeholder="Ej. error de captura, se duplicó la nota…"
                            maxLength={300}
                            disabled={cargando}
                        />
                        <p className="text-[11px] text-muted-foreground">
                            Mínimo 5 caracteres · {cantidad === 1 ? 'quedará registrado en la nota' : 'quedará registrado en cada nota'}.
                        </p>
                    </div>

                    {errorServidor && (
                        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            {errorServidor}
                        </p>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={cargando}>
                            Volver
                        </Button>
                        <Button type="submit" variant="destructive" disabled={cargando}>
                            {cargando
                                ? 'Cancelando…'
                                : cantidad === 1
                                  ? 'Cancelar nota'
                                  : `Cancelar ${cantidad} notas`}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
