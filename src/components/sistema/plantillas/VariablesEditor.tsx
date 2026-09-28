'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// VARIABLES DE LA PLANTILLA — EDITOR (Guía 2.1 · P4 · Dumb)
//
// El ESQUEMA DECLARADO de variables: la lista `clave → descripción` contra la que
// el motor (P6) valida y sanea el cuerpo. Sin declarar, un placeholder del cuerpo
// es una errata; declarado, es un dato.
//
// CONTROLADO: el valor vive en el `useForm` del modal. Este componente no tiene
// estado propio — una sola fuente para lo que viaja en el submit.
//
// La validación en vivo (duplicados, formato) es CORTESÍA: la que decide es zod
// (`refinarPlantilla`, Parte 1) al guardar.
// ═══════════════════════════════════════════════════════════════════════════════

import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { VariablePlantilla } from '@/types/plantillas'

const REGEX_CLAVE = /^[a-z][a-z0-9_]*$/

interface VariablesEditorProps {
    variables: VariablePlantilla[]
    onChange: (variables: VariablePlantilla[]) => void
    disabled?: boolean
}

export function VariablesEditor({ variables, onChange, disabled }: VariablesEditorProps) {
    const agregar = () => {
        onChange([...variables, { clave: '', descripcion: '' }])
    }

    const quitar = (i: number) => {
        onChange(variables.filter((_, idx) => idx !== i))
    }

    const cambiar = (i: number, patch: Partial<VariablePlantilla>) => {
        onChange(variables.map((v, idx) => (idx === i ? { ...v, ...patch } : v)))
    }

    /** Cuenta cuántas veces aparece una clave (para avisar del duplicado en vivo). */
    const repetida = (clave: string, i: number): boolean => {
        if (!clave) return false
        return variables.some((v, idx) => idx !== i && v.clave === clave)
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col">
                    <Label>Variables declaradas</Label>
                    <span className="text-xs text-muted-foreground">
                        Cada variable es un dato que el documento recibe al imprimirse.
                    </span>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={agregar}
                    disabled={disabled}
                    className="gap-1.5"
                >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Agregar
                </Button>
            </div>

            {variables.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                    Sin variables. Si el cuerpo usa <span className="font-mono">{'{{algo}}'}</span>, decláralo aquí.
                </p>
            ) : (
                <ul className="flex flex-col gap-2">
                    {variables.map((v, i) => {
                        const claveInvalida = v.clave !== '' && !REGEX_CLAVE.test(v.clave)
                        const duplicada = repetida(v.clave, i)
                        return (
                            <li key={i} className="flex items-start gap-2">
                                <div className="flex w-40 flex-col gap-1">
                                    <Input
                                        value={v.clave}
                                        onChange={(e) => cambiar(i, { clave: e.target.value })}
                                        placeholder="folio"
                                        disabled={disabled}
                                        aria-label={`Clave de la variable ${i + 1}`}
                                        className={`font-mono ${
                                            claveInvalida || duplicada ? 'border-destructive' : ''
                                        }`}
                                    />
                                    {claveInvalida && (
                                        <span className="text-xs text-destructive">
                                            Solo minúsculas, números y guion bajo.
                                        </span>
                                    )}
                                    {duplicada && (
                                        <span className="text-xs text-destructive">
                                            Esa variable ya está declarada.
                                        </span>
                                    )}
                                </div>

                                <Input
                                    value={v.descripcion}
                                    onChange={(e) => cambiar(i, { descripcion: e.target.value })}
                                    placeholder="Qué dato es (ej: folio del documento)"
                                    disabled={disabled}
                                    aria-label={`Descripción de la variable ${i + 1}`}
                                    className="flex-1"
                                />

                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => quitar(i)}
                                    disabled={disabled}
                                    aria-label={`Quitar la variable ${i + 1}`}
                                    className="text-muted-foreground hover:text-destructive"
                                >
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </Button>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}
