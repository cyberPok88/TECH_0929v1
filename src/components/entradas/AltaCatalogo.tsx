'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ALTA CATALOGO — Cola de cotejo del almacenista (Guía 1.6 · P6 · Smart)
// Lista entradas en `en_almacen` (por cotejar) con acción "Cotejar".
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PackageOpen } from 'lucide-react'

import { DataTable, crearColumnaAcciones } from '@/components/data-table'
import type { EstadoTabla } from '@/components/data-table'
import { usePageConfig } from '@/hooks/usePageConfig'
import { useCanAction } from '@/hooks/useCanAction'
import { listarEntradas } from '@/lib/actions/entradas'
import type { Entrada, FiltrosEntradas } from '@/types/entradas'
import { RecepcionFilters, FILTROS_ENTRADAS_DEFAULT } from '@/components/entradas/RecepcionFilters'
import { CotejoAltaModal } from '@/components/entradas/alta/CotejoAltaModal'
import { NotaCompraDetalleModal } from '@/components/compras/NotaCompraDetalleModal'
import {
    columnaEstado,
    columnaFolio,
    columnaPartidas,
    columnaPiezas,
    columnaProveedor,
    crearColumnaNota,
    type ColumnaEntrada,
} from '@/components/entradas/columnas-entrada'

const RUTA = '/dashboard/entradas/alta'

const PAGE_SIZE_OPTIONS = [
    { value: 10, label: '10' },
    { value: 20, label: '20' },
    { value: 50, label: '50' },
    { value: 100, label: '100' },
]

export function AltaCatalogo() {
    const [entradas, setEntradas] = useState<Entrada[]>([])
    const [estadoTabla, setEstadoTabla] = useState<EstadoTabla>('loading')
    const [filtros, setFiltros] = useState<FiltrosEntradas>(FILTROS_ENTRADAS_DEFAULT)
    const [pagina, setPagina] = useState(1)
    const [tamano, setTamano] = useState(25)
    const [total, setTotal] = useState(0)
    const [seleccion, setSeleccion] = useState<Entrada | null>(null)
    // ⭐ MEJORA 22 Sep 2026 — la nota de compra se consulta en modal: no se abandona el alta.
    const [notaDetalle, setNotaDetalle] = useState<string | null>(null)

    const puedeAprobar = useCanAction(RUTA, 'aprobar')

    useEffect(() => {
        let activo = true
        void listarEntradas(filtros, pagina, tamano).then((res) => {
            if (!activo) return
            if (!res.success) {
                setEstadoTabla('error')
                return
            }
            setEntradas(res.data ?? [])
            setTotal(res.total ?? 0)
            setEstadoTabla('idle')
        })
        return () => {
            activo = false
        }
    }, [filtros, pagina, tamano])

    const recargar = useCallback(async () => {
        setEstadoTabla('loading')
        const res = await listarEntradas(filtros, pagina, tamano)
        if (!res.success) {
            setEstadoTabla('error')
            return
        }
        setEntradas(res.data ?? [])
        setTotal(res.total ?? 0)
        setEstadoTabla('idle')
    }, [filtros, pagina, tamano])

    const manejarFiltros = useCallback((patch: Partial<FiltrosEntradas>) => {
        setFiltros((prev) => ({ ...prev, ...patch }))
        setPagina(1)
    }, [])

    const totalPaginas = Math.max(1, Math.ceil(total / tamano))

    const columnaAcciones = useMemo(
        () =>
            crearColumnaAcciones<Entrada>({
                acciones: [
                    ...(puedeAprobar
                        ? [
                              {
                                  icon: PackageOpen,
                                  label: 'Cotejar',
                                  dataAccion: 'aprobar',
                                  disabled: (e: Entrada) => e.estado !== 'en_almacen',
                                  onClick: (e: Entrada) => setSeleccion(e),
                              },
                          ]
                        : []),
                ],
            }),
        [puedeAprobar]
    )

    // ⭐ MEJORA 20 Sep 2026 — ALTA muestra partidas · piezas · nota (SIN costos — D14).
    const columnas = useMemo<ColumnaEntrada[]>(
        () => [
            columnaFolio,
            columnaProveedor,
            columnaPartidas,
            columnaPiezas,
            crearColumnaNota((e) => setNotaDetalle(e.id_nota ?? null)),
            columnaEstado,
            columnaAcciones,
        ],
        [columnaAcciones]
    )

    const filtrosBarra = useMemo(
        () => <RecepcionFilters filtros={filtros} onFiltrosChange={manejarFiltros} contador={total} />,
        [filtros, manejarFiltros, total]
    )

    usePageConfig({
        info: { title: 'Alta en almacén', subtitle: 'Entradas' },
        path: RUTA,
        filtros: filtrosBarra,
    })

    return (
        <>
            <DataTable<Entrada>
                columns={columnas}
                data={entradas}
                rowKey={(e) => e.id}
                estado={estadoTabla}
                emptyMessage="No hay entradas por cotejar."
                onRetry={() => {
                    void recargar()
                }}
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
                showColumnSelector
            />
            <CotejoAltaModal
                key={seleccion?.id ?? 'ninguna'}
                open={seleccion !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) setSeleccion(null)
                }}
                entrada={seleccion}
                onGuardado={() => {
                    void recargar()
                }}
            />
            <NotaCompraDetalleModal
                open={notaDetalle !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) setNotaDetalle(null)
                }}
                notaId={notaDetalle}
            />
        </>
    )
}
