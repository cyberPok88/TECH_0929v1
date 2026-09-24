'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// EXISTENCIAS CATALOGO — Listado de stock por SKU (Guía 1.5 · Smart)
// Página delgada + estado + delegación · Toolbar vía usePageConfig.
// Paginación SERVIDOR. Píldora de estado Ok/Bajo mínimo/Sin stock.
// La columna de acciones ⋮ (kardex · lotes · salida) se ANEXA en las Partes 3–4.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { Download, History, Layers, PackageMinus } from 'lucide-react'

import { DataTable, Pildora, crearColumnaAcciones, useSeleccionTabla } from '@/components/data-table'
import type { ColumnDefExtension, EstadoTabla } from '@/components/data-table'
import { usePageConfig } from '@/hooks/usePageConfig'
import { useCanAction } from '@/hooks/useCanAction'
import type { ToolbarAction } from '@/types/shell'
import {
    listarCategoriasYMarcas,
    listarExistencias,
} from '@/lib/actions/inventario'
import { InventarioFilters, FILTROS_EXISTENCIAS_DEFAULT } from '@/components/inventario/InventarioFilters'
import type { OpcionFiltro } from '@/components/inventario/InventarioFilters'
import { exportarExistenciasCsv } from '@/components/inventario/exportar-existencias-csv'
// ANEXIÓN Guía 1.5 · Parte 3: diálogo de lotes por producto · Parte 4: salida manual
import { LotesProductoDialog } from '@/components/inventario/LotesProductoDialog'
import { RegistrarSalidaDialog } from '@/components/inventario/RegistrarSalidaDialog'
import type { ExistenciaProducto, FiltrosExistencias } from '@/types/inventario'
import { TEXTO_ESTADO_CONSUMO, TONO_ESTADO_CONSUMO } from '@/types/inventario'

const RUTA = '/dashboard/inventario/existencias'

const PAGE_SIZE_OPTIONS = [
    { value: 10, label: '10' },
    { value: 20, label: '20' },
    { value: 50, label: '50' },
    { value: 100, label: '100' },
]

export function ExistenciasCatalogo() {
    const router = useRouter()
    const [filas, setFilas] = useState<ExistenciaProducto[]>([])
    const [estadoTabla, setEstadoTabla] = useState<EstadoTabla>('loading')
    const [filtros, setFiltros] = useState<FiltrosExistencias>(FILTROS_EXISTENCIAS_DEFAULT)
    const [pagina, setPagina] = useState(1)
    const [tamano, setTamano] = useState(25)
    const [total, setTotal] = useState(0)
    const [categorias, setCategorias] = useState<OpcionFiltro[]>([])
    const [marcas, setMarcas] = useState<OpcionFiltro[]>([])
    // ANEXIÓN Guía 1.5 · Parte 3/4: diálogos abiertos por la fila ⋮
    const [dialogo, setDialogo] = useState<
        { tipo: 'lotes' | 'salida'; producto: ExistenciaProducto } | null
    >(null)

    const puedeExportar = useCanAction(RUTA, 'exportar')
    const puedeRegistrarSalida = useCanAction(RUTA, 'editar')

    // Opciones de filtro (catálogos 1.0/1.2 — una carga).
    useEffect(() => {
        let activo = true
        void listarCategoriasYMarcas().then((res) => {
            if (!activo || !res.success || !res.data) return
            setCategorias(res.data.categorias.map((c) => ({ valor: c.id, etiqueta: c.nombre })))
            setMarcas(res.data.marcas.map((m) => ({ valor: m.id, etiqueta: m.nombre })))
        })
        return () => {
            activo = false
        }
    }, [])

    // Carga de página (servidor) — setState solo en continuación async.
    useEffect(() => {
        let activo = true
        void listarExistencias(filtros, pagina, tamano).then((res) => {
            if (!activo) return
            if (!res.success) {
                setEstadoTabla('error')
                return
            }
            setFilas(res.data ?? [])
            setTotal(res.total ?? 0)
            setEstadoTabla('idle')
        })
        return () => {
            activo = false
        }
    }, [filtros, pagina, tamano])

    const recargar = useCallback(async () => {
        setEstadoTabla('loading')
        const res = await listarExistencias(filtros, pagina, tamano)
        if (!res.success) {
            setEstadoTabla('error')
            return
        }
        setFilas(res.data ?? [])
        setTotal(res.total ?? 0)
        setEstadoTabla('idle')
    }, [filtros, pagina, tamano])

    // ── Selección (checkboxes) ──────────────────────────────────────────────────
    const { seleccion, onSeleccionChange, limpiar } = useSeleccionTabla(
        filas,
        (e) => e.id_producto
    )

    const manejarFiltros = useCallback(
        (patch: Partial<FiltrosExistencias>) => {
            setFiltros((prev) => ({ ...prev, ...patch }))
            setPagina(1)
            limpiar()
        },
        [limpiar]
    )

    const totalPaginas = Math.max(1, Math.ceil(total / tamano))

    // ANEXIÓN Guía 1.5 · Parte 3: acciones ⋮ por fila — Ver kardex (deep link a la
    // ficha con ?tab=kardex) · Ver lotes (dialog). Apertura diferida 160 ms desde el
    // menú ⋮ (overlay fantasma de Radix — patrón 1.1/1.4).
    const abrirDiferido = useCallback((fn: () => void) => {
        window.setTimeout(fn, 160)
    }, [])

    const columnaAcciones = useMemo(
        () =>
            crearColumnaAcciones<ExistenciaProducto>({
                acciones: [],
                secundarias: [
                    {
                        icon: History,
                        label: 'Ver kardex',
                        dataAccion: 'ver-kardex',
                        onClick: (e) =>
                            router.push(`/dashboard/catalogos/productos/${e.id_producto}?tab=kardex`),
                    },
                    {
                        icon: Layers,
                        label: 'Ver lotes',
                        dataAccion: 'ver-lotes',
                        onClick: (e) => abrirDiferido(() => setDialogo({ tipo: 'lotes', producto: e })),
                    },
                    ...(puedeRegistrarSalida
                        ? [
                              {
                                  icon: PackageMinus,
                                  label: 'Registrar salida',
                                  dataAccion: 'registrar-salida',
                                  disabled: (e: ExistenciaProducto) => e.stock_actual <= 0,
                                  onClick: (e: ExistenciaProducto) =>
                                      abrirDiferido(() => setDialogo({ tipo: 'salida', producto: e })),
                              },
                          ]
                        : []),
                ],
            }),
        [router, abrirDiferido, puedeRegistrarSalida]
    )

    const columnas = useMemo<(ColumnDef<ExistenciaProducto> & ColumnDefExtension<ExistenciaProducto>)[]>(
        () => [
            {
                accessorKey: 'sku',
                label: 'SKU',
                movil: 'ocultar',
                render: (value) => <span className="font-mono text-[12.5px]">{String(value)}</span>,
            },
            {
                accessorKey: 'nombre',
                label: 'Producto',
                movil: 'critica',
            },
            { accessorKey: 'categoria_nombre', label: 'Categoría', movil: 'secundaria' },
            { accessorKey: 'marca_nombre', label: 'Marca', movil: 'ocultar' },
            {
                id: 'stock_actual',
                accessorFn: (e) => e.stock_actual,
                label: 'Stock',
                movil: 'critica',
                render: (value) => (
                    <span className="font-mono tabular-nums">{Number(value).toLocaleString('es-MX')}</span>
                ),
            },
            { accessorKey: 'stock_minimo', label: 'Mínimo', movil: 'ocultar' },
            { accessorKey: 'ubicacion_nombre', label: 'Ubicación', movil: 'ocultar' },
            {
                id: 'estado',
                accessorFn: (e) => e.estado_existencia,
                label: 'Estado',
                movil: 'critica',
                render: (value) => (
                    <Pildora
                        texto={TEXTO_ESTADO_CONSUMO[value as keyof typeof TEXTO_ESTADO_CONSUMO]}
                        tono={TONO_ESTADO_CONSUMO[value as keyof typeof TONO_ESTADO_CONSUMO]}
                    />
                ),
            },
        ],
        []
    )

    const accionesToolbar = useMemo<ToolbarAction[]>(() => {
        const lista: ToolbarAction[] = []
        if (puedeExportar) {
            lista.push({
                id: 'exportar',
                label: 'Exportar CSV',
                icon: Download,
                accion: 'exportar',
                variant: 'outline',
                onClick: () => exportarExistenciasCsv(filas),
            })
        }
        return lista
    }, [puedeExportar, filas])

    usePageConfig({
        info: { title: 'Existencias', subtitle: 'Inventario' },
        path: RUTA,
        actions: accionesToolbar,
    })

    return (
        <div className="flex flex-col gap-4">
            <InventarioFilters
                filtros={filtros}
                onFiltrosChange={manejarFiltros}
                categorias={categorias}
                marcas={marcas}
                contador={total}
                disabled={estadoTabla === 'loading'}
            />

            <DataTable<ExistenciaProducto>
                columns={[...columnas, columnaAcciones]}
                data={filas}
                rowKey={(e) => e.id_producto}
                estado={estadoTabla}
                emptyMessage="Sin productos para este filtro"
                onRetry={() => void recargar()}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                pageSize={tamano}
                onPageSizeChange={(t) => {
                    setTamano(t)
                    setPagina(1)
                }}
                totalPages={totalPaginas}
                page={pagina}
                onPageChange={setPagina}
                enableRowSelection
                rowSelection={seleccion}
                onRowSelectionChange={onSeleccionChange}
            />

            {/* ANEXIÓN Guía 1.5 · Parte 3: lotes por producto (permanece montado) */}
            <LotesProductoDialog
                producto={dialogo?.tipo === 'lotes' ? dialogo.producto : null}
                open={dialogo?.tipo === 'lotes'}
                onOpenChange={(o) => {
                    if (!o) setDialogo(null)
                }}
            />

            {/* ANEXIÓN Guía 1.5 · Parte 4: salida manual FIFO */}
            <RegistrarSalidaDialog
                producto={dialogo?.tipo === 'salida' ? dialogo.producto : null}
                open={dialogo?.tipo === 'salida'}
                onOpenChange={(o) => {
                    if (!o) setDialogo(null)
                }}
                onSuccess={() => void recargar()}
            />
        </div>
    )
}
