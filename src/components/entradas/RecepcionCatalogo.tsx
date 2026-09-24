'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// RECEPCION CATALOGO — Listado de entradas (Guía 1.6 · P2 · Smart)
// Cola de trabajo del recepcionista: todas las entradas, filtrables por estado.
// Paginación SERVIDOR. Acciones por fila: Ver (expediente) · Editar (recién_creada).
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Eye, FileText, Pencil, Plus } from 'lucide-react'

import { DataTable, crearColumnaAcciones } from '@/components/data-table'
import type { EstadoTabla } from '@/components/data-table'
import { usePageConfig } from '@/hooks/usePageConfig'
import { useCanAction } from '@/hooks/useCanAction'
import type { ToolbarAction } from '@/types/shell'
import { listarEntradas } from '@/lib/actions/entradas'
import type { Entrada, FiltrosEntradas } from '@/types/entradas'
import { RecepcionFilters, FILTROS_ENTRADAS_DEFAULT } from '@/components/entradas/RecepcionFilters'
import { EntradaModal } from '@/components/entradas/EntradaModal'
import { EntradaDetailModal } from '@/components/entradas/EntradaDetailModal'
import { AjusteDevModal } from '@/components/entradas/AjusteDevModal'
import { exportarEntradasCsv } from '@/components/entradas/exportar-entradas-csv'
import { PartidasExpandidas } from '@/components/entradas/PartidasExpandidas'
import { NotaCompraDetalleModal } from '@/components/compras/NotaCompraDetalleModal'
import {
    columnaEstado,
    columnaFecha,
    columnaFolio,
    columnaPartidas,
    columnaPiezas,
    columnaProveedor,
    crearColumnaDevolucion,
    crearColumnaFinal,
    crearColumnaNota,
    type ColumnaEntrada,
} from '@/components/entradas/columnas-entrada'

const RUTA = '/dashboard/entradas/recepcion'

const PAGE_SIZE_OPTIONS = [
    { value: 10, label: '10' },
    { value: 20, label: '20' },
    { value: 50, label: '50' },
    { value: 100, label: '100' },
]

type ModalState = { modo: 'crear' } | { modo: 'editar'; entrada: Entrada } | null

export function RecepcionCatalogo() {
    const [entradas, setEntradas] = useState<Entrada[]>([])
    const [estadoTabla, setEstadoTabla] = useState<EstadoTabla>('loading')
    const [filtros, setFiltros] = useState<FiltrosEntradas>(FILTROS_ENTRADAS_DEFAULT)
    const [pagina, setPagina] = useState(1)
    const [tamano, setTamano] = useState(25)
    const [total, setTotal] = useState(0)
    const [modal, setModal] = useState<ModalState>(null)
    const [detalle, setDetalle] = useState<Entrada | null>(null)
    const [ajuste, setAjuste] = useState<Entrada | null>(null)
    // ⭐ MEJORA 22 Sep 2026 — nota de compra en MODAL: consultarla ya no saca de Recepción.
    const [notaDetalle, setNotaDetalle] = useState<string | null>(null)

    const puedeCrear = useCanAction(RUTA, 'crear')
    const puedeEditar = useCanAction(RUTA, 'editar')
    const puedeExportar = useCanAction(RUTA, 'exportar')

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

    const editable = (e: Entrada) => e.estado === 'recien_creada'
    const ajustable = (e: Entrada) =>
        ['con_dev', 'revisada_sin_dev'].includes(e.estado) && !e.id_nota

    const columnaAcciones = useMemo(
        () =>
            crearColumnaAcciones<Entrada>({
                acciones: [
                    {
                        icon: Eye,
                        label: 'Ver',
                        dataAccion: 'ver',
                        onClick: (e) => setDetalle(e),
                    },
                ],
                secundarias: [
                    ...(puedeEditar
                        ? [
                              {
                                  icon: Pencil,
                                  label: 'Editar',
                                  dataAccion: 'editar',
                                  disabled: (e: Entrada) => !editable(e),
                                  onClick: (e: Entrada) => setModal({ modo: 'editar', entrada: e }),
                              },
                          ]
                        : []),
                    {
                        icon: FileText,
                        label: 'Ajustar y nota',
                        dataAccion: 'editar',
                        disabled: (e: Entrada) => !ajustable(e),
                        onClick: (e: Entrada) => setAjuste(e),
                    },
                ],
            }),
        [puedeEditar]
    )

    // ⭐ MEJORA 20 Sep 2026 — RECEPCIÓN muestra los agregados del ingreso: partidas ·
    // piezas · total · devolución · nota de compra (necesidad del recepcionista).
    // ⭐ MEJORA 22 Sep 2026 (Fase 1) — el orden cuenta la EVOLUCIÓN que pidió el usuario:
    // Partidas · Recibidas · DEV · Final · Total (el total ya sale con la cantidad vigente;
    // el total "original" no se muestra: no aporta).
    const columnas = useMemo<ColumnaEntrada[]>(
        () => [
            columnaFolio,
            columnaFecha,
            columnaProveedor,
            columnaPartidas,
            columnaPiezas, // «PZ. RECIBIDAS» — lo declarado
            // «DEV» — lo rechazado: píldora-botón que abre la devolución (partida · producto ·
            // motivo · estado) con el ajuste y la nota ahí mismo.
            crearColumnaDevolucion((e) => setAjuste(e)),
            // El resultado: Σ vigente — y, si el ajuste está pendiente, el BOTÓN que lo abre.
            crearColumnaFinal((e) => setAjuste(e)),
            // La nota se ABRE en modal (no navega): se sigue viendo la tabla que se trabaja.
            crearColumnaNota((e) => setNotaDetalle(e.id_nota ?? null)),
            columnaEstado,
            columnaAcciones,
        ],
        [columnaAcciones]
    )

    const acciones = useMemo<ToolbarAction[]>(() => {
        const lista: ToolbarAction[] = []
        if (puedeCrear) {
            lista.push({
                id: 'nuevo',
                label: 'Nueva entrada',
                icon: Plus,
                accion: 'crear',
                variant: 'default',
                onClick: () => setModal({ modo: 'crear' }),
            })
        }
        if (puedeExportar) {
            lista.push({
                id: 'exportar',
                label: 'Exportar',
                icon: Download,
                accion: 'exportar',
                variant: 'outline',
                onClick: () => {
                    void (async () => {
                        const res = await listarEntradas(filtros, 1, 1000)
                        if (!res.success || !res.data?.length) return
                        exportarEntradasCsv(res.data)
                    })()
                },
            })
        }
        return lista
    }, [puedeCrear, puedeExportar, filtros])

    const filtrosBarra = useMemo(
        () => <RecepcionFilters filtros={filtros} onFiltrosChange={manejarFiltros} contador={total} />,
        [filtros, manejarFiltros, total]
    )

    usePageConfig({
        info: { title: 'Recepción', subtitle: 'Entradas' },
        path: RUTA,
        actions: acciones,
        filtros: filtrosBarra,
    })

    return (
        <>
            <DataTable<Entrada>
                columns={columnas}
                data={entradas}
                rowKey={(e) => e.id}
                estado={estadoTabla}
                emptyMessage="No hay entradas registradas."
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
                // ⭐ PROMOCIÓN 20 Sep — primer consumidor de la fila expandible del kit:
                // las partidas de la entrada se ven dentro de su fila.
                // ⭐ MEJORA 22 Sep 2026: recibe la FILA completa (no solo el id) para mostrar
                // la evolución (declaradas → DEV → final) y el timeline sin otra consulta.
                renderFilaExpandida={(e) => (
                    <PartidasExpandidas entrada={e} onAjustar={(x) => setAjuste(x)} />
                )}
                showColumnSelector
            />
            <EntradaModal
                open={modal !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) setModal(null)
                }}
                modo={modal?.modo === 'editar' ? 'editar' : 'crear'}
                entrada={modal?.modo === 'editar' ? modal.entrada : null}
                onGuardado={() => {
                    void recargar()
                }}
            />
            <EntradaDetailModal
                open={detalle !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) setDetalle(null)
                }}
                entrada={detalle}
            />
            <AjusteDevModal
                key={ajuste?.id ?? 'ninguna'}
                open={ajuste !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) setAjuste(null)
                }}
                entrada={ajuste}
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
