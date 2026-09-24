'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTARIO FISICO CATALOGO — listado de conteos (Guía 1.5 · Smart)
// Paginación servidor · píldora de estado · acciones Ver/Aplicar/Cancelar/Editar.
// Aplicar/cancelar/editar solo en BORRADOR (reglas server + disabled en UI).
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Ban, CheckCircle2, Eye, Pencil } from 'lucide-react'
import { toast } from 'sonner'

import { DataTable, Pildora, crearColumnaAcciones } from '@/components/data-table'
import type { ColumnDefExtension, EstadoTabla } from '@/components/data-table'
import { usePageConfig } from '@/hooks/usePageConfig'
import { useCanAction } from '@/hooks/useCanAction'
import type { ToolbarAction } from '@/types/shell'
import { ConfirmarAccionDialog } from '@/components/ui/ConfirmarAccionDialog'
import { aplicarConteo, cancelarConteo, listarConteos } from '@/lib/actions/inventario'
import { ConteoFilters, FILTROS_CONTEOS_DEFAULT } from '@/components/inventario/ConteoFilters'
import { ConteoInventarioModal } from '@/components/inventario/ConteoInventarioModal'
import { ConteoInventarioDetailModal } from '@/components/inventario/ConteoInventarioDetailModal'
import type { ConteoInventario, FiltrosConteos } from '@/types/inventario'
import { TEXTO_ESTADO_CONTEO, TONO_ESTADO_CONTEO } from '@/types/inventario'

const RUTA = '/dashboard/inventario/inventario-fisico'

const PAGE_SIZE_OPTIONS = [
    { value: 10, label: '10' },
    { value: 20, label: '20' },
    { value: 50, label: '50' },
]

type DialogoConteo =
    | { tipo: 'ver'; conteo: ConteoInventario }
    | { tipo: 'editar'; conteo: ConteoInventario }
    | { tipo: 'crear' }
    | null

type ConfirmacionPendiente =
    | { tipo: 'aplicar'; conteo: ConteoInventario }
    | { tipo: 'cancelar'; conteo: ConteoInventario }
    | null

type ColumnaConteo = ColumnDef<ConteoInventario> & ColumnDefExtension<ConteoInventario>

function fechaCorta(fecha: string): string {
    const [a, m, d] = fecha.split('-')
    return a && m && d ? `${d}/${m}/${a}` : fecha
}

export function InventarioFisicoCatalogo() {
    const [filas, setFilas] = useState<ConteoInventario[]>([])
    const [estadoTabla, setEstadoTabla] = useState<EstadoTabla>('loading')
    const [filtros, setFiltros] = useState<FiltrosConteos>(FILTROS_CONTEOS_DEFAULT)
    const [pagina, setPagina] = useState(1)
    const [tamano, setTamano] = useState(25)
    const [total, setTotal] = useState(0)
    const [dialogo, setDialogo] = useState<DialogoConteo>(null)
    const [confirmar, setConfirmar] = useState<ConfirmacionPendiente>(null)

    const puedeCrear = useCanAction(RUTA, 'crear')
    const puedeEditar = useCanAction(RUTA, 'editar')
    const puedeAprobar = useCanAction(RUTA, 'aprobar')

    // Carga de página (servidor) — setState solo en continuación async.
    useEffect(() => {
        let activo = true
        void listarConteos(filtros, pagina, tamano).then((res) => {
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
        const res = await listarConteos(filtros, pagina, tamano)
        if (!res.success) {
            setEstadoTabla('error')
            return
        }
        setFilas(res.data ?? [])
        setTotal(res.total ?? 0)
        setEstadoTabla('idle')
    }, [filtros, pagina, tamano])

    const abrirDiferido = useCallback((fn: () => void) => {
        window.setTimeout(fn, 160)
    }, [])

    const columnas = useMemo<ColumnaConteo[]>(
        () => [
            {
                accessorKey: 'fecha_conteo',
                label: 'Fecha',
                movil: 'critica',
                render: (value) => fechaCorta(String(value)),
            },
            { accessorKey: 'ubicacion_nombre', label: 'Ubicación', movil: 'secundaria' },
            { accessorKey: 'total_renglones', label: 'Renglones', movil: 'ocultar' },
            { accessorKey: 'creador_nombre', label: 'Registró', movil: 'ocultar' },
            {
                id: 'estado',
                accessorFn: (c) => c.estado,
                label: 'Estado',
                movil: 'critica',
                render: (value) => (
                    <Pildora
                        texto={TEXTO_ESTADO_CONTEO[value as keyof typeof TEXTO_ESTADO_CONTEO]}
                        tono={TONO_ESTADO_CONTEO[value as keyof typeof TONO_ESTADO_CONTEO]}
                    />
                ),
            },
        ],
        []
    )

    const columnaAcciones = useMemo(
        () =>
            crearColumnaAcciones<ConteoInventario>({
                acciones: [
                    {
                        icon: Eye,
                        label: 'Ver',
                        dataAccion: 'ver',
                        onClick: (c) => abrirDiferido(() => setDialogo({ tipo: 'ver', conteo: c })),
                    },
                ],
                secundarias: [
                    ...(puedeEditar
                        ? [
                              {
                                  icon: Pencil,
                                  label: 'Editar borrador',
                                  dataAccion: 'editar',
                                  disabled: (c: ConteoInventario) => c.estado !== 'borrador',
                                  onClick: (c: ConteoInventario) =>
                                      abrirDiferido(() => setDialogo({ tipo: 'editar', conteo: c })),
                              },
                          ]
                        : []),
                    ...(puedeAprobar
                        ? [
                              {
                                  icon: CheckCircle2,
                                  label: 'Aplicar conteo',
                                  dataAccion: 'aplicar',
                                  disabled: (c: ConteoInventario) => c.estado !== 'borrador',
                                  onClick: (c: ConteoInventario) =>
                                      abrirDiferido(() => setConfirmar({ tipo: 'aplicar', conteo: c })),
                              },
                              {
                                  icon: Ban,
                                  label: 'Cancelar conteo',
                                  dataAccion: 'cancelar',
                                  variant: 'destructive' as const,
                                  disabled: (c: ConteoInventario) => c.estado !== 'borrador',
                                  onClick: (c: ConteoInventario) =>
                                      abrirDiferido(() => setConfirmar({ tipo: 'cancelar', conteo: c })),
                              },
                          ]
                        : []),
                ],
            }),
        [puedeEditar, puedeAprobar, abrirDiferido]
    )

    const accionesToolbar = useMemo<ToolbarAction[]>(() => {
        const lista: ToolbarAction[] = []
        if (puedeCrear) {
            lista.push({
                id: 'nuevo',
                label: 'Nuevo conteo',
                icon: Plus,
                accion: 'crear',
                variant: 'default',
                onClick: () => setDialogo({ tipo: 'crear' }),
            })
        }
        return lista
    }, [puedeCrear])

    usePageConfig({
        info: { title: 'Inventario Físico', subtitle: 'Inventario' },
        path: RUTA,
        actions: accionesToolbar,
    })

    const totalPaginas = Math.max(1, Math.ceil(total / tamano))

    const ejecutarConfirmacion = async (): Promise<{ error: string | null }> => {
        if (!confirmar) return { error: null }
        const res =
            confirmar.tipo === 'aplicar'
                ? await aplicarConteo(confirmar.conteo.id)
                : await cancelarConteo(confirmar.conteo.id)
        if (!res.success) return { error: res.error ?? 'No se pudo completar la acción.' }
        toast.success(confirmar.tipo === 'aplicar' ? 'Conteo aplicado — stock ajustado.' : 'Conteo cancelado.')
        await recargar()
        return { error: null }
    }

    const dialogoTexto = (() => {
        if (!confirmar) return null
        return confirmar.tipo === 'aplicar'
            ? {
                  titulo: 'Aplicar conteo',
                  descripcion:
                      'Se ajustará el inventario a las cantidades contadas (movimientos de ajuste ± en el libro). Esta acción no se deshace — un error se corrige con otro ajuste.',
                  confirmLabel: 'Aplicar',
                  variant: 'default' as const,
              }
            : {
                  titulo: 'Cancelar conteo',
                  descripcion: 'El conteo en borrador se descarta — no se toca el inventario.',
                  confirmLabel: 'Cancelar conteo',
                  variant: 'destructive' as const,
              }
    })()

    const modalModo = dialogo?.tipo === 'editar' ? 'editar' : 'crear'
    const modalConteo = dialogo?.tipo === 'editar' ? dialogo.conteo : null

    return (
        <div className="flex flex-col gap-4">
            <ConteoFilters
                filtros={filtros}
                onFiltrosChange={(patch) => {
                    setFiltros((prev) => ({ ...prev, ...patch }))
                    setPagina(1)
                }}
                contador={total}
                disabled={estadoTabla === 'loading'}
            />

            <DataTable<ConteoInventario>
                columns={[...columnas, columnaAcciones]}
                data={filas}
                rowKey={(c) => c.id}
                estado={estadoTabla}
                emptyMessage="Sin conteos para este filtro"
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
            />

            {/* Diálogos siempre montados (controlados por `open` — patrón repo). */}
            <ConteoInventarioModal
                open={dialogo !== null && dialogo.tipo !== 'ver'}
                modo={modalModo}
                conteo={modalConteo}
                onOpenChange={(o) => {
                    if (!o) setDialogo(null)
                }}
                onSuccess={() => void recargar()}
            />

            <ConteoInventarioDetailModal
                conteo={dialogo?.tipo === 'ver' ? dialogo.conteo : null}
                open={dialogo?.tipo === 'ver'}
                onOpenChange={(o) => {
                    if (!o) setDialogo(null)
                }}
            />

            <ConfirmarAccionDialog
                open={confirmar !== null}
                onOpenChange={(o) => {
                    if (!o) setConfirmar(null)
                }}
                titulo={dialogoTexto?.titulo ?? ''}
                descripcion={dialogoTexto?.descripcion ?? ''}
                confirmLabel={dialogoTexto?.confirmLabel ?? 'Confirmar'}
                variant={dialogoTexto?.variant ?? 'default'}
                onConfirm={ejecutarConfirmacion}
            />
        </div>
    )
}
