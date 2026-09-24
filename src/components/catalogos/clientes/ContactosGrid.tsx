'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// CONTACTOS GRID — Grid N de contactos (Guía 1.3 · Parte 3 · Dumb)
// Editor INLINE de fila. Un contacto principal por cliente+tipo (UNIQUE b2) — la
// validación final la hace el schema (Parte 1 · refinarCliente).
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { Pencil, Phone, Plus, Trash2, UserRound } from 'lucide-react'

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
import { Textarea } from '@/components/ui/textarea'
import type { ContactoFormData, TipoContacto } from '@/types/clientes'

const TIPOS: { valor: TipoContacto; etiqueta: string }[] = [
    { valor: 'general', etiqueta: 'General' },
    { valor: 'ventas', etiqueta: 'Ventas' },
    { valor: 'cobranza', etiqueta: 'Cobranza' },
    { valor: 'soporte', etiqueta: 'Soporte' },
    { valor: 'direccion', etiqueta: 'Dirección' },
    { valor: 'otro', etiqueta: 'Otro' },
]

interface ContactosGridProps {
    rows: ContactoFormData[]
    onChange: (rows: ContactoFormData[]) => void
    deshabilitado?: boolean
}

function filaVacia(): ContactoFormData {
    return {
        id: '',
        tipo: 'general',
        nombre: '',
        telefono: '',
        email: '',
        notas: '',
        es_principal: false,
        es_activo: true,
    }
}

export function ContactosGrid({ rows, onChange, deshabilitado = false }: ContactosGridProps) {
    const [editando, setEditando] = useState<ContactoFormData | null>(null)

    const guardar = (fila: ContactoFormData) => {
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
                    <UserRound className="h-4 w-4" aria-hidden="true" /> Contactos
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
                    Sin contactos registrados (opcional).
                </p>
            )}

            {rows.map((fila) => (
                <div
                    key={fila.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-surface/40 p-3 text-sm"
                >
                    <div>
                        <span className="font-medium">{fila.nombre}</span>
                        {fila.es_principal && (
                            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                Principal
                            </span>
                        )}
                        <p className="mt-0.5 text-muted-foreground">
                            {fila.tipo} ·{' '}
                            {fila.telefono ? (
                                <>
                                    <Phone className="mr-0.5 inline h-3 w-3" aria-hidden="true" />
                                    {fila.telefono}
                                </>
                            ) : (
                                fila.email
                            )}
                        </p>
                    </div>
                    <div className="flex items-center gap-1">
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
            ))}

            {editando && (
                <div className="space-y-3 rounded-md border border-border p-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Tipo</Label>
                            <Select
                                value={editando.tipo}
                                onValueChange={(v) =>
                                    setEditando({ ...editando, tipo: v as TipoContacto })
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
                            <Label htmlFor="ct-nombre">Nombre *</Label>
                            <Input
                                id="ct-nombre"
                                value={editando.nombre}
                                onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ct-tel">Teléfono</Label>
                            <Input
                                id="ct-tel"
                                value={editando.telefono}
                                onChange={(e) => setEditando({ ...editando, telefono: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ct-email">Correo</Label>
                            <Input
                                id="ct-email"
                                type="email"
                                value={editando.email}
                                onChange={(e) => setEditando({ ...editando, email: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="ct-notas">Notas</Label>
                        <Textarea
                            id="ct-notas"
                            rows={2}
                            value={editando.notas}
                            onChange={(e) => setEditando({ ...editando, notas: e.target.value })}
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-2 text-sm">
                            <Switch
                                checked={editando.es_principal}
                                onCheckedChange={(v) => setEditando({ ...editando, es_principal: v })}
                            />
                            Principal de su tipo
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <Switch
                                checked={editando.es_activo}
                                onCheckedChange={(v) => setEditando({ ...editando, es_activo: v })}
                            />
                            Activo
                        </label>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setEditando(null)}>
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            disabled={!editando.nombre.trim()}
                            onClick={() => guardar(editando)}
                        >
                            Guardar contacto
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
