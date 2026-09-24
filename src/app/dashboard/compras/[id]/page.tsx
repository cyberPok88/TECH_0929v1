'use client'

import { useParams } from 'next/navigation'

import { NotaCompraFicha } from '@/components/compras/NotaCompraFicha'

export default function NotaDetallePage() {
    const params = useParams<{ id: string }>()
    const id = params.id
    return <NotaCompraFicha notaId={id} />
}
