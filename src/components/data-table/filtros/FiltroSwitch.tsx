'use client'

import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

export interface FiltroSwitchProps {
    label: string
    activo: boolean
    onActivoChange: (a: boolean) => void
    disabled?: boolean
}

export function FiltroSwitch({ label, activo, onActivoChange, disabled }: FiltroSwitchProps) {
    return (
        // ⭐ MEJORA 26 Sep 2026 (responsive, medido):
        //  · Fuera el `size-8` del Switch: forzaba 32×32 sobre un track que por
        //    defecto es 24×44 → el switch salía deforme (cuadrado) y por debajo
        //    de los 44px de ancho de la Ley 5. Con su tamaño natural mide 44×24.
        //  · `min-h-11 md:min-h-0`: la fila (switch + etiqueta) es el objetivo
        //    táctil real — 44px en móvil, densidad normal en escritorio.
        <div className="flex min-h-11 items-center gap-2 md:min-h-0">
            <Switch
                id={`filtro-${label}`}
                checked={activo}
                onCheckedChange={onActivoChange}
                disabled={disabled}
            />
            <Label htmlFor={`filtro-${label}`} className="text-xs text-muted-foreground">{label}</Label>
        </div>
    )
}
