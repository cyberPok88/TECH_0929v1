'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PARTIDAS EXPANDIDAS — contenido de la fila expandible (Guía 1.6 · Recepción)
// Primer consumidor de `DataTable.renderFilaExpandida` (PROMOCIÓN 20 Sep): muestra
// las PARTIDAS de la entrada dentro de su propia fila, sin abrir el expediente.
//
// ⭐ MEJORA 22 Sep 2026 (Fase 1 · Recepción) — evolución del ingreso + la DEV **real** de
// `devoluciones_entrada` (`dev_cantidad`) con su estado (`dev_ajustada`).
//
// ⭐ MEJORA 24 Sep 2026 (usuario) — el desglose dejó de apilar tres bloques (chips + timeline +
// tabla anidada con su propio «Costo»): ahora es **una sola tabla de partidas alineada** —
// un encabezado, números en columna — más el timeline en una línea con los totales en texto.
//   · la cantidad NO se dibuja con una barra por pieza (con 200 piezas no escala): números
//     (`Recibidas` · `DEV` · `Final`) + **barra de proporción**, que se lee igual con 5 o 200;
//   · el **producto** es la huella declarada (categoría + atributos de recepción): una pieza
//     devuelta no tiene SKU, lo resuelve Almacén y solo para lo aprobado;
//   · 2ª pasada del mismo día (usuario): encabezados **sintetizados** («#», «Producto»,
//     «Recib.»), **sin negritas** en las celdas y las acciones **contraídas en un menú ⋯**
//     — antes eran botones/iconos inline y se veían amontonados.
// ⚠️ El menú abre el MISMO modal de la DEV (`AjusteDevModal`): un Dialog que se abre en el
// mismo tick en que cierra un menú deja su overlay fantasma (Radix), así que la apertura va
// **diferida 160 ms** — el patrón que el proyecto ya documentó en `NotasCompraCatalogo`.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'

import { Pildora } from '@/components/data-table'
import { Spinner } from '@/components/ui/spinner'
import { listarPartidasConAvance } from '@/lib/actions/entradas'
import {
    devPendiente,
    formatearFechaEntrada,
    formatearMXNEntrada,
    lineasDePartidas,
    productoDeLinea,
} from '@/components/entradas/columnas-entrada'
import { cn } from '@/lib/utils'
import type { Entrada, EstadoPartida, PartidaConAvance } from '@/types/entradas'
import { TEXTO_ESTADO_PARTIDA } from '@/types/entradas'

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
                    'font-mono text-[10px] uppercase tracking-[0.12em]',
                    hecha ? 'text-foreground/80' : 'text-muted-foreground/70'
                )}
            >
                {etiqueta}
            </span>
            <span
                className={cn(
                    'text-[13px] tabular-nums',
                    hecha ? 'text-foreground' : 'text-muted-foreground/50'
                )}
            >
                {hecha ? formatearFechaEntrada(fecha as string) : '—'}
            </span>
        </span>
    )
}

/**
 * ⭐ Barra de PROPORCIÓN (no una barra por pieza): final vs DEV sobre lo declarado. El tramo
 * rojo lleva `minWidth` para que `−1 de 200` siga siendo visible sin exagerar la proporción.
 */
function Proporcion({ final, dev, total }: { final: number; dev: number; total: number }) {
    const base = Math.max(total, final + dev, 1)
    return (
        <span
            aria-hidden="true"
            className="inline-flex h-1.5 w-[64px] shrink-0 overflow-hidden rounded-full bg-border"
        >
            <span className="block h-full bg-success" style={{ width: `${(final / base) * 100}%` }} />
            {dev > 0 && (
                <span
                    className="block h-full bg-destructive"
                    style={{ width: `${(dev / base) * 100}%`, minWidth: 5 }}
                />
            )}
        </span>
    )
}

/** Estado de la partida cuando NO hay DEV (si la hay, manda el estado de la DEV). */
const TONO_PARTIDA: Record<EstadoPartida, 'neutro' | 'listo' | 'peligro'> = {
    PENDIENTE: 'neutro',
    OK: 'listo',
    MAL: 'peligro',
}

/** Los encabezados, cortos: el dato no se toca, la etiqueta se sintetiza. */
const TH = 'px-2.5 py-1.5 font-medium'

export function PartidasExpandidas({
    entrada,
    onAjustar,
}: {
    entrada: Entrada
    /** Abre el modal de la DEV (ver + ajustar + generar nota) para esta entrada. */
    onAjustar?: (e: Entrada) => void
}) {
    // ⭐ MEJORA 28 (decisión 22.h) — la MISMA fuente que el desglose de Revisión
    // (`listarPartidasConAvance`): con las huellas se puede mostrar una línea por producto. Antes
    // usaba `listarPartidasEntrada`, que solo devuelve lo DECLARADO — por eso Recepción seguía
    // viendo «una partida» cuando la revisión ya había abierto dos marcas.
    const [partidas, setPartidas] = useState<PartidaConAvance[]>([])
    const [cargando, setCargando] = useState(true)

    useEffect(() => {
        let activo = true
        void listarPartidasConAvance(entrada.id).then((r) => {
            if (!activo) return
            if (r.success) setPartidas(r.data ?? [])
            setCargando(false)
        })
        return () => {
            activo = false
        }
    }, [entrada.id])

    /** ¿La entrada está en el paso donde el ajuste + la nota ya se pueden generar? */
    const puedeAjustar = devPendiente(entrada) && Boolean(onAjustar)

    /** ⭐ MEJORA 24 Sep 2026 (Fase 1) — el ⋯ se fue del puesto de dedo: la acción es un
     *  **botón con etiqueta** (ley L11). Al no haber menú, tampoco hay que diferir la apertura
     *  del modal (el retardo de 160 ms existía para el overlay fantasma de Radix). */

    return (
        <div className="flex flex-col gap-3">
            {/* ── Partidas: una tabla alineada, un solo encabezado ───────────── */}
            {cargando ? (
                <Spinner etiqueta="Cargando partidas…" className="py-1" />
            ) : partidas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin partidas.</p>
            ) : (
                <div className="overflow-hidden rounded-md border border-border bg-surface-raised">
                    <table className="w-full text-[14.5px]">
                        <thead className="border-b border-border bg-surface text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
                            <tr>
                                <th className={cn(TH, 'w-12')} title="Número de partida">
                                    #
                                </th>
                                <th
                                    className={cn(TH, 'text-left')}
                                    title="Categoría y atributos capturados en recepción (la huella declarada)"
                                >
                                    Producto
                                </th>
                                <th
                                    className={cn(TH, 'w-20')}
                                    title="En la fila de PARTIDA, lo declarado en recepción; en las de producto, las piezas de ese producto."
                                >
                                    Recib.
                                </th>
                                <th
                                    className={cn(TH, 'w-14')}
                                    title="De la partida en su fila; de cada producto en la suya (la pieza devuelta dice su marca)."
                                >
                                    DEV
                                </th>
                                <th
                                    className={cn(TH, 'w-28')}
                                    title="Lo que queda tras el ajuste en la fila de partida; lo aprobado de cada producto en la suya."
                                >
                                    Final
                                </th>
                                <th className={cn(TH, 'w-28')} title="Estado de la PARTIDA">
                                    Estado
                                </th>
                                <th className={cn(TH, 'w-24')} title="Costo acordado de la PARTIDA">
                                    Costo
                                </th>
                                <th className={cn(TH, 'w-24')}>
                                    <span className="sr-only">Acciones</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {lineasDePartidas(partidas).map((l) => {
                                const p = l.partida
                                /* ── ⭐ MEJORA 30 (25 Sep 2026 · usuario) — LA FILA DE PARTIDA ──
                                   El mismo criterio que en Revisión, con las columnas de Recepción:
                                   lo que es de la PARTIDA (lo declarado · el DEV del documento · el
                                   `Final` vigente · el estado del ajuste · el costo · la acción de
                                   ajustar) tiene su PROPIA fila; las de producto dicen lo suyo. Antes
                                   todo eso vivía en la fila del primer producto y se leía como suyo. */
                                if (l.esPartida) {
                                    const devPartida = Number(p.dev_cantidad ?? 0)
                                    const devPendPartida = devPartida > 0 && !p.dev_ajustada
                                    return (
                                        <tr
                                            key={l.key}
                                            className="border-t-2 border-border bg-surface-2"
                                        >
                                            <td className="px-2.5 py-2 text-center">
                                                <span className="font-mono text-[11.5px] tracking-[0.06em] text-acc-entradas">
                                                    PARTIDA {p.partida}
                                                </span>
                                            </td>
                                            <td
                                                className="px-2.5 py-2 text-muted-foreground"
                                                title="Lo que Recepción declaró. Debajo, lo que la revisión encontró."
                                            >
                                                {productoDeLinea(l)}
                                            </td>
                                            <td
                                                className="px-2.5 py-2 text-center tabular-nums"
                                                title="Piezas declaradas en recepción"
                                            >
                                                {p.cantidad_original}
                                            </td>
                                            <td
                                                className={cn(
                                                    'px-2.5 py-2 text-center tabular-nums',
                                                    devPartida > 0
                                                        ? 'text-destructive'
                                                        : 'text-muted-foreground'
                                                )}
                                                title="DEV de la PARTIDA (Σ de sus productos)"
                                            >
                                                {devPartida > 0 ? `−${devPartida}` : '—'}
                                            </td>
                                            <td className="px-2.5 py-2">
                                                <span className="flex items-center justify-center gap-2">
                                                    <span className="text-[17px] tabular-nums">
                                                        {Number(p.cantidad_vigente)}
                                                    </span>
                                                    <Proporcion
                                                        final={Number(p.cantidad_vigente)}
                                                        dev={devPartida}
                                                        total={Number(p.cantidad_original)}
                                                    />
                                                </span>
                                            </td>
                                            <td className="px-2.5 py-2 text-center">
                                                {devPartida > 0 ? (
                                                    <Pildora
                                                        texto={
                                                            p.dev_ajustada
                                                                ? 'Ajustada'
                                                                : 'Por cotejar'
                                                        }
                                                        tono={
                                                            p.dev_ajustada ? 'listo' : 'advertencia'
                                                        }
                                                    />
                                                ) : (
                                                    <Pildora
                                                        texto={
                                                            TEXTO_ESTADO_PARTIDA[p.estado_partida]
                                                        }
                                                        tono={TONO_PARTIDA[p.estado_partida]}
                                                    />
                                                )}
                                            </td>
                                            <td className="px-2.5 py-2 text-center tabular-nums text-muted-foreground">
                                                {formatearMXNEntrada(Number(p.costo_acordado))}
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                {devPartida > 0 && onAjustar ? (
                                                    puedeAjustar && devPendPartida ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => onAjustar(entrada)}
                                                            title="Ajusta la devolución y genera la nota de compra de la entrada."
                                                            className="inline-flex h-8 items-center rounded-md border border-transparent bg-primary px-2.5 text-[12px] font-semibold text-primary-foreground transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                                        >
                                                            Ajustar y generar nota
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => onAjustar(entrada)}
                                                            title="Ver la devolución: partida, producto, motivo y estado."
                                                            data-accion="ver-devolucion"
                                                            className="inline-flex h-8 items-center whitespace-nowrap rounded-md border border-border bg-surface px-3 text-[12px] font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                                        >
                                                            Ver devolución
                                                        </button>
                                                    )
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                }
                                /* ── La fila de PRODUCTO: su DEV y su `Final` ────────────── */
                                // ⭐ MEJORA 29 — la DEV es de ESTA línea: guarda la huella de la pieza
                                // devuelta (antes era de la partida y se repetía —o se anulaba— en
                                // todas sus líneas para no contar dos veces el mismo rojo).
                                const dev = l.dev
                                const devPend = dev > 0 && !l.devAjustada
                                return (
                                    <tr key={l.key} className="border-t border-border/70">
                                        <td
                                            className={cn(
                                                'px-2.5 py-2 text-center font-mono tabular-nums',
                                                l.partidaMultiple
                                                    ? 'text-muted-foreground'
                                                    : 'text-foreground',
                                                devPend
                                                    ? 'shadow-[inset_3px_0_0_var(--warning)]'
                                                    : dev > 0
                                                      ? 'shadow-[inset_3px_0_0_var(--destructive)]'
                                                      : undefined
                                            )}
                                            title={
                                                l.partidaMultiple
                                                    ? `Producto ${l.numero} de la entrada · viene de la partida ${p.partida} declarada`
                                                    : `Partida ${p.partida}`
                                            }
                                        >
                                            {l.numero}
                                        </td>
                                        <td className="px-2.5 py-2 pl-8">{productoDeLinea(l)}</td>
                                        <td
                                            className="px-2.5 py-2 text-center tabular-nums text-muted-foreground"
                                            title="Piezas DE ESTE producto: aprobadas + devueltas"
                                        >
                                            {l.recibidas}
                                        </td>
                                        <td
                                            className={cn(
                                                'px-2.5 py-2 text-center tabular-nums',
                                                dev > 0
                                                    ? 'text-destructive'
                                                    : 'text-muted-foreground'
                                            )}
                                            title="DEV de ESTE producto (la pieza devuelta dice su marca)"
                                        >
                                            {dev > 0 ? `−${dev}` : '—'}
                                        </td>
                                        <td className="px-2.5 py-2">
                                            <span className="flex items-center justify-center gap-2">
                                                {/* ⭐ MEJORA 24 Sep 2026 (Fase 1) — la cifra que el
                                                    piso necesita leer de un vistazo: 17px. */}
                                                <span className="text-[17px] tabular-nums">
                                                    {l.aprobadas}
                                                </span>
                                                {/* ⭐ MEJORA 29 — la barra de cada fila es su rebanada
                                                    de lo DECLARADO: las rebanadas de una partida suman
                                                    su total, y la DEV cae en la que le toca. */}
                                                <Proporcion
                                                    final={l.aprobadas}
                                                    dev={dev}
                                                    total={Number(p.cantidad_original)}
                                                />
                                            </span>
                                        </td>
                                        <td className="px-2.5 py-2 text-center text-muted-foreground">
                                            —
                                        </td>
                                        <td className="px-2.5 py-2 text-center text-muted-foreground">
                                            —
                                        </td>
                                        <td className="px-2 py-2 text-center text-muted-foreground">
                                            —
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Timeline de etapas + totales, en UNA línea ─────────────────── */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <Hito etiqueta="Recepción" fecha={entrada.fecha} />
                <Hito etiqueta="Revisión" fecha={entrada.fecha_fin_rev} />
                <Hito etiqueta="Acondicionamiento" fecha={entrada.fecha_fin_acond} />
                <Hito etiqueta="Almacén" fecha={entrada.fecha_fin_almacen} />
                <span className="ml-auto font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                    {entrada.partidas_count} {entrada.partidas_count === 1 ? 'producto' : 'productos'} ·{' '}
                    {entrada.piezas_total} pza · DEV {entrada.devolucion_total} · final{' '}
                    {entrada.piezas_vigentes}
                </span>
            </div>
        </div>
    )
}
