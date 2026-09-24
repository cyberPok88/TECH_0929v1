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
        <div className="flex items-center gap-2">
            <Switch
                id={`filtro-${label}`}
                checked={activo}
                onCheckedChange={onActivoChange}
                disabled={disabled}
                className="size-8"
            />
            <Label htmlFor={`filtro-${label}`} className="text-xs text-muted-foreground">{label}</Label>
        </div>
    )
}
