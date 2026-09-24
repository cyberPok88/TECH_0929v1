'use client'

// FIX 02 Sep 2026 (implementación): `import { Label }` era un import sin usar
// (TS6133 — noUnusedLocals). El componente usa <legend>/<fieldset>, no Label.
import type { FiltroOpcion } from './FiltroSelect'

export interface FiltroMultiselectProps {
    label: string
    opciones: FiltroOpcion[]
    valores: string[]
    onValoresChange: (v: string[]) => void
    disabled?: boolean
}

export function FiltroMultiselect({ label, opciones, valores, onValoresChange, disabled }: FiltroMultiselectProps) {
    const toggle = (v: string) =>
        onValoresChange(valores.includes(v) ? valores.filter((x) => x !== v) : [...valores, v])

    return (
        <fieldset disabled={disabled} className="flex flex-col gap-1">
            <legend className="text-xs text-muted-foreground">{label}</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
                {opciones.map((o) => (
                    <label key={o.valor} className="flex cursor-pointer items-center gap-1.5 text-sm">
                        <input
                            type="checkbox"
                            checked={valores.includes(o.valor)}
                            onChange={() => toggle(o.valor)}
                            className="size-3.5"
                        />
                        {o.etiqueta}
                    </label>
                ))}
            </div>
        </fieldset>
    )
}
