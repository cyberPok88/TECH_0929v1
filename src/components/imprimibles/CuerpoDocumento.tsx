'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// CUERPO DEL DOCUMENTO — el ÚNICO punto que inyecta HTML (Guía 2.1 · P6 · Dumb)
//
// ⭐ Existe para que haya UN SOLO lugar donde entra al DOM **contenido que viene de la BD**.
// ⚠️ NO es la única aparición de `dangerouslySetInnerHTML` en el proyecto: `auth/` y
// `shell/` inyectan el CSS y el script de tema de la app (constantes de compilación, no
// datos — `ThemeInjector` lo dice en su comentario). Lo que se aísla aquí es el
// CONTENIDO DE LA BASE.
// ⚠️ La prop se llama `html` y NO `children` a propósito: `children` en React es
// marcado que React escapará o interpretará como elementos, y pasar una cadena por ahí
// invita a creer que React la sanea — no lo hace.
//
// ⚠️ La cadena TIENE que venir de `renderPlantilla` (`lib/plantillas/motor.ts`). Es el
// único saneado del proyecto.
// ═══════════════════════════════════════════════════════════════════════════════

interface CuerpoDocumentoProps {
    /** HTML **ya saneado** por `renderPlantilla`. */
    html: string
}

export function CuerpoDocumento({ html }: CuerpoDocumentoProps) {
    return <div dangerouslySetInnerHTML={{ __html: html }} />
}
