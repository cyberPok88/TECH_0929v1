'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENTE HISTORIAL TAB — Eventos de la bitácora (Guía 1.3 · P8 · Smart ligero)
// Autocontenido: carga listarBitacoraCliente (la ficha no trae el historial en el
// embeds de datos). Tabla read-only con DataTable local (paginación del kit).
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'

import { DataTable, Pildora } from '@/components/data-table'
import type { ColumnDefExtension, EstadoTabla } from '@/components/data-table'
import { listarBitacoraCliente } from '@/lib/actions/clientes'
import { formatearFechaHora } from '@/lib/utils/formatters'
import type { EventoBitacoraCliente } from '@/types/clientes'

// Mapa 14 eventos → texto legible + tono (los tonos agrupan por naturaleza).
export const TEXTO_EVENTO: Record<EventoBitacoraCliente['tipo_evento'], string> = {
    alta: 'Alta del cliente',
    edicion: 'Actualización de datos',
    activacion: 'Cliente activado',
    desactivacion: 'Cliente desactivado',
    archivado: 'Cliente archivado',
    restauracion: 'Cliente restaurado',
    suspension: 'Suspensión',
    levantamiento: 'Suspensión levantada',
    direccion_alta: 'Dirección agregada',
    direccion_edicion: 'Dirección actualizada',
    direccion_baja: 'Dirección eliminada',
    contacto_alta: 'Contacto agregado',
    contacto_edicion: 'Contacto actualizado',
    contacto_baja: 'Contacto eliminado',
}

const TONO_EVENTO: Record<
    EventoBitacoraCliente['tipo_evento'],
    'exito' | 'neutro' | 'advertencia' | 'peligro'
> = {
    alta: 'exito',
    edicion: 'neutro',
    activacion: 'exito',
    desactivacion: 'neutro',
    archivado: 'advertencia',
    restauracion: 'exito',
    suspension: 'peligro',
    levantamiento: 'exito',
    direccion_alta: 'exito',
    direccion_edicion: 'neutro',
    direccion_baja: 'advertencia',
    contacto_alta: 'exito',
    contacto_edicion: 'neutro',
    contacto_baja: 'advertencia',
}

export function ClienteHistorialTab({ clienteId }: { clienteId: string }) {
    const [eventos, setEventos] = useState<EventoBitacoraCliente[]>([])
    const [estadoTabla, setEstadoTabla] = useState<EstadoTabla>('loading')

    const cargar = useCallback(async () => {
        const res = await listarBitacoraCliente(clienteId)
        if (!res.success) {
            setEstadoTabla('error')
            return
        }
        setEventos(res.data ?? [])
        setEstadoTabla('idle')
    }, [clienteId])

    useEffect(() => {
        let activo = true
        void listarBitacoraCliente(clienteId).then((res) => {
            if (!activo) return
            if (!res.success) {
                setEstadoTabla('error')
                return
            }
            setEventos(res.data ?? [])
            setEstadoTabla('idle')
        })
        return () => {
            activo = false
        }
    }, [clienteId])

    const columnas = ((): (ColumnDef<EventoBitacoraCliente> & ColumnDefExtension<EventoBitacoraCliente>)[] => [
        {
            accessorKey: 'created_at',
            label: 'Fecha',
            movil: 'critica',
            render: (value) => <span className="text-xs">{formatearFechaHora(String(value))}</span>,
        },
        {
            accessorKey: 'tipo_evento',
            label: 'Evento',
            movil: 'critica',
            render: (value) => (
                <Pildora
                    texto={TEXTO_EVENTO[value as keyof typeof TEXTO_EVENTO]}
                    tono={TONO_EVENTO[value as keyof typeof TONO_EVENTO]}
                />
            ),
        },
        {
            accessorKey: 'descripcion',
            label: 'Detalle',
            movil: 'secundaria',
        },
        {
            accessorKey: 'usuario_nombre',
            label: 'Usuario',
            movil: 'ocultar',
            render: (value) => (value ? String(value) : '—'),
        },
    ])()

    return (
        <DataTable
            columns={columnas}
            data={eventos}
            rowKey={(e) => e.id}
            estado={estadoTabla}
            onRetry={() => void cargar()}
            emptyMessage="Sin eventos registrados (la bitácora se llena sola al operar el cliente)."
            showColumnSelector={false}
        />
    )
}
