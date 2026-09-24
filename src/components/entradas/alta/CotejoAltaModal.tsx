'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// COTEJO ALTA MODAL — Cotejo físico + ingreso a inventario (Guía 1.6 · P6 · Smart)
// ⭐ Evolución V5 (20 Sep): la revisión dejó la HUELLA (marca + atributos), no el SKU.
// Aquí el almacenista RESUELVE EL SKU por huella (`SelectorSkuHuella`), captura la
// cantidad FÍSICA (default = aprobada) y confirma. `confirmarAlta` escribe el lote +
// movimiento (sube stock) y persiste el SKU en la huella.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PackagePlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { abrirCotejoAlta, confirmarAlta } from '@/lib/actions/entradas'
import { SelectorSkuHuella } from '@/components/entradas/alta/SelectorSkuHuella'
import type { CotejoLinea, Entrada } from '@/types/entradas'

interface CotejoAltaModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    entrada: Entrada | null
    onGuardado?: () => void
}

const aTexto = (at: Record<string, unknown> | null | undefined): Record<string, string> =>
    Object.fromEntries(Object.entries(at ?? {}).map(([k, v]) => [k, String(v ?? '')]))

export function CotejoAltaModal({ open, onOpenChange, entrada, onGuardado }: CotejoAltaModalProps) {
    const [lineas, setLineas] = useState<CotejoLinea[]>([])
    const [cantidades, setCantidades] = useState<Record<string, string>>({})
    const [skuSel, setSkuSel] = useState<Record<string, string>>({})
    const [cargando, setCargando] = useState(false)

    useEffect(() => {
        if (!open || !entrada) return
        let activo = true
        void abrirCotejoAlta(entrada.id).then((r) => {
            if (!activo || !r.success) return
            const ls = r.data?.lineas ?? []
            setLineas(ls)
            setCantidades(Object.fromEntries(ls.map((l) => [l.id_partida_resuelta, String(l.cantidad_aprobada)])))
            setSkuSel(
                Object.fromEntries(
                    ls.filter((l) => l.id_producto).map((l) => [l.id_partida_resuelta, l.id_producto as string])
                )
            )
        })
        return () => {
            activo = false
        }
    }, [open, entrada])

    const confirmar = async () => {
        if (!entrada) return
        const conCantidad = lineas.filter((l) => Number(cantidades[l.id_partida_resuelta] ?? 0) > 0)
        if (conCantidad.some((l) => !skuSel[l.id_partida_resuelta])) {
            toast.error('Resuelve el SKU de todas las líneas con cantidad.')
            return
        }
        const lineasInput = conCantidad.map((l) => ({
            id_partida_resuelta: l.id_partida_resuelta,
            id_producto: skuSel[l.id_partida_resuelta] ?? '',
            cantidad_fisica: Number(cantidades[l.id_partida_resuelta] ?? 0),
            costo_acordado: l.costo_acordado,
        }))
        if (lineasInput.length === 0) {
            toast.error('Ingresa al menos una cantidad física.')
            return
        }
        setCargando(true)
        const res = await confirmarAlta({ id_entrada: entrada.id, lineas: lineasInput })
        setCargando(false)
        if (!res.success) {
            toast.error(res.error ?? 'No se pudo ingresar a almacén.')
            return
        }
        toast.success('Ingreso a almacén realizado')
        onGuardado?.()
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Cotejo e ingreso — {entrada?.folio ?? ''}</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                    {lineas.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin piezas aprobadas por ingresar.</p>
                    ) : (
                        lineas.map((l) => {
                            const huella = [l.marca_nombre, ...Object.values(aTexto(l.atributos))]
                                .filter(Boolean)
                                .join(' · ')
                            return (
                                <div key={l.id_partida_resuelta} className="space-y-2 rounded border p-3">
                                    <div className="text-xs text-muted-foreground">
                                        Huella:{' '}
                                        <span className="font-medium text-foreground">{huella || '—'}</span> ·
                                        aprobadas <b className="text-foreground">{l.cantidad_aprobada}</b>
                                    </div>
                                    <div className="flex items-end gap-2">
                                        <div className="min-w-0 flex-1 space-y-1">
                                            <span className="text-xs text-muted-foreground">
                                                SKU (lo resuelve Almacén)
                                            </span>
                                            <SelectorSkuHuella
                                                idCategoria={l.id_categoria}
                                                idMarca={l.id_marca}
                                                marcaNombre={l.marca_nombre}
                                                atributos={l.atributos}
                                                valor={skuSel[l.id_partida_resuelta] ?? ''}
                                                onChange={(id) =>
                                                    setSkuSel((prev) => ({ ...prev, [l.id_partida_resuelta]: id }))
                                                }
                                                disabled={cargando}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-xs text-muted-foreground">Física</span>
                                            <Input
                                                type="number"
                                                className="w-24"
                                                min={0}
                                                max={l.cantidad_aprobada}
                                                value={cantidades[l.id_partida_resuelta] ?? ''}
                                                onChange={(e) =>
                                                    setCantidades((prev) => ({
                                                        ...prev,
                                                        [l.id_partida_resuelta]: e.target.value,
                                                    }))
                                                }
                                            />
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={cargando}>
                        Cerrar
                    </Button>
                    <Button type="button" onClick={confirmar} disabled={cargando || lineas.length === 0}>
                        <PackagePlus className="mr-1 h-4 w-4" />
                        {cargando ? 'Ingresando…' : 'Ingresar a almacén'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
