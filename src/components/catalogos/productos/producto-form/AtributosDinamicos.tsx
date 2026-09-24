'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ATRIBUTOS DINAMICOS — subsección de características por esquema (Guía 1.2 · P3)
// Renderiza un control por definición del esquema_atributos de la categoría:
//   · text → Input · number → Input numérico · select → lista + «otra…»
// "otra…" está disponible para todos: pide el valor y lo guarda como propio
// (MEJORA 04 Sep · usuario). Solo el Administrador (puedeOtra) además agrega la
// opción al esquema para que aparezca en la lista del catálogo.
// Dumb: recibe las definiciones y los valores crudos (strings del form).
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { AtributoEsquema } from '@/types/catalogos'

const VALOR_OTRA = '__otra__'

interface AtributosDinamicosProps {
    esquema: AtributoEsquema[]
    valores: Record<string, string>
    onChange: (clave: string, valor: string) => void
    /** Quien puede editar el hub (Administrador) ve «otra…» y agrega la opción. */
    puedeOtra: boolean
    onAgregarOpcion?: (def: AtributoEsquema, opcion: string) => Promise<string | null>
    disabled?: boolean
}

export function AtributosDinamicos({
    esquema,
    valores,
    onChange,
    puedeOtra,
    onAgregarOpcion,
    disabled = false,
}: AtributosDinamicosProps) {
    const [otraPorClave, setOtraPorClave] = useState<Record<string, string>>({})

    if (esquema.length === 0) {
        return (
            <p className="text-xs text-muted-foreground">
                Esta categoría aún no define características técnicas (se definen en el editor
                del hub de Catálogos).
            </p>
        )
    }

    const valorActual = (clave: string) => valores[clave] ?? ''
    const esOtraActiva = (clave: string) => valorActual(clave) === VALOR_OTRA

    const manejarOtra = async (def: AtributoEsquema) => {
        const opcion = (otraPorClave[def.clave] ?? '').trim()
        if (!opcion) return
        // Solo el Admin persiste la opción en el esquema; el resto guarda su valor propio.
        if (puedeOtra && onAgregarOpcion) {
            const error = await onAgregarOpcion(def, opcion)
            if (error) return
        }
        onChange(def.clave, opcion)
        setOtraPorClave((prev) => ({ ...prev, [def.clave]: '' }))
    }

    return (
        <div className="grid gap-3 sm:grid-cols-2">
            {esquema.map((def) => {
                const actual = valorActual(def.clave)
                const customFueraDeLista =
                    def.tipo === 'select' &&
                    actual !== '' &&
                    actual !== VALOR_OTRA &&
                    !(def.opciones ?? []).includes(actual)
                const mostrarEntradaOtra =
                    def.tipo === 'select' && (esOtraActiva(def.clave) || customFueraDeLista)

                return (
                    <div key={def.clave} className="grid gap-1.5">
                        <Label className="text-xs">
                            {def.etiqueta}
                            {def.requerido && <span className="text-destructive"> *</span>}
                        </Label>

                        {def.tipo === 'select' ? (
                            <div className="space-y-1.5">
                                <select
                                    value={esOtraActiva(def.clave) ? VALOR_OTRA : actual || ''}
                                    disabled={disabled}
                                    onChange={(e) => {
                                        const v = e.target.value
                                        if (v === VALOR_OTRA) {
                                            onChange(def.clave, VALOR_OTRA)
                                        } else {
                                            onChange(def.clave, v)
                                            setOtraPorClave((prev) => ({ ...prev, [def.clave]: '' }))
                                        }
                                    }}
                                    className="h-9 w-full rounded-md border border-input bg-surface px-3 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <option value="">—</option>
                                    {(def.opciones ?? []).map((opcion) => (
                                        <option key={opcion} value={opcion}>
                                            {opcion}
                                        </option>
                                    ))}
                                    {!customFueraDeLista && (
                                        <option value={VALOR_OTRA}>otra…</option>
                                    )}
                                    {customFueraDeLista && (
                                        <option value={actual}>{actual} (no está en la lista)</option>
                                    )}
                                </select>

                                {mostrarEntradaOtra && (
                                    <div className="flex gap-1.5">
                                        <Input
                                            placeholder="Escribe el valor…"
                                            value={
                                                customFueraDeLista && !esOtraActiva(def.clave)
                                                    ? actual
                                                    : (otraPorClave[def.clave] ?? '')
                                            }
                                            disabled={disabled}
                                            onChange={(e) =>
                                                setOtraPorClave((prev) => ({
                                                    ...prev,
                                                    [def.clave]: e.target.value,
                                                }))
                                            }
                                        />
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            disabled={disabled}
                                            onClick={() => void manejarOtra(def)}
                                        >
                                            {puedeOtra ? 'Agregar opción' : 'Usar valor'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <Input
                                type={def.tipo === 'number' ? 'number' : 'text'}
                                step={def.tipo === 'number' ? 'any' : undefined}
                                value={def.tipo === 'number' && actual === '__otra__' ? '' : actual}
                                disabled={disabled}
                                placeholder={def.tipo === 'number' ? '0' : ''}
                                onChange={(e) => onChange(def.clave, e.target.value)}
                            />
                        )}
                    </div>
                )
            })}
        </div>
    )
}
