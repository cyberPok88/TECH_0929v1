'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// RESULTADO REVISION MODAL — Aprobadas por SKU + devoluciones (Guía 1.6 · P3 · Smart)
// Read-only. Consume listarResultadoRevision.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { listarResultadoRevision } from '@/lib/actions/entradas'
import type { Entrada, ResultadoRevision } from '@/types/entradas'

interface ResultadoRevisionModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    entrada: Entrada | null
}

export function ResultadoRevisionModal({ open, onOpenChange, entrada }: ResultadoRevisionModalProps) {
    const [resultado, setResultado] = useState<ResultadoRevision | null>(null)

    useEffect(() => {
        if (!open || !entrada) return
        let activo = true
        void listarResultadoRevision(entrada.id).then((r) => {
            if (activo && r.success) setResultado(r.data ?? null)
        })
        return () => {
            activo = false
        }
    }, [open, entrada])

    const aprobadas = resultado?.aprobadas ?? []
    const devoluciones = resultado?.devoluciones ?? []

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Resultado de revisión — {entrada?.folio ?? ''}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <section>
                        {/* ⭐ Evolución V5 (20 Sep): la revisión produce la HUELLA (marca + atributos);
                            el SKU se resuelve en Almacén (por eso puede venir vacío aquí). */}
                        <h4 className="mb-1 text-sm font-semibold">Aprobadas (huella — el SKU lo asigna Almacén)</h4>
                        {aprobadas.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Sin aprobadas.</p>
                        ) : (
                            <div className="rounded border">
                                <table className="w-full text-sm">
                                    <thead className="border-b bg-muted/50 text-center text-muted-foreground">
                                        <tr>
                                            <th className="px-3 py-2">Marca</th>
                                            <th className="px-3 py-2 text-left">Atributos</th>
                                            <th className="px-3 py-2">SKU</th>
                                            <th className="px-3 py-2">Cant.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {aprobadas.map((a) => (
                                            <tr key={a.id} className="border-b">
                                                <td className="px-3 py-2 text-center">{a.marca_nombre ?? '—'}</td>
                                                <td className="px-3 py-2 text-xs text-muted-foreground">
                                                    {Object.values(a.atributos ?? {})
                                                        .filter(Boolean)
                                                        .join(' · ') || '—'}
                                                </td>
                                                <td className="px-3 py-2 text-center font-mono text-xs tabular-nums">
                                                    {a.producto_sku ?? '— (Almacén)'}
                                                </td>
                                                <td className="px-3 py-2 text-center tabular-nums">{a.cantidad_aprobada}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                    <section>
                        <h4 className="mb-1 text-sm font-semibold">Devoluciones (por motivo)</h4>
                        {devoluciones.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Sin devoluciones.</p>
                        ) : (
                            <div className="rounded border">
                                <table className="w-full text-sm">
                                    <thead className="border-b bg-muted/50 text-center text-muted-foreground">
                                        <tr>
                                            <th className="px-3 py-2">Motivo</th>
                                            <th className="px-3 py-2">Cant.</th>
                                            <th className="px-3 py-2">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {devoluciones.map((d) => (
                                            <tr key={d.id} className="border-b">
                                                <td className="px-3 py-2 text-center">{d.motivo_nombre ?? '—'}</td>
                                                <td className="px-3 py-2 text-center tabular-nums">{d.cantidad}</td>
                                                <td className="px-3 py-2 text-center">{d.estado === 'ajustada' ? 'Ajustada' : 'Por cotejar'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </div>
            </DialogContent>
        </Dialog>
    )
}
