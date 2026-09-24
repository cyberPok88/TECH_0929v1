'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ENTRADA MODAL — Alta/Edición de entrada (Guía 1.6 · P2 · Smart)
// Encabezado (proveedor · es_sin_revision · notas) + PartidasEntradaGrid (catálogo:
// categoría select + cantidad + costo). Folio ING y estado los fija la SA/BD.
// ⭐ Fix 18 Sep: categoría por catálogo (listarCategoriasCapturables) — nunca texto libre.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

import { SelectorProveedor } from '@/components/form'
import { PartidasEntradaGrid } from '@/components/entradas/PartidasEntradaGrid'
import { crearEntrada, editarEntrada, listarCategoriasCapturables, listarPartidasEntrada } from '@/lib/actions/entradas'
import type { CategoriaCapturable, Entrada, EntradaFormData } from '@/types/entradas'

function formVacio(): EntradaFormData {
    return {
        id_proveedor: '',
        es_sin_revision: false,
        origen: 'flujo',
        notas: '',
        partidas: [
            {
                id: `p-${Date.now()}`,
                id_categoria: '',
                atributos: {},
                cantidad_original: '1',
                costo_acordado: '',
            },
        ],
    }
}

interface EntradaModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    modo: 'crear' | 'editar'
    entrada?: Entrada | null
    onGuardado?: () => void
}

export function EntradaModal({ open, onOpenChange, modo, entrada = null, onGuardado }: EntradaModalProps) {
    const [form, setForm] = useState<EntradaFormData>(formVacio)
    const [categorias, setCategorias] = useState<CategoriaCapturable[]>([])
    const [cargando, setCargando] = useState(false)
    const [errorServidor, setErrorServidor] = useState<string | null>(null)

    // Reset al abrir (instancia siempre montada — setState fuera del ciclo síncrono).
    useEffect(() => {
        if (!open) return
        const timer = setTimeout(() => {
            if (modo === 'editar' && entrada) {
                setForm({
                    id_proveedor: entrada.id_proveedor,
                    es_sin_revision: entrada.es_sin_revision,
                    origen: entrada.origen,
                    notas: entrada.notas ?? '',
                    partidas: [],
                })
                void listarPartidasEntrada(entrada.id).then((res) => {
                    if (!res.success) return
                    const partidas = (res.data ?? []).map((p) => ({
                        id: p.id,
                        id_categoria: p.id_categoria ?? '',
                        atributos: Object.fromEntries(
                            Object.entries(p.atributos ?? {}).map(([k, v]) => [k, String(v ?? '')])
                        ),
                        cantidad_original: String(p.cantidad_original),
                        costo_acordado: String(p.costo_acordado),
                    }))
                    setForm((prev) => ({ ...prev, partidas: partidas.length ? partidas : prev.partidas }))
                })
            } else {
                setForm(formVacio())
            }
            setErrorServidor(null)
        }, 0)
        return () => clearTimeout(timer)
    }, [open, modo, entrada])

    // Catálogo de categorías capturables (HDD/M.2/SSD/RAM) para el select de partidas.
    useEffect(() => {
        if (!open) return
        let activo = true
        void listarCategoriasCapturables().then((res) => {
            if (activo && res.success) setCategorias(res.data ?? [])
        })
        return () => {
            activo = false
        }
    }, [open])

    const actualizar = <K extends keyof EntradaFormData>(campo: K, valor: EntradaFormData[K]) =>
        setForm((prev) => ({ ...prev, [campo]: valor }))

    const manejarEnvio = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setCargando(true)
        setErrorServidor(null)

        if (modo === 'editar' && entrada) {
            const res = await editarEntrada(entrada.id, form)
            setCargando(false)
            if (!res.success) {
                setErrorServidor(res.error ?? 'No se pudo guardar la entrada.')
                return
            }
            toast.success(`Entrada ${entrada.folio} actualizada`)
        } else {
            const res = await crearEntrada(form)
            setCargando(false)
            if (!res.success) {
                setErrorServidor(res.error ?? 'No se pudo registrar la entrada.')
                return
            }
            toast.success(`Entrada ${res.data?.folio ?? ''} registrada`)
        }

        onGuardado?.()
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>
                        {modo === 'editar' ? `Editar ${entrada?.folio ?? 'entrada'}` : 'Nueva entrada'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={manejarEnvio} className="space-y-5">
                    <div className="space-y-1.5">
                        <Label htmlFor="proveedor">Proveedor</Label>
                        <SelectorProveedor
                            value={form.id_proveedor}
                            onChange={(id) => actualizar('id_proveedor', id ?? '')}
                        />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
                        <div className="space-y-0.5">
                            <Label htmlFor="sin-revision" className="cursor-pointer text-sm">
                                Mercancía nueva (sin revisión técnica)
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Salta la revisión pieza a pieza y va directo a acondicionamiento.
                            </p>
                        </div>
                        <Switch
                            id="sin-revision"
                            checked={form.es_sin_revision}
                            onCheckedChange={(r) => actualizar('es_sin_revision', r)}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Partidas</Label>
                        <p className="text-xs text-muted-foreground">
                            Elige la categoría de cada línea. Marca y atributos (capacidad, tipo, bus…) se
                            capturan en revisión al resolver el SKU.
                        </p>
                        <PartidasEntradaGrid
                            partidas={form.partidas}
                            categorias={categorias}
                            onChange={(partidas) => actualizar('partidas', partidas)}
                            disabled={cargando}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="notas">Notas</Label>
                        <Input
                            id="notas"
                            placeholder="Opcional"
                            value={form.notas}
                            onChange={(e) => actualizar('notas', e.target.value)}
                            disabled={cargando}
                        />
                    </div>

                    {errorServidor && <p className="text-sm text-destructive">{errorServidor}</p>}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={cargando}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={cargando}>
                            {cargando ? 'Guardando…' : 'Guardar entrada'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
