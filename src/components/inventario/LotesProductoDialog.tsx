'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// LOTES PRODUCTO DIALOG — lotes de un producto (Guía 1.5 · desde Existencias)
// Solo lectura. La tabla la PUEBLA Entradas 1.6 al confirmar el alta; 1.5 la
// descuenta con las salidas FIFO. Dialog controlado por `open` (permanece montado).
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { listarLotesPorProducto } from '@/lib/actions/inventario'
import type { LoteInventario } from '@/types/inventario'
import type { ExistenciaProducto } from '@/types/inventario'

function fechaCorta(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface LotesProductoDialogProps {
    producto: ExistenciaProducto | null
    open: boolean
    onOpenChange: (abierto: boolean) => void
}

export function LotesProductoDialog({ producto, open, onOpenChange }: LotesProductoDialogProps) {
    const [lotes, setLotes] = useState<LoteInventario[]>([])
    // '' = sin carga previa · otro valor = producto al que pertenece `lotes`
    const [cargadoId, setCargadoId] = useState('')

    // ¿Mostrar loading? Primera apertura, o producto distinto al ya cargado.
    const cargando = open && producto !== null && cargadoId !== producto.id_producto

    useEffect(() => {
        if (!open || !producto) return
        let activo = true
        void listarLotesPorProducto(producto.id_producto).then((res) => {
            if (!activo) return
            if (!res.success) {
                setLotes([])
                setCargadoId(producto.id_producto)
                return
            }
            setLotes(res.data ?? [])
            setCargadoId(producto.id_producto)
        })
        return () => {
            activo = false
        }
    }, [open, producto])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Lotes — {producto?.nombre ?? ''}</DialogTitle>
                    <DialogDescription>
                        Existencia de {producto?.sku ?? ''} por lote de entrada. Los lotes los crea
                        Entradas (1.6) al confirmar el alta; las salidas los descuentan por FIFO.
                    </DialogDescription>
                </DialogHeader>

                {cargando && (
                    <p className="py-6 text-center text-sm text-muted-foreground">Cargando lotes…</p>
                )}
                {!cargando && cargadoId !== '' && lotes.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                        Este producto aún no tiene lotes de entrada.
                    </p>
                )}

                {!cargando && lotes.length > 0 && (
                    <div className="overflow-auto rounded-md border border-border">
                        <table className="w-full text-sm">
                            <thead className="bg-surface text-center text-xs uppercase text-muted-foreground">
                                <tr>
                                    <th className="px-3 py-2">Fecha</th>
                                    <th className="px-3 py-2 text-center">Original</th>
                                    <th className="px-3 py-2 text-center">Disponible</th>
                                    <th className="px-3 py-2 text-center">Costo</th>
                                    <th className="px-3 py-2">Ubicación</th>
                                </tr>
                            </thead>
                            <tbody className="text-center">
                                {lotes.map((l) => (
                                    <tr key={l.id} className="border-t border-border">
                                        <td className="px-3 py-2">{fechaCorta(l.fecha_entrada)}</td>
                                        <td className="px-3 py-2 text-center font-mono tabular-nums">
                                            {l.cantidad_original}
                                        </td>
                                        <td className="px-3 py-2 text-center font-mono tabular-nums">
                                            {l.cantidad_disponible}
                                        </td>
                                        <td className="px-3 py-2 text-center font-mono tabular-nums">
                                            {l.costo_unitario === null ? '—' : `$${l.costo_unitario}`}
                                        </td>
                                        <td className="px-3 py-2">{l.ubicacion_nombre ?? '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
