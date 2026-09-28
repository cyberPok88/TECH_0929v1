'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS DE DOCUMENTO — CATÁLOGO (Guía 2.1 · P2 · Smart)
//
// La pestaña del INVENTARIO VIVO: los 8 documentos del ERP como dato, con su
// familia, si se firman, si auditan su reimpresión y si ya tienen plantilla.
//
// ⚠️ ESTA PESTAÑA LLAMA `usePageConfig` — no la página. Con pestañas debe haber UN
// solo llamador y su ciclo de vida tiene que coincidir con la superficie visible:
// `usePageConfig` limpia la config al desmontar, así que si la página y la pestaña
// lo llamaran, cambiar de pestaña dejaría la toolbar VACÍA (el efecto de la página
// no vuelve a correr: sus dependencias no cambiaron). Ver la nota de la Parte 2.
//
// ⭐ P3 — el vocabulario de familia ya NO se declara aquí: se importa de
// `columnas-plantilla.tsx`, que lo comparte con la pestaña de plantillas (ley L7:
// un solo nombre por cosa).
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Power, PowerOff } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'

import {
    ConfirmDialog,
    DataTable,
    Pildora,
    crearColumnaAcciones,
} from '@/components/data-table'
import type { ColumnDefExtension, EstadoTabla } from '@/components/data-table'
import {
    TEXTO_FAMILIA,
    TONO_FAMILIA,
} from '@/components/sistema/plantillas/columnas-plantilla'
import { PlantillaFilters } from '@/components/sistema/plantillas/PlantillaFilters'
import { TipoDocumentoModal } from '@/components/sistema/plantillas/TipoDocumentoModal'
import { usePageConfig } from '@/hooks/usePageConfig'
import { useCanAction } from '@/hooks/useCanAction'
import { cambiarEstadoTipoDocumento, listarTiposDocumento } from '@/lib/actions/plantillas'
import type {
    FamiliaDocumento,
    FiltrosTiposDocumento,
    TipoDocumento,
} from '@/types/plantillas'
import type { ToolbarAction } from '@/types/shell'

const RUTA = '/dashboard/sistema/plantillas'

const FILTROS_DEFAULT: FiltrosTiposDocumento = { busqueda: '', familia: '', esActivo: '' }

export function TiposDocumentoCatalogo() {
    const [tipos, setTipos] = useState<TipoDocumento[]>([])
    const [estadoTabla, setEstadoTabla] = useState<EstadoTabla>('loading')
    const [filtros, setFiltros] = useState<FiltrosTiposDocumento>(FILTROS_DEFAULT)

    const [modalOpen, setModalOpen] = useState(false)
    const [modo, setModo] = useState<'crear' | 'editar'>('crear')
    const [seleccionado, setSeleccionado] = useState<TipoDocumento | null>(null)

    const [porCambiar, setPorCambiar] = useState<TipoDocumento | null>(null)
    const [cambiando, setCambiando] = useState(false)

    const puedeCrear = useCanAction(RUTA, 'crear')
    const puedeEditar = useCanAction(RUTA, 'editar')

    // Fetch puro: NO setea estado (lo consume el efecto y recargar()).
    const obtener = useCallback(async () => {
        return listarTiposDocumento(filtros)
    }, [filtros])

    // Carga inicial + recarga al cambiar filtros: el setState vive en el .then().
    // ⚠️ AQUÍ NO va `setEstadoTabla('loading')`: un setState SÍNCRONO en el cuerpo de un
    //    efecto es el anti-patrón que `react-hooks/set-state-in-effect` prohíbe (el patrón
    //    0.9 ya lo documenta y esta parte lo volvió a introducir — lo cazó el FINGERPRINT).
    //    El 'loading' de un cambio de filtro lo marca el HANDLER del filtro (evento).
    useEffect(() => {
        let activo = true
        obtener().then((res) => {
            if (!activo) return
            if (!res.success) {
                setEstadoTabla('error')
                return
            }
            setTipos(res.data ?? [])
            setEstadoTabla('idle')
        })
        return () => {
            activo = false
        }
    }, [obtener])

    // Recarga desde handlers (onExito del modal / confirmación del toggle).
    const recargar = useCallback(async () => {
        const res = await obtener()
        if (!res.success) {
            setEstadoTabla('error')
            return
        }
        setTipos(res.data ?? [])
        setEstadoTabla('idle')
    }, [obtener])

    const abrirCrear = useCallback(() => {
        setModo('crear')
        setSeleccionado(null)
        setModalOpen(true)
    }, [])

    const abrirEditar = useCallback((t: TipoDocumento) => {
        setModo('editar')
        setSeleccionado(t)
        setModalOpen(true)
    }, [])

    // ── Toolbar del Shell (única llamadora: esta pestaña montada) ──────────────
    const acciones = useMemo<ToolbarAction[]>(
        () => [
            {
                id: 'nuevo',
                label: 'Nuevo tipo',
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
        info: { title: 'Plantillas', subtitle: 'Tipos de documento' },
        path: RUTA,
        actions: acciones,
    })

    // ── Columnas (checklist de consumo 0.8: label · movil · align) ─────────────
    const columnas = useMemo<(ColumnDef<TipoDocumento> & ColumnDefExtension<TipoDocumento>)[]>(
        () => [
            {
                accessorKey: 'clave',
                label: 'Clave',
                movil: 'critica',
                // Ley 6 — dato que se dicta y se escribe literal en el código: mono.
                render: (value) => (
                    <span className="font-mono text-[13px]">{String(value)}</span>
                ),
            },
            { accessorKey: 'nombre', label: 'Nombre', movil: 'critica' },
            {
                accessorKey: 'familia',
                label: 'Familia',
                movil: 'critica',
                render: (value) => {
                    const f = value as FamiliaDocumento
                    return <Pildora texto={TEXTO_FAMILIA[f]} tono={TONO_FAMILIA[f]} />
                },
            },
            {
                id: 'se_firma',
                accessorFn: (row) => row.se_firma,
                label: 'Se firma',
                movil: 'secundaria',
                render: (value) => (
                    <span className="font-mono text-[13px]">{value ? 'Sí' : '—'}</span>
                ),
            },
            {
                id: 'plantilla',
                accessorFn: (row) => row.plantilla_version,
                label: 'Plantilla',
                movil: 'secundaria',
                // «—» = el tipo todavía no tiene papel en la BD (vive en código, fallback).
                render: (value) => (
                    <span className="font-mono text-[13px] tabular-nums">
                        {value === null ? '—' : `v${String(value)}`}
                    </span>
                ),
            },
            {
                accessorKey: 'es_activo',
                label: 'Estado',
                movil: 'critica',
                render: (value) => (
                    <Pildora
                        texto={value ? 'Activo' : 'Inactivo'}
                        tono={value ? 'exito' : 'neutro'}
                    />
                ),
            },
        ],
        []
    )

    const columnaAcciones = useMemo(
        () =>
            crearColumnaAcciones<TipoDocumento>({
                acciones: puedeEditar
                    ? [
                          {
                              icon: Pencil,
                              label: 'Editar',
                              dataAccion: 'editar',
                              onClick: (t: TipoDocumento) => abrirEditar(t),
                          },
                      ]
                    : [],
                secundarias: puedeEditar
                    ? [
                          {
                              icon: Power,
                              label: 'Activar',
                              dataAccion: 'activar',
                              disabled: (t: TipoDocumento) => t.es_activo,
                              onClick: (t: TipoDocumento) => setPorCambiar(t),
                          },
                          {
                              icon: PowerOff,
                              label: 'Desactivar',
                              dataAccion: 'desactivar',
                              disabled: (t: TipoDocumento) => !t.es_activo,
                              onClick: (t: TipoDocumento) => setPorCambiar(t),
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
            const res = await cambiarEstadoTipoDocumento(porCambiar.id, activar)
            if (!res.success) return { error: res.error ?? 'No se pudo cambiar el estado.' }
            toast.success(activar ? 'Tipo activado' : 'Tipo desactivado')
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
                placeholderBusqueda="Buscar por clave o nombre…"
            />

            <DataTable<TipoDocumento>
                columns={[...columnas, columnaAcciones]}
                data={tipos}
                rowKey={(t) => t.id}
                estado={estadoTabla}
                emptyMessage="Sin tipos de documento para este filtro"
                onRetry={() => void recargar()}
            />

            <TipoDocumentoModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                modo={modo}
                tipo={seleccionado}
                onExito={() => void recargar()}
            />

            <ConfirmDialog
                open={porCambiar !== null}
                onOpenChange={(o) => {
                    if (!o) setPorCambiar(null)
                }}
                titulo={porCambiar?.es_activo ? 'Desactivar tipo' : 'Activar tipo'}
                descripcion={
                    porCambiar
                        ? porCambiar.es_activo
                            ? `«${porCambiar.nombre}» dejará de ofrecerse a los módulos que imprimen. Los documentos ya impresos no se tocan.`
                            : `«${porCambiar.nombre}» volverá a ofrecerse a los módulos que imprimen.`
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
