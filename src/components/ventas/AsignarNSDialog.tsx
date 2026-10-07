'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ASIGNAR NS DIALOG — el paso 3 de la emisión (Guía 1.8 · PLAN §6.5)
// Pide UN NS POR PIEZA de cada renglón que lo exija (R30) y muestra la HISTORIA de
// cada pieza consultando el concentrado de 1.6 (`consultarNumeroSerie`).
//
// ⭐ Esto es la TRAZABILIDAD INVERSA: 1.6 responde «de dónde vino esta pieza»;
//    aquí se responde «a quién y cuándo se vendió». El caso de uso es la GARANTÍA.
// ⚠️ `encontrado: false` NO ES UN ERROR — lo dice el tipo de 1.6: el negocio vende
//    piezas que entraron SIN ACTA. Se avisa, no se bloquea: bloquear obligaría a dar
//    de alta una entrada falsa para poder vender.
// ⚠️ El rechazo del «ya vendido» NO se hace aquí (el navegador no ve las demás notas):
//    lo hace `fn_emitir_nota_remision` DENTRO de la transacción (b7). Aquí solo se
//    evita el repetido DENTRO de la misma nota — que sí es visible.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { CheckCircle2, HelpCircle, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { consultarNumeroSerie } from '@/lib/actions/entradas'
import type { ResultadoConsultaNs } from '@/types/entradas'
import type { PartidaRemisionInput } from '@/types/ventas'

/** Un renglón que exige NS, ya desglosado a N piezas. */
interface PiezaRequerida {
    id_partida: string
    descripcion: string
    /** 1..N — el índice de la pieza dentro del renglón. */
    indice: number
    total: number
}

interface AsignarNSDialogProps {
    open: boolean
    onOpenChange: (abierto: boolean) => void
    partidas: PartidaRemisionInput[]
    /** Las series ya capturadas, por id de partida. */
    series: Record<string, string[]>
    onConfirmar: (series: Record<string, string[]>) => void
}

export function AsignarNSDialog({
    open,
    onOpenChange,
    partidas,
    series,
    onConfirmar,
}: AsignarNSDialogProps) {
    // ⭐ FIX 02 Oct 2026 — LA PROPIEDAD `series` **SE LEE**: antes llegaba y se descartaba
    //    (`useState({})`), así que **volver a abrir el diálogo BORRABA lo ya capturado**. Ahora se
    //    siembra el estado desde lo que la fila ya tiene (la clave es `id_partida#indice`, la misma
    //    que usa `clave()`).
    const [valores, setValores] = useState<Record<string, string>>(() => {
        const inicial: Record<string, string> = {}
        for (const p of partidas) {
            for (const [i, ns] of (series[p.id] ?? []).entries()) {
                inicial[`${p.id}#${i + 1}`] = ns
            }
        }
        return inicial
    })
    const [historias, setHistorias] = useState<Record<string, ResultadoConsultaNs>>({})
    const [consultando, setConsultando] = useState<string | null>(null)

    /** El desglose: un campo por PIEZA (no por renglón). */
    const piezas: PiezaRequerida[] = partidas.flatMap((p) =>
        Array.from({ length: Math.max(1, Number(p.cantidad) || 1) }, (_, i) => ({
            id_partida: p.id,
            descripcion: p.descripcion_snapshot || 'Producto',
            indice: i + 1,
            total: Number(p.cantidad) || 1,
        }))
    )

    const clave = (p: PiezaRequerida) => `${p.id_partida}#${p.indice}`

    /** ⭐ Al capturar se consulta el concentrado: la historia de ESA pieza. */
    const consultar = async (p: PiezaRequerida, ns: string) => {
        const k = clave(p)
        setValores((prev) => ({ ...prev, [k]: ns }))
        if (ns.trim().length < 3) return
        setConsultando(k)
        const res = await consultarNumeroSerie(ns)
        setConsultando(null)
        if (res.success && res.data) setHistorias((prev) => ({ ...prev, [k]: res.data as ResultadoConsultaNs }))
    }

    /** El repetido DENTRO de la nota: eso sí es visible aquí y se avisa. */
    const estaRepetido = (ns: string): boolean =>
        Object.entries(valores).some(([, v]) => v.trim() !== '' && v.trim() === ns.trim())

    const capturados = Object.values(valores).filter((v) => v.trim() !== '').length

    const confirmar = () => {
        const siguiente: Record<string, string[]> = {}
        for (const p of piezas) {
            const v = (valores[clave(p)] ?? '').trim()
            if (v === '') continue
            siguiente[p.id_partida] = [...(siguiente[p.id_partida] ?? []), v]
        }
        onConfirmar(siguiente)
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Asignar números de serie</DialogTitle>
                    <DialogDescription>
                        Un número de serie por PIEZA. Se capturan {piezas.length} y llevas{' '}
                        <b className="tabular-nums">{capturados}</b>.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-3">
                    {piezas.map((p) => {
                        const k = clave(p)
                        const h = historias[k]
                        const valor = valores[k] ?? ''
                        const repetido = valor.trim() !== '' && estaRepetido(valor)
                        return (
                            <div key={k} className="flex flex-col gap-1.5">
                                <span className="text-[12.5px] text-muted-foreground">
                                    <b className="text-foreground">{p.descripcion}</b> · pieza {p.indice} de{' '}
                                    {p.total}
                                </span>
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={valor}
                                        onChange={(e) => void consultar(p, e.target.value)}
                                        placeholder="Teclea o escanea el número de serie"
                                        className="font-mono"
                                    />
                                    {consultando === k && <Spinner className="py-0" />}
                                </div>
                                {/* ⭐ La HISTORIA de la pieza — lo que 1.6 sabe de ella */}
                                {h && !h.encontrado && (
                                    <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                                        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                        No está en el concentrado (entró sin acta). Se puede vender igual.
                                    </span>
                                )}
                                {h?.encontrado && (
                                    <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground">
                                        {h.resultado === 'NO_PASA' ? (
                                            <XCircle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
                                        ) : (
                                            <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                                        )}
                                        <span>Entrada {h.folio ?? '—'}</span>
                                        <span>{h.proveedor ?? '—'}</span>
                                        <span>{h.fecha_entrada ?? '—'}</span>
                                        <span>Revisión {h.resultado ?? '—'}</span>
                                    </span>
                                )}
                                {repetido && (
                                    <span className="text-[12px] font-medium text-destructive">
                                        Ese número de serie ya está capturado en esta nota.
                                    </span>
                                )}
                            </div>
                        )
                    })}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Volver
                    </Button>
                    <Button type="button" onClick={confirmar}>
                        Guardar {capturados} de {piezas.length}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
