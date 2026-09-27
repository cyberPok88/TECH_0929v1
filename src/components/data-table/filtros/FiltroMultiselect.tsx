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
        <fieldset disabled={disabled} className="flex w-full flex-col gap-1 md:w-auto">
            <legend className="text-xs text-muted-foreground">{label}</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
                {opciones.map((o) => (
                    // ⭐ MEJORA 26 Sep 2026 — el checkbox mide 14×14 (no se puede agrandar
                    // sin romper la convención visual de checkbox), pero el OBJETIVO
                    // táctil es la etiqueta completa: `min-h-11` en móvil le da los 44px
                    // de la Ley 5 y `md:min-h-0` devuelve la densidad de escritorio.
                    <label
                        key={o.valor}
                        className="flex min-h-11 cursor-pointer items-center gap-1.5 text-sm md:min-h-0"
                    >
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
