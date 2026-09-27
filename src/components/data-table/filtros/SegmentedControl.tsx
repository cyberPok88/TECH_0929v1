'use client'

import { Button } from '@/components/ui/button'
import type { FiltroOpcion } from './FiltroSelect'

export interface SegmentedControlProps {
    label: string
    opciones: FiltroOpcion[]
    valor: string
    onValorChange: (v: string) => void
    disabled?: boolean
}

export function SegmentedControl({ label, opciones, valor, onValorChange, disabled }: SegmentedControlProps) {
    return (
        <div className="flex w-full flex-col gap-1 md:w-auto">
            <span className="text-xs text-muted-foreground">{label}</span>
            <div role="group" aria-label={label} className="flex flex-wrap gap-1">
                {opciones.map((o) => (
                    <Button
                        key={o.valor}
                        type="button"
                        variant={valor === o.valor ? 'default' : 'outline'}
                        size="sm"
                        aria-pressed={valor === o.valor}
                        disabled={disabled}
                        onClick={() => onValorChange(o.valor)}
                        // ⭐ MEJORA 26 Sep 2026 — `h-11 md:h-8`: en móvil los botones
                        // medían 32px de alto y se quedaban por debajo de la Ley 5.
                        className="h-11 md:h-8"
                    >
                        {o.etiqueta}
                    </Button>
                ))}
            </div>
        </div>
    )
}
