'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PARTIDAS EXPANDIDAS — contenido de la fila expandible (Guía 1.6 · MEJORA 20 Sep)
// Primer consumidor de `DataTable.renderFilaExpandida` (PROMOCIÓN 20 Sep): muestra
// las PARTIDAS de la entrada dentro de su propia fila, sin abrir el expediente.
//
// ⭐ MEJORA 22 Sep 2026 (Fase 1 · Recepción) — muestra la EVOLUCIÓN del ingreso:
//   · Cabecera: partidas · Recibidas · DEV · Final (o «ajuste pendiente») + Total.
//     Mismo lenguaje que las columnas de la tabla: se entiende sin abrir nada.
//   · Por partida: Recibida · DEV · Final, con la DEV **real** de
//     `devoluciones_entrada` (`dev_cantidad`) y si ya se ajustó (`dev_ajustada`).
//     No se resta a ojo: puede haber DEV viva con la cantidad vigente intacta.
//   · Timeline de etapas con las fechas que ya trae la fila (recepción · revisión ·
//     acondicionamiento · almacén).
// Recibe la FILA (`entrada`), no solo el id: la cabecera y el timeline salen de ahí y
// las partidas se piden aparte. Cero SQL nuevo.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { Check, Clock, FileText, Package, PackageCheck, PackageMinus } from 'lucide-react'

import { Pildora } from '@/components/data-table'
import { listarPartidasEntrada } from '@/lib/actions/entradas'
import {
    devPendiente,
    formatearFechaEntrada,
    formatearMXNEntrada,
} from '@/components/entradas/columnas-entrada'
import { cn } from '@/lib/utils'
import type { Entrada, PartidaEntrada } from '@/types/entradas'

/** Un hito del timeline: la fecha ya formateada, o `—` si esa etapa no ocurrió. */
function Hito({ etiqueta, fecha }: { etiqueta: string; fecha: string | null }) {
    const hecha = Boolean(fecha)
    return (
        <span className="inline-flex items-center gap-1.5">
            <span
                aria-hidden="true"
                className={cn('size-1.5 rounded-full', hecha ? 'bg-acc-entradas' : 'bg-border')}
            />
            <span
                className={cn(
                    'font-mono text-[9.5px] uppercase tracking-[0.12em]',
                    hecha ? 'text-foreground/80' : 'text-muted-foreground/70'
                )}
            >
                {etiqueta}
            </span>
            <span
                className={cn(
                    'text-[11.5px] tabular-nums',
                    hecha ? 'text-foreground' : 'text-muted-foreground/50'
                )}
            >
                {hecha ? formatearFechaEntrada(fecha as string) : '—'}
            </span>
        </span>
    )
}

/** Dato de la cabecera de evolución (icono + etiqueta + valor). */
function Dato({
    icono: Icono,
    etiqueta,
    valor,
    tono = 'neutro',
}: {
    icono: typeof Package
    etiqueta: string
    valor: string
    tono?: 'neutro' | 'peligro' | 'exito'
}) {
    return (
        <span className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5">
            <Icono
                className={cn(
                    'size-3.5 shrink-0',
                    tono === 'peligro'
                        ? 'text-destructive'
                        : tono === 'exito'
                          ? 'text-success'
                          : 'text-muted-foreground'
                )}
                aria-hidden="true"
            />
            <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">
                {etiqueta}
            </span>
            <span
                className={cn(
                    'text-[12.5px] font-semibold tabular-nums',
                    tono === 'peligro'
                        ? 'text-destructive'
                        : tono === 'exito'
                          ? 'text-success'
                          : 'text-foreground'
                )}
            >
                {valor}
            </span>
        </span>
    )
}

export function PartidasExpandidas({
    entrada,
    onAjustar,
}: {
    entrada: Entrada
    /** Abre «Ajustar y nota» para esta entrada (lo provee la página). */
    onAjustar?: (e: Entrada) => void
}) {
    const [partidas, setPartidas] = useState<PartidaEntrada[]>([])
    const [cargando, setCargando] = useState(true)

    useEffect(() => {
        let activo = true
        void listarPartidasEntrada(entrada.id).then((r) => {
            if (!activo) return
            if (r.success) setPartidas(r.data ?? [])
            setCargando(false)
        })
        return () => {
            activo = false
        }
    }, [entrada.id])

    const pendiente = devPendiente(entrada)
    const conDev = entrada.devolucion_total > 0

    return (
        <div className="space-y-3">
            {/* ── Evolución del ingreso ───────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2">
                <Dato icono={Package} etiqueta="Partidas" valor={String(entrada.partidas_count)} />
                <Dato
                    icono={PackageCheck}
                    etiqueta="PZ. RECIBIDAS"
                    valor={String(entrada.piezas_total)}
                />
                <Dato
                    icono={PackageMinus}
                    etiqueta="DEV"
                    valor={conDev ? `−${entrada.devolucion_total}` : '—'}
                    tono={conDev ? 'peligro' : 'neutro'}
                />
                <Dato
                    icono={Check}
                    etiqueta="Final"
                    valor={String(entrada.piezas_vigentes)}
                    tono={conDev && !pendiente ? 'exito' : 'neutro'}
                />
                {/* La acción, no el aviso (usuario): el botón abre «Ajustar y nota». */}
                {pendiente && onAjustar && (
                    <button
                        type="button"
                        onClick={() => onAjustar(entrada)}
                        title="La DEV no está ajustada: abre el ajuste y genera la nota de compra."
                        className="inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-wide text-warning transition-colors hover:bg-warning/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning"
                    >
                        <FileText className="size-3 shrink-0" aria-hidden="true" />
                        Ajustar y generar nota
                    </button>
                )}
            </div>

            {/* ── Timeline de etapas ──────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md border border-border/70 bg-surface px-3 py-2">
                <Hito etiqueta="Recepción" fecha={entrada.fecha} />
                <Hito etiqueta="Revisión" fecha={entrada.fecha_fin_rev} />
                <Hito etiqueta="Acondicionamiento" fecha={entrada.fecha_fin_acond} />
                <Hito etiqueta="Almacén" fecha={entrada.fecha_fin_almacen} />
            </div>

            {/* ── Partidas: recibida · DEV · final ────────────────────────── */}
            {cargando ? (
                <p className="text-sm text-muted-foreground">Cargando partidas…</p>
            ) : partidas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin partidas.</p>
            ) : (
                <div className="rounded-md border border-border/70">
                    <table className="w-full text-xs">
                        <thead className="border-b border-border/70 text-center text-muted-foreground">
                            <tr>
                                <th className="px-3 py-2 font-medium">#</th>
                                <th className="px-3 py-2 font-medium">Clasificación</th>
                                <th className="px-3 py-2 font-medium">Recibida</th>
                                <th className="px-3 py-2 font-medium">DEV</th>
                                <th className="px-3 py-2 font-medium">Final</th>
                                <th className="px-3 py-2 font-medium">Costo</th>
                                <th className="px-3 py-2 font-medium">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {partidas.map((p) => (
                                <tr key={p.id} className="border-t border-border/70">
                                    <td className="px-3 py-2 text-center font-mono tabular-nums">{p.partida}</td>
                                    <td className="px-3 py-2 text-center">{p.categoria_nombre ?? '—'}</td>
                                    <td className="px-3 py-2 text-center tabular-nums">{p.cantidad_original}</td>
                                    <td className="px-3 py-2 text-center">
                                        {p.dev_cantidad > 0 ? (
                                            <span className="inline-flex items-center gap-1.5">
                                                <Pildora texto={`−${p.dev_cantidad}`} tono="peligro" />
                                                {p.dev_ajustada ? (
                                                    <Check
                                                        className="size-3 text-success"
                                                        aria-label="DEV ya ajustada"
                                                    />
                                                ) : (
                                                    <Clock
                                                        className="size-3 text-warning"
                                                        aria-label="DEV pendiente de ajuste"
                                                    />
                                                )}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </td>
                                    <td
                                        className={cn(
                                            'px-3 py-2 text-center tabular-nums',
                                            p.dev_cantidad > 0 && 'font-semibold'
                                        )}
                                    >
                                        {p.cantidad_vigente}
                                    </td>
                                    <td className="px-3 py-2 text-center tabular-nums">
                                        {formatearMXNEntrada(p.costo_acordado)}
                                    </td>
                                    <td className="px-3 py-2 text-center">{p.estado_partida}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
