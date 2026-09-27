'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// AVANCE DE LA REVISIÓN — la puerta de la píldora «En revisión técnica» (Guía 1.6 · Fase 1)
//
// ⭐ MEJORA 24 Sep 2026 (usuario): *«en la columna estado aparece la píldora del estado, en las que
// aparece en revisión técnica que sea un link para abrir modal para mostrar el avance de la
// revisión … en la etapa 2 se resuelve cómo mostrar la tabla de los detalles de los ítems»*.
//
// Tres decisiones, y las tres son del pedido:
//  ① **La píldora es la puerta** (L3: todo número accionable es una puerta). Recepción no revisa,
//    pero necesita saber **cuánto lleva** el técnico sin salir de su cola: el mismo patrón que ya
//    estrenaron la DEV («n malas») y el Final pendiente. La píldora no cambia de forma: se envuelve
//    (precedente MEJORA 12).
//  ② **La tabla es la de la Fase 2**, no una copia: `PartidasAvance` es la MISMA superficie que el
//    técnico despliega en su cola (partida · huella de la revisión · recibidas · revisadas con
//    barra · aprobadas · DEV · faltan · estado). Dos vistas distintas del mismo avance serían dos
//    maneras de mentir.
//  ③ **Solo lectura.** Desde Recepción no se inicia ni se libera nada: aquí no se pintan controles
//    que no hacen nada (SISTEMA_COMPONENTES §8). Las acciones siguen en la fila de Recepción (DEV ·
//    Final · Nota) y en la cola del técnico.
//
// ⚠️ El avance de la ENTRADA se resume arriba en una línea —«5/7 revisadas» + barra + aprobadas,
// DEV y faltan— porque es el número que la píldora NO dice (a la píldora de Recepción se le quitó
// el tiempo en días a propósito; el detalle vive aquí, no en la fila de todos).
//
// ⚠️ Carga SIN `setState` sincrónico en el efecto (regla `react-hooks/set-state-in-effect`): el
// padre lo monta con `key={entrada.id}`, así que cada apertura es un montaje nuevo y «cargando» es
// simplemente `partidas === null`. Mismo patrón que `AjusteDevModal`.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { BarraAvance } from '@/components/entradas/columnas-entrada'
import { PartidasAvance } from '@/components/entradas/PartidasAvance'
import { listarPartidasConAvance } from '@/lib/actions/entradas'
import type { Entrada, PartidaConAvance } from '@/types/entradas'

interface AvanceRevisionModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    entrada: Entrada | null
}

export function AvanceRevisionModal({ open, onOpenChange, entrada }: AvanceRevisionModalProps) {
    /** `null` = todavía no llegó (es el estado «cargando», no un booleano aparte). */
    const [partidas, setPartidas] = useState<PartidaConAvance[] | null>(null)

    useEffect(() => {
        if (!open || !entrada) return
        let activo = true
        void listarPartidasConAvance(entrada.id).then((r) => {
            if (activo) setPartidas(r.success ? (r.data ?? []) : [])
        })
        return () => {
            activo = false
        }
    }, [open, entrada])

    // El avance de la entrada se suma de las partidas (no de los agregados del listado): es el
    // mismo dato que acaba de leer el modal, así que no puede contradecir la tabla de abajo.
    const lista = partidas ?? []
    const recibidas = lista.reduce((s, p) => s + p.cantidad_original, 0)
    const revisadas = lista.reduce((s, p) => s + p.revisadas, 0)
    const aprobadas = lista.reduce((s, p) => s + p.aprobadas, 0)
    const dev = lista.reduce((s, p) => s + p.dev_cantidad, 0)
    const liberadas = lista.reduce((s, p) => s + p.liberadas, 0)
    const faltan = Math.max(0, recibidas - revisadas)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
                <DialogHeader className="flex-row items-center gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="min-h-11 shrink-0 gap-1.5 px-3 text-[14px]"
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        Atrás
                    </Button>
                    <DialogTitle>Avance de la revisión — {entrada?.folio ?? ''}</DialogTitle>
                </DialogHeader>

                {entrada === null ? null : partidas === null ? (
                    <Spinner etiqueta="Leyendo el avance de la revisión…" className="py-4" />
                ) : partidas.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Esta entrada no tiene partidas.</p>
                ) : (
                    <div className="space-y-3">
                        {/* ① El avance de la ENTRADA en una línea: el número que la píldora no dice. */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-border bg-surface-2 px-3 py-2.5">
                            <span className="flex items-baseline gap-1 text-[18px] font-semibold tabular-nums">
                                {revisadas}
                                <span className="text-[13px] font-normal text-muted-foreground">
                                    /{recibidas}
                                </span>
                            </span>
                            <BarraAvance
                                aprobadas={aprobadas}
                                dev={dev}
                                total={recibidas}
                                liberadas={liberadas}
                            />
                            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                                revisadas · {aprobadas} aprobadas · DEV {dev}
                                {liberadas > 0 ? ` · ${liberadas} liberadas` : ''} · faltan {faltan}
                            </span>
                        </div>

                        {/* ② La MISMA tabla de ítems de la Fase 2, en solo lectura. */}
                        <PartidasAvance entrada={entrada} partidas={partidas} />
                    </div>
                )}

                <DialogFooter className="gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        className="min-h-[52px] px-5 text-[15px]"
                        onClick={() => onOpenChange(false)}
                    >
                        Cerrar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
