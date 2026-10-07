'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENTE VENTAS TAB — pestaña «Ventas · 1.8» de la ficha del cliente (Guía 1.8 · P6)
// ⭐ NO estrena consulta: usa `listarNotasRemision({ idCliente })` — **la MISMA SA del
//    listado**, con el filtro puesto. Una consulta propia sería una SEGUNDA definición
//    de «las notas de un cliente», y con ella dos columnas de saldo que podrían
//    discrepar (la regla del BLOQUE 1).
// ⭐ NO estrena columnas: reusa `columnasVentas()` por la PUERTA ÚNICA del módulo
//    (`@/components/ventas`). Solo quita la columna «Cliente»: en esta ficha TODAS las
//    filas son el mismo cliente — repetirlo en cada renglón es ruido, no información.
// ⚠️ Paginación SERVIDOR: la SA es paginada. Cargar solo la página 1 escondería notas
//    sin decirlo — el defecto que este proyecto no acepta (mostrar de menos, en silencio).
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'

import { DataTable } from '@/components/data-table'
import type { EstadoTabla } from '@/components/data-table'
import { FILTROS_VENTAS_DEFAULT, columnasVentas } from '@/components/ventas'
import { listarNotasRemision } from '@/lib/actions/ventas'
import type { FiltrosNotaRemision, NotaRemisionListado } from '@/types/ventas'

const PAGE_SIZE_OPTIONS = [
    { value: 10, label: '10' },
    { value: 20, label: '20' },
    { value: 50, label: '50' },
    { value: 100, label: '100' },
]

export function ClienteVentasTab({ clienteId }: { clienteId: string }) {
    const [notas, setNotas] = useState<NotaRemisionListado[]>([])
    const [estadoTabla, setEstadoTabla] = useState<EstadoTabla>('loading')
    const [pagina, setPagina] = useState(1)
    const [tamano, setTamano] = useState(25)
    const [total, setTotal] = useState(0)

    /** ⭐ El único filtro de esta pantalla: `idCliente`. El resto va en su default. */
    const filtros = useMemo<FiltrosNotaRemision>(
        () => ({ ...FILTROS_VENTAS_DEFAULT, idCliente: clienteId }),
        [clienteId]
    )

    /**
     * ⚠️ `columnasVentas()` va en `useMemo`: un arreglo nuevo por render le entrega a
     * `DataTable` columnas DISTINTAS en cada pasada (pierde orden y visibilidad).
     * ⚠️ `accessorKey` vive en UNA sola rama de la unión `ColumnDef` — mismo cast
     * estructural sin `any` que usa el propio `DataTable` (L248).
     */
    const columnas = useMemo(
        () =>
            columnasVentas().filter(
                (c) => (c as { accessorKey?: string }).accessorKey !== 'cliente_nombre'
            ),
        []
    )

    const cargar = useCallback(async () => {
        const res = await listarNotasRemision(filtros, pagina, tamano)
        if (!res.success) {
            setEstadoTabla('error')
            return
        }
        setNotas(res.data ?? [])
        setTotal(res.total ?? 0)
        setEstadoTabla('idle')
    }, [filtros, pagina, tamano])

    // Carga de página (SERVIDOR) — setState SOLO en la continuación async
    useEffect(() => {
        let activo = true
        void listarNotasRemision(filtros, pagina, tamano).then((res) => {
            if (!activo) return
            if (!res.success) {
                setEstadoTabla('error')
                return
            }
            setNotas(res.data ?? [])
            setTotal(res.total ?? 0)
            setEstadoTabla('idle')
        })
        return () => {
            activo = false
        }
    }, [filtros, pagina, tamano])

    const totalPaginas = Math.max(1, Math.ceil(total / tamano))

    return (
        <DataTable<NotaRemisionListado>
            columns={columnas}
            data={notas}
            rowKey={(n) => n.id}
            estado={estadoTabla}
            emptyMessage="Este cliente todavía no tiene notas de remisión."
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
