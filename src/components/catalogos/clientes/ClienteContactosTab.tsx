'use client'

// CLIENTE CONTACTOS TAB — lista read-only de las hijas (Guía 1.3 · P7 · Dumb)
import { Phone, UserRound } from 'lucide-react'
import type { ContactoCliente } from '@/types/clientes'

export function ClienteContactosTab({ contactos }: { contactos: ContactoCliente[] }) {
    if (contactos.length === 0) {
        return <p className="text-sm text-muted-foreground">Sin contactos registrados.</p>
    }
    return (
        <div className="grid gap-2 sm:grid-cols-2">
            {contactos
                .filter((c) => c.es_activo)
                .map((c) => (
                    <div key={c.id} className="rounded-md border border-border/60 bg-surface/40 p-3 text-sm">
                        <p className="flex items-center gap-1.5 font-medium">
                            <UserRound className="h-4 w-4" aria-hidden="true" />
                            {c.nombre}
                            {c.es_principal && (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                    Principal
                                </span>
                            )}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                            {c.tipo}
                            {c.telefono && (
                                <>
                                    <span className="mx-1">·</span>
                                    <Phone className="mr-0.5 inline h-3 w-3" aria-hidden="true" />
                                    {c.telefono}
                                </>
                            )}
                        </p>
                        {c.email && <p className="text-muted-foreground">{c.email}</p>}
                    </div>
                ))}
        </div>
    )
}
