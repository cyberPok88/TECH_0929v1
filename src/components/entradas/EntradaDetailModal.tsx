'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ENTRADA DETAIL MODAL — Expediente de la entrada (Guía 1.6 · P2 · Smart)
// Vista read-only: cabecera + partidas declaradas (original vs vigente).
// Las pestañas Resultado/Devoluciones/Nota/Timeline se agregan en P3–P4.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { Check, Clock, FileDown } from 'lucide-react'

import { Pildora } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DocumentoImprimibleDialog } from '@/components/entradas/DocumentoImprimibleDialog'
import { NotaEntradaImprimible } from '@/components/entradas/NotaEntradaImprimible'
import { devPendiente } from '@/components/entradas/columnas-entrada'
import { listarPartidasEntrada } from '@/lib/actions/entradas'
import { cn } from '@/lib/utils'
import type { Entrada, PartidaEntrada } from '@/types/entradas'

function formatearMXN(monto: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto)
}

interface EntradaDetailModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    entrada: Entrada | null
}

export function EntradaDetailModal({ open, onOpenChange, entrada }: EntradaDetailModalProps) {
    const [partidas, setPartidas] = useState<PartidaEntrada[]>([])
    const [imprimir, setImprimir] = useState(false)

    useEffect(() => {
        if (!open || !entrada) return
        let activo = true
        void listarPartidasEntrada(entrada.id).then((res) => {
            if (!activo) return
            if (res.success) setPartidas(res.data ?? [])
        })
        return () => {
            activo = false
        }
    }, [open, entrada])

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>
                            {entrada?.folio ?? 'Entrada'} — {entrada?.proveedor_nombre ?? '—'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <span>Sin revisión: {entrada?.es_sin_revision ? 'Sí' : 'No'}</span>
                            <span>Origen: {entrada?.origen === 'directa' ? 'Nota directa' : 'Flujo'}</span>
                        </div>
                        {entrada?.notas && <p className="text-sm">{entrada.notas}</p>}

                        {/* ⭐ 22 Sep 2026 — misma lectura que la fila expandible y que la tabla:
                            declaradas · DEV · final. El costo agregado no se muestra (el del
                            flujo son PIEZAS; el costo por partida sí, abajo). */}
                        {entrada && (
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded border border-border bg-surface px-3 py-2 text-xs">
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">
                                        Partidas
                                    </span>
                                    <span className="font-semibold tabular-nums text-foreground">
                                        {entrada.partidas_count}
                                    </span>
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">
                                        PZ. RECIBIDAS
                                    </span>
                                    <span className="font-semibold tabular-nums text-foreground">
                                        {entrada.piezas_total}
                                    </span>
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">
                                        DEV
                                    </span>
                                    <span
                                        className={cn(
                                            'font-semibold tabular-nums',
                                            entrada.devolucion_total > 0 ? 'text-destructive' : 'text-foreground'
                                        )}
                                    >
                                        {entrada.devolucion_total > 0 ? `−${entrada.devolucion_total}` : '—'}
                                    </span>
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">
                                        Final
                                    </span>
                                    <span
                                        className={cn(
                                            'font-semibold tabular-nums',
                                            devPendiente(entrada) ? 'text-muted-foreground' : 'text-foreground'
                                        )}
                                        title={
                                            devPendiente(entrada)
                                                ? 'La DEV todavía no se ajusta: esta es la cantidad vigente hoy.'
                                                : undefined
                                        }
                                    >
                                        {entrada.piezas_vigentes}
                                    </span>
                                </span>
                            </div>
                        )}

                        <div className="rounded border">
                            <table className="w-full text-sm">
                                <thead className="border-b bg-muted/50 text-center text-muted-foreground">
                                    <tr>
                                        <th className="px-3 py-2">#</th>
                                        <th className="px-3 py-2">Clasificación</th>
                                        <th className="px-3 py-2">PZ. RECIBIDAS</th>
                                        <th className="px-3 py-2">DEV</th>
                                        <th className="px-3 py-2">Final</th>
                                        <th className="px-3 py-2">Costo</th>
                                        <th className="px-3 py-2">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {partidas.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">
                                                Sin partidas.
                                            </td>
                                        </tr>
                                    ) : (
                                        partidas.map((p) => (
                                            <tr key={p.id} className="border-b">
                                                <td className="px-3 py-2 text-center font-mono text-xs tabular-nums">{p.partida}</td>
                                                <td className="px-3 py-2 text-center">
                                                    {p.categoria_nombre ?? '—'}
                                                </td>
                                                <td className="px-3 py-2 text-center tabular-nums">{p.cantidad_original}</td>
                                                {/* ⭐ 22 Sep 2026 — DEV real de la partida (dato de la BD, no una resta). */}
                                                <td className="px-3 py-2 text-center">
                                                    {p.dev_cantidad > 0 ? (
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <Pildora texto={`−${p.dev_cantidad}`} tono="peligro" />
                                                            {p.dev_ajustada ? (
                                                                <Check className="size-3 text-success" aria-label="DEV ya ajustada" />
                                                            ) : (
                                                                <Clock className="size-3 text-warning" aria-label="DEV pendiente de ajuste" />
                                                            )}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-center font-semibold tabular-nums">
                                                    {p.cantidad_vigente}
                                                </td>
                                                <td className="px-3 py-2 text-center tabular-nums">{formatearMXN(p.costo_acordado)}</td>
                                                <td className="px-3 py-2 text-center">{p.estado_partida}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={!entrada}
                                onClick={() => setImprimir(true)}
                            >
                                <FileDown className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                                Imprimir / PDF
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            <DocumentoImprimibleDialog
                open={imprimir && entrada !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) setImprimir(false)
                }}
                titulo="Nota de entrada"
                nombreArchivo={`entrada-${entrada?.folio ?? 'sin-folio'}`}
            >
                {entrada ? <NotaEntradaImprimible entrada={entrada} partidas={partidas} /> : null}
            </DocumentoImprimibleDialog>
        </>
    )
}
