'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// DIVERGENCIA MODAL — Resolución del admin (Guía 1.6 · P7 · Smart)
// Muestra la divergencia (esperada vs encontrada + causa) y captura la cantidad
// AUTORIZADA por huella → `resolverDivergencia` (resuelve/persiste el SKU + alta).
// ⭐ Evolución V5 (20 Sep): el SKU lo resuelve el ALMACÉN (`SelectorSkuHuella`).
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { abrirCotejoAlta, resolverDivergencia } from '@/lib/actions/entradas'
import { SelectorSkuHuella } from '@/components/entradas/alta/SelectorSkuHuella'
import type { CotejoLinea, Divergencia } from '@/types/entradas'

interface DivergenciaModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    divergencia: Divergencia | null
    onGuardado?: () => void
}

const aTexto = (at: Record<string, unknown> | null | undefined): Record<string, string> =>
    Object.fromEntries(Object.entries(at ?? {}).map(([k, v]) => [k, String(v ?? '')]))

export function DivergenciaModal({ open, onOpenChange, divergencia, onGuardado }: DivergenciaModalProps) {
    const [lineas, setLineas] = useState<CotejoLinea[]>([])
    const [cantidades, setCantidades] = useState<Record<string, string>>({})
    const [skuSel, setSkuSel] = useState<Record<string, string>>({})
    const [cargando, setCargando] = useState(false)

    useEffect(() => {
        if (!open || !divergencia) return
        let activo = true
        void abrirCotejoAlta(divergencia.id_entrada).then((r) => {
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
    }, [open, divergencia])

    const resolver = async () => {
        if (!divergencia) return
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
        setCargando(true)
        const res = await resolverDivergencia(divergencia.id, lineasInput)
        setCargando(false)
        if (!res.success) {
            toast.error(res.error ?? 'No se pudo resolver.')
            return
        }
        toast.success('Divergencia resuelta — alta confirmada')
        onGuardado?.()
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Resolver divergencia — {divergencia?.entrada_folio ?? ''}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="rounded border p-3 text-sm">
                        <p>
                            <span className="text-muted-foreground">Esperado:</span>{' '}
                            <span className="tabular-nums">{divergencia?.cantidad_esperada}</span>
                        </p>
                        <p>
                            <span className="text-muted-foreground">Encontrado:</span>{' '}
                            <span className="tabular-nums">{divergencia?.cantidad_encontrada}</span>
                        </p>
                        <p>
                            <span className="text-muted-foreground">Causa:</span>{' '}
                            {divergencia?.causa_nombre ?? '—'}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold">Cantidad autorizada por huella</h4>
                        {lineas.map((l) => {
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
                                            <span className="text-xs text-muted-foreground">Autorizada</span>
                                            <Input
                                                type="number"
                                                className="w-24"
                                                min={0}
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
                        })}
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={cargando}>
                        Cerrar
                    </Button>
                    <Button type="button" onClick={resolver} disabled={cargando || lineas.length === 0}>
                        <ShieldCheck className="mr-1 h-4 w-4" />
                        {cargando ? 'Resolviendo…' : 'Resolver y confirmar alta'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
