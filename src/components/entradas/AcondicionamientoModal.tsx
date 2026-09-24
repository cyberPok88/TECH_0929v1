'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ACONDICIONAMIENTO MODAL — Prep físico (Guía 1.6 · P5 · Smart)
// Muestra las aprobadas y dispara tomar (→ en_acondicionamiento) o completar
// (→ en_almacén). No resuelve SKU: ese es trabajo de Almacén.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { completarAcondicionamiento, listarResultadoRevision, tomarAcondicionamiento } from '@/lib/actions/entradas'
import type { Entrada, ResultadoRevision } from '@/types/entradas'

interface AcondicionamientoModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    entrada: Entrada | null
    onGuardado?: () => void
}

export function AcondicionamientoModal({ open, onOpenChange, entrada, onGuardado }: AcondicionamientoModalProps) {
    const [resultado, setResultado] = useState<ResultadoRevision | null>(null)
    const [cargando, setCargando] = useState(false)

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
    const enAcondicionamiento = entrada?.estado === 'en_acondicionamiento'

    const accion = async () => {
        if (!entrada) return
        setCargando(true)
        const res = enAcondicionamiento
            ? await completarAcondicionamiento(entrada.id)
            : await tomarAcondicionamiento(entrada.id)
        setCargando(false)
        if (!res.success) {
            toast.error(res.error ?? 'No se pudo avanzar.')
            return
        }
        toast.success(enAcondicionamiento ? 'Acondicionamiento completado' : 'Tomada para acondicionar')
        onGuardado?.()
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Acondicionamiento — {entrada?.folio ?? ''}</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Piezas aprobadas (a acondicionar)</h4>
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
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={cargando}>
                        Cerrar
                    </Button>
                    <Button type="button" onClick={accion} disabled={cargando}>
                        {enAcondicionamiento ? 'Completar acondicionamiento' : 'Tomar para acondicionar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
