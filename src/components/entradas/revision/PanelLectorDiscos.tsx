'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PANEL LECTOR DE DISCOS — el puesto lee el disco y llena la huella (Guía 1.6 · MEJORA 44)
// ═══════════════════════════════════════════════════════════════════════════════
// El técnico aprieta «Leer discos» y el AGENTE de esta PC devuelve lo que el disco
// dice de sí mismo: NS del firmware, marca, modelo, horas, temperatura… y ⭐ LA
// SALUD (el `Health` de **HDSentinel**, que es lo que decide: 100 pasa; menos es
// devolución). El técnico elige el disco y el wizard se llena — **sugerencia
// editable, nunca un candado**.
//
// ⚠ Si el agente no está corriendo, el panel lo dice y NO bloquea: la revisión
//   sigue a mano como siempre.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, RefreshCw, ScanSearch, ShieldAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { leerDiscos, type DiscoLeido } from '@/lib/lector-discos'

interface PanelLectorDiscosProps {
    /** ¿La categoría de la partida es un disco? Si no, el panel no se muestra. */
    aplica: boolean
    /** Se llama cuando el técnico elige un disco (el wizard decide qué llenar). */
    onElegir: (disco: DiscoLeido) => void
}

const num = (v: number | null, unidad = '') => (v === null || v === undefined ? '—' : `${v}${unidad}`)

export function PanelLectorDiscos({ aplica, onElegir }: PanelLectorDiscosProps) {
    const [cargando, setCargando] = useState(false)
    const [discos, setDiscos] = useState<DiscoLeido[]>([])
    const [nota, setNota] = useState<string | null>(null)
    const [leido, setLeido] = useState(false)

    if (!aplica) return null

    const leer = async () => {
        setCargando(true)
        setNota(null)
        try {
            const r = await leerDiscos()
            setDiscos(r.discos)
            setLeido(true)
            if (!r.agente) {
                setNota(r.error ?? 'No encontré el lector de discos en esta PC.')
                return
            }
            if (r.discos.length === 0) {
                setNota('El lector no encontró discos. Revisá que el dock esté encendido y con discos.')
                return
            }
            if (r.avisos.length > 0) toast.warning(r.avisos[0])
        } finally {
            setCargando(false)
        }
    }

    const aptos = discos.filter((d) => d.salud.apto).length

    return (
        <div className="space-y-2.5 rounded-lg border border-dashed border-border bg-surface-2 p-3.5">
            <div className="flex flex-wrap items-center gap-3">
                <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 gap-2 px-3.5 text-[13.5px]"
                    onClick={() => void leer()}
                    disabled={cargando}
                    data-accion="leer-discos"
                >
                    {cargando ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                        <ScanSearch className="h-4 w-4" aria-hidden="true" />
                    )}
                    {cargando ? 'Leyendo los discos…' : 'Leer discos'}
                </Button>
                {leido && discos.length > 0 ? (
                    <span className="text-[12px] text-muted-foreground">
                        {discos.length} disco(s) · <b className="text-foreground">{aptos} pasa(n)</b> (
                        {discos.length - aptos} a devolución)
                    </span>
                ) : (
                    <span className="text-[11.5px] text-muted-foreground">
                        Lee los discos del dock y llena la marca, el NS y las horas. La salud decide con el{' '}
                        <b className="text-foreground">Health de HDSentinel</b>.
                    </span>
                )}
            </div>

            {nota ? (
                <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12.5px]">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{nota}</span>
                </p>
            ) : null}

            {discos.length > 0 ? (
                <ul className="space-y-1.5">
                    {discos.map((d, i) => {
                        const ok = d.salud.apto
                        return (
                            <li
                                key={`${d.serial ?? d.modelo ?? 'disco'}-${i}`}
                                className={cn(
                                    'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2 text-[12.5px]',
                                    ok ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-rose-500/40 bg-rose-500/5'
                                )}
                            >
                                <span className="font-semibold">{d.marca ?? 'marca ?'}</span>
                                <span className="text-muted-foreground">{d.modelo ?? '—'}</span>
                                <span className="font-mono">{d.serial ?? 'sin NS'}</span>
                                <span className={cn('font-semibold', ok ? 'text-emerald-600' : 'text-rose-600')}>
                                    {ok ? 'PASA' : 'NO PASA'} · salud {num(d.salud.puntaje, ' %')}
                                    {d.salud.fuente !== 'hdsentinel' ? ` (${d.salud.fuente})` : ''}
                                </span>
                                <span className="text-muted-foreground">
                                    {num(d.horas_uso, ' h')} · {num(d.encendidos)} enc. · {num(d.temperatura_c, ' °C')}
                                    {d.rpm ? ` · ${d.rpm} rpm` : ''}
                                    {d.bahia ? ` · bahía ${d.bahia}` : ''}
                                </span>
                                <span className="flex-1" />
                                <Button
                                    type="button"
                                    variant={ok ? 'default' : 'outline'}
                                    className="min-h-9 px-3 text-[12.5px]"
                                    onClick={() => {
                                        onElegir(d)
                                        toast.success(
                                            ok
                                                ? `Disco ${d.serial ?? ''} aplicado al formulario.`
                                                : `Disco ${d.serial ?? ''}: salud ${d.salud.puntaje} % — va a devolución.`
                                        )
                                    }}
                                    data-accion="usar-disco"
                                >
                                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                                    Usar
                                </Button>
                            </li>
                        )
                    })}
                </ul>
            ) : null}
        </div>
    )
}
