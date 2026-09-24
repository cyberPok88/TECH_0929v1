'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ACONDICIONAMIENTO CATALOGO — Cola del acondicionador (Guía 1.6 · P5 · Smart)
// Lista entradas en acondicionamiento (ajustada · en_acondicionamiento · recién_creada
// sin revisión) con acción "Acondicionar".
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PackageCheck } from 'lucide-react'

import { DataTable, crearColumnaAcciones } from '@/components/data-table'
import type { EstadoTabla } from '@/components/data-table'
import { usePageConfig } from '@/hooks/usePageConfig'
import { useCanAction } from '@/hooks/useCanAction'
import { listarEntradas } from '@/lib/actions/entradas'
import type { Entrada, FiltrosEntradas } from '@/types/entradas'
import { RecepcionFilters, FILTROS_ENTRADAS_DEFAULT } from '@/components/entradas/RecepcionFilters'
import { AcondicionamientoModal } from '@/components/entradas/AcondicionamientoModal'
import {
    columnaEstado,
    columnaFolio,
    columnaPartidas,
    columnaPiezas,
    columnaProveedor,
    type ColumnaEntrada,
} from '@/components/entradas/columnas-entrada'

const RUTA = '/dashboard/entradas/acondicionamiento'

const PAGE_SIZE_OPTIONS = [
    { value: 10, label: '10' },
    { value: 20, label: '20' },
    { value: 50, label: '50' },
    { value: 100, label: '100' },
]

const Acondicionable = (e: Entrada): boolean =>
    e.estado === 'ajustada' || e.estado === 'en_acondicionamiento' || (e.estado === 'recien_creada' && e.es_sin_revision)

export function AcondicionamientoCatalogo() {
    const [entradas, setEntradas] = useState<Entrada[]>([])
    const [estadoTabla, setEstadoTabla] = useState<EstadoTabla>('loading')
    const [filtros, setFiltros] = useState<FiltrosEntradas>(FILTROS_ENTRADAS_DEFAULT)
    const [pagina, setPagina] = useState(1)
    const [tamano, setTamano] = useState(25)
    const [total, setTotal] = useState(0)
    const [seleccion, setSeleccion] = useState<Entrada | null>(null)

    const puedeEditar = useCanAction(RUTA, 'editar')

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
                    ...(puedeEditar
                        ? [
                              {
                                  icon: PackageCheck,
                                  label: 'Acondicionar',
                                  dataAccion: 'editar',
                                  disabled: (e: Entrada) => !Acondicionable(e),
                                  onClick: (e: Entrada) => setSeleccion(e),
                              },
                          ]
                        : []),
                ],
            }),
        [puedeEditar]
    )

    // ⭐ MEJORA 20 Sep 2026 — ACONDICIONAMIENTO muestra partidas · piezas (SIN costos).
    const columnas = useMemo<ColumnaEntrada[]>(
        () => [
            columnaFolio,
            columnaProveedor,
            columnaPartidas,
            columnaPiezas,
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
        info: { title: 'Acondicionamiento', subtitle: 'Entradas' },
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
                emptyMessage="No hay entradas por acondicionar."
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
            <AcondicionamientoModal
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
        </>
    )
}
