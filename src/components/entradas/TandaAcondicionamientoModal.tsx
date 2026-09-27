'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// BANDEJA — ACONDICIONAMIENTO (Guía 1.6 · MEJORA 25/27 · decisión 22.g · MEJORA 32)
//
// El puesto del acondicionador trabaja sobre la **BANDEJA**: un grupo aprobado (partida + huella) que
// puede traer **varias tandas** ya liberadas. El usuario: *«como una bandeja donde si van entregando
// de revisión ahí se van agrupando si vienen de la misma entrada misma partida»*. Dos estados:
//   ① `por_limpiar`  → **Iniciar**                 (marca el inicio del trabajo físico)
//   ② `en_limpieza`  → **Terminar y entregar**     (pasa a la cola de cotejo del almacenista)
//
// ⭐ MEJORA 32 (25 Sep 2026 · usuario) — **el modal muestra SOLO lo que se va a acondicionar.**
// El usuario: *«abre modal, ese hay que modificarlo, solo muestra lo que va a acondicionar… y botón
// "tomar bandeja", que diga solo "iniciar"»*. Antes había un bloque «Origen» que repetía lo mismo que
// las cifras de arriba (las piezas otra vez, la partida, la marca) y una nota larga: se retiró. Queda
// **el producto**, **cuántas piezas** y **de qué tandas vienen** — el contenido del trabajo — más el
// estado. El botón dice **Iniciar** (antes «Tomar la bandeja (n)»).
//
// ⚠️ Lo que el usuario decidió que NO se pinta aquí (24 Sep): **quién liberó ni cuándo**. No son un
// dato para este puesto; viven en la bitácora y en el detalle de Revisión.
//
// ⚠️ La acción va acotada a **ESTA huella** (`id_partida_resuelta` + sus tandas), no a la tanda
// entera: `fn_liberar_avance` crea una tanda con N grupos, y mover por `id_tanda` arrastraba las
// marcas hermanas del mismo viaje (el bug reportado: *«al iniciar una tanda todas las otras inician»*).
//
// No resuelve SKU: eso es de Almacén (decisión 13 del mapa) y se ve en el alta.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, PackageOpen, Play } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Pildora } from '@/components/data-table'
import { Spinner } from '@/components/ui/spinner'

import { entregarBandeja, tomarBandeja } from '@/lib/actions/entradas'
import { productoDeBandeja } from '@/components/entradas/columnas-entrada'
import { TEXTO_ESTADO_TANDA, TONO_ESTADO_TANDA } from '@/types/entradas'
import type { BandejaLiberada } from '@/types/entradas'

interface TandaAcondicionamientoModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    bandeja: BandejaLiberada | null
    onGuardado?: () => void
}

export function TandaAcondicionamientoModal({
    open,
    onOpenChange,
    bandeja,
    onGuardado,
}: TandaAcondicionamientoModalProps) {
    const [cargando, setCargando] = useState(false)
    const enLimpieza = bandeja?.estado === 'en_limpieza'

    const accion = async () => {
        if (!bandeja) return
        setCargando(true)
        const res = enLimpieza
            ? await entregarBandeja(bandeja.id_partida_resuelta, bandeja.ids_tanda)
            : await tomarBandeja(bandeja.id_partida_resuelta, bandeja.ids_tanda)
        setCargando(false)
        if (!res.success) {
            toast.error(res.error ?? 'No se pudo avanzar la bandeja.')
            return
        }
        toast.success(
            enLimpieza
                ? `${bandeja.entrada_folio} · ${bandeja.piezas} pieza(s) entregadas al almacén`
                : `${bandeja.entrada_folio} · ${bandeja.piezas} pieza(s) en limpieza`
        )
        onGuardado?.()
        onOpenChange(false)
    }

    const cerrada = bandeja?.estado === 'en_almacen' || bandeja?.estado === 'confirmada'

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
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
                    <DialogTitle>
                        {enLimpieza ? 'Entregar al almacén' : 'Iniciar acondicionamiento'} —{' '}
                        {bandeja?.entrada_folio ?? ''}
                    </DialogTitle>
                </DialogHeader>

                {!bandeja ? (
                    <Spinner etiqueta="Cargando la bandeja…" className="py-4" />
                ) : (
                    <div className="space-y-4">
                        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            <span className="size-1.5 rounded-full bg-acc-entradas" aria-hidden="true" />
                            {productoDeBandeja(bandeja)}
                        </span>

                        {/* ── LO QUE SE VA A ACONDICIONAR, y nada más: las piezas y de qué tandas
                            vienen. El «origen» (partida declarada, marca) se retiró en la MEJORA 32:
                            repetía estas mismas cifras y no es lo que se trabaja aquí. ─────────── */}
                        <div className="flex flex-wrap items-end gap-x-8 gap-y-4 rounded-md border border-border bg-surface-raised p-3">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[28px] font-bold tabular-nums">
                                    {bandeja.piezas}
                                </span>
                                <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                                    {bandeja.piezas === 1 ? 'Pieza a acondicionar' : 'Piezas a acondicionar'}
                                </span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="flex flex-wrap items-center gap-1.5">
                                    {[...bandeja.tandas]
                                        .sort((a, b) => a - b)
                                        .map((n) => (
                                            <Pildora key={n} texto={`T${n}`} tono="neutro" />
                                        ))}
                                </span>
                                <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                                    {bandeja.tandas.length === 1
                                        ? 'Tanda que lo trae'
                                        : 'Tandas que lo traen — se limpian y se entregan juntas'}
                                </span>
                            </div>
                            <div className="ml-auto flex flex-col items-end gap-1">
                                <Pildora
                                    texto={TEXTO_ESTADO_TANDA[bandeja.estado]}
                                    tono={TONO_ESTADO_TANDA[bandeja.estado]}
                                />
                                <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                                    Estado
                                </span>
                            </div>
                        </div>

                        <p className="text-[12.5px] text-muted-foreground">
                            Sin SKU todavía: lo resuelve <b className="text-foreground">Almacén</b> al dar
                            el alta.
                        </p>
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
                        <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
                        Atrás
                    </Button>
                    <Button
                        type="button"
                        className="min-h-[56px] flex-1 px-6 text-[16px] font-semibold sm:flex-none"
                        onClick={accion}
                        disabled={cargando || !bandeja || cerrada}
                    >
                        {cargando && <Spinner className="mr-2 text-primary-foreground" />}
                        {enLimpieza ? (
                            <>
                                <PackageOpen className="mr-1.5 h-4 w-4" aria-hidden="true" />
                                {cargando ? 'Entregando…' : 'Terminar y entregar'}
                            </>
                        ) : (
                            <>
                                <Play className="mr-1.5 h-4 w-4" aria-hidden="true" />
                                {cargando ? 'Iniciando…' : 'Iniciar'}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
