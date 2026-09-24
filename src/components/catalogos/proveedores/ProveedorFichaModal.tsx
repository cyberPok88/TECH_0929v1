'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PROVEEDOR FICHA MODAL — Detalle read-only (Guía 1.1 · Parte 4 · Dumb)
// Las 4 pestañas del diccionario (ANATOMÍA §4) en SOLO LECTURA + encabezado
// con código/estado/tipo y `saldo_por_pagar` (única superficie que lo muestra —
// decisión mapa §5 #5). Recibe el proveedor y emite "Editar" al padre.
// También es el destino del deep link ?proveedor={id} (contrato mapa §3).
//
// ⚠️ INSTANCIA SIEMPRE MONTADA (open controlado, sin early-return): devolver
// null cuando no hay proveedor desmonta el Dialog a mitad de su animación de
// salida y deja el overlay de Radix colgado (página "congelada").
// ═══════════════════════════════════════════════════════════════════════════════

import { Pildora } from '@/components/data-table'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCanAction } from '@/hooks/useCanAction'
import { ProveedorComprasTab } from '@/components/catalogos/proveedores/ProveedorComprasTab'
import type { RegimenFiscalOpcion } from '@/lib/actions/sat'
import {
    TEXTO_ESTADO,
    TEXTO_TIPO,
    TONO_ESTADO,
    TONO_TIPO,
    estadoDeProveedor,
} from '@/types/proveedores'
import type { Proveedor } from '@/types/proveedores'

interface ProveedorFichaModalProps {
    proveedor: Proveedor | null
    regimenes: RegimenFiscalOpcion[]
    open: boolean
    onOpenChange: (open: boolean) => void
    onEditar?: (proveedor: Proveedor) => void
}

function Valor({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-0.5 py-1">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {etiqueta}
            </dt>
            <dd className="text-[13.5px] text-foreground">
                {children ?? <span className="text-muted-foreground/70">—</span>}
            </dd>
        </div>
    )
}

function moneda(valor: number): string {
    return valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}

export function ProveedorFichaModal({
    proveedor,
    regimenes,
    open,
    onOpenChange,
    onEditar,
}: ProveedorFichaModalProps) {
    const p = proveedor
    const regimenNombre =
        p?.regimen_descripcion ??
        (p ? regimenes.find((r) => r.id === p.id_regimen_fiscal)?.descripcion : null) ??
        null
    const estado = p ? estadoDeProveedor(p) : null
    // Anexión 1.4: la pestaña "Compras" solo se muestra con permiso `ver` del
    // módulo Compras (decisión mapa D5 · PLAN N2 — un rol con proveedores ver
    // pero sin compras ver no la ve).
    const puedeVerCompras = useCanAction('/dashboard/compras', 'ver')

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                {p && (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 font-display">
                                {p.nombre_comercial}
                                <span className="font-mono text-[12px] font-semibold text-muted-foreground">
                                    {p.codigo}
                                </span>
                            </DialogTitle>
                            <div className="flex flex-wrap items-center gap-1.5">
                                <Pildora texto={TEXTO_TIPO[p.tipo]} tono={TONO_TIPO[p.tipo]} />
                                {estado && (
                                    <Pildora
                                        texto={TEXTO_ESTADO[estado]}
                                        tono={TONO_ESTADO[estado]}
                                    />
                                )}
                            </div>
                        </DialogHeader>

                        <Tabs defaultValue="general" className="mt-1">
                            <TabsList className={`grid w-full ${puedeVerCompras ? 'grid-cols-5' : 'grid-cols-4'}`}>
                                <TabsTrigger value="general">General</TabsTrigger>
                                <TabsTrigger value="fiscal">Datos fiscales</TabsTrigger>
                                <TabsTrigger value="contacto">Contacto y domicilio</TabsTrigger>
                                <TabsTrigger value="terminos">Términos y notas</TabsTrigger>
                                {puedeVerCompras && (
                                    <TabsTrigger value="compras">Compras</TabsTrigger>
                                )}
                            </TabsList>

                            <TabsContent value="general" className="pt-2">
                                <dl className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                                    <Valor etiqueta="Nombre comercial">{p.nombre_comercial}</Valor>
                                    <Valor etiqueta="Razón social">{p.razon_social}</Valor>
                                    <Valor etiqueta="Tipo">{TEXTO_TIPO[p.tipo]}</Valor>
                                    <Valor etiqueta="Código">{p.codigo}</Valor>
                                </dl>
                            </TabsContent>

                            <TabsContent value="fiscal" className="pt-2">
                                <dl className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                                    <Valor etiqueta="RFC">{p.rfc}</Valor>
                                    <Valor etiqueta="Régimen fiscal">{regimenNombre}</Valor>
                                    <Valor etiqueta="C.P. (domicilio fiscal)">{p.codigo_postal}</Valor>
                                </dl>
                            </TabsContent>

                            <TabsContent value="contacto" className="pt-2">
                                <dl className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                                    <Valor etiqueta="Teléfono">{p.telefono}</Valor>
                                    <Valor etiqueta="Correo">{p.email}</Valor>
                                    <Valor etiqueta="Contacto">{p.nombre_contacto}</Valor>
                                    <Valor etiqueta="Dirección">{p.direccion}</Valor>
                                    <Valor etiqueta="Colonia">{p.colonia}</Valor>
                                    <Valor etiqueta="Ciudad">{p.ciudad}</Valor>
                                    <Valor etiqueta="Estado">{p.estado}</Valor>
                                </dl>
                            </TabsContent>

                            <TabsContent value="terminos" className="pt-2">
                                <dl className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                                    <Valor etiqueta="Términos de pago">
                                        {p.terminos_pago === 'credito' ? 'Crédito' : 'Contado'}
                                    </Valor>
                                    <Valor etiqueta="Días de crédito">
                                        {p.terminos_pago === 'credito'
                                            ? String(p.dias_credito ?? '')
                                            : '—'}
                                    </Valor>
                                    <Valor etiqueta="Saldo por pagar">
                                        <span className="font-mono">{moneda(p.saldo_por_pagar)}</span>
                                    </Valor>
                                    <Valor etiqueta="Notas">{p.notas}</Valor>
                                </dl>
                            </TabsContent>

                            {puedeVerCompras && (
                                <TabsContent value="compras" className="pt-2">
                                    {/* Anexión 1.4: historial read-only + Ver (cierra fila 1.1) */}
                                    <ProveedorComprasTab proveedorId={p.id} />
                                </TabsContent>
                            )}
                        </Tabs>

                        <DialogFooter>
                            {onEditar && (
                                <Button
                                    variant="outline"
                                    onClick={() => onEditar(p)}
                                    data-accion="editar"
                                >
                                    Editar
                                </Button>
                            )}
                            <Button variant="default" onClick={() => onOpenChange(false)}>
                                Cerrar
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
