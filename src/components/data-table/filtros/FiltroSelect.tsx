'use client'

import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
}

export function FiltroSelect({
    label, opciones, valor, onValorChange,
    centinela = '__todos__', etiquetaCentinela = 'Todos',
    cargando, disabled,
}: FiltroSelectProps) {
    const bloqueado = disabled || cargando
    return (
        <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <Select
                value={valor}
                onValueChange={onValorChange}
                disabled={bloqueado}
            >
                <SelectTrigger className="h-9 w-full md:w-44">
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
