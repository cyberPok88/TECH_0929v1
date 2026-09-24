'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORTAR CSV MODAL — wizard de importación masiva (Guía 1.2 · Parte 8 · Smart)
// 3 pasos: 1) subir archivo (+ plantilla descargable) · 2) preview DRY-RUN (sin
// folios) con errores por fila · 3) confirmar importación real (batches por fila).
// Solo visible para la acción RBAC 'importar' (Administrador · b5).
// ═══════════════════════════════════════════════════════════════════════════════

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Download, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { importarProductosCSV } from '@/lib/actions/productos'
import type { ResultadoImportProductos } from '@/lib/actions/productos'

const PLANTILLA = [
    'nombre;categoria;marca;unidad;impuesto;precio_base;precio_minimo;stock_minimo;codigo_barras;requiere_revision;maneja_numero_serie;descripcion;notas;capacidad;tipo',
    'Disco duro Seagate 1TB SATA;Almacenamiento / HDD;Seagate;Pieza;IVA 16%;950;900;2;;true;false;Disco interno;;1TB;PC',
    'Memoria RAM 8GB DDR4;RAM;Kingston;Pieza;IVA 16%;600;550;3;;true;false;;;8GB;PC',
].join('\r\n')

interface ImportarCSVModalProps {
    abierto: boolean
    onCerrar: () => void
    onExito: () => void
}

export function ImportarCSVModal({ abierto, onCerrar, onExito }: ImportarCSVModalProps) {
    const [paso, setPaso] = useState<1 | 2 | 3>(1)
    const [csv, setCsv] = useState('')
    const [archivo, setArchivo] = useState('')
    const [preview, setPreview] = useState<ResultadoImportProductos | null>(null)
    const [resultado, setResultado] = useState<ResultadoImportProductos | null>(null)
    const [ocupado, setOcupado] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const descargarPlantilla = () => {
        const blob = new Blob(['\uFEFF' + PLANTILLA], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'productos-plantilla.csv'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const alElegirArchivo = async (archivoSeleccionado: File) => {
        const texto = await archivoSeleccionado.text()
        setCsv(texto)
        setArchivo(archivoSeleccionado.name)
        setPaso(2)
        setOcupado(true)
        try {
            const res = await importarProductosCSV(texto, true)
            if (res.success && res.data) setPreview(res.data)
            else toast.error(res.error ?? 'No se pudo validar el archivo.')
        } finally {
            setOcupado(false)
        }
    }

    const confirmar = async () => {
        if (!csv) return
        setOcupado(true)
        try {
            const res = await importarProductosCSV(csv, false)
            if (!res.success || !res.data) {
                toast.error(res.error ?? 'No se pudo importar.')
                return
            }
            setResultado(res.data)
            setPaso(3)
            if (res.data.insertados > 0) toast.success(`${res.data.insertados} producto(s) importado(s).`)
        } finally {
            setOcupado(false)
        }
    }

    const reiniciar = () => {
        setPaso(1)
        setCsv('')
        setArchivo('')
        setPreview(null)
        setResultado(null)
        if (inputRef.current) inputRef.current.value = ''
    }

    return (
        <Dialog open={abierto} onOpenChange={(v) => { if (!v && !ocupado) onCerrar() }}>
            <DialogContent className="sm:max-w-[680px]">
                <DialogHeader>
                    <DialogTitle>Importar productos desde CSV</DialogTitle>
                </DialogHeader>

                {paso === 1 && (
                    <div className="grid gap-4">
                        <p className="text-sm text-muted-foreground">
                            Paso 1 de 3 — sube tu archivo <code>.csv</code> (UTF-8, separador{' '}
                            <code>;</code> o <code>,</code> con auto-detección). Las columnas extra
                            se mapean a las características de la categoría; las marcas faltantes se
                            crean automáticamente; las categorías deben existir.
                        </p>
                        <div className="flex items-center gap-3">
                            <input
                                ref={inputRef}
                                type="file"
                                accept=".csv,text/csv"
                                onChange={(e) => {
                                    const f = e.target.files?.[0]
                                    if (f) void alElegirArchivo(f)
                                }}
                                className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:text-primary-foreground"
                            />
                        </div>
                        <div>
                            <Button type="button" variant="outline" size="sm" onClick={descargarPlantilla}>
                                <Download className="mr-2 h-4 w-4" /> Descargar plantilla
                            </Button>
                        </div>
                    </div>
                )}

                {paso === 2 && (
                    <div className="grid gap-3">
                        <p className="text-sm">
                            Paso 2 de 3 — preview (<code>dry-run</code>, sin folios) de{' '}
                            <span className="font-medium">{archivo || 'archivo'}</span>:
                        </p>
                        {ocupado ? (
                            <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" /> Validando…
                            </p>
                        ) : (
                            preview && (
                                <div className="space-y-3 text-sm">
                                    <div className="flex flex-wrap gap-3">
                                        <span className="rounded-md border border-border px-2 py-1">
                                            ✅ {preview.insertados} fila(s) válidas
                                        </span>
                                        <span className="rounded-md border border-border px-2 py-1">
                                            ⚠️ {preview.errores.length} error(es) por fila
                                        </span>
                                        {preview.marcasCreadas.length > 0 && (
                                            <span className="rounded-md border border-border px-2 py-1">
                                                🏷️ {preview.marcasCreadas.length} marca(s) por crear:{' '}
                                                {preview.marcasCreadas.slice(0, 3).join(', ')}
                                                {preview.marcasCreadas.length > 3 ? '…' : ''}
                                            </span>
                                        )}
                                    </div>
                                    {preview.errores.length > 0 && (
                                        <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                                            {preview.errores.map((e, i) => (
                                                <p key={i} className="text-xs text-destructive">
                                                    Fila {e.fila}: {e.error}
                                                </p>
                                            ))}
                                        </div>
                                    )}
                                    {preview.avisos.length > 0 && (
                                        <div className="space-y-0.5 text-xs text-muted-foreground">
                                            {preview.avisos.map((a, i) => (
                                                <p key={i}>• {a}</p>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        )}
                    </div>
                )}

                {paso === 3 && resultado && (
                    <div className="space-y-3 text-sm">
                        <p className="font-medium">
                            {resultado.insertados > 0
                                ? `Importación completada: ${resultado.insertados} producto(s) insertado(s).`
                                : 'No se insertó ningún producto.'}
                        </p>
                        {resultado.errores.length > 0 && (
                            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                                {resultado.errores.map((e, i) => (
                                    <p key={i} className="text-xs text-destructive">
                                        Fila {e.fila}: {e.error}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter className="gap-2">
                    {paso === 1 && (
                        <Button variant="ghost" onClick={onCerrar}>Cancelar</Button>
                    )}
                    {paso === 2 && (
                        <>
                            <Button variant="ghost" onClick={() => setPaso(1)} disabled={ocupado}>
                                Cambiar archivo
                            </Button>
                            <Button onClick={() => void confirmar()} disabled={ocupado}>
                                {ocupado ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importando…</>
                                ) : (
                                    'Confirmar importación'
                                )}
                            </Button>
                        </>
                    )}
                    {paso === 3 && (
                        <>
                            <Button variant="outline" onClick={() => { reiniciar(); onCerrar() }}>
                                Cerrar
                            </Button>
                            <Button variant="ghost" onClick={() => { reiniciar(); onExito() }}>
                                Volver al catálogo
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
