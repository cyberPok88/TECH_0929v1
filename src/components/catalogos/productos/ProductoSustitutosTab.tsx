'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTO SUSTITUTOS TAB — gestión N:N bidireccional (Guía 1.2 · Parte 7 · Smart)
// Lista los sustitutos del producto (2 filas por par en BD · b3), agrega por
// buscador (nombre/sku) y quita con confirmación (kit ConfirmarAccionDialog).
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmarAccionDialog } from '@/components/ui/ConfirmarAccionDialog'
import {
    agregarSustituto,
    listarProductos,
    listarSustitutos,
    quitarSustituto,
} from '@/lib/actions/productos'
import type { Producto, ProductoOpcion } from '@/types/productos'

interface ProductoSustitutosTabProps {
    producto: Producto
}

export function ProductoSustitutosTab({ producto }: ProductoSustitutosTabProps) {
    const [sustitutos, setSustitutos] = useState<ProductoOpcion[]>([])
    const [busqueda, setBusqueda] = useState('')
    const [candidatos, setCandidatos] = useState<ProductoOpcion[]>([])
    const [buscando, setBuscando] = useState(false)
    const [quitarDe, setQuitarDe] = useState<ProductoOpcion | null>(null)

    const cargar = useCallback(async () => {
        const res = await listarSustitutos(producto.id)
        if (res.success) setSustitutos(res.data ?? [])
    }, [producto.id])

    useEffect(() => {
        let activo = true
        listarSustitutos(producto.id).then((res) => {
            if (!activo) return
            if (res.success) setSustitutos(res.data ?? [])
        })
        return () => {
            activo = false
        }
    }, [producto.id])

    const buscar = async () => {
        if (!busqueda.trim()) return
        setBuscando(true)
        try {
            const res = await listarProductos({
                busqueda,
                id_categoria: '',
                id_marca: '',
                estado: 'activo',
                solo_pendientes: false,
            })
            if (res.success) {
                const yaExisten = new Set([
                    producto.id,
                    ...sustitutos.map((s) => s.id),
                ])
                setCandidatos((res.data ?? []).filter((p) => !yaExisten.has(p.id)))
            }
        } finally {
            setBuscando(false)
        }
    }

    const agregar = async (candidato: ProductoOpcion) => {
        const res = await agregarSustituto(producto.id, candidato.id)
        if (!res.success) {
            toast.error(res.error ?? 'No se pudo agregar el sustituto.')
            return
        }
        toast.success(`"${candidato.nombre}" agregado como sustituto.`)
        setBusqueda('')
        setCandidatos([])
        await cargar()
    }

    const confirmarQuitar = async (): Promise<{ error: string | null }> => {
        if (!quitarDe) return { error: null }
        const res = await quitarSustituto(producto.id, quitarDe.id)
        if (!res.success) return { error: res.error ?? 'No se pudo quitar el sustituto.' }
        await cargar()
        return { error: null }
    }

    return (
        <div className="space-y-3">
            <div className="flex gap-2">
                <Input
                    placeholder="Buscar producto por nombre o SKU…"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void buscar() }}
                />
                <Button type="button" variant="outline" onClick={() => void buscar()} disabled={buscando}>
                    {buscando ? 'Buscando…' : 'Buscar'}
                </Button>
            </div>

            {candidatos.length > 0 && (
                <div className="rounded-md border border-border">
                    {candidatos.map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5 text-sm last:border-0">
                            <span>
                                <span className="font-mono text-[12px] text-muted-foreground">{c.sku}</span>{' '}
                                {c.nombre}
                            </span>
                            <Button type="button" size="sm" variant="outline" onClick={() => void agregar(c)}>
                                <Plus className="mr-1 h-3.5 w-3.5" /> Agregar
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            {sustitutos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Este producto no tiene sustitutos.</p>
            ) : (
                <div className="rounded-md border border-border">
                    {sustitutos.map((s) => (
                        <div key={s.id} className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5 text-sm last:border-0">
                            <span>
                                <span className="font-mono text-[12px] text-muted-foreground">{s.sku}</span>{' '}
                                {s.nombre}
                            </span>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setQuitarDe(s)}>
                                <X className="mr-1 h-3.5 w-3.5" /> Quitar
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            <ConfirmarAccionDialog
                open={quitarDe !== null}
                onOpenChange={(v) => { if (!v) setQuitarDe(null) }}
                titulo="Quitar sustituto"
                descripcion={quitarDe ? `Se quita "${quitarDe.nombre}" como sustituto de ambos lados.` : ''}
                confirmLabel="Quitar"
                variant="destructive"
                successMessage="Sustituto quitado"
                onConfirm={confirmarQuitar}
            />
        </div>
    )
}
