'use client'

// Página placeholder — Guía 0.6 · Parte 5.
// El módulo real se construye en una guía futura del módulo Sistema.

import { SlidersHorizontal } from 'lucide-react'

import { PlaceholderModule } from '@/components/shell'
import { usePageConfig } from '@/hooks/usePageConfig'

export default function Page() {
    usePageConfig({
        info: { title: 'Configuración', subtitle: 'Sistema' },
        path: '/dashboard/sistema/configuracion',
    })

    return (
        <PlaceholderModule
            titulo="Configuración"
            descripcion="Catálogos operativos, folios, listas de precios e impuestos."
            icon={SlidersHorizontal}
            estado="en_construccion"
            guiaDestino="una guía futura del módulo Sistema"
        />
    )
}
