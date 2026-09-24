'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PARTIDAS DE REVISIÓN — contenido de la fila expandible del acordeón del técnico
// (Guía 1.6 · MEJORA 20 Sep 2026). Espejo del acordeón de la V5
// (`listarEntradasRevConPartidas`): el técnico ve las PARTIDAS del ingreso con su
// AVANCE (recibidas · revisadas · restantes · estado) y elige cuál iniciar.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { Play } from 'lucide-react'

import { Pildora } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { listarPartidasConAvance } from '@/lib/actions/entradas'
import type { Entrada, PartidaConAvance } from '@/types/entradas'

interface PartidasRevisionProps {
    entrada: Entrada
    /** Abre el wizard de revisión en esa partida. */
    onIniciar: (idPartida: string) => void
}

export function PartidasRevision({ entrada, onIniciar }: PartidasRevisionProps) {
    const [partidas, setPartidas] = useState<PartidaConAvance[]>([])
    const [cargando, setCargando] = useState(true)

    useEffect(() => {
        let activo = true
        void listarPartidasConAvance(entrada.id).then((r) => {
            if (!activo) return
            if (r.success) setPartidas(r.data ?? [])
            setCargando(false)
        })
        return () => {
            activo = false
        }
    }, [entrada.id])

    if (cargando) return <p className="text-sm text-muted-foreground">Cargando partidas…</p>
    if (partidas.length === 0) return <p className="text-sm text-muted-foreground">Sin partidas.</p>

    return (
        <table className="w-full text-xs">
            <thead className="text-center text-muted-foreground">
                <tr>
                    <th className="py-1 pr-3">Partida</th>
                    <th className="py-1 pr-3">Producto</th>
                    <th className="py-1 pr-3">Recibidas</th>
                    <th className="py-1 pr-3">Revisadas</th>
                    <th className="py-1 pr-3">Restantes</th>
                    <th className="py-1 pr-3">Estado</th>
                    <th className="py-1" />
                </tr>
            </thead>
            <tbody>
                {partidas.map((p) => {
                    const completa = p.restantes <= 0
                    return (
                        <tr key={p.id} className="border-t border-border">
                            <td className="py-1 pr-3 text-center tabular-nums">{p.partida}</td>
                            <td className="py-1 pr-3 text-center">{p.categoria_nombre ?? '—'}</td>
                            <td className="py-1 pr-3 text-center tabular-nums">{p.cantidad_original}</td>
                            <td className="py-1 pr-3 text-center tabular-nums">{p.revisadas}</td>
                            <td className="py-1 pr-3 text-center tabular-nums">{p.restantes}</td>
                            <td className="py-1 pr-3 text-center">
                                {p.estado_partida === 'OK' ? (
                                    <Pildora texto="OK" tono="exito" />
                                ) : p.estado_partida === 'MAL' ? (
                                    <Pildora texto="Con malas" tono="peligro" />
                                ) : (
                                    <Pildora texto="Pendiente" tono="advertencia" />
                                )}
                            </td>
                            <td className="py-1 text-center">
                                {!completa && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onIniciar(p.id)}
                                    >
                                        <Play className="mr-1 h-3.5 w-3.5" /> Iniciar
                                    </Button>
                                )}
                            </td>
                        </tr>
                    )
                })}
            </tbody>
        </table>
    )
}
