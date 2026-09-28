'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PLANTILLAS — CATÁLOGO (Guía 2.1 · P3 · Smart · la pestaña de arranque)
//
// Trae las plantillas, filtra, permite activar/desactivar y — desde P4 — CREAR y
// EDITAR con el editor de plantilla.
//
// ⚠️ ESTA PESTAÑA LLAMA `usePageConfig` — único llamador mientras está montada.
// Si otro componente lo llamara, cambiar de pestaña vaciaría la toolbar (el hook
// limpia la config al desmontar). Ver la nota de la Parte 2.
//
// ⭐ FIX 27 Sep 2026 (precedente 22 Sep de sistema/roles): `abrirCrear` va en las
// dependencias del useMemo de `acciones`. Sin eso el memo se invalida en cada
// render y la toolbar parpadea.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Power, PowerOff } from 'lucide-react'
import { toast } from 'sonner'

import {
    ConfirmDialog,
    DataTable,
    crearColumnaAcciones,
} from '@/components/data-table'
import type { EstadoTabla } from '@/components/data-table'
import { COLUMNAS_PLANTILLA } from '@/components/sistema/plantillas/columnas-plantilla'
import { PlantillaEditorModal } from '@/components/sistema/plantillas/PlantillaEditorModal'
import { PlantillaFilters } from '@/components/sistema/plantillas/PlantillaFilters'
import { usePageConfig } from '@/hooks/usePageConfig'
import { useCanAction } from '@/hooks/useCanAction'
import { cambiarEstadoPlantilla, listarPlantillas } from '@/lib/actions/plantillas'
import type { FiltrosPlantillas, PlantillaDocumento } from '@/types/plantillas'
import type { ToolbarAction } from '@/types/shell'

const RUTA = '/dashboard/sistema/plantillas'

const FILTROS_DEFAULT: FiltrosPlantillas = { busqueda: '', familia: '', esActivo: '' }

export function PlantillasCatalogo() {
    const [plantillas, setPlantillas] = useState<PlantillaDocumento[]>([])
    const [estadoTabla, setEstadoTabla] = useState<EstadoTabla>('loading')
    const [filtros, setFiltros] = useState<FiltrosPlantillas>(FILTROS_DEFAULT)

    const [modalOpen, setModalOpen] = useState(false)
    const [modo, setModo] = useState<'crear' | 'editar'>('crear')
    const [seleccionada, setSeleccionada] = useState<PlantillaDocumento | null>(null)

    const [porCambiar, setPorCambiar] = useState<PlantillaDocumento | null>(null)
    const [cambiando, setCambiando] = useState(false)

    const puedeCrear = useCanAction(RUTA, 'crear')
    const puedeEditar = useCanAction(RUTA, 'editar')

    const obtener = useCallback(async () => {
        return listarPlantillas(filtros)
    }, [filtros])

    // ⚠️ Sin setState SÍNCRONO aquí: el 'loading' de un cambio de filtro lo marca el HANDLER.
    useEffect(() => {
        let activo = true
        obtener().then((res) => {
            if (!activo) return
            if (!res.success) {
                setEstadoTabla('error')
                return
            }
            setPlantillas(res.data ?? [])
            setEstadoTabla('idle')
        })
        return () => {
            activo = false
        }
    }, [obtener])

    const recargar = useCallback(async () => {
        const res = await obtener()
        if (!res.success) {
            setEstadoTabla('error')
            return
        }
        setPlantillas(res.data ?? [])
        setEstadoTabla('idle')
    }, [obtener])

    const abrirCrear = useCallback(() => {
        setModo('crear')
        setSeleccionada(null)
        setModalOpen(true)
    }, [])

    const abrirEditar = useCallback((p: PlantillaDocumento) => {
        setModo('editar')
        setSeleccionada(p)
        setModalOpen(true)
    }, [])

    // ── Toolbar del Shell (única llamadora: esta pestaña montada) ──────────────
    const acciones = useMemo<ToolbarAction[]>(
        () => [
            {
                id: 'nueva',
                label: 'Nueva plantilla',
                icon: Plus,
                accion: 'crear',
                variant: 'default',
                disabled: !puedeCrear,
                onClick: abrirCrear,
            },
        ],
        [puedeCrear, abrirCrear]
    )

    usePageConfig({
        info: { title: 'Plantillas', subtitle: 'Sistema' },
        path: RUTA,
        actions: acciones,
    })

    const columnaAcciones = useMemo(
        () =>
            crearColumnaAcciones<PlantillaDocumento>({
                // `Editar` es LA acción de esta pantalla → primaria (Decisión 24 de la 0.8).
                acciones: puedeEditar
                    ? [
                          {
                              icon: Pencil,
                              label: 'Editar',
                              dataAccion: 'editar',
                              onClick: (p: PlantillaDocumento) => abrirEditar(p),
                          },
                      ]
                    : [],
                secundarias: puedeEditar
                    ? [
                          {
                              icon: Power,
                              label: 'Activar',
                              dataAccion: 'activar',
                              disabled: (p: PlantillaDocumento) => p.es_activo,
                              onClick: (p: PlantillaDocumento) => setPorCambiar(p),
                          },
                          {
                              icon: PowerOff,
                              label: 'Desactivar',
                              dataAccion: 'desactivar',
                              disabled: (p: PlantillaDocumento) => !p.es_activo,
                              onClick: (p: PlantillaDocumento) => setPorCambiar(p),
                          },
                      ]
                    : [],
            }),
        [puedeEditar, abrirEditar]
    )

    // onConfirm del ConfirmDialog: devuelve { error } (contrato 0.8) — nunca throw.
    const ejecutarCambioEstado = async (): Promise<{ error: string | null }> => {
        if (!porCambiar) return { error: null }
        setCambiando(true)
        try {
            const activar = !porCambiar.es_activo
            const res = await cambiarEstadoPlantilla(porCambiar.id, activar)
            if (!res.success) return { error: res.error ?? 'No se pudo cambiar el estado.' }
            toast.success(activar ? 'Plantilla activada' : 'Plantilla desactivada')
            await recargar()
            setPorCambiar(null)
            return { error: null }
        } finally {
            setCambiando(false)
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <PlantillaFilters
                filtros={filtros}
                onFiltrosChange={(patch) => {
                    // El 'loading' se marca en el HANDLER (evento), nunca en el efecto.
                    setEstadoTabla('loading')
                    setFiltros((f) => ({ ...f, ...patch }))
                }}
                disabled={estadoTabla === 'loading'}
                placeholderBusqueda="Buscar por nombre de la plantilla…"
            />

            <DataTable<PlantillaDocumento>
                columns={[...COLUMNAS_PLANTILLA, columnaAcciones]}
                data={plantillas}
                rowKey={(p) => p.id}
                estado={estadoTabla}
                emptyMessage="Sin plantillas para este filtro"
                onRetry={() => void recargar()}
            />

            <PlantillaEditorModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                modo={modo}
                plantilla={seleccionada}
                onExito={() => void recargar()}
            />

            <ConfirmDialog
                open={porCambiar !== null}
                onOpenChange={(o) => {
                    if (!o) setPorCambiar(null)
                }}
                titulo={porCambiar?.es_activo ? 'Desactivar plantilla' : 'Activar plantilla'}
                descripcion={
                    porCambiar
                        ? porCambiar.es_activo
                            ? `«${porCambiar.nombre}» dejará de usarse en los documentos nuevos. Los documentos ya impresos no se tocan.`
                            : `«${porCambiar.nombre}» pasará a ser la plantilla vigente de su tipo. Si el tipo ya tenía otra activa, la operación se rechaza.`
                        : ''
                }
                confirmLabel={porCambiar?.es_activo ? 'Desactivar' : 'Activar'}
                variant={porCambiar?.es_activo ? 'destructive' : 'default'}
                isLoading={cambiando}
                onConfirm={ejecutarCambioEstado}
            />
        </div>
    )
}
