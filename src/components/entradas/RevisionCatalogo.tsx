'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// REVISION CATALOGO — Cola del técnico (Guía 1.6 · P3 · Smart)
// Lista todas las entradas; "Revisar" (pendiente) abre el wizard · "Resultado"
// (revisada+) abre el resumen. Paginación servidor.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardList, Eye, ScanLine } from 'lucide-react'

import { DataTable, crearColumnaAcciones } from '@/components/data-table'
import type { EstadoTabla } from '@/components/data-table'
import { usePageConfig } from '@/hooks/usePageConfig'
import { useCanAction } from '@/hooks/useCanAction'
import { listarEntradas } from '@/lib/actions/entradas'
import type { Entrada, FiltrosEntradas } from '@/types/entradas'
import { RecepcionFilters, FILTROS_ENTRADAS_DEFAULT } from '@/components/entradas/RecepcionFilters'
import { WizardRevision } from '@/components/entradas/revision/WizardRevision'
import { ResultadoRevisionModal } from '@/components/entradas/ResultadoRevisionModal'
import { PartidasRevision } from '@/components/entradas/PartidasRevision'
import {
    columnaEstado,
    columnaFecha,
    columnaFolio,
    columnaPartidas,
    columnaPiezas,
    columnaProveedor,
    columnaResultado,
    type ColumnaEntrada,
} from '@/components/entradas/columnas-entrada'

const RUTA = '/dashboard/entradas/revision'

const PAGE_SIZE_OPTIONS = [
    { value: 10, label: '10' },
    { value: 20, label: '20' },
    { value: 50, label: '50' },
    { value: 100, label: '100' },
]

const PENDIENTES = new Set(['recien_creada', 'lista_para_revision', 'en_revision'])

export function RevisionCatalogo() {
    const [entradas, setEntradas] = useState<Entrada[]>([])
    const [estadoTabla, setEstadoTabla] = useState<EstadoTabla>('loading')
    const [filtros, setFiltros] = useState<FiltrosEntradas>(FILTROS_ENTRADAS_DEFAULT)
    const [pagina, setPagina] = useState(1)
    const [tamano, setTamano] = useState(25)
    const [total, setTotal] = useState(0)
    const [revisando, setRevisando] = useState<Entrada | null>(null)
    const [partidaInicial, setPartidaInicial] = useState<string | undefined>(undefined)
    const [resultado, setResultado] = useState<Entrada | null>(null)

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
                                  icon: ScanLine,
                                  label: 'Revisar',
                                  dataAccion: 'editar',
                                  disabled: (e: Entrada) => !PENDIENTES.has(e.estado),
                                  onClick: (e: Entrada) => {
                                      setPartidaInicial(undefined)
                                      setRevisando(e)
                                  },
                              },
                          ]
                        : []),
                    {
                        icon: ClipboardList,
                        label: 'Resultado',
                        dataAccion: 'ver',
                        disabled: (e: Entrada) => PENDIENTES.has(e.estado),
                        onClick: (e: Entrada) => setResultado(e),
                    },
                ],
                secundarias: [
                    {
                        icon: Eye,
                        label: 'Ver',
                        dataAccion: 'ver',
                        onClick: (e: Entrada) => setResultado(e),
                    },
                ],
            }),
        [puedeEditar]
    )

    // ⭐ MEJORA 20 Sep 2026 — REVISIÓN muestra: partidas · piezas · resultado
    // (lo que el técnico necesita para tomar la cola).
    const columnas = useMemo<ColumnaEntrada[]>(
        () => [
            columnaFolio,
            columnaFecha,
            columnaProveedor,
            columnaPartidas,
            columnaPiezas,
            columnaResultado,
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
        info: { title: 'Revisión', subtitle: 'Entradas' },
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
                emptyMessage="No hay entradas."
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
                // ⭐ MEJORA 20 Sep — acordeón: el técnico despliega las PARTIDAS del
                // ingreso y elige cuál iniciar (espejo del acordeón de la V5).
                renderFilaExpandida={(e) => (
                    <PartidasRevision
                        entrada={e}
                        onIniciar={(idPartida) => {
                            setPartidaInicial(idPartida)
                            setRevisando(e)
                        }}
                    />
                )}
                showColumnSelector
            />
            <WizardRevision
                key={revisando?.id ?? 'ninguna'}
                open={revisando !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) {
                        setRevisando(null)
                        setPartidaInicial(undefined)
                    }
                }}
                entrada={revisando}
                partidaInicialId={partidaInicial}
                onGuardado={() => {
                    void recargar()
                }}
            />
            <ResultadoRevisionModal
                open={resultado !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) setResultado(null)
                }}
                entrada={resultado}
            />
        </>
    )
}
