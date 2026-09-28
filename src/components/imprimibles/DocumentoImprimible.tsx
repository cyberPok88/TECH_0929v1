'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// DOCUMENTO IMPRIMIBLE — EL PUNTO DE INVOCACIÓN (Guía 2.1 · P6 · Smart)
//
// ⭐ NACE EN EL KIT (Guía 0.8 · familia `imprimibles/`), no en este módulo: sus ≥2
// consumidores (1.4 · 1.6 · 1.7 · 1.8) son ANTERIORES a su existencia, así que
// construirlo local «para promoverlo después» sería el anti-patrón exacto.
// Precedente literal: `SelectorUbicacionCascada` (0.8 P7 B7).
//
// El consumidor escribe SOLO el tipo y los datos:
//   <DocumentoImprimible tipo="nota_compra" datos={…} nombreArchivo="NC-0001" … />
//
// ⭐ P7 (27 Sep 2026): EL MEMBRETE SE RESUELVE SOLO desde `empresa_emisora` si el
// consumidor no lo pasa. Con eso la 1.6 puede borrar su «TENOCHTITLÁN — IMPERIO
// TECNOLÓGICO» hardcodeado SIN REEMPLAZARLO POR NADA: el dato llega de la base.
//
// ⭐ P8 (27 Sep 2026): LA AUDITORÍA VIVE AQUÍ, EN EL ÚNICO PUNTO QUE TODOS ATRAVIESAN.
// Si cada consumidor registrara su impresión, cuatro módulos repetirían la llamada y
// el quinto se olvidaría — y una auditoría con huecos MIENTE, porque afirma que nadie
// imprimió. El gate de familia es de la BD (`fn_impresiones_solo_valor()`): aquí no se
// repite la regla (ver DECISIONES DE DISEÑO de la Parte 8).
//
// ⚠️ NO trae su propio botón «Imprimir»: el botón vive donde el dato está completo
// (contrato §4.4 del alcance). Este componente entrega el documento ABIERTO.
//
// ⚠️ El fallback es una PROP: un mapa {tipo → componente} aquí obligaría al kit a
// importar las plantillas de 1.6 (módulo de negocio) — inversión de capas.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'

import { Spinner } from '@/components/ui/spinner'
import { DocumentoImprimibleDialog } from '@/components/imprimibles/DocumentoImprimibleDialog'
import { CuerpoDocumento } from '@/components/imprimibles/CuerpoDocumento'
import { obtenerMembrete } from '@/lib/actions/empresa'
import { registrarImpresion } from '@/lib/actions/plantillas'
import { renderPlantilla } from '@/lib/plantillas/motor'
import type { VariablesDocumento } from '@/lib/plantillas/motor'
import { resolverPlantilla } from '@/lib/plantillas/registro'
import type { PlantillaFallback } from '@/lib/plantillas/registro'
import type { MembreteDocumento } from '@/types/empresa'
import type { PlantillaActiva } from '@/types/plantillas'

interface DocumentoImprimibleProps {
    /** La `clave` del tipo de documento (ej: `nota_compra`). Es el VÍNCULO con el registro. */
    tipo: string
    /**
     * Los datos del documento, ya resueltos Y formateados. La plantilla PINTA — no
     * calcula (L6).
     * ⚠️ Es `VariablesDocumento`, no un record de escalares: un documento con tabla
     * —una nota de entrada con sus partidas— pasa la LISTA, y el motor la recorre con
     * `{{#partidas}}`. Con el tipo estrecho, el primer consumidor con tabla no compila.
     */
    datos: VariablesDocumento
    /** Nombre del archivo descargado, sin extensión (ej: `NC-0001`). */
    nombreArchivo: string
    /** Título del diálogo. */
    titulo: string
    /**
     * El membrete, SOLO si este documento necesita uno distinto del de la empresa.
     * Si se omite, se resuelve desde `empresa_emisora`. `datos` gana sobre todo.
     */
    empresa?: MembreteDocumento
    /** Respaldo en código para un tipo cuya plantilla aún no vive en la BD (decisión 8 de P0). */
    fallback?: PlantillaFallback
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function DocumentoImprimible({
    tipo,
    datos,
    nombreArchivo,
    titulo,
    empresa,
    fallback: Fallback,
    open,
    onOpenChange,
}: DocumentoImprimibleProps) {
    const [plantilla, setPlantilla] = useState<PlantillaActiva | null>(null)
    const [membreteLeido, setMembreteLeido] = useState<MembreteDocumento | null>(null)
    const [cargando, setCargando] = useState(true)

    // ⚠️ `setCargando` NUNCA en el cuerpo del efecto (react-hooks/set-state-in-effect):
    //    se apaga en el .then(). Al cerrar se vuelve a marcar cargando desde el HANDLER.
    useEffect(() => {
        if (!open) return
        let activo = true

        // El membrete solo se consulta si el consumidor NO lo pasó: pasar `empresa` es
        // también decirle al componente «no consultes».
        if (!empresa) {
            obtenerMembrete().then((m) => {
                if (activo) setMembreteLeido(m)
            })
        }

        resolverPlantilla(tipo).then((p) => {
            if (!activo) return
            setPlantilla(p)
            setCargando(false)
        })

        return () => {
            activo = false
        }
    }, [open, tipo, empresa])

    // Marca "cargando" al ABRIR, desde el handler — no desde el efecto.
    const manejarOpenChange = (o: boolean) => {
        if (o) {
            setCargando(true)
            setPlantilla(null)
        }
        onOpenChange(o)
    }

    // ⭐ El acto que audita el papel: se dispara cuando el PDF YA se guardó (B2). El
    //   resultado se descarta a propósito — el usuario ya tiene su documento. Un tipo
    //   `interno` lo rechaza la BD y el papel sale igual (P1: la auditoría no bloquea).
    const auditarImpresion = () => {
        void registrarImpresion(tipo, plantilla?.version ?? null)
    }

    // ⭐ El alcance que ven LOS DOS caminos: la plantilla y el RESPALDO en código. El
    //   membrete va primero y `datos` GANA si trae el mismo campo. Antes el merge vivía
    //   dentro del `renderPlantilla`, así que el respaldo pintaba sin membrete: un
    //   documento migrado perdía la razón social al desactivar su plantilla.
    const alcance: VariablesDocumento = {
        ...(empresa ?? membreteLeido ?? {}),
        ...datos,
    }

    return (
        <DocumentoImprimibleDialog
            open={open}
            onOpenChange={manejarOpenChange}
            titulo={titulo}
            nombreArchivo={nombreArchivo}
            onGuardado={auditarImpresion}
        >
            {cargando ? (
                <div className="flex justify-center py-10">
                    <Spinner />
                </div>
            ) : plantilla ? (
                <CuerpoDocumento html={renderPlantilla(plantilla.cuerpo, alcance)} />
            ) : Fallback ? (
                <Fallback datos={alcance} />
            ) : (
                <div className="py-8 text-center">
                    <p className="font-medium">Este documento todavía no tiene plantilla.</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        El tipo <span className="font-mono">{tipo}</span> existe, pero no tiene una
                        plantilla activa ni un respaldo en código.
                    </p>
                </div>
            )}
        </DocumentoImprimibleDialog>
    )
}
