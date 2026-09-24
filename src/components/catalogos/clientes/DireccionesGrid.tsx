'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// DIRECCIONES GRID — Grid N de direcciones (Guía 1.3 · Parte 3 · Dumb)
// Editor INLINE de fila (ajuste Fase 6): Añadir/Editar abren el formulario en la
// propia grid; Eliminar quita la fila. El default fiscal se marca con el sello
// FISCAL sobre el C.P. (SelloFiscal del kit) y con la píldora "Fiscal".
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react'

import { SelloFiscal } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { DireccionFormData, TipoDireccion } from '@/types/clientes'

const TIPOS: { valor: TipoDireccion; etiqueta: string }[] = [
    { valor: 'matriz', etiqueta: 'Matriz' },
    { valor: 'sucursal', etiqueta: 'Sucursal' },
    { valor: 'envio', etiqueta: 'Envío' },
    { valor: 'almacen', etiqueta: 'Almacén' },
    { valor: 'otro', etiqueta: 'Otro' },
]

interface DireccionesGridProps {
    rows: DireccionFormData[]
    onChange: (rows: DireccionFormData[]) => void
    deshabilitado?: boolean
}

function filaVacia(): DireccionFormData {
    return {
        id: '',
        tipo: 'matriz',
        etiqueta: '',
        direccion: '',
        colonia: '',
        ciudad: '',
        estado: '',
        codigo_postal: '',
        es_default_fiscal: false,
        es_default_envio: false,
        es_activo: true,
    }
}

export function DireccionesGrid({ rows, onChange, deshabilitado = false }: DireccionesGridProps) {
    // Editor inline: fila en edición ('' = cerrado). No persiste nada directo.
    const [editando, setEditando] = useState<DireccionFormData | null>(null)

    const guardar = (fila: DireccionFormData) => {
        const existe = fila.id !== ''
        onChange(
            existe
                ? rows.map((r) => (r.id === fila.id ? fila : r))
                : [...rows, { ...fila, id: crypto.randomUUID() }]
        )
        setEditando(null)
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" aria-hidden="true" /> Direcciones
                </Label>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={deshabilitado || editando !== null}
                    onClick={() => setEditando(filaVacia())}
                >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Añadir
                </Button>
            </div>

            {rows.length === 0 && editando === null && (
                <p className="text-xs text-muted-foreground">
                    Sin direcciones registradas (opcional).
                </p>
            )}

            {rows.map((fila) => (
                <div
                    key={fila.id}
                    className="rounded-md border border-border/60 bg-surface/40 p-3 text-sm"
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                            {fila.etiqueta || (fila.tipo.charAt(0).toUpperCase() + fila.tipo.slice(1))}
                        </span>
                        <div className="flex items-center gap-1">
                            {fila.es_default_fiscal && (
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Fiscal
                                </span>
                            )}
                            {fila.es_default_envio && (
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Envío
                                </span>
                            )}
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                disabled={deshabilitado}
                                onClick={() => setEditando(fila)}
                            >
                                <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                disabled={deshabilitado}
                                onClick={() => onChange(rows.filter((r) => r.id !== fila.id))}
                            >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                        </div>
                    </div>
                    <p className="mt-0.5 text-muted-foreground">
                        {fila.direccion}
                        {fila.colonia ? `, ${fila.colonia}` : ''}
                        {fila.ciudad ? ` · ${fila.ciudad}` : ''}
                    </p>
                    {fila.codigo_postal && (
                        <span className="mt-1 inline-flex items-center gap-1 text-xs">
                            C.P. {fila.codigo_postal}{' '}
                            {fila.es_default_fiscal && <SelloFiscal />}
                        </span>
                    )}
                </div>
            ))}

            {editando && (
                <div className="space-y-3 rounded-md border border-border p-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="space-y-2">
                            <Label>Tipo</Label>
                            <Select
                                value={editando.tipo}
                                onValueChange={(v) =>
                                    setEditando({ ...editando, tipo: v as TipoDireccion })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TIPOS.map((t) => (
                                        <SelectItem key={t.valor} value={t.valor}>
                                            {t.etiqueta}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dir-etiqueta">Etiqueta</Label>
                            <Input
                                id="dir-etiqueta"
                                value={editando.etiqueta}
                                onChange={(e) => setEditando({ ...editando, etiqueta: e.target.value })}
                                placeholder="Sucursal Toluca"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dir-cp">Código postal</Label>
                            <Input
                                id="dir-cp"
                                value={editando.codigo_postal}
                                onChange={(e) =>
                                    setEditando({ ...editando, codigo_postal: e.target.value })
                                }
                                inputMode="numeric"
                                maxLength={5}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="dir-calleynumero">Dirección (calle y número) *</Label>
                            <Input
                                id="dir-calleynumero"
                                value={editando.direccion}
                                onChange={(e) => setEditando({ ...editando, direccion: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dir-colonia">Colonia</Label>
                            <Input
                                id="dir-colonia"
                                value={editando.colonia}
                                onChange={(e) => setEditando({ ...editando, colonia: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dir-ciudad">Ciudad</Label>
                            <Input
                                id="dir-ciudad"
                                value={editando.ciudad}
                                onChange={(e) => setEditando({ ...editando, ciudad: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dir-estado">Estado</Label>
                            <Input
                                id="dir-estado"
                                value={editando.estado}
                                onChange={(e) => setEditando({ ...editando, estado: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-2 text-sm">
                            <Switch
                                checked={editando.es_default_fiscal}
                                onCheckedChange={(v) =>
                                    setEditando({ ...editando, es_default_fiscal: v })
                                }
                            />
                            Default fiscal
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <Switch
                                checked={editando.es_default_envio}
                                onCheckedChange={(v) => setEditando({ ...editando, es_default_envio: v })}
                            />
                            Default envío
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <Switch
                                checked={editando.es_activo}
                                onCheckedChange={(v) => setEditando({ ...editando, es_activo: v })}
                            />
                            Activa
                        </label>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setEditando(null)}>
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            disabled={!editando.direccion.trim()}
                            onClick={() => guardar(editando)}
                        >
                            Guardar dirección
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
