'use client'

import { useRef, useState } from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface FiltroBusquedaProps {
    valor: string
    onValorChange: (v: string) => void
    placeholder?: string
    disabled?: boolean
    className?: string
}

export function FiltroBusqueda({ valor, onValorChange, placeholder, disabled, className }: FiltroBusquedaProps) {
    const [local, setLocal] = useState(valor)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

    return (
        <Input
            type="search"
            value={local}
            placeholder={placeholder ?? 'Buscar…'}
            disabled={disabled}
            onChange={(e) => {
                setLocal(e.target.value)
                if (timer.current) clearTimeout(timer.current)
                timer.current = setTimeout(() => onValorChange(e.target.value), 300)
            }}
            // ⭐ MEJORA 26 Sep 2026 — `h-11 md:h-9`: Ley 5 (44px de dedo en móvil,
            // 36px densos en escritorio), el patrón de NavItem/NavGroup/DataTable.
            className={cn('h-11 w-full md:h-9 md:w-64 md:flex-none', className)}
        />
    )
}
