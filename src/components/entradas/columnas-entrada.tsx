'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// COLUMNAS DE ENTRADA — builders compartidos por las tablas de cada fase
// (Guía 1.6 · MEJORA 20 Sep 2026).
// ⭐ Cada fase COMPONE las suyas según el ROL de la etapa (no todas muestran lo
// mismo):  Recepción → partidas·recibidas·DEV·final·total·nota · Revisión →
// partidas·piezas·resultado · Acondicionamiento → partidas·piezas (sin costos) ·
// Alta → partidas·piezas·nota (sin costos).
// ⭐ MEJORA 22 Sep 2026: Recepción muestra la EVOLUCIÓN de la cantidad —
// `Recibidas` (declarada) · `DEV` · `Final` (Σ vigente, que solo existe tras el
// ajuste: mientras la DEV esté pendiente la celda lo dice en vez de mentir con un
// número) — y el `Total` ya sale con la cantidad vigente (no hay total "original"
// en pantalla: no aporta).
// ═══════════════════════════════════════════════════════════════════════════════

import type { ColumnDef } from '@tanstack/react-table'
import { FileText } from 'lucide-react'

import { Pildora } from '@/components/data-table'
import type { ColumnDefExtension } from '@/components/data-table'
import { cn } from '@/lib/utils'
import type { Entrada } from '@/types/entradas'
import { TEXTO_ESTADO_ENTRADA, TONO_ESTADO_ENTRADA } from '@/types/entradas'

export type ColumnaEntrada = ColumnDef<Entrada> & ColumnDefExtension<Entrada>

export function formatearFechaEntrada(fecha: string): string {
    const d = new Date(fecha)
    if (Number.isNaN(d.getTime())) return fecha
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatearMXNEntrada(monto: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto)
}

/**
 * ⭐ MEJORA 22 Sep 2026 — ¿la entrada tiene una DEV **sin ajustar**? Mismo criterio que la
 * acción «Ajustar y nota». Mientras sea `true` el «final» todavía NO existe: `cantidad_vigente`
 * sigue igual a la declarada (caso real ING-0005: dev 1 · vigentes 5 · estado `con_dev`).
 */
export function devPendiente(e: Entrada): boolean {
    return e.devolucion_total > 0 && ['con_dev', 'revisada_sin_dev'].includes(e.estado) && !e.id_nota
}

export const columnaFolio: ColumnaEntrada = {
    accessorKey: 'folio',
    label: 'Folio',
    movil: 'critica',
    render: (valor) => <span className="font-mono text-xs tabular-nums">{String(valor)}</span>,
}

export const columnaFecha: ColumnaEntrada = {
    accessorKey: 'fecha',
    label: 'Fecha',
    movil: 'secundaria',
    render: (valor) => <span className="tabular-nums">{formatearFechaEntrada(String(valor))}</span>,
}

export const columnaProveedor: ColumnaEntrada = {
    accessorKey: 'proveedor_nombre',
    label: 'Proveedor',
    movil: 'secundaria',
    render: (_valor, fila) => <span className="block truncate">{fila.proveedor_nombre ?? '—'}</span>,
}

export const columnaPartidas: ColumnaEntrada = {
    id: 'partidas',
    accessorFn: (e) => e.partidas_count,
    label: 'Partidas',
    align: 'derecha',
    movil: 'secundaria',
    // ⭐ MEJORA 22 Sep 2026 — `size` declarado: las columnas de SOLO NÚMEROS no deben comerse el
    // ancho (el kit aplica el `size` de la columna; el espacio sobrante va a las de texto).
    size: 72,
    render: (_valor, fila) => <span>{fila.partidas_count}</span>,
}

export const columnaPiezas: ColumnaEntrada = {
    id: 'piezas',
    accessorFn: (e) => e.piezas_total,
    label: 'PZ. RECIBIDAS',
    align: 'derecha',
    movil: 'secundaria',
    size: 104,
    render: (_valor, fila) => <span>{fila.piezas_total}</span>,
}

// ⭐ MEJORA 22 Sep 2026 — FUERA el builder del monto agregado (`columnaTotal`): el flujo de
// Entradas cuenta PIEZAS, no dinero (el costo vive en la nota de compra y en el detalle por
// partida). Si una fase futura necesita el monto, se vuelve a declarar aquí.

/**
 * ⭐ MEJORA 22 Sep 2026 (12) — la píldora de la DEV es una **ACCIÓN**: abre la devolución de la
 * entrada (de qué partida y de qué producto declarado se devuelve, con qué motivo y en qué estado)
 * junto con los botones de **ajustar y generar nota**. Se construye con el callback de quien la
 * hospeda — una columna compartida no puede conocer el estado de React —, igual que
 * `crearColumnaFinal` y `crearColumnaNota`.
 */
export function crearColumnaDevolucion(onVerDev?: (fila: Entrada) => void): ColumnaEntrada {
    return {
        id: 'devolucion',
        accessorFn: (e) => e.devolucion_total,
        label: 'DEV',
        align: 'derecha',
        movil: 'ocultar',
        size: 72,
        render: (_valor, fila) =>
            fila.devolucion_total > 0 ? (
                // La píldora NO cambia de forma (el usuario la aprobó): se envuelve para volverla botón.
                <button
                    type="button"
                    onClick={() => onVerDev?.(fila)}
                    disabled={!onVerDev}
                    title="Ver la devolución: partida, producto, motivo, estado y ajuste."
                    className="rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:cursor-default disabled:hover:opacity-100"
                >
                    <Pildora texto={`−${fila.devolucion_total}`} tono="peligro" />
                </button>
            ) : (
                <span className="text-muted-foreground">—</span>
            ),
    }
}

/**
 * ⭐ MEJORA 22 Sep 2026 — «Final»: lo que QUEDA después del ajuste (Σ `cantidad_vigente`).
 * ⭐ 3ª pasada (idea del usuario): mientras la DEV está **sin ajustar** la celda no se queda en
 * un aviso — es el **BOTÓN que abre «Ajustar y nota»**, que es justo la acción que resuelve ese
 * estado. Con el ajuste hecho muestra el número (en negrita si hubo DEV).
 * Se construye con el callback de la página (patrón `crearColumnaAcciones`).
 */
export function crearColumnaFinal(onAjustar?: (e: Entrada) => void): ColumnaEntrada {
    return {
        id: 'final',
        accessorFn: (e) => e.piezas_vigentes,
        label: 'Final',
        align: 'derecha',
        movil: 'secundaria',
        // 104px: el ancho lo manda el botón (el `max-w-[110px]` de `secundaria` no lo corta).
        size: 104,
        render: (_valor, fila) => {
            const pendiente = devPendiente(fila)
            if (pendiente && onAjustar) {
                return (
                    <button
                        type="button"
                        onClick={() => onAjustar(fila)}
                        title="La DEV no está ajustada: abre el ajuste y genera la nota de compra."
                        className={cn(
                            'inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5',
                            'text-[10px] font-medium uppercase tracking-wide text-warning transition-colors',
                            'hover:bg-warning/20',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning'
                        )}
                    >
                        <FileText className="size-3 shrink-0" aria-hidden="true" />
                        Ajustar
                    </button>
                )
            }
            return (
                <span
                    className={cn('tabular-nums', fila.devolucion_total > 0 && 'font-semibold')}
                    title={pendiente ? 'La DEV todavía no se ajusta: esta es la cantidad vigente hoy.' : undefined}
                >
                    {fila.piezas_vigentes}
                </span>
            )
        },
    }
}

/**
 * ⭐ MEJORA 22 Sep 2026 — la píldora de la nota es una ACCIÓN (abrir la nota), y una columna
 * compartida no puede saber del estado de React: se construye con el callback de quien la
 * hospeda — Recepción y Alta —, igual que `crearColumnaFinal`.
 *
 * El destino NO es otra página: se monta `NotaCompraDetalleModal` (dueño: Guía 1.4), la ficha
 * completa con sus acciones (pagar · cancelar · editar) y su RBAC. Consultar una nota no debe
 * costar el estado de la tabla que se está trabajando.
 */
export function crearColumnaNota(onVerNota?: (fila: Entrada) => void): ColumnaEntrada {
    return {
        id: 'nota',
        accessorFn: (e) => e.nota_folio ?? '',
        label: 'Nota de compra',
        movil: 'ocultar',
        render: (_valor, fila) =>
            fila.nota_folio && fila.id_nota ? (
                <button
                    type="button"
                    onClick={() => onVerNota?.(fila)}
                    disabled={!onVerNota}
                    title={`Ver la nota de compra ${fila.nota_folio} sin salir de esta página`}
                    className={cn(
                        'inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-0.5',
                        'font-mono text-[10px] text-foreground transition-colors',
                        'hover:border-primary/40 hover:bg-primary/10 hover:text-primary',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        'disabled:cursor-default disabled:hover:border-border disabled:hover:bg-surface-2 disabled:hover:text-foreground'
                    )}
                >
                    <FileText className="size-3 shrink-0" aria-hidden="true" />
                    {fila.nota_folio}
                </button>
            ) : (
                <span className="text-muted-foreground">—</span>
            ),
    }
}

export const columnaResultado: ColumnaEntrada = {
    id: 'resultado',
    accessorFn: (e) => e.resultado_rev ?? '',
    label: 'Resultado',
    movil: 'ocultar',
    render: (_valor, fila) =>
        fila.resultado_rev === 'CON_MALAS' ? (
            <Pildora texto="Con malas" tono="peligro" />
        ) : fila.resultado_rev === 'SIN_MALAS' ? (
            <Pildora texto="Sin malas" tono="exito" />
        ) : (
            <span className="text-muted-foreground">—</span>
        ),
}

export const columnaEstado: ColumnaEntrada = {
    accessorKey: 'estado',
    label: 'Estado',
    movil: 'critica',
    render: (_valor, fila) => (
        <Pildora texto={TEXTO_ESTADO_ENTRADA[fila.estado]} tono={TONO_ESTADO_ENTRADA[fila.estado]} />
    ),
}
