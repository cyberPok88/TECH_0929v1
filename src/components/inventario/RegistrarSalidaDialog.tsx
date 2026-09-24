'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRAR SALIDA DIALOG — salida manual (Guía 1.5 · desde la fila de Existencias)
// Producto fijo de la fila · consume lotes por FIFO (SA) · NS si maneja serie ·
// motivo con causa. Estado local + reset en `alAbrir` (patrón 1.4 — setState solo
// en handlers, nunca síncrono en effects).
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { registrarSalidaManual } from '@/lib/actions/inventario'
import type { MotivoSalidaManual } from '@/types/inventario'
import { OPCIONES_MOTIVO_SALIDA, TEXTO_MOTIVO_SALIDA } from '@/types/inventario'
import type { ExistenciaProducto } from '@/types/inventario'

interface RegistrarSalidaDialogProps {
    producto: ExistenciaProducto | null
    open: boolean
    onOpenChange: (abierto: boolean) => void
    onSuccess?: () => void
}

export function RegistrarSalidaDialog({
    producto,
    open,
    onOpenChange,
    onSuccess,
}: RegistrarSalidaDialogProps) {
    const [cantidad, setCantidad] = useState('')
    const [motivo, setMotivo] = useState<MotivoSalidaManual>('merma_tardia')
    const [numeroSerie, setNumeroSerie] = useState('')
    const [cargando, setCargando] = useState(false)
    const [errorServidor, setErrorServidor] = useState<string | null>(null)

    const manejarAbierto = (abierto: boolean) => {
        onOpenChange(abierto)
        if (abierto) {
            setCantidad('')
            setMotivo('merma_tardia')
            setNumeroSerie('')
            setErrorServidor(null)
        }
    }

    const requiereNs = producto?.maneja_numero_serie === true
    const stockDisponible = producto?.stock_actual ?? 0

    const guardar = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!producto) return
        const n = Number(cantidad)
        if (!cantidad || Number.isNaN(n) || n <= 0) {
            setErrorServidor('Indica una cantidad mayor a 0.')
            return
        }
        if (n > stockDisponible) {
            setErrorServidor(`Stock insuficiente: hay ${stockDisponible} y pides ${n}.`)
            return
        }
        if (requiereNs && numeroSerie.trim() === '') {
            setErrorServidor('Este producto maneja número de serie — indica el NS que sale.')
            return
        }

        setCargando(true)
        setErrorServidor(null)
        const res = await registrarSalidaManual({
            id_producto: producto.id_producto,
            cantidad,
            motivo,
            numero_serie: numeroSerie,
            notas: '',
        })
        setCargando(false)
        if (!res.success) {
            setErrorServidor(res.error ?? 'No se pudo registrar la salida.')
            return
        }
        toast.success('Salida registrada — el stock se actualizó.')
        onSuccess?.()
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={manejarAbierto}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Registrar salida manual</DialogTitle>
                    <DialogDescription>
                        Da de baja stock con causa (merma tardía · corrección). La salida consume los
                        lotes más antiguos primero (FIFO) y queda en el libro de inventario.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={guardar} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1 rounded-md border border-border bg-surface px-3 py-2 text-sm">
                        <span className="font-medium">{producto?.nombre ?? '—'}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                            {producto?.sku} · Stock disponible:{' '}
                            <span className="font-semibold tabular-nums text-foreground">
                                {stockDisponible}
                            </span>
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">Cantidad *</Label>
                            <Input
                                type="number"
                                min={1}
                                step={1}
                                value={cantidad}
                                onChange={(e) => setCantidad(e.target.value)}
                                placeholder="0"
                                autoFocus
                                disabled={cargando}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">Motivo *</Label>
                            <Select
                                value={motivo}
                                onValueChange={(v) => setMotivo(v as MotivoSalidaManual)}
                                disabled={cargando}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {OPCIONES_MOTIVO_SALIDA.map((m) => (
                                        <SelectItem key={m} value={m}>
                                            {TEXTO_MOTIVO_SALIDA[m]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {requiereNs && (
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">
                                Número de serie que sale <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                value={numeroSerie}
                                onChange={(e) => setNumeroSerie(e.target.value)}
                                placeholder="NS de la pieza que sale…"
                                disabled={cargando}
                            />
                        </div>
                    )}

                    {errorServidor && <p className="text-sm text-destructive">{errorServidor}</p>}

                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={cargando}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={cargando || !producto}>
                            {cargando ? 'Registrando…' : 'Registrar salida'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
