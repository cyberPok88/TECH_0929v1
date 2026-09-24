'use client'

import { useCallback, useRef, useState } from 'react'
import { Plus, FileDown } from 'lucide-react'
import { usePageConfig } from '@/hooks/usePageConfig'
import type { ToolbarAction } from '@/types/shell'
import {
  CatalogosBasicosHub,
  type HubCatalogosHandle,
} from '@/components/catalogos/catalogos-basicos/CatalogosBasicosHub'

const RUTA = '/dashboard/catalogos/catalogos-basicos'

export default function CatalogosBasicosPage() {
  const hubRef = useRef<HubCatalogosHandle | null>(null)
  const [hubListo, setHubListo] = useState(false)

  const cuandoListo = useCallback((h: HubCatalogosHandle) => {
    hubRef.current = h
    setHubListo(true)
  }, [])

  const nuevoEnActiva = useCallback(() => {
    hubRef.current?.nuevoEnTabActiva()
  }, [])

  const exportarActiva = useCallback(() => {
    hubRef.current?.exportarTabActiva()
  }, [])

  const acciones: ToolbarAction[] = [
    { id: 'nuevo', label: 'Nuevo', icon: Plus, accion: 'crear', disabled: !hubListo, title: 'Crear registro en el catálogo activo', onClick: nuevoEnActiva },
    { id: 'exportar-csv', label: 'Exportar CSV', icon: FileDown, accion: 'exportar', disabled: !hubListo, title: 'Exportar el catálogo activo', onClick: exportarActiva },
  ]

  usePageConfig({
    info: { title: 'Catálogos básicos', subtitle: 'Administración de los datos maestros del sistema' },
    path: RUTA,
    actions: acciones,
  })

  return <CatalogosBasicosHub onReady={cuandoListo} />
}
