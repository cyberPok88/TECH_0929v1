'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// COTEJO ALTA MODAL — Cotejo físico + ingreso a inventario (Guía 1.6 · P6 · Smart)
// ⭐ Evolución V5 (20 Sep): la revisión dejó la HUELLA (marca + atributos), no el SKU.
// Aquí el almacenista RESUELVE EL SKU por huella (`SelectorSkuHuella`), captura la
// cantidad FÍSICA (default = la pendiente) y confirma. `confirmarAlta` / `confirmarAltaBandeja`
// escriben el lote + movimiento (sube stock) y persisten el SKU en la huella.
//
// ⭐ MEJORA 25 (24 Sep 2026 · decisión 22) — sirve a DOS sujetos con el mismo cuerpo:
//   · **la ENTRADA** (camino clásico) — coteja el **saldo no liberado**, no lo aprobado total:
//     las piezas que ya salieron por tanda subirían stock dos veces (decisión 22.b).
//   · **la TANDA** — coteja exactamente lo que el acondicionador entregó.
// Si no queda saldo, la entrada **igual cierra**: antes devolvía error y quedaba atorada en
// `en_almacen` para siempre. Diseño aprobado: mockup §7.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, PackagePlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { abrirCotejoAlta, abrirCotejoBandeja, confirmarAlta, confirmarAltaBandeja } from '@/lib/actions/entradas'
import { SelectorSkuHuella } from '@/components/entradas/alta/SelectorSkuHuella'
import type { BandejaLiberada, CotejoLinea, Entrada } from '@/types/entradas'

interface CotejoAltaModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Camino clásico: la entrada completa. */
    entrada: Entrada | null
    /** ⭐ MEJORA 25/27 — camino de la BANDEJA (tandas del mismo producto). Si viene, manda él. */
    bandeja?: BandejaLiberada | null
    onGuardado?: () => void
}

const aTexto = (at: Record<string, unknown> | null | undefined): Record<string, string> =>
    Object.fromEntries(Object.entries(at ?? {}).map(([k, v]) => [k, String(v ?? '')]))

export function CotejoAltaModal({ open, onOpenChange, entrada, bandeja, onGuardado }: CotejoAltaModalProps) {
    // `null` = todavía no llegó: el loader se DERIVA de ahí (no se escribe estado en el efecto).
    const [lineas, setLineas] = useState<CotejoLinea[] | null>(null)
    const [cantidades, setCantidades] = useState<Record<string, string>>({})
    const [skuSel, setSkuSel] = useState<Record<string, string>>({})
    const [cargando, setCargando] = useState(false)

    useEffect(() => {
        if (!open) return
        if (!entrada && !bandeja) return
        let activo = true
        const promesa = bandeja ? abrirCotejoBandeja(bandeja.ids_tanda) : abrirCotejoAlta((entrada as Entrada).id)
        void promesa.then((r) => {
            if (!activo) return
            if (!r.success) {
                toast.error(r.error ?? 'No se pudo abrir el cotejo.')
                setLineas([])
                return
            }
            const ls = r.data?.lineas ?? []
            setLineas(ls)
            // El default es la cantidad PENDIENTE (lo que falta por dar de alta), no lo aprobado.
            setCantidades(
                Object.fromEntries(ls.map((l) => [l.id_partida_resuelta, String(l.cantidad_pendiente)]))
            )
            setSkuSel(
                Object.fromEntries(
                    ls.filter((l) => l.id_producto).map((l) => [l.id_partida_resuelta, l.id_producto as string])
                )
            )
        })
        return () => {
            activo = false
        }
    }, [open, entrada, bandeja])

    const cargandoLineas = lineas === null
    const filas = lineas ?? []
    const pendienteTotal = filas.reduce((s, l) => s + Number(l.cantidad_pendiente ?? 0), 0)
    const yaAlta = filas.reduce(
        (s, l) => s + Math.max(0, Number(l.cantidad_aprobada) - Number(l.cantidad_pendiente)),
        0
    )
    /** Sin saldo por cotejar: la acción es CERRAR (todo salió por tandas), no ingresar. */
    const soloCerrar = filas.length > 0 && pendienteTotal === 0

    const confirmar = async () => {
        const conCantidad = filas.filter((l) => Number(cantidades[l.id_partida_resuelta] ?? 0) > 0)
        if (conCantidad.some((l) => !skuSel[l.id_partida_resuelta])) {
            toast.error('Resuelve el SKU de todas las líneas con cantidad.')
            return
        }

        setCargando(true)
        if (bandeja) {
            const lineasInput = conCantidad.map((l) => ({

                id_partida_resuelta: l.id_partida_resuelta,
                id_producto: skuSel[l.id_partida_resuelta] ?? '',
                cantidad_fisica: Number(cantidades[l.id_partida_resuelta] ?? 0),
                costo_acordado: l.costo_acordado,
            }))
            if (lineasInput.length === 0) {
                setCargando(false)
                toast.error('Ingresa al menos una cantidad física.')
                return
            }
            const res = await confirmarAltaBandeja({ ids_tanda: bandeja.ids_tanda, lineas: lineasInput })
            setCargando(false)
            if (!res.success) {
                toast.error(res.error ?? 'No se pudo dar el alta a la bandeja.')
                return
            }
            toast.success(`${bandeja.entrada_folio} · ${lineasInput.reduce((s, l) => s + l.cantidad_fisica, 0)} pieza(s) dadas de alta`)
        } else if (entrada) {
            const lineasInput = conCantidad.map((l) => ({
                id_partida_resuelta: l.id_partida_resuelta,
                id_producto: skuSel[l.id_partida_resuelta] ?? '',
                cantidad_fisica: Number(cantidades[l.id_partida_resuelta] ?? 0),
                costo_acordado: l.costo_acordado,
            }))
            const res = await confirmarAlta({ id_entrada: entrada.id, lineas: lineasInput })
            setCargando(false)
            if (!res.success) {
                toast.error(res.error ?? 'No se pudo ingresar a almacén.')
                return
            }
            toast.success(
                lineasInput.length === 0
                    ? `${entrada.folio} cerrada · todo su saldo ya había salido por tandas`
                    : 'Ingreso a almacén realizado'
            )
        }
        onGuardado?.()
        onOpenChange(false)
    }

    const titulo = bandeja
        ? `Cotejo y alta — ${bandeja.entrada_folio} · ${bandeja.tandas.map((n) => `T${n}`).join(' + ')}`
        : `Cotejo e ingreso — ${entrada?.folio ?? ''}`

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader className="flex-row items-center gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 shrink-0 gap-1.5 px-3 text-[14px]"
                        onClick={() => onOpenChange(false)}
                        disabled={cargando}
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        Atrás
                    </Button>
                    <DialogTitle>{titulo}</DialogTitle>
                </DialogHeader>

                {cargandoLineas ? (
                    <Spinner etiqueta="Leyendo lo que falta por cotejar…" className="py-4" />
                ) : (
                    <div className="space-y-3">
                        {/* ⭐ MEJORA 25 — la cuenta que impide subir stock dos veces. */}
                        {yaAlta > 0 && (
                            <p className="rounded-md border border-chart-4/40 bg-chart-4/10 px-3 py-2 text-[12.5px]">
                                <b>{yaAlta} pieza(s)</b> de esta entrada ya se dieron
                                de alta por tandas. Aquí se coteja solo el <b>saldo</b>.
                            </p>
                        )}
                        {soloCerrar && (
                            <p className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-[12.5px]">
                                Todo lo aprobado de <b>{entrada?.folio}</b> ya entró a almacén por tandas. Esta
                                confirmación solo <b>cierra la entrada</b>.
                            </p>
                        )}

                        {filas.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Sin piezas aprobadas por ingresar.</p>
                        ) : (
                            filas.map((l) => {
                                const huella = [l.marca_nombre, ...Object.values(aTexto(l.atributos))]
                                    .filter(Boolean)
                                    .join(' · ')
                                const sinSaldo = Number(l.cantidad_pendiente ?? 0) <= 0
                                return (
                                    <div
                                        key={l.id_partida_resuelta}
                                        className="space-y-2 rounded border p-3"
                                    >
                                        <div className="text-xs text-muted-foreground">
                                            Huella:{' '}
                                            <span className="font-medium text-foreground">{huella || '—'}</span> ·
                                            pendientes{' '}
                                            <b className="text-foreground">{l.cantidad_pendiente}</b>
                                            {sinSaldo && <span className="text-chart-4"> · ya en almacén</span>}
                                        </div>
                                        {!sinSaldo && (
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
                                                            setSkuSel((prev) => ({
                                                                ...prev,
                                                                [l.id_partida_resuelta]: id,
                                                            }))
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
                                                        max={l.cantidad_pendiente}
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
                                        )}
                                    </div>
                                )
                            })
                        )}
                    </div>
                )}

                <DialogFooter className="gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        className="min-h-[52px] px-5 text-[15px]"
                        onClick={() => onOpenChange(false)}
                        disabled={cargando}
                    >
                        Cerrar
                    </Button>
                    <Button
                        type="button"
                        className="min-h-[56px] flex-1 px-6 text-[16px] font-semibold sm:flex-none"
                        onClick={confirmar}
                        disabled={cargando || cargandoLineas || filas.length === 0}
                    >
                        {cargando ? (
                            <Spinner className="mr-2 text-primary-foreground" />
                        ) : (
                            <PackagePlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                        )}
                        {cargando
                            ? 'Ingresando…'
                            : soloCerrar
                              ? 'Cerrar la entrada'
                              : `Dar alta a ${pendienteTotal} pieza(s)`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
