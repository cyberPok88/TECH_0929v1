'use client'

// CLIENTE GENERAL TAB — Identidad · comercial · crédito (Guía 1.3 · P7 · Dumb)
import type { ClienteDetalle } from '@/types/clientes'

function Campo({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
    return (
        <div className="space-y-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
            <p className="text-sm">{valor ?? '—'}</p>
        </div>
    )
}

export function ClienteGeneralTab({ detalle }: { detalle: ClienteDetalle }) {
    const monto = (n: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

    return (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <Campo etiqueta="Tipo de persona" valor={detalle.tipo_persona === 'fisica' ? 'Física' : 'Moral'} />
            <Campo etiqueta="Razón social" valor={detalle.razon_social} />
            <Campo etiqueta="Marca" valor={detalle.marca_nombre} />
            <Campo etiqueta="Tipo de cliente" valor={detalle.tipo_cliente_nombre} />
            <Campo etiqueta="Lista de precios" valor={detalle.lista_precio_nombre} />
            <Campo etiqueta="Canal de venta" valor={detalle.canal_venta_nombre} />
            <Campo etiqueta="Ruta de cobro" valor={detalle.ruta_cobro_nombre} />
            <Campo etiqueta="Vendedor (cartera)" valor={detalle.vendedor_nombre} />
            <Campo etiqueta="Crédito" valor={detalle.tiene_credito ? 'Con crédito' : 'Contado'} />
            <Campo etiqueta="Límite" valor={detalle.limite_credito !== null ? monto(detalle.limite_credito) : null} />
            <Campo etiqueta="Días" valor={detalle.dias_credito ?? null} />
            <Campo etiqueta="Saldo actual" valor={monto(detalle.saldo_actual)} />
            <Campo etiqueta="Saldo inicial" valor={monto(detalle.saldo_inicial)} />
            {detalle.notas && (
                <div className="col-span-full">
                    <Campo etiqueta="Notas" valor={detalle.notas} />
                </div>
            )}
        </div>
    )
}
