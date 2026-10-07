'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// COLUMNAS Y FORMATEADORES — VENTAS (Guía 1.8 · 01 Oct 2026)
// ⭐ El DINERO lo pinta `formatearMoneda` de la casa (`@/lib/utils/formatters`, dueño
// 0.2): NO se inventa un 11º `formatearMXN` local (decisión medida el 01 Oct 2026).
// El formateador de FECHA sí vive aquí —y lo usa el catálogo— porque `fecha_emision`
// y `fecha_vencimiento` llegan SIN hora (`yyyy-mm-dd`): ver la nota sobre por qué el
// `Intl` + `new Date()` de la casa no sirve para ese caso.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ColumnDef } from '@tanstack/react-table'

import { Pildora } from '@/components/data-table'
import type { ColumnDefExtension } from '@/components/data-table'
import { formatearMoneda } from '@/lib/utils/formatters'
import {
    ETIQUETA_ESTADO_PAGO,
    TONO_ESTADO_PAGO,
    type NotaRemisionListado,
} from '@/types/ventas'

/**
 * ⚠️ NO se usa `new Date(fecha)`: `date` llega como `yyyy-mm-dd` y `new Date` lo interpreta como
 * UTC — en México eso pinta el día ANTERIOR. Se parte y se rearma.
 */
export function formatearFecha(fecha: string | null | undefined): string {
    if (!fecha) return '—'
    const [a, m, d] = fecha.split('-')
    return a && m && d ? `${d}/${m}/${a}` : fecha
}

/** ¿La nota está vencida y aún debe? — la marca que hace visible la mora en el listado. */
function estaVencida(n: NotaRemisionListado): boolean {
    if (n.es_cancelada || n.saldo_pendiente <= 0) return false
    const hoy = new Date().toISOString().slice(0, 10)
    return n.fecha_vencimiento < hoy
}

export function columnasVentas(): (ColumnDef<NotaRemisionListado> & ColumnDefExtension<NotaRemisionListado>)[] {
    return [
        {
            accessorKey: 'folio',
            label: 'Folio',
            movil: 'critica',
            render: (valor) => (
                <span className="font-mono text-xs tabular-nums">{String(valor)}</span>
            ),
        },
        {
            accessorKey: 'cliente_nombre',
            label: 'Cliente',
            movil: 'critica',
            render: (_valor, fila) => (
                <span className="block min-w-0">
                    <span className="block truncate">
                        {fila.es_cancelada ? (
                            <span className="text-muted-foreground line-through">
                                {fila.cliente_nombre ?? '—'}
                            </span>
                        ) : (
                            (fila.cliente_nombre ?? '—')
                        )}
                    </span>
                    {fila.cliente_codigo && (
                        <span className="block font-mono text-[11px] tabular-nums text-muted-foreground">
                            {fila.cliente_codigo}
                        </span>
                    )}
                </span>
            ),
        },
        {
            accessorKey: 'fecha_emision',
            label: 'Fecha',
            movil: 'secundaria',
            render: (valor) => <span className="tabular-nums">{formatearFecha(String(valor))}</span>,
        },
        {
            accessorKey: 'fecha_vencimiento',
            label: 'Vence',
            movil: 'ocultar',
            // ⭐ La mora se VE: la fecha se pinta en rojo cuando la nota ya venció y aún debe (R27)
            render: (_valor, fila) => (
                <span
                    className={
                        estaVencida(fila)
                            ? 'tabular-nums font-semibold text-destructive'
                            : 'tabular-nums text-muted-foreground'
                    }
                >
                    {formatearFecha(fila.fecha_vencimiento)}
                </span>
            ),
        },
        {
            accessorKey: 'vendedor_nombre',
            label: 'Vendedor',
            movil: 'ocultar',
            render: (valor) => (
                <span className="text-muted-foreground">{valor ? String(valor) : '—'}</span>
            ),
        },
        {
            accessorKey: 'estado_pago_clave',
            label: 'Pago',
            movil: 'critica',
            // ⭐ DERIVADO por trigger (R27): la columna lo PINTA, no lo calcula
            render: (_valor, fila) =>
                fila.es_cancelada ? (
                    <Pildora texto="Cancelada" tono="neutro" />
                ) : fila.estado_pago_clave ? (
                    <Pildora
                        texto={ETIQUETA_ESTADO_PAGO[fila.estado_pago_clave]}
                        tono={TONO_ESTADO_PAGO[fila.estado_pago_clave]}
                    />
                ) : (
                    <Pildora texto={fila.estado_pago_nombre ?? '—'} tono="neutro" />
                ),
        },
        {
            accessorKey: 'total',
            label: 'Total',
            movil: 'secundaria',
            render: (valor) => (
                <span className="tabular-nums">{formatearMoneda(Number(valor))}</span>
            ),
        },
        {
            accessorKey: 'saldo_pendiente',
            label: 'Saldo',
            movil: 'critica',
            // El saldo se lee del LIBRO: aquí solo se pinta. Cero = pagada (sin ruido visual).
            render: (valor, fila) => {
                const saldo = Number(valor)
                if (fila.es_cancelada) return <span className="text-muted-foreground">—</span>
                if (saldo <= 0) return <span className="tabular-nums text-muted-foreground">—</span>
                return (
                    <span
                        className={
                            estaVencida(fila)
                                ? 'tabular-nums font-semibold text-destructive'
                                : 'tabular-nums font-medium'
                        }
                    >
                        {formatearMoneda(saldo)}
                    </span>
                )
            },
        },
    ]
}
