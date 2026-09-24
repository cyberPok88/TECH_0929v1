'use client'

import { useEffect, useMemo, useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { ClaveTabCatalogo } from '@/types/catalogos'
import { CatalogoMiniCrud } from './CatalogoMiniCrud'
import { configDeTab, type SolicitudNueva } from './catalogos-config'
import { CategoriasTab } from './CategoriasTab'
import { RutasTab } from './RutasTab'
import { VendedoresTab } from './VendedoresTab'

export interface HubCatalogosHandle {
  /** Crea un registro en la pestaña activa (Toolbar → tab). Parte 3+ abre el modal real. */
  nuevoEnTabActiva: () => void
  /** Exporta CSV de la pestaña activa. Parte 9 implementa la descarga. */
  exportarTabActiva: () => void
  tabActiva: () => ClaveTabCatalogo
}

export interface TabMeta {
  clave: ClaveTabCatalogo
  etiqueta: string
  parte: number // parte de la guía que implementa el contenido de la pestaña
}

const TABS: TabMeta[] = [
  { clave: 'impuestos', etiqueta: 'Impuestos', parte: 3 },
  { clave: 'unidades_medida', etiqueta: 'Unidades de medida', parte: 4 },
  { clave: 'categorias', etiqueta: 'Categorías', parte: 6 },
  { clave: 'canales_venta', etiqueta: 'Canales de venta', parte: 4 },
  { clave: 'marcas_comerciales', etiqueta: 'Marcas comerciales', parte: 4 },
  { clave: 'tipos_cliente', etiqueta: 'Tipos de cliente', parte: 5 },
  { clave: 'rutas_cobro', etiqueta: 'Rutas de cobro', parte: 7 },
  { clave: 'listas_precios', etiqueta: 'Listas de precios', parte: 5 },
  { clave: 'vendedores', etiqueta: 'Vendedores', parte: 8 },
  { clave: 'marcas_producto', etiqueta: 'Marcas de producto', parte: 4 },
  { clave: 'ubicaciones_almacen', etiqueta: 'Almacén', parte: 7 },
]

interface Props {
  onReady: (handle: HubCatalogosHandle) => void
}

export function CatalogosBasicosHub({ onReady }: Props) {
  const [tabActiva, setTabActiva] = useState<ClaveTabCatalogo>('impuestos')
  const [señalExportar, setSeñalExportar] = useState(0)
  const [solicitudNuevo, setSolicitudNuevo] = useState<SolicitudNueva>({ tab: tabActiva, seq: 0 })

  const handle = useMemo<HubCatalogosHandle>(() => ({
    nuevoEnTabActiva: () => {
      if (tabActiva === 'vendedores') return // sin alta (derivado)
      setSolicitudNuevo((prev) => ({ tab: tabActiva, seq: prev.seq + 1 }))
    },
    exportarTabActiva: () => {
      setSeñalExportar((n) => n + 1)
    },
    tabActiva: () => tabActiva,
  }), [tabActiva, setSolicitudNuevo, setSeñalExportar])

  useEffect(() => {
    onReady(handle)
  }, [handle, onReady])

  return (
    <Tabs value={tabActiva} onValueChange={(v) => setTabActiva(v as ClaveTabCatalogo)}>
      <TabsList className="flex flex-wrap justify-start">
        {TABS.map((tab) => (
          <TabsTrigger key={tab.clave} value={tab.clave}>{tab.etiqueta}</TabsTrigger>
        ))}
      </TabsList>
      {TABS.map((tab) => {
        const cfg = configDeTab(tab.clave)
        const activa = tab.clave === tabActiva
        return (
          <TabsContent key={tab.clave} value={tab.clave} className="pt-4">
            {tab.clave === 'categorias' ? (
              <CategoriasTab solicitudNuevo={solicitudNuevo} />
            ) : tab.clave === 'rutas_cobro' ? (
              <RutasTab solicitudNuevo={solicitudNuevo} />
            ) : tab.clave === 'vendedores' ? (
              <VendedoresTab />
            ) : cfg ? (
              <CatalogoMiniCrud
                config={cfg}
                activo={activa}
                solicitudNuevo={solicitudNuevo}
                señalExportar={señalExportar}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Catálogo «{tab.etiqueta}» — se implementa en la Parte {tab.parte} de la Guía 1.0.
              </p>
            )}
          </TabsContent>
        )
      })}
    </Tabs>
  )
}
