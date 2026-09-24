'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// DIVERGENCIAS CATALOGO — Bloqueos de cotejo (Guía 1.6 · P7 · Smart)
// Lista divergencias con acción "Resolver" (solo admin · permiso aprobar).
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { ShieldCheck } from 'lucide-react'

import { DataTable, Pildora, crearColumnaAcciones } from '@/components/data-table'
import type { ColumnDefExtension, EstadoTabla } from '@/components/data-table'
import { usePageConfig } from '@/hooks/usePageConfig'
import { useCanAction } from '@/hooks/useCanAction'
import { listarDivergencias } from '@/lib/actions/entradas'
import type { Divergencia } from '@/types/entradas'
import { DivergenciaModal } from '@/components/entradas/DivergenciaModal'

const RUTA = '/dashboard/entradas/divergencias'

export function DivergenciasCatalogo() {
    const [divergencias, setDivergencias] = useState<Divergencia[]>([])
    const [estadoTabla, setEstadoTabla] = useState<EstadoTabla>('loading')
    const [seleccion, setSeleccion] = useState<Divergencia | null>(null)

    const puedeAprobar = useCanAction(RUTA, 'aprobar')

    useEffect(() => {
        let activo = true
        void listarDivergencias().then((res) => {
            if (!activo) return
            if (!res.success) {
                setEstadoTabla('error')
                return
            }
            setDivergencias(res.data ?? [])
            setEstadoTabla('idle')
        })
        return () => {
            activo = false
        }
    }, [])

    const recargar = useCallback(async () => {
        setEstadoTabla('loading')
        const res = await listarDivergencias()
        if (!res.success) {
            setEstadoTabla('error')
            return
        }
        setDivergencias(res.data ?? [])
        setEstadoTabla('idle')
    }, [])

    const columnaAcciones = useMemo(
        () =>
            crearColumnaAcciones<Divergencia>({
                acciones: [
                    ...(puedeAprobar
                        ? [
                              {
                                  icon: ShieldCheck,
                                  label: 'Resolver',
                                  dataAccion: 'aprobar',
                                  disabled: (d: Divergencia) => d.estado !== 'abierta',
                                  onClick: (d: Divergencia) => setSeleccion(d),
                              },
                          ]
                        : []),
                ],
            }),
        [puedeAprobar]
    )

    const columnas = useMemo<(ColumnDef<Divergencia> & ColumnDefExtension<Divergencia>)[]>(
        () => [
            {
                accessorKey: 'entrada_folio',
                label: 'Entrada',
                movil: 'critica',
                render: (valor) => <span className="font-mono text-xs tabular-nums">{String(valor ?? '—')}</span>,
            },
            {
                accessorKey: 'causa_nombre',
                label: 'Causa',
                movil: 'secundaria',
                render: (_valor, fila) => <span className="block truncate">{fila.causa_nombre ?? '—'}</span>,
            },
            {
                id: 'diferencia',
                accessorFn: (d) => Number(d.cantidad_esperada) - Number(d.cantidad_encontrada),
                label: 'Diferencia',
                movil: 'secundaria',
                render: (_valor, fila) => (
                    <span className="tabular-nums">
                        {Number(fila.cantidad_esperada) - Number(fila.cantidad_encontrada)}
                    </span>
                ),
            },
            {
                accessorKey: 'estado',
                label: 'Estado',
                movil: 'critica',
                render: (_valor, fila) => (
                    <Pildora texto={fila.estado === 'abierta' ? 'Abierta' : 'Resuelta'} tono={fila.estado === 'abierta' ? 'peligro' : 'exito'} />
                ),
            },
            columnaAcciones,
        ],
        [columnaAcciones]
    )

    usePageConfig({
        info: { title: 'Divergencias', subtitle: 'Entradas' },
        path: RUTA,
    })

    return (
        <>
            <DataTable<Divergencia>
                columns={columnas}
                data={divergencias}
                rowKey={(d) => d.id}
                estado={estadoTabla}
                emptyMessage="No hay divergencias."
                onRetry={() => {
                    void recargar()
                }}
                showColumnSelector
            />
            <DivergenciaModal
                key={seleccion?.id ?? 'ninguna'}
                open={seleccion !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) setSeleccion(null)
                }}
                divergencia={seleccion}
                onGuardado={() => {
                    void recargar()
                }}
            />
        </>
    )
}
