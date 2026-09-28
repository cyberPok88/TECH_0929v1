'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// VISTA PREVIA DE LA PLANTILLA (Guía 2.1 · P7 · Smart)
//
// Muestra EL PAPEL de la plantilla que se está editando: el membrete REAL (de
// `empresa_emisora`) y una MUESTRA en el lugar de los datos.
//
// ⭐ La muestra se construye AQUÍ y NO en el motor: mostrar un ejemplo es una
// necesidad de la vista previa. Si `renderPlantilla` tuviera un «modo muestra», el
// documento real pasaría por el camino del ejemplo. Un motor, un camino.
//
// ⭐ Las LISTAS también se muestrean: cada `{{#seccion}}` declara sus campos DENTRO del
// bloque, así que se puede inventar UN elemento con esos campos y la tabla SE VE. Sin
// esto, una sección sin datos renderizaría vacío y el usuario aprobaría una plantilla
// cuyo renglón nunca vio.
//
// ⚠️ El papel va en blanco y negro: es la excepción declarada del sistema de tokens
// (SPEC §2.1.d), la misma que el contenedor del kit. Si heredara la paleta, la vista
// previa dejaría de parecerse al PDF.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react'

import { CuerpoDocumento } from '@/components/imprimibles'
import { obtenerMembrete } from '@/lib/actions/empresa'
import { renderPlantilla } from '@/lib/plantillas/motor'
import type { VariablesDocumento } from '@/lib/plantillas/motor'
import type { MembreteDocumento } from '@/types/empresa'
import type { VariablePlantilla } from '@/types/plantillas'

const REGEX_SECCIONES = /\{\{#([a-z][a-z0-9_]*)\}\}([\s\S]*?)\{\{\/\1\}\}/g
const REGEX_VALOR = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g

/**
 * Construye la muestra: un valor por variable declarada (su descripción, o la clave
 * entre comillas) y **un elemento por sección** con los campos que esa sección usa.
 */
function muestraDe(cuerpo: string, declaradas: VariablePlantilla[]): VariablesDocumento {
    const muestra: VariablesDocumento = {}

    for (const v of declaradas) {
        muestra[v.clave] = v.descripcion?.trim() || `«${v.clave}»`
    }

    for (const seccion of cuerpo.matchAll(REGEX_SECCIONES)) {
        const clave = seccion[1]
        const dentro = seccion[2]
        const campos: Record<string, string> = {}
        for (const valor of dentro.matchAll(REGEX_VALOR)) {
            campos[valor[1]] = `«${valor[1]}»`
        }
        muestra[clave] = [campos]
    }

    return muestra
}

interface PlantillaPreviewProps {
    /** El cuerpo que se está editando — se previsualiza lo que hay en pantalla, no lo guardado. */
    cuerpo: string
    /** El esquema declarado (Parte 1). */
    variables: VariablePlantilla[]
}

export function PlantillaPreview({ cuerpo, variables }: PlantillaPreviewProps) {
    const [membrete, setMembrete] = useState<MembreteDocumento | null>(null)

    // El membrete real, una vez al montar la pestaña. setState DENTRO del .then() —
    // nunca sincrónico en el cuerpo del efecto (react-hooks/set-state-in-effect).
    useEffect(() => {
        let activo = true
        obtenerMembrete().then((m) => {
            if (activo) setMembrete(m)
        })
        return () => {
            activo = false
        }
    }, [])

    const html = useMemo(() => {
        const muestra = muestraDe(cuerpo, variables)
        // El membrete GANA: es dato real. La muestra rellena lo que falta, nunca pisa
        // lo que existe.
        return renderPlantilla(cuerpo, { ...muestra, ...(membrete ?? {}) })
    }, [cuerpo, variables, membrete])

    return (
        <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
                Así se verá el papel. Los datos van en <span className="font-mono">«…»</span> — es una
                muestra; el membrete sí es el real, leído de la empresa emisora.
            </p>
            {/* El papel: excepción declarada del sistema de tokens (SPEC §2.1.d). */}
            <div className="max-h-[60vh] overflow-y-auto rounded border bg-white p-6 text-black">
                <CuerpoDocumento html={html} />
            </div>
        </div>
    )
}
