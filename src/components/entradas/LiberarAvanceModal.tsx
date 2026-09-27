'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// LIBERAR AVANCE A ACONDICIONAMIENTO — Guía 1.6 (MEJORA 25 · decisión 22 del mapa)
//
// El pedido del usuario: *«si ya se revisaron 20 discos o 10, se guarda y esos 10 ya pueden ser
// limpiados … y a almacén, para que esos 10 ya se puedan vender, en lo que el resto de la revisión
// concluye»*.
//
// Este modal es la puerta de esa entrega. Tres reglas que lo gobiernan:
//  ① **La unidad es el GRUPO (partida + huella)**, no la pieza suelta: es la misma agrupación que
//    ya usa `partidas_resueltas` y con la que Almacén resuelve el SKU (decisión 22.e).
//  ② **La cantidad es editable**: el caso de urgencia es «de 50, se necesitan 10» — si liberara el
//    grupo completo no habría forma de dejar 10 atrás (por eso se descartó la variante B).
//  ③ **Se confirma aparte**: la acción saca mercancía del expediente y merece un «¿seguro?». Se usa
//    el `ConfirmarAccionDialog` del kit — nunca un `AlertDialog` (su auto-cierre dejó el overlay
//    colgado; está escrito en la cabecera del propio componente).
//
// Diseño aprobado: `DOCS/design/entradas/liberacion-parcial-revision-acondicionamiento.html` §4.
// ⚠️ La entrada NO cambia de estado: sigue en `en_revision`. Lo que se mueve es la mercancía.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Minus, PackageCheck, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmarAccionDialog } from '@/components/ui/ConfirmarAccionDialog'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Pildora } from '@/components/data-table'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

import { liberarAvance, listarPartidasConAvance } from '@/lib/actions/entradas'
import { huellaDeclarada } from '@/components/entradas/columnas-entrada'
import type { Entrada, HuellaResuelta, PartidaConAvance } from '@/types/entradas'

interface LiberarAvanceModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    entrada: Entrada | null
    /** Si viene, el modal abre acotado a ESA partida (la puerta del desglose). */
    idPartidaFiltro?: string | null
    /**
     * ⭐ MEJORA 28 (decisión 22.h) — y si la partida rindió VARIAS marcas, acotado al **grupo**
     * (la huella): «Liberar 4» de Seagate y «Liberar 1» de ADATA son dos actos distintos.
     */
    idGrupoFiltro?: string | null
    onGuardado?: () => void
}

/** Un grupo de la partida con lo que le queda por liberar. */
interface GrupoLiberable {
    id_partida_resuelta: string
    partida: number
    id_categoria: string | null
    categoria_nombre: string | null
    atributos: Record<string, unknown>
    huella: HuellaResuelta
    /** Aprobadas − ya liberadas. */
    disponible: number
}

export function LiberarAvanceModal({
    open,
    onOpenChange,
    entrada,
    idPartidaFiltro,
    idGrupoFiltro,
    onGuardado,
}: LiberarAvanceModalProps) {
    // `null` = todavía no llegó (el loader se DERIVA de ahí: no se escribe estado en el efecto).
    const [partidas, setPartidas] = useState<PartidaConAvance[] | null>(null)
    const [guardando, setGuardando] = useState(false)
    const [confirmando, setConfirmando] = useState(false)
    /** `id_partida_resuelta` → piezas a liberar. */
    const [elegidas, setElegidas] = useState<Record<string, string>>({})

    useEffect(() => {
        if (!open || !entrada) return
        let activo = true
        void listarPartidasConAvance(entrada.id).then((r) => {
            if (!activo) return
            const ps = r.success ? (r.data ?? []) : []
            if (!r.success) toast.error(r.error ?? 'No se pudieron leer las partidas.')
            setPartidas(ps)
            // Default: TODO lo liberable de cada grupo — el caso más común es «mándalo ya».
            const inicial: Record<string, string> = {}
            for (const p of ps) {
                if (idPartidaFiltro && p.id !== idPartidaFiltro) continue
                for (const h of p.huellas) {
                    if (idGrupoFiltro && h.id_partida_resuelta !== idGrupoFiltro) continue
                    const libre = Math.max(0, h.cantidad_aprobada - h.cantidad_liberada)
                    if (libre > 0) inicial[h.id_partida_resuelta] = String(libre)
                }
            }
            setElegidas(inicial)
        })
        return () => {
            activo = false
        }
    }, [open, entrada, idPartidaFiltro, idGrupoFiltro])

    const cargando = partidas === null

    /** Los grupos con algo por liberar, ya con su tope. */
    const grupos = useMemo<GrupoLiberable[]>(() => {
        const out: GrupoLiberable[] = []
        for (const p of partidas ?? []) {
            if (idPartidaFiltro && p.id !== idPartidaFiltro) continue
            for (const h of p.huellas) {
                if (idGrupoFiltro && h.id_partida_resuelta !== idGrupoFiltro) continue
                const disponible = Math.max(0, h.cantidad_aprobada - h.cantidad_liberada)
                if (disponible <= 0) continue
                out.push({
                    id_partida_resuelta: h.id_partida_resuelta,
                    partida: p.partida,
                    id_categoria: p.id_categoria,
                    categoria_nombre: p.categoria_nombre,
                    atributos: p.atributos,
                    huella: h,
                    disponible,
                })
            }
        }
        return out
    }, [partidas, idPartidaFiltro, idGrupoFiltro])

    const items = useMemo(
        () =>
            grupos
                .map((g) => ({
                    id_partida_resuelta: g.id_partida_resuelta,
                    cantidad: Math.min(g.disponible, Math.max(0, Math.floor(Number(elegidas[g.id_partida_resuelta] ?? 0)))),
                }))
                .filter((i) => i.cantidad > 0),
        [grupos, elegidas]
    )
    const totalPiezas = items.reduce((s, i) => s + i.cantidad, 0)
    const yaLiberadas = (partidas ?? []).reduce((s, p) => s + p.liberadas, 0)
    const aprobadas = (partidas ?? []).reduce((s, p) => s + p.aprobadas, 0)

    const ajustar = (id: string, delta: number, tope: number) =>
        setElegidas((prev) => {
            const actual = Number(prev[id] ?? 0)
            return { ...prev, [id]: String(Math.max(0, Math.min(tope, actual + delta))) }
        })

    /**
     * Libera y devuelve el error (o `null`). Los toasts y el cierre del diálogo los maneja
     * `ConfirmarAccionDialog` — si aquí se cerrara también, la confirmación se pisaría a sí misma.
     */
    const guardar = async (): Promise<string | null> => {
        if (!entrada || items.length === 0) return 'No hay piezas por liberar.'
        setGuardando(true)
        const res = await liberarAvance({ id_entrada: entrada.id, items })
        setGuardando(false)
        if (!res.success) return res.error ?? 'No se pudo liberar el avance.'
        onGuardado?.()
        onOpenChange(false)
        return null
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader className="flex-row items-center gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            className="min-h-11 shrink-0 gap-1.5 px-3 text-[14px]"
                            onClick={() => onOpenChange(false)}
                            disabled={guardando}
                        >
                            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                            Atrás
                        </Button>
                        <DialogTitle>Liberar a acondicionamiento — {entrada?.folio ?? ''}</DialogTitle>
                    </DialogHeader>

                    {cargando ? (
                        <Spinner etiqueta="Leyendo el avance de la revisión…" className="py-4" />
                    ) : grupos.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No hay piezas aprobadas sin liberar en esta entrada.
                        </p>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid gap-1">
                                <span className="font-mono text-[11px] uppercase tracking-[0.09em] text-muted-foreground">
                                    {(partidas ?? []).length} partida
                                    {(partidas ?? []).length === 1 ? '' : 's'} · {aprobadas} aprobadas ·{' '}
                                    {yaLiberadas} ya liberadas
                                </span>
                            </div>

                            {/* ⭐ 25 Sep 2026 (usuario) — **qué sucede**, ARRIBA y antes de elegir: el
                                usuario lo pidió textual (*«el modal solo diga las piezas… pero que diga
                                qué sucede: es ya para darle el material físicamente, que este paso
                                indica que las piezas se entregan»*). Antes esta caja vivía al FINAL,
                                después de la lista, y por eso el modal se leía como «solo las piezas».
                                El Vo.Bo. del acondicionador está en `FLUJO_01 §3.6`. */}
                            <div
                                className={cn(
                                    'flex flex-wrap items-center gap-2.5 rounded-md border px-3 py-2.5 text-[12.5px]',
                                    totalPiezas > 0
                                        ? 'border-warning/45 bg-warning/10'
                                        : 'border-border bg-surface-2 text-muted-foreground'
                                )}
                            >
                                <PackageCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                                <span>
                                    {totalPiezas > 0 ? (
                                        <>
                                            Entregas <b>{totalPiezas} pieza(s)</b> al acondicionador como{' '}
                                            <b>una tanda</b>: es la entrega <b>física</b> del material —
                                            salen del área de revisión y el acondicionador da su Vo.Bo. al
                                            recibirlas. <b>No</b> cierra la partida, <b>no</b> cierra la
                                            entrada y <b>no</b> genera nota: la nota nace cuando termina la
                                            revisión de toda la entrada.
                                        </>
                                    ) : (
                                        <>
                                            Marca las piezas que <b>entregas ahora</b> al
                                            acondicionamiento; el resto se queda en la revisión.
                                        </>
                                    )}
                                </span>
                            </div>

                            {grupos.map((g) => {
                                const valor = Math.max(
                                    0,
                                    Number(elegidas[g.id_partida_resuelta] ?? 0)
                                )
                                const queda = Math.max(0, g.disponible - valor)
                                return (
                                    <div
                                        key={g.id_partida_resuelta}
                                        className="overflow-hidden rounded-md border border-border bg-surface-raised"
                                    >
                                        <div className="flex flex-wrap items-center gap-2.5 border-b border-border bg-surface-2 px-3 py-2.5">
                                            <input
                                                type="checkbox"
                                                className="size-4"
                                                checked={valor > 0}
                                                aria-label={`Incluir el grupo de la partida ${g.partida}`}
                                                onChange={(e) =>
                                                    setElegidas((prev) => ({
                                                        ...prev,
                                                        [g.id_partida_resuelta]: e.target.checked
                                                            ? String(g.disponible)
                                                            : '0',
                                                    }))
                                                }
                                            />
                                            <span className="font-semibold">
                                                {huellaDeclarada(
                                                    g.huella.marca_nombre ?? g.categoria_nombre,
                                                    g.huella.atributos
                                                )}
                                            </span>
                                            <span className="ml-auto">
                                                <Pildora
                                                    texto={`${g.disponible} por liberar`}
                                                    tono="listo"
                                                />
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-3 px-3 py-3">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <span className="font-mono text-[11px] uppercase tracking-[0.09em] text-muted-foreground">
                                                    Piezas a liberar
                                                </span>
                                                <span className="flex items-center gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="h-11 w-11 shrink-0 p-0"
                                                        aria-label="Una pieza menos"
                                                        disabled={valor <= 0}
                                                        onClick={() =>
                                                            ajustar(
                                                                g.id_partida_resuelta,
                                                                -1,
                                                                g.disponible
                                                            )
                                                        }
                                                    >
                                                        <Minus className="h-4 w-4" aria-hidden="true" />
                                                    </Button>
                                                    <b className="min-w-[44px] text-center text-[19px] tabular-nums">
                                                        {valor}
                                                    </b>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="h-11 w-11 shrink-0 p-0"
                                                        aria-label="Una pieza más"
                                                        disabled={valor >= g.disponible}
                                                        onClick={() =>
                                                            ajustar(
                                                                g.id_partida_resuelta,
                                                                1,
                                                                g.disponible
                                                            )
                                                        }
                                                    >
                                                        <Plus className="h-4 w-4" aria-hidden="true" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="min-h-11"
                                                        onClick={() =>
                                                            setElegidas((prev) => ({
                                                                ...prev,
                                                                [g.id_partida_resuelta]: String(g.disponible),
                                                            }))
                                                        }
                                                    >
                                                        Todas ({g.disponible})
                                                    </Button>
                                                </span>
                                            </div>
                                            <p className="text-[12.5px] text-muted-foreground">
                                                {queda > 0 ? (
                                                    <>
                                                        Quedan <b className="text-foreground">{queda}</b>{' '}
                                                        aprobadas en la partida {g.partida}, esperando la
                                                        revisión de las que faltan.
                                                    </>
                                                ) : (
                                                    <>
                                                        Sale <b className="text-foreground">todo</b> lo
                                                        aprobado de la partida {g.partida}.
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            className="min-h-[52px] px-5 text-[15px]"
                            onClick={() => onOpenChange(false)}
                            disabled={guardando}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            className="min-h-[56px] flex-1 px-6 text-[16px] font-semibold sm:flex-none"
                            disabled={guardando || totalPiezas === 0}
                            onClick={() => setConfirmando(true)}
                        >
                            {guardando && <Spinner className="mr-2 text-primary-foreground" />}
                            {/* ⭐ 25 Sep 2026 (usuario) — la acción DICE A DÓNDE VA: «liberar» a secas
                                no decía que la mercancía pasa a acondicionamiento (mismo texto que el
                                pie del wizard). */}
                            {guardando
                                ? 'Entregando…'
                                : `Liberar ${totalPiezas} a acondicionamiento`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ③ La confirmación aparte: la acción saca mercancía del expediente. */}
            <ConfirmarAccionDialog
                open={confirmando}
                titulo={`¿Liberar ${totalPiezas} pieza(s) a acondicionamiento?`}
                descripcion={`${entrada?.folio ?? ''} · salen del área de revisión hacia limpieza; la revisión de la entrada sigue abierta.`}
                detalle="Una liberación no se deshace: si algo sale mal, el camino es una divergencia."
                confirmLabel="Sí, liberar"
                tactil
                successMessage={`Tanda liberada · ${totalPiezas} pieza(s) a acondicionamiento`}
                onOpenChange={setConfirmando}
                onConfirm={async () => ({ error: await guardar() })}
            />
        </>
    )
}
