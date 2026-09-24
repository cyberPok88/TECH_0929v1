'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENTE FICHA — Expediente en página [id] (Guía 1.3 · Parte 7 · Smart)
// Header + acciones (Editar · Suspender/Levantar) + pestañas:
//   General · Fiscal · Direcciones · Contactos (activas)
//   Historial → Parte 8 · Cotizaciones 1.7 · Ventas 1.8 · Cobros 1.9 (disabled)
// Carga ClienteDetalle (obtenerCliente — creado en P4). Editar reutiliza el
// ClienteModal (modo editar); la suspensión usa SuspenderClienteDialog (P6).
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { Pencil, ShieldAlert, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Pildora } from '@/components/data-table'
import { ConfirmarAccionDialog } from '@/components/ui/ConfirmarAccionDialog'
import { ClienteModal } from '@/components/catalogos/clientes/ClienteModal'
import { SuspenderClienteDialog } from '@/components/catalogos/clientes/SuspenderClienteDialog'
import { ClienteGeneralTab } from '@/components/catalogos/clientes/ClienteGeneralTab'
import { ClienteFiscalTab } from '@/components/catalogos/clientes/ClienteFiscalTab'
import { ClienteDireccionesTab } from '@/components/catalogos/clientes/ClienteDireccionesTab'
import { ClienteContactosTab } from '@/components/catalogos/clientes/ClienteContactosTab'
import { ClienteHistorialTab } from '@/components/catalogos/clientes/ClienteHistorialTab'
import { levantarSuspensionCliente, obtenerCliente } from '@/lib/actions/clientes'
import { useCanAction } from '@/hooks/useCanAction'
import {
    TEXTO_ESTADO_CLIENTE,
    TEXTO_TIPO_PERSONA,
    TONO_ESTADO_CLIENTE,
    TONO_TIPO_PERSONA,
    estadoDeCliente,
} from '@/types/clientes'
import type { ClienteDetalle } from '@/types/clientes'

const RUTA = '/dashboard/catalogos/clientes'

export function ClienteFicha({ clienteId }: { clienteId: string }) {
    const [detalle, setDetalle] = useState<ClienteDetalle | null>(null)
    const [estado, setEstado] = useState<'cargando' | 'idle' | 'error' | 'ausente'>('cargando')
    const [error, setError] = useState('')

    const [editarAbierto, setEditarAbierto] = useState(false)
    const [suspenderAbierto, setSuspenderAbierto] = useState(false)
    const [levantarConfirmacion, setLevantarConfirmacion] = useState(false)

    const puedeEditar = useCanAction(RUTA, 'editar')

    const cargar = useCallback(async () => {
        const res = await obtenerCliente(clienteId)
        if (!res.success || !res.data) {
            setEstado('ausente')
            setError(res.error ?? 'El cliente no existe.')
            return
        }
        setDetalle(res.data as ClienteDetalle)
        setEstado('idle')
    }, [clienteId])

    useEffect(() => {
        let activo = true
        void obtenerCliente(clienteId).then((res) => {
            if (!activo) return
            if (!res.success || !res.data) {
                setEstado('ausente')
                setError(res.error ?? 'El cliente no existe.')
                return
            }
            setDetalle(res.data as ClienteDetalle)
            setEstado('idle')
        })
        return () => {
            activo = false
        }
    }, [clienteId])

    if (estado === 'cargando') return <p className="py-8 text-sm text-muted-foreground">Cargando cliente…</p>
    if (estado !== 'idle' || !detalle) {
        return (
            <p className="py-8 text-sm text-destructive">
                {error || 'No se pudo cargar el cliente.'}
            </p>
        )
    }

    const estadoCliente = estadoDeCliente(detalle)
    const puedeSuspender = puedeEditar && !detalle.es_archivado

    return (
        <div className="flex flex-col gap-4">
            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                    <h1 className="text-xl font-semibold">{detalle.nombre_comercial}</h1>
                    <p className="font-mono text-xs text-muted-foreground">{detalle.codigo}</p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Pildora
                            texto={TEXTO_ESTADO_CLIENTE[estadoCliente]}
                            tono={TONO_ESTADO_CLIENTE[estadoCliente]}
                        />
                        {detalle.marca_nombre && (
                            <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-muted-foreground">
                                {detalle.marca_nombre}
                            </span>
                        )}
                        <Pildora
                            texto={TEXTO_TIPO_PERSONA[detalle.tipo_persona]}
                            tono={TONO_TIPO_PERSONA[detalle.tipo_persona]}
                        />
                        {detalle.es_suspendido && detalle.motivo_suspension && (
                            <span className="text-xs text-destructive">
                                Motivo: {detalle.motivo_suspension}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {puedeEditar && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setEditarAbierto(true)}
                        >
                            <Pencil className="mr-1.5 h-4 w-4" /> Editar
                        </Button>
                    )}
                    {puedeSuspender &&
                        (detalle.es_suspendido ? (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setLevantarConfirmacion(true)}
                            >
                                <ShieldCheck className="mr-1.5 h-4 w-4" /> Levantar suspensión
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={() => setSuspenderAbierto(true)}
                            >
                                <ShieldAlert className="mr-1.5 h-4 w-4" /> Suspender
                            </Button>
                        ))}
                </div>
            </div>

            {/* ── Pestañas ───────────────────────────────────────────────────── */}
            <Tabs defaultValue="general">
                <TabsList className="w-full flex-wrap justify-start">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
                    <TabsTrigger value="direcciones">Direcciones</TabsTrigger>
                    <TabsTrigger value="contactos">Contactos</TabsTrigger>
                    <TabsTrigger value="historial">Historial</TabsTrigger>
                    <TabsTrigger value="cotizaciones" disabled title="Cotizaciones 1.7">
                        Cotizaciones · 1.7
                    </TabsTrigger>
                    <TabsTrigger value="ventas" disabled title="Ventas 1.8">
                        Ventas · 1.8
                    </TabsTrigger>
                    <TabsTrigger value="cobros" disabled title="Cobros 1.9">
                        Cobros · 1.9
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="pt-3">
                    <ClienteGeneralTab detalle={detalle} />
                </TabsContent>
                <TabsContent value="fiscal" className="pt-3">
                    <ClienteFiscalTab detalle={detalle} />
                </TabsContent>
                <TabsContent value="direcciones" className="pt-3">
                    <ClienteDireccionesTab direcciones={detalle.direcciones} />
                </TabsContent>
                <TabsContent value="contactos" className="pt-3">
                    <ClienteContactosTab contactos={detalle.contactos} />
                </TabsContent>
                <TabsContent value="historial" className="pt-3">
                    <ClienteHistorialTab clienteId={detalle.id} />
                </TabsContent>
            </Tabs>

            <p className="rounded-md border border-border/60 bg-surface/30 px-3 py-2 text-xs text-muted-foreground">
                Los documentos (Cotizaciones/Ventas/Cobros) se habilitan cuando existan las guías
                1.7/1.8/1.9.
            </p>

            {/* ⚠️ Instancias SIEMPRE montadas (Radix). */}
            <ClienteModal
                open={editarAbierto}
                modo="editar"
                clienteId={detalle.id}
                onOpenChange={setEditarAbierto}
                onSuccess={() => void cargar()}
            />
            <SuspenderClienteDialog
                open={suspenderAbierto}
                clienteId={detalle.id}
                nombreCliente={detalle.nombre_comercial}
                onOpenChange={setSuspenderAbierto}
                onSuccess={() => void cargar()}
            />
            <ConfirmarAccionDialog
                open={levantarConfirmacion}
                onOpenChange={setLevantarConfirmacion}
                titulo="Levantar suspensión"
                descripcion={`${detalle.nombre_comercial} vuelve a estar disponible para ventas y cobros.`}
                confirmLabel="Levantar"
                variant="default"
                successMessage="Suspensión levantada"
                onConfirm={async () => {
                    const res = await levantarSuspensionCliente(detalle.id)
                    if (!res.success) return { error: res.error ?? 'No se pudo completar la acción.' }
                    toast.success('Suspensión levantada')
                    await cargar()
                    return { error: null }
                }}
            />
        </div>
    )
}
