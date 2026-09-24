// ============================================================================
// BARREL EXPORT — Módulo de componentes de autenticación
// Cara pública del módulo: de aquí en adelante los imports externos pasan
// por @/components/auth. Componentes internos (PasswordRequirements) no se
// exportan — son detalles de implementación de LoginForm.
// ============================================================================

export { BrandPanel }  from './BrandPanel'
export { LoginForm }   from './LoginForm'
export { AuthWrapper } from './AuthWrapper'
