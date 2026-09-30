'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// NOTA DE COMPRA IMPRIMIBLE — EL RESPALDO EN CÓDIGO DEL PAPEL (Guía 1.4 · MEJORA 40)
//
// `DocumentoImprimible` lo pinta cuando el tipo `nota_compra` NO tiene plantilla
// activa en la base. Si el usuario activa la suya, se imprime la plantilla; si la
// desactiva —o publica una versión rota— el papel **sigue saliendo** por acá.
//
// ⭐ POR QUÉ EXISTE (medido 28 Sep 2026): el punto de invocación se cableó SIN
// respaldo, así que el PDF de una nota de compra dependía **100%** de que existiera
// una plantilla activa: con el registro vacío, «Imprimir / PDF» mostraba el mensaje
// «este documento todavía no tiene plantilla». **La plantilla era punto único de
// falla.** Un respaldo convierte ese fallo en una degradación, no en un documento
// que no se puede entregar.
//
// ⭐ RECIBE `datos`, el MISMO vocabulario que la plantilla (lo arma `datosImpresion`
// en `NotaCompraFicha`, que es donde está la nota). Los dos caminos imprimen lo
// mismo: si el vocabulario cambia, cambia para los dos. Formatea el que arma los
// datos — acá no se calcula (la plantilla tampoco: el motor PINTA).
//
// ⭐ ENCABEZA LA MARCA, NO LA RAZÓN SOCIAL (`DOCS/EMPRESA/03_MARCA.md`: TECH COMPUTER
// = matriz/facturación · TENOCHTITLÁN = marca visible). `razon_social` queda como
// último recurso para no dejar el encabezado vacío.
//
// Presentacional: no llama Server Actions; recibe todo resuelto.
// ═══════════════════════════════════════════════════════════════════════════════

import type { VariablesDocumento } from '@/lib/plantillas/motor'

interface NotaCompraImprimibleProps {
    /** El vocabulario del papel, ya formateado (`NotaCompraFicha` + el membrete). */
    datos: VariablesDocumento
}

/** Un valor del vocabulario como texto. Acá tampoco se calcula: el papel pinta. */
function texto(valor: unknown): string {
    if (valor === null || valor === undefined) return ''
    return String(valor)
}

/** Clases del papel: tinta negra, rejilla de una línea — como el resto de los documentos. */
const TH = 'border border-black bg-neutral-100 px-2 py-1 text-left text-[10px] font-bold uppercase tracking-[0.06em]'
const TD = 'border border-black px-2 py-1 align-top'

export function NotaCompraImprimible({ datos }: NotaCompraImprimibleProps) {
    const partidas = Array.isArray(datos.partidas) ? datos.partidas : []
    const pagos = Array.isArray(datos.pagos) ? datos.pagos : []
    const logo = texto(datos.logo_url)
    const sello = texto(datos.sello)

    return (
        <div className="text-sm text-black">
            {/* El membrete sale de `empresa_emisora`. Un logo vacío NO se pinta:
                `<img src="">` apunta a la propia página y la recarga. */}
            {logo ? (
                // ⚠️ `<img>` a propósito (no `next/image`): es un elemento del PAPEL, que
                //    html2canvas rasteriza. El optimizador exige `height` —y distorsionaría
                //    un logo de proporción desconocida— y una allowlist de dominios.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt={texto(datos.nombre_comercial)} width={140} className="mb-1" />
            ) : null}

            <div className="flex items-start justify-between gap-3 border-b-2 border-black pb-2">
                <div>
                    <div className="text-lg font-bold">
                        {texto(datos.nombre_comercial) || texto(datos.razon_social)}
                    </div>
                    {texto(datos.rfc) ? (
                        <div className="text-[11px]">RFC {texto(datos.rfc)}</div>
                    ) : null}
                    {texto(datos.direccion) ? (
                        <div className="text-[11px]">{texto(datos.direccion)}</div>
                    ) : null}
                </div>
                <div className="text-right">
                    <div className="text-[15px] font-bold">NOTA DE COMPRA</div>
                    <div className="text-[12px]">
                        Folio: <span className="font-mono tabular-nums">{texto(datos.folio)}</span>
                    </div>
                    <div className="text-[12px]">Fecha: {texto(datos.fecha)}</div>
                    {texto(datos.origen) ? (
                        <div className="text-[11px]">Origen: {texto(datos.origen)}</div>
                    ) : null}
                </div>
            </div>

            <table className="mt-2 w-full text-[12px]">
                <tbody>
                    <tr>
                        <td className="pr-2 align-top">
                            <span className="font-bold">PROVEEDOR: </span>
                            {texto(datos.proveedor_nombre) || '—'}
                            {texto(datos.proveedor_codigo) ? ` (${texto(datos.proveedor_codigo)})` : ''}
                        </td>
                        <td className="align-top">
                            <span className="font-bold">ESTADO: </span>
                            {texto(datos.estado_fisico)}
                            {texto(datos.estado_pago) ? ` · ${texto(datos.estado_pago)}` : ''}
                        </td>
                    </tr>
                    {/* Vacíos = el dato no existe: se omite la línea, no se pinta «—». */}
                    {texto(datos.factura) || texto(datos.referencia) ? (
                        <tr>
                            <td className="pt-1 align-top">
                                {texto(datos.factura) ? (
                                    <>
                                        <span className="font-bold">FACTURA: </span>
                                        {texto(datos.factura)}
                                    </>
                                ) : null}
                            </td>
                            <td className="pt-1 align-top">
                                {texto(datos.referencia) ? (
                                    <>
                                        <span className="font-bold">REFERENCIA: </span>
                                        {texto(datos.referencia)}
                                    </>
                                ) : null}
                            </td>
                        </tr>
                    ) : null}
                </tbody>
            </table>

            <table className="mt-3 w-full border-collapse text-[12px]">
                <thead>
                    <tr>
                        <th className={TH}>#</th>
                        <th className={TH}>Descripción</th>
                        <th className={TH}>Código</th>
                        <th className={`${TH} text-right`}>Cantidad</th>
                        <th className={`${TH} text-right`}>Costo</th>
                        <th className={`${TH} text-right`}>Importe</th>
                    </tr>
                </thead>
                <tbody>
                    {partidas.map((p, i) => (
                        <tr key={`${texto(p.num)}-${i}`}>
                            <td className={`${TD} tabular-nums`}>{texto(p.num)}</td>
                            <td className={TD}>{texto(p.descripcion)}</td>
                            <td className={`${TD} font-mono text-[11px]`}>{texto(p.codigo)}</td>
                            <td className={`${TD} text-right tabular-nums`}>{texto(p.cantidad)}</td>
                            <td className={`${TD} text-right tabular-nums`}>{texto(p.costo)}</td>
                            <td className={`${TD} text-right tabular-nums`}>{texto(p.importe)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="mt-2 flex justify-end">
                <table className="text-[12px]">
                    <tbody>
                        <tr>
                            <td className="pr-4 text-right font-bold">TOTAL</td>
                            <td className="text-right font-bold tabular-nums">{texto(datos.total)}</td>
                        </tr>
                        <tr>
                            <td className="pr-4 text-right">Pagado</td>
                            <td className="text-right tabular-nums">{texto(datos.pagado)}</td>
                        </tr>
                        <tr>
                            <td className="pr-4 text-right">Saldo</td>
                            <td className="text-right font-bold tabular-nums">{texto(datos.saldo)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Los pagos: si no hay ninguno, la sección NO se pinta (el «sin pagos» es
                del diseño de la plantilla, no de un dato que haya que inventar). */}
            {pagos.length > 0 ? (
                <>
                    <div className="mt-3 text-[12px] font-bold">PAGOS REGISTRADOS</div>
                    <table className="mt-1 w-full border-collapse text-[12px]">
                        <thead>
                            <tr>
                                <th className={TH}>Fecha</th>
                                <th className={TH}>Método</th>
                                <th className={TH}>Referencia</th>
                                <th className={`${TH} text-right`}>Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pagos.map((p, i) => (
                                <tr key={`${texto(p.fecha)}-${i}`}>
                                    <td className={`${TD} tabular-nums`}>{texto(p.fecha)}</td>
                                    <td className={TD}>{texto(p.metodo)}</td>
                                    <td className={TD}>{texto(p.referencia)}</td>
                                    <td className={`${TD} text-right tabular-nums`}>
                                        {texto(p.monto)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            ) : null}

            {texto(datos.notas) ? (
                <div className="mt-3 text-[12px]">
                    <span className="font-bold">NOTAS: </span>
                    {texto(datos.notas)}
                </div>
            ) : null}

            {texto(datos.motivo_cancelacion) ? (
                <div className="mt-1 text-[12px]">
                    <span className="font-bold">MOTIVO DE CANCELACIÓN: </span>
                    {texto(datos.motivo_cancelacion)}
                </div>
            ) : null}

            {/* El sello lo decide quien imprime (Pagada · Cancelada · ninguno). */}
            {sello ? (
                <div className="mt-4 text-center">
                    <span className="inline-block border-2 border-black px-4 py-1 text-[14px] font-bold uppercase tracking-[0.15em]">
                        {sello}
                    </span>
                </div>
            ) : null}

            <div className="mt-10 text-[12px]">
                ENTREGÓ: ____________________________________ &nbsp;&nbsp; RECIBIÓ:
                ____________________________________
            </div>
        </div>
    )
}
