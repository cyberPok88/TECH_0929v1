'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// CANCELAR NOTA REMISION DIALOG — deshacer una venta (Guía 1.8 · Parte 5)
//
// ⭐ DECIR EN VOZ ALTA QUÉ VA A PASAR: el inventario vuelve, la cuenta se cierra con
//    un asiento inverso y los NS quedan libres. Es IRREVERSIBLE — el usuario tiene que
//    saberlo ANTES de confirmar, no después.
// ⚠️ Sin ese aviso, quien cancela cree que deshace UN DOCUMENTO y en realidad está
//    MOVIENDO INVENTARIO Y ABRIENDO UN ASIENTO. Enterarse después es lo que convierte
//    una corrección en un descuadre.
// ⚠️ El diálogo NO comprueba el permiso: lo impone `b8` con `tiene_permiso_accion(…,
//    'eliminar')` en su primera línea — la capa que NO se puede esquivar.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { toast } from 'sonner'
import { TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cancelarNotaRemision } from '@/lib/actions/ventas'
import { formatearMoneda } from '@/lib/utils/formatters'
import type { NotaRemisionDetalle } from '@/types/ventas'

interface CancelarNotaRemisionDialogProps {
    open: boolean
    onOpenChange: (abierto: boolean) => void
    nota: NotaRemisionDetalle | null
    /** La cancelación se aplicó: el listado y la ficha se refrescan. */
    onCambio: () => void
}

export function CancelarNotaRemisionDialog({
    open,
    onOpenChange,
    nota,
    onCambio,
}: CancelarNotaRemisionDialogProps) {
    const [motivo, setMotivo] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [cancelando, setCancelando] = useState(false)

    const cerrar = (abierto: boolean) => {
        if (!abierto) {
            setMotivo('')
            setError(null)
        }
        onOpenChange(abierto)
    }

    const confirmar = async () => {
        if (!nota) return
        if (motivo.trim().length === 0) {
            setError('Indica el motivo de la cancelación.')
            return
        }
        setCancelando(true)
        const res = await cancelarNotaRemision(nota.id, { id: nota.id, motivo_cancelacion: motivo })
        setCancelando(false)

        if (!res.success) {
            // ⭐ Los mensajes de b8 ya vienen en español («…tiene cobros aplicados»)
            setError(res.error ?? 'No se pudo cancelar la nota.')
            return
        }

        toast.success(`Nota ${nota.folio} cancelada.`)
        onCambio()
        cerrar(false)
    }

    return (
        <Dialog open={open} onOpenChange={cerrar}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <TriangleAlert className="h-4 w-4 text-destructive" aria-hidden="true" />
                        Cancelar la nota {nota?.folio ?? ''}
                    </DialogTitle>
                    <DialogDescription>
                        La cancelación es <b>total e irreversible</b>. Esto es lo que va a pasar:
                    </DialogDescription>
                </DialogHeader>

                {/* ⭐ Los TRES efectos, dichos en el idioma del negocio */}
                <ul className="flex flex-col gap-1.5 rounded-md border border-border bg-surface-raised px-3 py-2.5 text-[13px]">
                    <li>
                        El <b>inventario vuelve</b>: entra de nuevo lo que esta nota sacó
                        {nota && nota.partidas.length > 0 ? ` (${nota.partidas.length} renglón(es))` : ''}.
                    </li>
                    <li>
                        La cuenta del cliente se cierra con un <b>asiento inverso</b> de{' '}
                        <b className="tabular-nums">{formatearMoneda(nota?.saldo_pendiente ?? 0)}</b>.
                    </li>
                    <li>
                        Los <b>números de serie quedan libres</b> y se pueden volver a vender.
                    </li>
                    <li className="text-muted-foreground">
                        La nota <b>no se borra</b>: queda con su folio y este motivo.
                    </li>
                </ul>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="motivo-cancelacion">Motivo *</Label>
                    <Input
                        id="motivo-cancelacion"
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        placeholder="Por qué se cancela (queda en el expediente de la nota)"
                        disabled={cancelando}
                    />
                </div>

                {error && <p className="text-[13px] text-destructive">{error}</p>}

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => cerrar(false)}
                        disabled={cancelando}
                    >
                        Volver
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={() => void confirmar()}
                        disabled={cancelando || !nota}
                    >
                        {cancelando ? 'Cancelando…' : 'Cancelar la nota'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
