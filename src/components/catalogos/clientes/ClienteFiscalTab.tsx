'use client'

// CLIENTE FISCAL TAB — CFDI base (Guía 1.3 · P7 · Dumb)
import type { ClienteDetalle } from '@/types/clientes'

function Campo({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
    return (
        <div className="space-y-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
            <p className="text-sm">{valor ?? '—'}</p>
        </div>
    )
}

export function ClienteFiscalTab({ detalle }: { detalle: ClienteDetalle }) {
    return (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Campo etiqueta="RFC" valor={detalle.rfc} />
            <Campo etiqueta="Régimen fiscal" valor={detalle.regimen_descripcion} />
            <Campo etiqueta="Uso de CFDI" valor="(V2)" />
        </div>
    )
}
