'use client'

// Página placeholder — Guía 0.6 · Parte 5.
// El módulo real se construye en una guía futura del módulo Sistema.

import { Building2 } from 'lucide-react'

import { PlaceholderModule } from '@/components/shell'
import { usePageConfig } from '@/hooks/usePageConfig'

export default function Page() {
    usePageConfig({
        info: { title: 'Mi Empresa', subtitle: 'Sistema' },
        path: '/dashboard/sistema/empresa',
    })

    return (
        <PlaceholderModule
            titulo="Mi Empresa"
            descripcion="Datos fiscales del emisor, domicilio, logotipo y marcas comerciales."
            icon={Building2}
            estado="en_construccion"
            guiaDestino="una guía futura del módulo Sistema"
        />
    )
}
