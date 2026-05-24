# Cerebro Virtual - Bot de Telegram

Bot para organizar tareas, notas y recordatorios. Los datos se guardan
en Postgres, asi que no se borran nunca.

## Como desplegarlo en Render

### 1. Subir estos archivos a GitHub

Subir `bot.js`, `package.json` y `README.md` al repositorio.

### 2. Crear la base de datos en Render

- En Render: New + -> Postgres
- Nombre: cerebro-db
- Plan: Free
- Crear y copiar la “Internal Database URL”

### 3. Crear el Web Service

- New + -> Web Service -> elegir el repositorio
- Language: Node
- Build Command: npm install
- Start Command: node bot.js
- Plan: Free

### 4. Variables de entorno (Environment)

Agregar dos variables:

- TELEGRAM_TOKEN = el token que da BotFather
- DATABASE_URL = la Internal Database URL de Postgres

### 5. Deploy

Render instala y arranca solo. Cuando el log diga
“Bot funcionando”, abrir Telegram y escribir /start.

## Comandos

- /agregar, /listar, /hecho, /borrar - tareas
- /nota, /notas - notas
- /recordar, /recordatorios - recordatorios
- /stats - resumen
- /ayuda - lista de comandos
