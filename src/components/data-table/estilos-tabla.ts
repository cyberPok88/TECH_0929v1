// ═══════════════════════════════════════════════════════════════════════════════
// ESTILOS DE TABLA — FUENTE ÚNICA DEL CROMO DE TABLA (Guía 0.8 · contrato agregado 26 Sep 2026)
//
// POR QUÉ EXISTE: el encabezado de una tabla es CROMO, no contenido — y la app tenía
// TRES maneras de pintarlo. `DataTable` usaba `bg-surface-2` sin versalitas; las tablas
// anidadas de Entradas usaban `bg-surface` con versalitas; los modales de detalle, otra
// cosa. En el tema claro el resultado era que **el encabezado y la fila salían del mismo
// color** (medido sobre captura: los dos `#fefdfa`), y el usuario lo describió exacto:
// *«los encabezados parecen datos mismos»*.
//
// REGLA ÚNICA que este archivo impone, para el `DataTable` y para TODA tabla escrita a mano:
//   · el encabezado lleva BANDA (`bg-th`) + VERSALITAS + una REGLA DE 2px;
//   · las filas se separan con la MISMA regla de 1px (`border-border`) en las dos tablas —
//     una tabla anidada con línea más débil (era `border-border/70`) deja de leerse como filas.
//
// CÓMO SE USA EN UNA TABLA A MANO:
//
//   import { CLASE_CAJA_TABLA, CLASE_TABLA, CLASE_THEAD_TABLA, CLASE_TH_TABLA, CLASE_TD_FILA } from '@/components/data-table'
//
//   <div className={CLASE_CAJA_TABLA}>
//     <table className={CLASE_TABLA}>
//       <thead className={CLASE_THEAD_TABLA}>
//         <tr><th className={cn(CLASE_TH_TABLA, 'w-12')}>#</th></tr>
//       </thead>
//       <tbody>
//         <tr><td className={cn(CLASE_TD_FILA, 'px-2.5 py-2')}>…</td></tr>
//       </tbody>
//     </table>
//   </div>
//
// ⚠️ La ÚNICA excepción deliberada es `NotaEntradaImprimible.tsx`: es un DOCUMENTO que se
// imprime en papel, no la UI de la app. Ahí el encabezado va con reglas de tinta, sin banda.
// ═══════════════════════════════════════════════════════════════════════════════

/** La caja que envuelve una tabla: borde, esquina y la superficie de sus celdas. */
export const CLASE_CAJA_TABLA = 'overflow-hidden rounded-md border border-border bg-surface'

/** La tabla. `border-separate`/`spacing-0` para que el sticky del kit no pierda bordes. */
export const CLASE_TABLA = 'w-full border-separate border-spacing-0 text-sm'

/** El `<thead>`: BANDA + regla de 2px + la tipografía del encabezado.
 *  ⚠️ La tipografía va AQUÍ a propósito: `font-size`, `font-weight`, `text-transform`,
 *  `letter-spacing`, `color` y `vertical-align` son propiedades **heredadas**, así que una
 *  tabla escrita a mano solo necesita esta clase en su `<thead>` — sus `<th>` no se tocan. */
export const CLASE_THEAD_TABLA =
    'border-b-2 border-border bg-th text-[9.5px] font-semibold uppercase tracking-[0.11em] text-foreground/70'

/** Una celda de encabezado (`<th>`): versalitas, tracking y peso. El padding lo pone quien la usa. */
export const CLASE_TH_TABLA =
    'align-middle text-[9.5px] font-semibold uppercase tracking-[0.11em] text-foreground/70'

/** El encabezado del kit (dentro del `DataTable`), que además es sticky y mide 44/40px. */
export const CLASE_TH_KIT = `${CLASE_TH_TABLA} sticky top-0 z-[5] border-b-2 border-border bg-th`

/** Una celda de cuerpo (`<td>`): la REGLA DE FILA. El padding lo pone quien la usa. */
export const CLASE_TD_FILA = 'border-b border-border'

/** El cuerpo del kit: la última fila no lleva regla (la cierra el borde de la caja). */
export const CLASE_TBODY_KIT = '[&_tr:last-child>td]:border-b-0'
