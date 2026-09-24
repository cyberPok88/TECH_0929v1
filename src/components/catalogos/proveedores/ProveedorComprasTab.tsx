'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PROVEEDOR NOTAS TAB — Historial del proveedor (Guía 1.4 · rediseño · Smart)
// ANEXIÓN a la Guía 1.1: pestaña en la ficha del proveedor que lista sus NOTAS DE
// COMPRA (directas y de flujo) — read-only con enlace "Ver" hacia la ficha de la
// nota (/dashboard/compras/{id}). Visible solo con permiso `ver` del módulo.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Pildora } from '@/components/data-table'
import { listarNotasCompra } from '@/lib/actions/notas-compra'
import type { NotaCompra } from '@/types/notas-compra'
import {
    TEXTO_ESTADO_FISICO,
    TEXTO_ESTADO_PAGO_NOTA,
    TONO_ESTADO_FISICO,
    TONO_ESTADO_PAGO_NOTA,
} from '@/types/notas-compra'

function formatearMXN(monto: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto)
}

function formatearFecha(fecha: string): string {
    const [a, m, d] = fecha.split('-')
    return a && m && d ? `${d}/${m}/${a}` : fecha
}

export function ProveedorComprasTab({ proveedorId }: { proveedorId: string }) {
    const router = useRouter()
    const [notas, setNotas] = useState<NotaCompra[]>([])
    const [cargando, setCargando] = useState(true)
    const [errorCarga, setErrorCarga] = useState<string | null>(null)

    useEffect(() => {
        let activo = true
        void listarNotasCompra(
            { busqueda: '', idProveedor: proveedorId, estadoFisico: '', estadoPago: '', fechaDesde: '', fechaHasta: '' },
            1,
            10
        ).then((res) => {
            if (!activo) return
            setCargando(false)
            if (!res.success) {
                setErrorCarga(res.error ?? 'No se pudieron cargar las notas.')
                return
            }
            setNotas(res.data ?? [])
        })
        return () => {
            activo = false
        }
    }, [proveedorId])

    if (cargando) {
        return (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Cargando notas de compra…
            </div>
        )
    }

    if (errorCarga) {
        return <p className="py-3 text-sm text-destructive">{errorCarga}</p>
    }

    if (notas.length === 0) {
        return (
            <p className="py-3 text-sm text-muted-foreground">
                Este proveedor no tiene notas de compra todavía.
            </p>
        )
    }

    return (
        <div className="flex flex-col gap-1.5 py-1">
            {notas.map((n) => (
                <div
                    key={n.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2"
                >
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="font-mono text-xs font-semibold tabular-nums">{n.folio}</span>
                        <span className="text-xs text-muted-foreground">{formatearFecha(n.fecha_nota)}</span>
                        <span className="hidden items-center gap-1.5 sm:flex">
                            <Pildora texto={TEXTO_ESTADO_FISICO[n.estado_fisico]} tono={TONO_ESTADO_FISICO[n.estado_fisico]} />
                            {n.estado_pago_clave && (
                                <Pildora
                                    texto={TEXTO_ESTADO_PAGO_NOTA[n.estado_pago_clave]}
                                    tono={TONO_ESTADO_PAGO_NOTA[n.estado_pago_clave]}
                                />
                            )}
                        </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-xs tabular-nums">{formatearMXN(n.total)}</span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Ver nota"
                            aria-label={`Ver nota ${n.folio}`}
                            onClick={() => router.push(`/dashboard/compras/${n.id}`)}
                        >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    )
}
