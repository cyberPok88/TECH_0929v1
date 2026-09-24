'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// SELECTOR UBICACIÓN EN CASCADA — Guía 0.8 · Parte 7 (componente compartido Dumb)
//
// Selector jerárquico de ubicación de almacén en 4 pasos encadenados:
//   rack → nivel → organizador → charola.
//
// AGNÓSTICO (SISTEMA_COMPONENTES §4): recibe `ubicaciones` como PROP — NO
// consulta BD, NO conoce el origen de los datos ni el módulo que lo consume.
// El consumidor (1.1 Productos modal · 2.2 Entradas modal de alta) es quien
// trae las ubicaciones y pasa la lista. Cero duplicación de lógica de
// almacén; solo dirección de cascada.
//
// Contrato declarado en la Guía 0.8 el 28 Ago 2026:
//   <SelectorUbicacionCascada
//     value={idUbicacion}
//     onChange={(id) => ...}
//     ubicaciones={UbicacionAlmacen[]}
//     disabled?
//     placeholder?
//   />
//
// value=true → id de la ubicación completa elegida (charola); null = ninguna.
// Cada cambio a un nivel superior invalida la selección (value=null) hasta
// elegir una charola final.
//
// Dumb: sin Server Action · sin router · sin store. state local SOLO para el
// nivel parcial de cascada (rack/nivel/organizador) mientras se elige charola
// — setState únicamente en handlers (regla react-hooks/set-state-in-effect).
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

/** Forma mínima que el consumidor provee por cada ubicación de almacén. */
export interface UbicacionAlmacen {
    id: string
    rack: string
    nivel: string
    organizador: string
    charola: string
    descripcion?: string | null
}

interface SelectorUbicacionCascadaProps {
    /** id de la ubicación completa (charola) elegida — null = ninguna. */
    value: string | null
    /** Notifica la selección — null cuando un nivel superior invalida. */
    onChange: (id: string | null) => void
    /** Ubicaciones a cascadear (las provee el consumidor — NO se consultan). */
    ubicaciones: UbicacionAlmacen[]
    disabled?: boolean
    placeholder?: string
    className?: string
}

const __SIN_VALOR__ = '__sin__'

export function SelectorUbicacionCascada({
    value,
    onChange,
    ubicaciones,
    disabled = false,
    placeholder = 'Elegir ubicación…',
    className,
}: SelectorUbicacionCascadaProps) {
    // Selección completa vigente (si value apunta a una ubicación real).
    const seleccion = ubicaciones.find((u) => u.id === value) ?? null

    // Nivel parcial de cascada: drive de los 3 selects altos mientras el
    // usuario no ha cerrado en una charola. Cuando hay selección completa
    // mostramos sus niveles; si no, el estado parcial.
    const [parcial, setParcial] = useState({ rack: '', nivel: '', organizador: '' })

    const rack = seleccion ? seleccion.rack : parcial.rack
    const nivel = seleccion ? seleccion.nivel : parcial.nivel
    const organizador = seleccion ? seleccion.organizador : parcial.organizador

    const racks = [...new Set(ubicaciones.map((u) => u.rack))].sort()
    const niveles = [...new Set(ubicaciones.filter((u) => u.rack === rack).map((u) => u.nivel))].sort()
    const organizadores = [...new Set(
        ubicaciones.filter((u) => u.rack === rack && u.nivel === nivel).map((u) => u.organizador),
    )].sort()
    const charolas = ubicaciones.filter(
        (u) => u.rack === rack && u.nivel === nivel && u.organizador === organizador,
    )

    const manejarRack = (r: string) => {
        if (r === __SIN_VALOR__) {
            setParcial({ rack: '', nivel: '', organizador: '' })
            onChange(null)
            return
        }
        setParcial({ rack: r, nivel: '', organizador: '' })
        onChange(null)
    }

    const manejarNivel = (n: string) => {
        if (n === __SIN_VALOR__) {
            setParcial((p) => ({ ...p, nivel: '', organizador: '' }))
            onChange(null)
            return
        }
        setParcial((p) => ({ ...p, nivel: n, organizador: '' }))
        onChange(null)
    }

    const manejarOrganizador = (o: string) => {
        if (o === __SIN_VALOR__) {
            setParcial((p) => ({ ...p, organizador: '' }))
            onChange(null)
            return
        }
        setParcial((p) => ({ ...p, organizador: o }))
        onChange(null)
    }

    const manejarCharola = (id: string) => {
        onChange(id === __SIN_VALOR__ ? null : id)
    }

    const selectClase = 'w-full'

    return (
        <div className={cn('flex flex-col gap-2', className)}>
            <Label className="text-xs font-medium text-muted-foreground">Ubicación en almacén</Label>

            {!seleccion && placeholder && (
                <p className="text-[11px] text-muted-foreground">{placeholder}</p>
            )}

            {/* Rack */}
            <Select value={rack || __SIN_VALOR__} onValueChange={manejarRack} disabled={disabled}>
                <SelectTrigger className={selectClase}>
                    <SelectValue placeholder={rack ? rack : 'Rack…'} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={__SIN_VALOR__}>Elegir rack…</SelectItem>
                    {racks.map((r) => (
                        <SelectItem key={r} value={r}>
                            {r}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Nivel */}
            <Select
                value={nivel || __SIN_VALOR__}
                onValueChange={manejarNivel}
                disabled={disabled || !rack}
            >
                <SelectTrigger className={selectClase}>
                    <SelectValue placeholder={!rack ? 'Elige primero el rack…' : 'Nivel…'} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={__SIN_VALOR__}>Elegir nivel…</SelectItem>
                    {niveles.map((n) => (
                        <SelectItem key={n} value={n}>
                            {n}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Organizador */}
            <Select
                value={organizador || __SIN_VALOR__}
                onValueChange={manejarOrganizador}
                disabled={disabled || !nivel}
            >
                <SelectTrigger className={selectClase}>
                    <SelectValue placeholder={!nivel ? 'Elige primero el nivel…' : 'Organizador…'} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={__SIN_VALOR__}>Elegir organizador…</SelectItem>
                    {organizadores.map((o) => (
                        <SelectItem key={o} value={o}>
                            {o}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Charola — la que fija el id real de la ubicación */}
            <Select
                value={value ?? __SIN_VALOR__}
                onValueChange={manejarCharola}
                disabled={disabled || !organizador}
            >
                <SelectTrigger className={selectClase}>
                    <SelectValue
                        placeholder={!organizador ? 'Elige primero el organizador…' : 'Charola…'}
                    />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={__SIN_VALOR__}>Sin charola…</SelectItem>
                    {charolas.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                            {c.rack} · {c.nivel} · {c.organizador} · {c.charola}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {seleccion && (
                <p className="text-[11px] text-muted-foreground">
                    {seleccion.rack} / {seleccion.nivel} / {seleccion.organizador} / {seleccion.charola}
                    {seleccion.descripcion ? ` — ${seleccion.descripcion}` : ''}
                </p>
            )}
        </div>
    )
}
