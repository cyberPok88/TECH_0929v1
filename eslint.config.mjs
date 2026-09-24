import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ═════════════════════════════════════════════════════════════════════════════════
// REGLA DE SEGURIDAD — Bloquear getSession() de Supabase Auth
//
// getSession() lee la sesion desde localStorage del navegador sin
// verificarla contra el servidor. Un atacante puede modificar el
// token desde DevTools y falsificar su identidad o rol.
//
// getUser() hace una peticion HTTP a Supabase Auth y verifica el
// token criptograficamente — no se puede falsificar desde el cliente.
//
// Esta regla convierte ese error en un error de compilacion.
// Se aplica a TODOS los archivos del proyecto sin excepcion.
// ════════════════════════════════════════════════════════════════════════════════
const securityConfig = {
    name: "security-rules",
    rules: {
        // ─── Parametros ignorados intencionalmente ─────────────────────────────
        // El prefijo _ en un parametro (ej: _errorInfo, _event) indica
        // que la omision es por diseno, no un olvido. Sin esta regla,
        // TypeScript strict marca error en callbacks y class methods
        // donde el parametro es obligatorio por la firma pero no se usa.
        //
        // Ejemplos en este proyecto:
        // componentDidCatch(error, _errorInfo) — firma obligatoria de React
        // onChange={(_event, value) => value}  — solo interesa el valor
        // async (_req, res) => res.json(...)   — solo interesa la respuesta
        "@typescript-eslint/no-unused-vars": [
            "warn",
            {
                "argsIgnorePattern": "^_",
                "varsIgnorePattern": "^_",
                "caughtErrorsIgnorePattern": "^_"
            }
        ],

        // ─── Seguridad de autenticacion ─────────────────────────────────────────
        // Bloquea supabase.getSession() en cualquier archivo.
        // Solo getUser() esta permitido — verifica el token contra
        // el servidor de Supabase, no puede ser falsificado desde
        // el navegador.
        "no-restricted-syntax": [
            "error",
            {
                selector: 'CallExpression[callee.object.name="supabase"][callee.property.name="getSession"]',
                message: "SEGURIDAD: Usa getUser() en vez de getSession() — getSession() lee del storage local y puede ser manipulado por el usuario desde DevTools."
            }
        ]
    }
};

// securityConfig va primero — tiene prioridad sobre nextVitals y nextTs
const eslintConfig = defineConfig([
    securityConfig,
    ...nextVitals,
    ...nextTs,
    // globalIgnores al final — se aplica sobre todas las configs anteriores
    globalIgnores([
        ".next/**",
        "out/**",
        "build/**",
        "next-env.d.ts",
    ]),
]);

export default eslintConfig;
