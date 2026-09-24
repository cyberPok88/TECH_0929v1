'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRAR PAGO NOTA — Abono con historial (Guía 1.4 · rediseño)
// Inserta en `pagos_nota` (append-only) y deriva saldo/estado de la nota
// (por pagar → parcial → pagada). Método + referencia obligatoria si no es
// efectivo (schema). El historial de pagos vive en la ficha de la nota.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { registrarPagoNota } from '@/lib/actions/notas-compra'
import type { MetodoPago } from '@/types/notas-compra'
import { OPCIONES_METODO_PAGO, TEXTO_METODO_PAGO } from '@/types/notas-compra'

function formatearMXN(monto: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto)
}

export interface NotaParaPago {
    id: string
    folio: string
    total: number
    saldo_pendiente: number
}

interface RegistrarPagoNotaDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    nota: NotaParaPago | null
    onGuardado?: () => void
}

export function RegistrarPagoNotaDialog({ open, onOpenChange, nota, onGuardado }: RegistrarPagoNotaDialogProps) {
    const [monto, setMonto] = useState('')
    const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
    const [referencia, setReferencia] = useState('')
    const [notas, setNotas] = useState('')
    const [cargando, setCargando] = useState(false)
    const [errorServidor, setErrorServidor] = useState<string | null>(null)

    const alAbrir = (abierto: boolean) => {
        onOpenChange(abierto)
        if (abierto) {
            setMonto('')
            setMetodo('efectivo')
            setReferencia('')
            setNotas('')
            setErrorServidor(null)
        }
    }

    const manejarEnvio = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!nota) return
        setCargando(true)
        setErrorServidor(null)
        const respuesta = await registrarPagoNota(nota.id, {
            monto,
            metodo,
            referencia_bancaria: referencia,
            notas,
        })
        setCargando(false)
        if (!respuesta.success) {
            setErrorServidor(respuesta.error ?? 'No se pudo registrar el pago.')
            return
        }
        toast.success('Pago registrado')
        onGuardado?.()
        onOpenChange(false)
    }

    const saldo = nota?.saldo_pendiente ?? 0
    const total = nota?.total ?? 0
    const montoNum = Number(monto) || 0
    const nuevoSaldo = Math.max(0, saldo - montoNum)

    return (
        <Dialog open={open} onOpenChange={alAbrir}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Registrar pago — {nota?.folio ?? ''}</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-1 rounded-md border border-border bg-surface px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Total de la nota {formatearMXN(total)}</span>
                    <span className="text-xs text-muted-foreground">
                        Saldo pendiente:{' '}
                        <span className="font-mono font-semibold tabular-nums text-foreground">
                            {formatearMXN(saldo)}
                        </span>
                    </span>
                </div>

                <form onSubmit={manejarEnvio} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">Monto del pago *</Label>
                        <Input
                            inputMode="decimal"
                            value={monto}
                            onChange={(e) => setMonto(e.target.value)}
                            placeholder="0.00"
                            autoFocus
                            disabled={cargando}
                        />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">Método *</Label>
                            <Select
                                value={metodo}
                                onValueChange={(v) => setMetodo(v as MetodoPago)}
                                disabled={cargando}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {OPCIONES_METODO_PAGO.map((m) => (
                                        <SelectItem key={m} value={m}>
                                            {TEXTO_METODO_PAGO[m]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">Referencia</Label>
                            <Input
                                value={referencia}
                                onChange={(e) => setReferencia(e.target.value)}
                                placeholder={metodo === 'efectivo' ? 'Opcional' : 'Obligatoria'}
                                disabled={cargando}
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">Notas</Label>
                        <Input
                            value={notas}
                            onChange={(e) => setNotas(e.target.value)}
                            placeholder="Opcional"
                            disabled={cargando}
                        />
                    </div>

                    {saldo > 0 && montoNum > 0 && (
                        <p className="text-xs text-muted-foreground">
                            Nuevo saldo:{' '}
                            <span className="font-mono font-semibold tabular-nums text-foreground">
                                {formatearMXN(nuevoSaldo)}
                            </span>
                            {nuevoSaldo === 0 && ' — la nota quedará pagada.'}
                        </p>
                    )}

                    {errorServidor && (
                        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            {errorServidor}
                        </p>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={cargando}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={cargando}>
                            {cargando ? 'Registrando…' : 'Registrar pago'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
