'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// NOTA COMPRA MODAL — Alta/Edición de nota directa (Guía 1.4 · rediseño · P3–P4)
// Encabezado (proveedor · fecha · documento) + PartidasNotaGrid (productos/
// cantidades/costos). `folio` (NC) y estados NO se capturan: los fija la SA/BD.
// En edición solo aplica para `por_recibir` y sin pagos (reglas server + hint).
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { SelectorProveedor } from '@/components/form'
import { crearNotaCompraDirecta, editarNotaCompra } from '@/lib/actions/notas-compra'
import { notaAFormData, notaFormDataVacia } from '@/types/notas-compra'
import type { NotaCompraDetalle, NotaCompraFormData, PartidaNotaForm } from '@/types/notas-compra'
import { PartidasNotaGrid, type InfoProducto } from '@/components/compras/PartidasNotaGrid'

interface NotaCompraModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** 'editar' requiere `nota` (objeto completo del detalle). */
    modo: 'crear' | 'editar'
    nota?: NotaCompraDetalle | null
    onGuardado?: () => void
}

function infoInicialDe(n: NotaCompraDetalle | null | undefined): Record<string, InfoProducto> {
    const mapa: Record<string, InfoProducto> = {}
    if (!n) return mapa
    for (const p of n.partidas) {
        if (p.id_producto) {
            mapa[p.id_producto] = { sku: p.producto_codigo ?? '', nombre: p.producto_nombre ?? '' }
        }
    }
    return mapa
}

export function NotaCompraModal({ open, onOpenChange, modo, nota = null, onGuardado }: NotaCompraModalProps) {
    const [form, setForm] = useState<NotaCompraFormData>(notaFormDataVacia)
    const [cargando, setCargando] = useState(false)
    const [errorServidor, setErrorServidor] = useState<string | null>(null)

    const esEdicion = modo === 'editar'

    // Reset al abrir (instancia siempre montada — setState fuera del ciclo síncrono).
    useEffect(() => {
        if (!open) return
        const timer = setTimeout(() => {
            setForm(nota ? notaAFormData(nota) : notaFormDataVacia())
            setErrorServidor(null)
        }, 0)
        return () => {
            clearTimeout(timer)
        }
    }, [open, nota, esEdicion])

    const actualizar = <K extends keyof NotaCompraFormData>(campo: K, valor: NotaCompraFormData[K]) => {
        setForm((prev) => ({ ...prev, [campo]: valor }))
    }

    const actualizarPartidas = (partidas: PartidaNotaForm[]) => {
        setForm((prev) => ({ ...prev, partidas }))
    }

    const manejarEnvio = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setCargando(true)
        setErrorServidor(null)

        if (esEdicion && nota) {
            const respuesta = await editarNotaCompra(nota.id, form as Parameters<typeof editarNotaCompra>[1])
            setCargando(false)
            if (!respuesta.success) {
                setErrorServidor(respuesta.error ?? 'No se pudo guardar la nota.')
                return
            }
            toast.success(`Nota ${nota.folio} actualizada`)
        } else {
            const respuesta = await crearNotaCompraDirecta(form as Parameters<typeof crearNotaCompraDirecta>[0])
            setCargando(false)
            if (!respuesta.success) {
                setErrorServidor(respuesta.error ?? 'No se pudo registrar la nota.')
                return
            }
            toast.success(`Nota ${respuesta.data?.folio ?? ''} registrada — por recibir`)
        }

        onGuardado?.()
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{esEdicion ? 'Editar nota de compra' : 'Nueva nota de compra'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={manejarEnvio} className="flex flex-col gap-5">
                    {/* Proveedor + fecha */}
                    <section className="flex flex-col gap-3">
                        <h3 className="text-sm font-semibold uppercase text-muted-foreground">Proveedor</h3>
                        <SelectorProveedor
                            value={form.id_proveedor || null}
                            onChange={(id) => actualizar('id_proveedor', id ?? '')}
                            disabled={cargando}
                        />
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">Fecha de la nota *</Label>
                                <Input
                                    type="date"
                                    value={form.fecha_nota}
                                    onChange={(e) => actualizar('fecha_nota', e.target.value)}
                                    disabled={cargando}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">
                                    Nº factura / remisión del proveedor
                                </Label>
                                <Input
                                    value={form.numero_factura_proveedor}
                                    onChange={(e) => actualizar('numero_factura_proveedor', e.target.value)}
                                    placeholder="Opcional"
                                    disabled={cargando}
                                />
                            </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">Referencia</Label>
                                <Input
                                    value={form.referencia_proveedor}
                                    onChange={(e) => actualizar('referencia_proveedor', e.target.value)}
                                    maxLength={20}
                                    placeholder="Máx. 20 caracteres"
                                    disabled={cargando}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">Notas</Label>
                                <Input
                                    value={form.notas}
                                    onChange={(e) => actualizar('notas', e.target.value)}
                                    disabled={cargando}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Partidas */}
                    <section className="flex flex-col gap-3 border-t border-border pt-4">
                        <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                            Productos de la nota
                        </h3>
                        <PartidasNotaGrid
                            partidas={form.partidas}
                            onChange={actualizarPartidas}
                            infoInicial={infoInicialDe(esEdicion ? nota : null)}
                            disabled={cargando}
                        />
                        <p className="text-[11px] text-muted-foreground">
                            La nota registra el documento y su cuenta por pagar; el inventario se
                            mueve cuando Almacén confirme la entrada ligada (Entradas 1.6).
                        </p>
                    </section>

                    {esEdicion && (
                        <p className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
                            Solo se edita una nota <strong>por recibir</strong> y <strong>sin pagos</strong>.
                        </p>
                    )}

                    {errorServidor && (
                        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            {errorServidor}
                        </p>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={cargando}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={cargando}>
                            {cargando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Registrar nota'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
