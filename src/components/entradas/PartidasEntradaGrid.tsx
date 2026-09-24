'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PARTIDAS ENTRADA GRID — Renglones declarados de la entrada (Guía 1.6 · P2 · Dumb)
// ⭐ Evolución V5 (20 Sep): la RECEPCIÓN es SOFT. Cada línea captura SOLO los
// atributos `en_entrada` del esquema (categoría · capacidad · PC/LAP · DDR) +
// cantidad + costo + vista previa. La MARCA y los atributos de identidad se
// capturan en REVISIÓN; el SKU lo resuelve ALMACÉN. RPM no se pregunta (auto 7200).
// ⭐ 20 Sep (MEJORA formato): los atributos `derivado_de` se resuelven SOLOS desde
// otro campo (HDD: tipo PC → 3.5" · LAP → 2.5") y se muestran read-only.
// ═══════════════════════════════════════════════════════════════════════════════

import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CategoriaCapturable, PartidaEntradaForm } from '@/types/entradas'

function nuevaPartida(): PartidaEntradaForm {
    return {
        id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        id_categoria: '',
        atributos: {},
        cantidad_original: '1',
        costo_acordado: '',
    }
}

function formatearMXN(monto: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto)
}

interface PartidasEntradaGridProps {
    partidas: PartidaEntradaForm[]
    categorias: CategoriaCapturable[]
    onChange: (partidas: PartidaEntradaForm[]) => void
    disabled?: boolean
}

export function PartidasEntradaGrid({ partidas, categorias, onChange, disabled = false }: PartidasEntradaGridProps) {
    const categoriaDe = (id: string) => categorias.find((c) => c.id === id) ?? null
    // ⭐ Campos que la RECEPCIÓN muestra: los `en_entrada` + los `derivado_de`
    // (read-only). Se excluye lo automático (`valor_default`, ej. rpm=7200).
    const enEntradaDe = (id: string) =>
        categoriaDe(id)?.esquema.filter((a) => (a.en_entrada || a.derivado_de) && !a.valor_default) ?? []

    // ⭐ Resuelve los atributos `derivado_de` a partir de otro campo (HDD: tipo → formato).
    const aplicarDerivados = (id: string, atributos: Record<string, string>): Record<string, string> => {
        const next = { ...atributos }
        for (const at of categoriaDe(id)?.esquema ?? []) {
            if (at.derivado_de) {
                const base = next[at.derivado_de.clave] ?? ''
                next[at.clave] = at.derivado_de.mapa[base] ?? ''
            }
        }
        return next
    }

    const actualizar = (i: number, patch: Partial<PartidaEntradaForm>) =>
        onChange(partidas.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
    const quitar = (i: number) => onChange(partidas.filter((_, idx) => idx !== i))
    const agregar = () => onChange([...partidas, nuevaPartida()])

    const cambiarCategoria = (i: number, id: string) =>
        actualizar(i, { id_categoria: id, atributos: aplicarDerivados(id, {}) })

    const cambiarAtributo = (i: number, clave: string, valor: string) =>
        onChange(
            partidas.map((p, idx) =>
                idx === i
                    ? {
                          ...p,
                          atributos: aplicarDerivados(p.id_categoria, { ...p.atributos, [clave]: valor }),
                      }
                    : p
            )
        )

    const previewDe = (p: PartidaEntradaForm): string => {
        const cat = categoriaDe(p.id_categoria)
        if (!cat) return ''
        const valores = enEntradaDe(p.id_categoria)
            .map((a) => p.atributos[a.clave])
            .filter(Boolean)
        return [cat.nombre, ...valores].join(' ')
    }

    const totalPiezas = partidas.reduce((s, p) => s + (Number(p.cantidad_original) || 0), 0)
    const totalCosto = partidas.reduce(
        (s, p) => s + (Number(p.cantidad_original) || 0) * (Number(p.costo_acordado) || 0),
        0
    )

    return (
        <div className="space-y-3">
            <div className="space-y-2">
                {partidas.map((p, i) => {
                    const esquema = enEntradaDe(p.id_categoria)
                    const cat = categoriaDe(p.id_categoria)
                    const preview = previewDe(p)
                    return (
                        <div key={p.id} className="rounded-lg border p-3">
                            <div className="flex items-start gap-3">
                                <span className="mt-2 w-6 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                                    {i + 1}
                                </span>
                                <div className="min-w-0 flex-1 space-y-3">
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Categoría</Label>
                                            <select
                                                className="h-9 w-full rounded-md border bg-surface px-2 text-sm"
                                                value={p.id_categoria}
                                                onChange={(e) => cambiarCategoria(i, e.target.value)}
                                                disabled={disabled}
                                            >
                                                <option value="">— elige categoría —</option>
                                                {categorias.map((c) => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.nombre}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        {esquema.map((at) => (
                                            <div key={at.clave} className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">
                                                    {at.etiqueta}
                                                    {at.requerido ? <span className="text-destructive"> *</span> : ''}
                                                </Label>
                                                {at.derivado_de ? (
                                                    <div className="flex h-9 items-center justify-between rounded-md border bg-surface-2 px-2 text-sm text-muted-foreground">
                                                        <span>{p.atributos[at.clave] || '—'}</span>
                                                        <span className="font-mono text-[10px] uppercase tracking-wide">
                                                            auto
                                                        </span>
                                                    </div>
                                                ) : at.tipo === 'select' && at.opciones ? (
                                                    <select
                                                        className="h-9 w-full rounded-md border bg-surface px-2 text-sm"
                                                        value={p.atributos[at.clave] ?? ''}
                                                        onChange={(e) => cambiarAtributo(i, at.clave, e.target.value)}
                                                        disabled={disabled}
                                                    >
                                                        <option value="">—</option>
                                                        {at.opciones.map((op) => (
                                                            <option key={op} value={op}>
                                                                {op}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <Input
                                                        type={at.tipo === 'number' ? 'number' : 'text'}
                                                        value={p.atributos[at.clave] ?? ''}
                                                        onChange={(e) => cambiarAtributo(i, at.clave, e.target.value)}
                                                        disabled={disabled}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Cantidad</Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                className="tabular-nums"
                                                value={p.cantidad_original}
                                                onChange={(e) => actualizar(i, { cantidad_original: e.target.value })}
                                                disabled={disabled}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Costo acordado</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                step="0.0001"
                                                placeholder="0.00"
                                                className="tabular-nums"
                                                value={p.costo_acordado}
                                                onChange={(e) => actualizar(i, { costo_acordado: e.target.value })}
                                                disabled={disabled}
                                            />
                                        </div>
                                    </div>
                                    {cat && (
                                        <p className="text-xs text-muted-foreground">
                                            Producto:{' '}
                                            <span className="font-medium text-foreground">{preview || '—'}</span>
                                        </p>
                                    )}
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => quitar(i)}
                                    disabled={disabled || partidas.length === 1}
                                    aria-label="Quitar línea"
                                >
                                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="flex items-center justify-between">
                <Button type="button" variant="outline" size="sm" onClick={agregar} disabled={disabled}>
                    <Plus className="mr-1 h-4 w-4" /> Agregar línea
                </Button>
                <div className="flex items-center gap-4 text-sm tabular-nums text-muted-foreground">
                    <span>
                        Partidas: <b className="text-foreground">{partidas.length}</b>
                    </span>
                    <span>
                        Piezas: <b className="text-foreground">{totalPiezas}</b>
                    </span>
                    <span>
                        Total: <b className="text-foreground">{formatearMXN(totalCosto)}</b>
                    </span>
                </div>
            </div>
        </div>
    )
}
