'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PLANTILLAS — HUB DE PESTAÑAS (Guía 2.1 · P3 · composición)
//
// Contenedor de las pestañas del módulo. NO llama `usePageConfig`: el título y las
// acciones dependen de la pestaña activa, y llamar hooks condicionalmente es
// ilegal. Además, si este Hub (siempre montado) lo llamara junto con la pestaña,
// el clearPageConfig() del desmontaje de la pestaña dejaría la toolbar VACÍA.
//
// ⚠️ SOLO SE MONTA LA PESTAÑA ACTIVA: el contenido va dentro de `TabsContent`, que
// Radix DESMONTA al no estar seleccionado (no lo oculta). Cada pestaña registra su
// propia toolbar y debe desmontarse al salir para liberarla. Bonus: `TabsContent`
// da el `tabpanel` con su `aria-controls`, que un render condicional propio NO daría
// (accesibilidad mínima — SISTEMA_COMPONENTES §6).
//
// ⭐ P8 (27 Sep 2026): LA TERCERA PESTAÑA YA EXISTE. P3 dejó anotado que llegaría
// «cuando su superficie exista» porque una pestaña vacía es un control muerto
// (SISTEMA_COMPONENTES §8). La superficie es `ImpresionesTabla` (auditoría de
// impresiones, solo lectura) y se monta aquí, en la parte que la construyó.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ImpresionesTabla } from '@/components/sistema/plantillas/ImpresionesTabla'
import { PlantillasCatalogo } from '@/components/sistema/plantillas/PlantillasCatalogo'
import { TiposDocumentoCatalogo } from '@/components/sistema/plantillas/TiposDocumentoCatalogo'

type PestanaId = 'plantillas' | 'tipos' | 'auditoria'

export function PlantillasHub() {
    // La pestaña de arranque es la de trabajo diario: editar el papel.
    const [pestana, setPestana] = useState<PestanaId>('plantillas')

    return (
        <div className="flex flex-col gap-4">
            <Tabs value={pestana} onValueChange={(v) => setPestana(v as PestanaId)}>
                <TabsList>
                    <TabsTrigger value="plantillas">Plantillas</TabsTrigger>
                    <TabsTrigger value="tipos">Tipos de documento</TabsTrigger>
                    {/* Última a propósito: las dos primeras se usan para trabajar; esta, para consultar. */}
                    <TabsTrigger value="auditoria">Auditoría</TabsTrigger>
                </TabsList>
                {/* Radix DESMONTA el TabsContent inactivo: la pestaña que sale libera su
                    usePageConfig. Y da el tabpanel con su aria-controls. */}
                <TabsContent value="plantillas">
                    <PlantillasCatalogo />
                </TabsContent>
                <TabsContent value="tipos">
                    <TiposDocumentoCatalogo />
                </TabsContent>
                <TabsContent value="auditoria">
                    <ImpresionesTabla />
                </TabsContent>
            </Tabs>
        </div>
    )
}
