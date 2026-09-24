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
            className={cn('w-full md:w-64 md:flex-none', className)}
        />
    )
}
