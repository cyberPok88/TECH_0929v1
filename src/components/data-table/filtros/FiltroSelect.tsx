'use client'

import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface FiltroOpcion {
    valor: string
    etiqueta: string
}

export interface FiltroSelectProps {
    label: string
    opciones: FiltroOpcion[]
    valor: string
    onValorChange: (v: string) => void
    centinela?: string
    etiquetaCentinela?: string
    cargando?: boolean
    disabled?: boolean
    /** ⭐ MEJORA 26 Sep 2026 — `'bloque'` (default): ancho de bloque en la fila del
     *  `FiltrosBar` (`md:w-44`). `'completo'`: ocupa el panel que lo hospeda — lo usa el
     *  filtro de columna, que vive dentro de un popover y necesita todo su ancho. */
    ancho?: 'bloque' | 'completo'
}

export function FiltroSelect({
    label, opciones, valor, onValorChange,
    centinela = '__todos__', etiquetaCentinela = 'Todos',
    cargando, disabled, ancho = 'bloque',
}: FiltroSelectProps) {
    const bloqueado = disabled || cargando
    return (
        // ⭐ MEJORA 26 Sep 2026 (responsive, medido): la raíz es `flex flex-col`, que
        // se ENCOGE AL CONTENIDO dentro de la fila flex del padre — por eso el
        // `w-full` del trigger no daba ancho completo y el control medía 76px en
        // móvil (más angosto que su propia etiqueta «Categoría»). Con `w-full
        // md:w-auto` el select ocupa su fila en móvil y recupera su ancho de
        // bloque desde md. El `h-11 md:h-9` es la Ley 5 (44px de dedo).
        <div className={cn('flex w-full flex-col gap-1', ancho === 'bloque' ? 'md:w-auto' : 'md:w-full')}>
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <Select
                value={valor}
                onValueChange={onValorChange}
                disabled={bloqueado}
            >
                <SelectTrigger
                    className={cn('h-11 w-full md:h-9', ancho === 'bloque' ? 'md:w-44' : 'md:w-full')}
                >
                    <SelectValue placeholder={cargando ? 'Cargando…' : etiquetaCentinela} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={centinela}>{etiquetaCentinela}</SelectItem>
                    {opciones.map((o) => (
                        <SelectItem key={o.valor} value={o.valor}>{o.etiqueta}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
