'use client'

import { useParams } from 'next/navigation'

import { ClienteFicha } from '@/components/catalogos/clientes/ClienteFicha'

export default function ClienteDetallePage() {
    const params = useParams<{ id: string }>()
    const id = params.id
    return <ClienteFicha clienteId={id} />
}
