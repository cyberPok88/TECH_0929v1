'use client'

// CLIENTE DIRECCIONES TAB — lista read-only de las hijas (Guía 1.3 · P7 · Dumb)
import { MapPin } from 'lucide-react'
import type { DireccionCliente } from '@/types/clientes'

export function ClienteDireccionesTab({ direcciones }: { direcciones: DireccionCliente[] }) {
    if (direcciones.length === 0) {
        return <p className="text-sm text-muted-foreground">Sin direcciones registradas.</p>
    }
    return (
        <div className="grid gap-2 sm:grid-cols-2">
            {direcciones
                .filter((d) => d.es_activo)
                .map((d) => (
                    <div key={d.id} className="rounded-md border border-border/60 bg-surface/40 p-3 text-sm">
                        <p className="flex items-center gap-1.5 font-medium">
                            <MapPin className="h-4 w-4" aria-hidden="true" />
                            {d.etiqueta || d.tipo}
                            {d.es_default_fiscal && (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                    Fiscal
                                </span>
                            )}
                            {d.es_default_envio && (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                    Envío
                                </span>
                            )}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                            {d.direccion}
                            {d.colonia ? `, ${d.colonia}` : ''}
                        </p>
                        <p className="text-muted-foreground">
                            {[d.ciudad, d.estado, d.codigo_postal].filter(Boolean).join(' · ')}
                        </p>
                    </div>
                ))}
        </div>
    )
}
