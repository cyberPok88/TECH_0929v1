'use client'

import { Label } from '@/components/ui/label'

export interface RangoFechasProps {
    desde?: string
    hasta?: string
    onDesdeChange: (v: string) => void
    onHastaChange: (v: string) => void
    disabled?: boolean
}

export function RangoFechas({ desde, hasta, onDesdeChange, onHastaChange, disabled }: RangoFechasProps) {
    return (
        <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Fechas</Label>
            <div className="flex items-center gap-2">
                <input
                    type="date"
                    value={desde ?? ''}
                    onChange={(e) => onDesdeChange(e.target.value)}
                    disabled={disabled}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm md:w-40"
                />
                <span className="text-xs text-muted-foreground">—</span>
                <input
                    type="date"
                    value={hasta ?? ''}
                    onChange={(e) => onHastaChange(e.target.value)}
                    disabled={disabled}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm md:w-40"
                />
            </div>
        </div>
    )
}
