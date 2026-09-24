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
        <div className="flex flex-col gap-1">
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
                        className="h-8"
                    >
                        {o.etiqueta}
                    </Button>
                ))}
            </div>
        </div>
    )
}
