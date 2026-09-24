import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════════
// INFRAESTRUCTURA DE VALIDACIÓN — ZOD
//
// Configura globalmente el mapa de errores de Zod en español.
// Se aplica a TODOS los schemas del proyecto sin configuración adicional.
//
// Los schemas de negocio (clientes, productos, pedidos) van en
// src/lib/validations/[modulo].ts y heredan este mapa de errores.
// Los schemas de autenticación pertenecen a la Guía 0.5 (login, JWT).
// ═══════════════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────────────────
// MAPA DE ERRORES — ESPAÑOL GLOBAL
// Convierte los mensajes internos de Zod en mensajes legibles para el usuario.
// Los mensajes explícitos en cada schema (.min(8, "Mensaje")) tienen
// precedencia sobre este mapa — el mapa solo aplica como fallback.
// ───────────────────────────────────────────────────────────────────────────────

const errorMap: z.ZodErrorMap = (issue, ctx) => {
    switch (issue.code) {
        case z.ZodIssueCode.invalid_type:
            if (issue.received === z.ZodParsedType.undefined) {
                return { message: "Este campo es requerido" };
            }
            return { message: `Tipo invalido — se esperaba ${issue.expected}` };

        case z.ZodIssueCode.too_small:
            if (issue.type === "string") {
                return {
                    message: `Debe contener al menos ${issue.minimum} caracteres`,
                };
            }
            if (issue.type === "number") {
                return {
                    message: `Debe ser mayor o igual a ${issue.minimum}`,
                };
            }
            break;

        case z.ZodIssueCode.too_big:
            if (issue.type === "string") {
                return {
                    message: `No debe exceder ${issue.maximum} caracteres`,
                };
            }
            break;

        case z.ZodIssueCode.invalid_string:
            if (issue.validation === "email") {
                return { message: "Correo electronico invalido" };
            }
            if (issue.validation === "url") {
                return { message: "URL invalida" };
            }
            if (issue.validation === "uuid") {
                return { message: "Identificador invalido" };
            }
            break;

        case z.ZodIssueCode.invalid_enum_value:
            return {
                message: `Valor no permitido. Opciones: ${issue.options.join(", ")}`,
            };
    }

    // Fallback: usar el mensaje por defecto de Zod si no hay traduccion
    return { message: ctx.defaultError };
};

// Aplicar el mapa globalmente — se ejecuta al importar este modulo
z.setErrorMap(errorMap);
