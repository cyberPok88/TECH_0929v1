'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTO VENTAS TAB — pestaña «Ventas (1.8)» de la ficha del producto (Guía 1.8 · P6)
// ⭐ Responde la pregunta INVERSA del listado: «¿dónde se fue ESTE sku?». Usa
//    `listarPartidasDeProducto(id_producto)` — la SA que esta Parte creó para eso.
//    ⚠️ NO se resuelve con `listarNotasRemision`: los renglones no viajan en el listado
//    (a propósito — Parte 2 · BLOQUE 1), y ahí no se sabría CUÁL renglón es este SKU.
// ⚠️ Las columnas SÍ son propias: el listado pinta NOTAS y sus columnas no aplican a un
//    renglón. Ninguna otra pantalla pinta una partida vista DESDE el producto.
// ⚠️ Paginación SERVIDOR: la SA es paginada — mostrar solo la página 1 escondería
//    ventas sin decirlo.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'

import { DataTable } from '@/components/data-table'
import type { ColumnDefExtension, EstadoTabla } from '@/components/data-table'
import { formatearFecha } from '@/components/ventas'
import { listarPartidasDeProducto } from '@/lib/actions/ventas'
import { formatearMoneda, formatearNumero } from '@/lib/utils/formatters'
import type { PartidaVendidaListado } from '@/types/ventas'

const PAGE_SIZE_OPTIONS = [
    { value: 10, label: '10' },
    { value: 20, label: '20' },
    { value: 50, label: '50' },
    { value: 100, label: '100' },
]

interface ProductoVentasTabProps {
    productoId: string
}

export function ProductoVentasTab({ productoId }: ProductoVentasTabProps) {
    const [partidas, setPartidas] = useState<PartidaVendidaListado[]>([])
    const [estadoTabla, setEstadoTabla] = useState<EstadoTabla>('loading')
    const [pagina, setPagina] = useState(1)
    const [tamano, setTamano] = useState(25)
    const [total, setTotal] = useState(0)

    const cargar = useCallback(async () => {
        const res = await listarPartidasDeProducto(productoId, pagina, tamano)
        if (!res.success) {
            setEstadoTabla('error')
            return
        }
        setPartidas(res.data ?? [])
        setTotal(res.total ?? 0)
        setEstadoTabla('idle')
    }, [productoId, pagina, tamano])

    // Carga de página (SERVIDOR) — setState SOLO en la continuación async
    useEffect(() => {
        let activo = true
        void listarPartidasDeProducto(productoId, pagina, tamano).then((res) => {
            if (!activo) return
            if (!res.success) {
                setEstadoTabla('error')
                return
            }
            setPartidas(res.data ?? [])
            setTotal(res.total ?? 0)
            setEstadoTabla('idle')
        })
        return () => {
            activo = false
        }
    }, [productoId, pagina, tamano])

    /** ⚠️ `useMemo`: columnas nuevas por render = columnas distintas en cada pasada. */
    const columnas = useMemo(
        (): (ColumnDef<PartidaVendidaListado> & ColumnDefExtension<PartidaVendidaListado>)[] => [
            {
                accessorKey: 'nota_folio',
                label: 'Nota',
                movil: 'critica',
                render: (valor) => (
                    <span className="font-mono text-xs tabular-nums">
                        {valor ? String(valor) : '—'}
                    </span>
                ),
            },
            {
                accessorKey: 'nota_fecha',
                label: 'Fecha',
                movil: 'secundaria',
                // ⚠️ `String(null)` daría "null": el nulo se resuelve ANTES de formatear
                render: (valor) => (
                    <span className="tabular-nums">{formatearFecha(valor ? String(valor) : null)}</span>
                ),
            },
            {
                accessorKey: 'cliente_nombre',
                label: 'Cliente',
                movil: 'critica',
                render: (_valor, fila) => (
                    <span className="block min-w-0">
                        <span className="block truncate">{fila.cliente_nombre ?? '—'}</span>
                        {fila.cliente_codigo && (
                            <span className="block font-mono text-[11px] tabular-nums text-muted-foreground">
                                {fila.cliente_codigo}
                            </span>
                        )}
                    </span>
                ),
            },
            {
                accessorKey: 'cantidad',
                label: 'Cantidad',
                movil: 'secundaria',
                align: 'derecha',
                render: (valor) => (
                    <span className="tabular-nums font-medium">{formatearNumero(Number(valor))}</span>
                ),
            },
            {
                accessorKey: 'precio_unitario_final',
                label: 'Precio',
                movil: 'secundaria',
                align: 'derecha',
                render: (valor) => (
                    <span className="tabular-nums">{formatearMoneda(Number(valor))}</span>
                ),
            },
        ],
        []
    )

    const totalPaginas = Math.max(1, Math.ceil(total / tamano))

    return (
        <DataTable<PartidaVendidaListado>
            columns={columnas}
            data={partidas}
            rowKey={(p) => p.id}
            estado={estadoTabla}
            emptyMessage="Este producto todavía no se ha vendido en ninguna nota vigente."
            onRetry={() => {
                void cargar()
            }}
            showColumnSelector={false}
            pageSize={tamano}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            page={pagina}
            totalPages={totalPaginas}
            onPageChange={(p) => {
                setEstadoTabla('loading')
                setPagina(p)
            }}
            onPageSizeChange={(n) => {
                setEstadoTabla('loading')
                setTamano(n)
                setPagina(1)
            }}
        />
    )
}
