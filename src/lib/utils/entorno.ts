// ═══════════════════════════════════════════════════════════════════════════════
// ENTORNO — EL CANDADO DE LA HERRAMIENTA DE BORRADO (Guía 2.4 · 05 Oct 2026)
//
// Responde UNA pregunta: ¿esta instalación puede borrar datos de la BD?
//
// ⚠️ SOLO SERVIDOR. Este módulo NO debe importarse desde un componente de cliente
//    ni re-exportarse desde un barrel que llegue al navegador: la variable dejaría
//    de ser un secreto operativo y el candado pasaría a ser una sugerencia.
//
// Por qué acá y no en la BD (medido 05 Oct 2026): `ALTER DATABASE postgres SET
// app.…` devuelve ERROR 42501 permission denied — el rol `postgres` de Supabase no
// es superusuario. Y un GUC de sesión SÍ se puede fijar, así que el propio llamador
// lo falsificaría. La base pone los otros dos gates (permiso + dueño); el entorno
// se decide acá.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ¿Esta instalación es de DESARROLLO?
 *
 * 🔑 **Fail-closed a propósito**: la comparación es `=== 'desarrollo'`. Si la variable
 *    falta, o vale cualquier otra cosa (`produccion`, `staging`, un typo), devuelve
 *    `false` ⇒ **la herramienta de borrado queda deshabilitada**.
 *
 * ⚠️ Alcance honesto: esto evita el **accidente** (desplegar y hacer clic). NO detiene
 *    a un administrador decidido — que de todos modos tiene acceso SQL directo.
 */
export function permiteBorradoBd(): boolean {
    return process.env.ENTORNO === 'desarrollo'
}
