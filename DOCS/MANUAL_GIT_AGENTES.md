# Manual de Git para Agentes IA

Este documento detalla las instrucciones para que cualquier agente de Inteligencia Artificial que colabore en el proyecto sepa cómo interactuar con los repositorios, hacer commits y subir cambios correctamente.

## Reglas Básicas

1. **Mensajes de Commit Expresivos**: Usar Convencional Commits (ej. `feat: agregar manual de git`, `fix: resolver bug de login`).
2. **Revisar Estado**: Antes de hacer commit, siempre usar `git status` para validar qué archivos se van a subir. Nunca uses `git add .` sin estar seguro de que no estás filtrando archivos sensibles (.env, claves, dependencias, etc.).
3. **No Romper la Historia**: No usar `git push -f` (force) en ramas compartidas o `main`. 
4. **Inglés por Defecto (si aplica)**: Seguir la convención del proyecto sobre el idioma en el código y commits, aunque el chat con el usuario sea en español.

## Flujo de Trabajo (Paso a Paso)

### 1. Inicialización (Si el repo es nuevo)
Si el repositorio local no está inicializado, el agente debe ejecutar:
```bash
git init
```

### 2. Verificar Ramas y Estado
Revisar en qué rama se encuentra y qué archivos han sido modificados:
```bash
git status
git branch
```

### 3. Agregar Archivos (Staging)
Agregar únicamente los archivos que tengan sentido para el cambio atómico:
```bash
git add <ruta/archivo1> <ruta/archivo2>
# O si es 100% seguro:
git add .
```

### 4. Crear el Commit
Generar un commit claro:
```bash
git commit -m "feat(docs): agregar manual de convenciones para agentes"
```

### 5. Configurar el Origen Remoto (Si aplica)
Si es la primera vez que se sube al repositorio:
```bash
git remote add origin <URL_DEL_REPO>
git branch -M main
```

### 6. Subir los Cambios (Push)
Hacer push a la rama correspondiente (generalmente `main` o la rama en la que se esté trabajando):
```bash
git push -u origin main
```

## Manejo de Credenciales
- Los agentes **no deben** manejar directamente contraseñas en texto plano. Si un `git push` requiere autenticación y falla, el agente debe informar al usuario para que ingrese sus credenciales o provea un Personal Access Token / SSH Key válida.
- Nunca commitear archivos `.env` a menos que sean ejemplos como `.env.example`.

## Resumen de Comandos a usar por el Agente
- `git status`
- `git add <archivos>`
- `git commit -m "mensaje"`
- `git push origin <rama>`
