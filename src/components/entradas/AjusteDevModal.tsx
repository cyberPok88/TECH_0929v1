'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// AJUSTE DEV MODAL — Validar DEV + ajustar + generar nota de compra (Guía 1.6 · P4)
// Camino A: el recepcionista valida la devolución, ajusta la partida (original vs
// vigente) y genera la NOTA DE COMPRA por las aprobadas (ajustarYGenerarNota).
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ajustarYGenerarNota, listarResultadoRevision } from '@/lib/actions/entradas'
import type { Entrada, ResultadoRevision } from '@/types/entradas'

interface AjusteDevModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    entrada: Entrada | null
    onGuardado?: () => void
}

export function AjusteDevModal({ open, onOpenChange, entrada, onGuardado }: AjusteDevModalProps) {
    const [resultado, setResultado] = useState<ResultadoRevision | null>(null)
    const [cargando, setCargando] = useState(false)
    const [folio, setFolio] = useState<string | null>(null)

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

    const ajustar = async () => {
        if (!entrada) return
        setCargando(true)
        const res = await ajustarYGenerarNota(entrada.id)
        setCargando(false)
        if (!res.success) {
            toast.error(res.error ?? 'No se pudo ajustar.')
            return
        }
        setFolio(res.data?.folio ?? null)
        toast.success(`Nota de compra ${res.data?.folio} generada`)
        onGuardado?.()
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Ajuste y nota de compra — {entrada?.folio ?? ''}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <section>
                        <h4 className="mb-1 text-sm font-semibold">Aprobadas (se pagarán)</h4>
                        {aprobadas.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Sin aprobadas.</p>
                        ) : (
                            <ul className="space-y-1 text-sm">
                                {aprobadas.map((a) => (
                                    <li key={a.id} className="flex justify-between">
                                        <span className="font-mono text-xs tabular-nums">{a.producto_sku ?? '—'}</span>
                                        <span className="tabular-nums">{a.cantidad_aprobada}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                    <section>
                        <h4 className="mb-1 text-sm font-semibold">Devoluciones (se ajustan)</h4>
                        {devoluciones.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Sin devoluciones.</p>
                        ) : (
                            <ul className="space-y-1 text-sm">
                                {devoluciones.map((d) => (
                                    <li key={d.id} className="flex justify-between">
                                        <span>{d.motivo_nombre ?? '—'}</span>
                                        <span className="tabular-nums">{d.cantidad} pza</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                    {folio && (
                        <p className="rounded border bg-muted/50 p-2 text-sm">
                            ✅ Nota <span className="font-mono tabular-nums">{folio}</span> generada y ligada a la entrada.
                        </p>
                    )}
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={cargando}>
                        Cerrar
                    </Button>
                    <Button type="button" onClick={ajustar} disabled={cargando || !!folio || aprobadas.length === 0}>
                        <FileText className="mr-1 h-4 w-4" />
                        {cargando ? 'Generando…' : 'Ajustar y generar nota'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
