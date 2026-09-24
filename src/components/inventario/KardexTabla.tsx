'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable, Pildora } from '@/components/data-table'
import type { ColumnDefExtension, EstadoTabla } from '@/components/data-table'
import type { MovimientoInventario } from '@/types/inventario'
import {
    TEXTO_ORIGEN,
    TEXTO_TIPO_MOVIMIENTO,
    TONO_TIPO_MOVIMIENTO,
} from '@/types/inventario'

function fechaCorta(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function cantConSigno(m: MovimientoInventario): string {
    const n = m.cantidad
    if (n > 0) return `+${n}`
    return String(n)
}

interface KardexTablaProps {
    filas: MovimientoInventario[]
    estado: EstadoTabla
    total?: number
    emptyMessage?: string
    onRetry?: () => void
}

export function KardexTabla({
    filas,
    estado,
    emptyMessage = 'Sin movimientos para este producto.',
    onRetry,
}: KardexTablaProps) {
    const columnas = useMemo<(ColumnDef<MovimientoInventario> & ColumnDefExtension<MovimientoInventario>)[]>(
        () => [
            {
                accessorKey: 'created_at',
                label: 'Fecha',
                movil: 'critica',
                render: (value) => fechaCorta(String(value)),
            },
            {
                accessorKey: 'tipo_movimiento',
                label: 'Tipo',
                movil: 'critica',
                render: (value) => (
                    <Pildora
                        texto={TEXTO_TIPO_MOVIMIENTO[value as keyof typeof TEXTO_TIPO_MOVIMIENTO]}
                        tono={TONO_TIPO_MOVIMIENTO[value as keyof typeof TONO_TIPO_MOVIMIENTO]}
                    />
                ),
            },
            {
                id: 'cantidad',
                accessorFn: (m) => m.cantidad,
                label: 'Cantidad',
                movil: 'critica',
                render: (_v, m) => (
                    <span className={`font-mono tabular-nums ${m.cantidad < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                        {cantConSigno(m)}
                    </span>
                ),
            },
            {
                id: 'stock',
                accessorFn: (m) => m.stock_resultante,
                label: 'Stock ant. → res.',
                movil: 'secundaria',
                render: (_v, m) => (
                    <span className="font-mono tabular-nums">
                        {m.stock_anterior} → {m.stock_resultante}
                    </span>
                ),
            },
            {
                accessorKey: 'origen_tabla',
                label: 'Origen',
                movil: 'secundaria',
                render: (value) =>
                    value ? TEXTO_ORIGEN[value as keyof typeof TEXTO_ORIGEN] ?? String(value) : '—',
            },
            { accessorKey: 'motivo', label: 'Motivo', movil: 'ocultar' },
            { accessorKey: 'creador_nombre', label: 'Usuario', movil: 'ocultar' },
        ],
        []
    )

    return (
        <DataTable<MovimientoInventario>
            columns={columnas}
            data={filas}
            rowKey={(m) => m.id}
            estado={estado}
            emptyMessage={emptyMessage}
            onRetry={onRetry}
            showColumnSelector={false}
            densidad="compacto"
            alturaMaxima="420px"
        />
    )
}
