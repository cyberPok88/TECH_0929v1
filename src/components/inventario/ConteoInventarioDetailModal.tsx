'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { obtenerConteo } from '@/lib/actions/inventario'
import type { ConteoInventarioDetalle } from '@/types/inventario'
import { TEXTO_ESTADO_CONTEO } from '@/types/inventario'
import type { ConteoInventario } from '@/types/inventario'

interface ConteoInventarioDetailModalProps {
    conteo: ConteoInventario | null
    open: boolean
    onOpenChange: (abierto: boolean) => void
}

function fechaCorta(fecha: string): string {
    const [a, m, d] = fecha.split('-')
    return a && m && d ? `${d}/${m}/${a}` : fecha
}

export function ConteoInventarioDetailModal({
    conteo,
    open,
    onOpenChange,
}: ConteoInventarioDetailModalProps) {
    const [detalle, setDetalle] = useState<ConteoInventarioDetalle | null>(null)

    useEffect(() => {
        if (!open || !conteo) return
        let activo = true
        void obtenerConteo(conteo.id).then((res) => {
            if (!activo || !res.success || !res.data) return
            setDetalle(res.data)
        })
        return () => {
            activo = false
        }
    }, [open, conteo])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Conteo — {detalle ? fechaCorta(detalle.fecha_conteo) : ''}</DialogTitle>
                </DialogHeader>

                {detalle && (
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap gap-3 text-sm">
                            <span className="rounded-md border border-border px-2 py-1">
                                Estado: <strong>{TEXTO_ESTADO_CONTEO[detalle.estado]}</strong>
                            </span>
                            <span className="rounded-md border border-border px-2 py-1">
                                Ubicación: <strong>{detalle.ubicacion_nombre ?? '—'}</strong>
                            </span>
                            <span className="rounded-md border border-border px-2 py-1">
                                Renglones: <strong>{detalle.renglones.length}</strong>
                            </span>
                        </div>

                        {detalle.notas && <p className="text-sm text-muted-foreground">{detalle.notas}</p>}

                        <div className="overflow-auto rounded-md border border-border">
                            <table className="w-full text-sm">
                                <thead className="bg-surface text-center text-xs uppercase text-muted-foreground">
                                    <tr>
                                        <th className="px-3 py-2">Producto</th>
                                        <th className="px-3 py-2 text-center">Sistema</th>
                                        <th className="px-3 py-2 text-center">Contado</th>
                                        <th className="px-3 py-2 text-center">Diferencia</th>
                                    </tr>
                                </thead>
                                <tbody className="text-center">
                                    {detalle.renglones.map((r) => {
                                        const sistema = r.stock_sistema ?? 0
                                        const diff = Number(r.cantidad_contada) - sistema
                                        return (
                                            <tr key={r.id} className="border-t border-border">
                                                <td className="px-3 py-2">
                                                    {r.producto_nombre}
                                                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                                                        {r.producto_sku}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-center font-mono tabular-nums">{sistema}</td>
                                                <td className="px-3 py-2 text-center font-mono tabular-nums">
                                                    {r.cantidad_contada}
                                                </td>
                                                <td
                                                    className={`px-3 py-2 text-center font-mono tabular-nums ${
                                                        diff === 0 ? '' : diff > 0 ? 'text-emerald-600' : 'text-destructive'
                                                    }`}
                                                >
                                                    {diff > 0 ? `+${diff}` : diff}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
