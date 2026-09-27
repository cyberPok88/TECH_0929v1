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
        <div className="flex w-full flex-col gap-1 md:w-auto">
            <Label className="text-xs text-muted-foreground">Fechas</Label>
            {/* ⭐ MEJORA 26 Sep 2026 (responsive, medido): antes cada input era `w-full`
                (100% del contenedor) dentro de una fila flex → los DOS pedían el ancho
                completo y el contenido se desbordaba (medido: 2 elementos con
                scrollWidth > clientWidth a 320px). Con `min-w-0 flex-1` comparten la
                fila sin desbordar y sin ganar alto.
                `flex-wrap` es la válvula de escape: si el contenedor es más angosto que
                dos campos (p. ej. la celda de 208px que le da el grid de Recepción entre
                768 y 1023px con el Sidebar de 256px puesto), los campos BAJAN de línea en
                vez de desbordar o de encogerse hasta truncar la fecha.
                `md:w-[9.5rem]` (y no `w-40` = 10rem): en `lg` la celda de Recepción mide
                21rem y dos campos de 10rem + el guion la superan por 2px — medido, eso
                forzaba el salto de línea y costaba 44px de tabla en escritorio. */}
            <div className="flex flex-wrap items-center gap-2">
                <input
                    type="date"
                    value={desde ?? ''}
                    onChange={(e) => onDesdeChange(e.target.value)}
                    disabled={disabled}
                    className="h-11 w-full min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-sm md:h-9 md:w-[9.5rem] md:flex-none"
                />
                <span className="shrink-0 text-xs text-muted-foreground">—</span>
                <input
                    type="date"
                    value={hasta ?? ''}
                    onChange={(e) => onHastaChange(e.target.value)}
                    disabled={disabled}
                    className="h-11 w-full min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-sm md:h-9 md:w-[9.5rem] md:flex-none"
                />
            </div>
        </div>
    )
}
