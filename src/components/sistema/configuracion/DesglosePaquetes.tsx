'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// DESGLOSE DE PAQUETES — el RADIO DE EXPLOSIÓN (Guía 2.4 · 05 Oct 2026)
//
// ⭐ ESTE COMPONENTE **ES** EL CANDADO. La herramienta de borrado tiene un solo
//   candado de ejecución —el conteo previo— y vive acá: por CADA TABLA, no por
//   paquete. Medido con datos reales: un paquete «Entradas» con 3 entradas son
//   **13 filas en 7 tablas** (partidas, números de serie, lecturas SMART, etapas,
//   devoluciones). Una pantalla que dijera «Entradas: 3» MENTIRÍA, y el usuario
//   apretaría el botón creyendo que pierde tres filas.
//
// ⚠️ Las tablas con 0 se muestran: el cero también informa (dice que ese paquete
//    está vacío). Esconderlas haría pensar que hay tablas que no se tocan.
// ⚠️ Dumb: recibe los números contados. No cuenta, no decide, no borra.
// ═══════════════════════════════════════════════════════════════════════════════

import type { FilaConteo } from '@/types/configuracion'
import { cn } from '@/lib/utils'

interface DesglosePaquetesProps {
    /** Las filas del paquete, tal como las devolvió la RPC (una por tabla). */
    filas: FilaConteo[]
    className?: string
}

export function DesglosePaquetes({ filas, className }: DesglosePaquetesProps) {
    if (filas.length === 0) {
        return (
            <p className={cn('px-4 py-2 text-[11.5px] text-muted-foreground', className)}>
                Contando…
            </p>
        )
    }

    const total = filas.reduce((n, f) => n + Number(f.filas), 0)

    return (
        <div className={cn('space-y-0.5 px-4 py-2', className)}>
            {filas.map((f) => {
                const vacia = Number(f.filas) === 0
                return (
                    <div
                        key={f.tabla}
                        className="flex items-baseline justify-between gap-3 text-[11.5px]"
                    >
                        <span
                            className={cn(
                                'min-w-0 truncate font-mono',
                                vacia ? 'text-muted-foreground/60' : 'text-muted-foreground'
                            )}
                        >
                            {f.tabla}
                        </span>
                        <span
                            className={cn(
                                'shrink-0 font-mono tabular-nums',
                                vacia ? 'text-muted-foreground/60' : 'font-semibold text-foreground'
                            )}
                        >
                            {f.filas}
                        </span>
                    </div>
                )
            })}
            <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-border pt-1 text-[12px]">
                <span className="font-semibold">Total del paquete</span>
                <span className="font-mono font-semibold tabular-nums">{total}</span>
            </div>
        </div>
    )
}
