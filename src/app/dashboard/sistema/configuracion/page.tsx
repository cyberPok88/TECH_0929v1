// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN — la ruta (Guía 2.4 · 05 Oct 2026)
//
// ⭐ SERVER COMPONENT, y es a propósito (decisión E3 de la anatomía §7).
//
//   El molde del proyecto usa `'use client'` + `usePageConfig` en la página. Acá NO,
//   porque esta página tiene que leer el CANDADO DE ENTORNO — y `ENTORNO` es
//   server-only a propósito: si la leyera el cliente habría que volverla
//   `NEXT_PUBLIC_`, quedaría horneada en el bundle y el navegador podría falsearla.
//
//   ⇒ La página LEE el candado y lo pasa por PROP. El panel (cliente) solo obedece.
//   ⇒ `usePageConfig` (un hook) baja al panel, que sí es cliente.
//
//   Reemplaza el `PlaceholderModule` que ocupaba la ruta, cuyo texto anunciaba
//   "Catálogos operativos, folios, listas de precios e impuestos" — un destino que ya
//   quedaron ocupados por la Guía 1.0 y la 2.2. El propósito se CORRIGE, no se hereda.
// ═══════════════════════════════════════════════════════════════════════════════

import { ConfiguracionPanel } from '@/components/sistema/configuracion/ConfiguracionPanel'
import { permiteBorradoBd } from '@/lib/utils/entorno'

export default function Page() {
    // ⚠️ Se evalúa EN EL SERVIDOR. Fail-closed: sin `ENTORNO=desarrollo`, es false
    //    y la tarjeta de borrado NO se dibuja.
    const permiteBorrado = permiteBorradoBd()

    return <ConfiguracionPanel permiteBorrado={permiteBorrado} />
}
