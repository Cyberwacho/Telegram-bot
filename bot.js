// ============================================
//  CEREBRO VIRTUAL - Bot de Telegram
//  Núcleo: tareas, recordatorios y notas
// ============================================

const TelegramBot = require('node-telegram-bot-api');
const { Pool } = require('pg');

// --- 1. CONEXIONES ---
// El token y la URL de la base vienen de Render (variables de entorno).
// Nunca se escriben aquí directamente, por seguridad.
const TOKEN = process.env.TELEGRAM_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;

const bot = new TelegramBot(TOKEN, { polling: true });

const db = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- 2. PREPARAR LA BASE DE DATOS ---
// Esto crea las tablas la primera vez. Si ya existen, no hace nada.
async function prepararBase() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS tareas (
      id SERIAL PRIMARY KEY,
      usuario_id BIGINT NOT NULL,
      texto TEXT NOT NULL,
      categoria TEXT DEFAULT 'general',
      prioridad TEXT DEFAULT 'normal',
      vence DATE,
      hecha BOOLEAN DEFAULT FALSE,
      creada TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS notas (
      id SERIAL PRIMARY KEY,
      usuario_id BIGINT NOT NULL,
      texto TEXT NOT NULL,
      creada TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS recordatorios (
      id SERIAL PRIMARY KEY,
      usuario_id BIGINT NOT NULL,
      texto TEXT NOT NULL,
      cuando TIMESTAMP NOT NULL,
      avisado BOOLEAN DEFAULT FALSE
    )
  `);
  console.log('Base de datos lista.');
}

// --- 3. COMANDO /start ---
bot.onText(/\/start/, (msg) => {
  const nombre = msg.from.first_name || 'amigo';
  bot.sendMessage(msg.chat.id,
    `Hola ${nombre}. Soy tu cerebro virtual.\n\n` +
    `Esto es lo que puedo hacer ahora mismo:\n\n` +
    `TAREAS\n` +
    `/agregar <texto> - guardar una tarea\n` +
    `/listar - ver tus tareas pendientes\n` +
    `/hecho <numero> - marcar una como completada\n` +
    `/borrar <numero> - eliminar una tarea\n\n` +
    `NOTAS\n` +
    `/nota <texto> - guardar una idea o nota\n` +
    `/notas - ver todas tus notas\n\n` +
    `RECORDATORIOS\n` +
    `/recordar <minutos> <texto> - te aviso en X minutos\n` +
    `/recordatorios - ver tus recordatorios activos\n\n` +
    `OTROS\n` +
    `/stats - ver tu resumen\n` +
    `/ayuda - ver esta lista otra vez`
  );
});

bot.onText(/\/ayuda/, (msg) => {
  bot.emit('text', { ...msg, text: '/start' });
  bot.sendMessage(msg.chat.id, 'Escribe /start para ver la lista de comandos.');
});

// --- 4. TAREAS ---

// /agregar comprar texturas
bot.onText(/\/agregar (.+)/, async (msg, match) => {
  const texto = match[1].trim();
  await db.query(
    'INSERT INTO tareas (usuario_id, texto) VALUES ($1, $2)',
    [msg.from.id, texto]
  );
  bot.sendMessage(msg.chat.id, `Tarea guardada: "${texto}"`);
});

// /listar
bot.onText(/\/listar/, async (msg) => {
  const res = await db.query(
    'SELECT id, texto, categoria FROM tareas WHERE usuario_id=$1 AND hecha=FALSE ORDER BY creada',
    [msg.from.id]
  );
  if (res.rows.length === 0) {
    bot.sendMessage(msg.chat.id, 'No tienes tareas pendientes. Todo limpio.');
    return;
  }
  let texto = 'TUS TAREAS PENDIENTES:\n\n';
  res.rows.forEach((t, i) => {
    texto += `${i + 1}. ${t.texto}  [${t.categoria}]\n`;
  });
  texto += '\nUsa /hecho <numero> o /borrar <numero>';
  bot.sendMessage(msg.chat.id, texto);
});

// /hecho 2
bot.onText(/\/hecho (\d+)/, async (msg, match) => {
  const indice = parseInt(match[1]) - 1;
  const res = await db.query(
    'SELECT id, texto FROM tareas WHERE usuario_id=$1 AND hecha=FALSE ORDER BY creada',
    [msg.from.id]
  );
  if (indice < 0 || indice >= res.rows.length) {
    bot.sendMessage(msg.chat.id, 'Ese numero no existe. Usa /listar para ver los numeros.');
    return;
  }
  const tarea = res.rows[indice];
  await db.query('UPDATE tareas SET hecha=TRUE WHERE id=$1', [tarea.id]);
  bot.sendMessage(msg.chat.id, `Completada: "${tarea.texto}". Bien hecho.`);
});

// /borrar 2
bot.onText(/\/borrar (\d+)/, async (msg, match) => {
  const indice = parseInt(match[1]) - 1;
  const res = await db.query(
    'SELECT id, texto FROM tareas WHERE usuario_id=$1 AND hecha=FALSE ORDER BY creada',
    [msg.from.id]
  );
  if (indice < 0 || indice >= res.rows.length) {
    bot.sendMessage(msg.chat.id, 'Ese numero no existe. Usa /listar para ver los numeros.');
    return;
  }
  const tarea = res.rows[indice];
  await db.query('DELETE FROM tareas WHERE id=$1', [tarea.id]);
  bot.sendMessage(msg.chat.id, `Eliminada: "${tarea.texto}"`);
});

// --- 5. NOTAS ---

bot.onText(/\/nota (.+)/, async (msg, match) => {
  const texto = match[1].trim();
  await db.query(
    'INSERT INTO notas (usuario_id, texto) VALUES ($1, $2)',
    [msg.from.id, texto]
  );
  bot.sendMessage(msg.chat.id, 'Nota guardada.');
});

bot.onText(/\/notas/, async (msg) => {
  const res = await db.query(
    'SELECT texto, creada FROM notas WHERE usuario_id=$1 ORDER BY creada DESC',
    [msg.from.id]
  );
  if (res.rows.length === 0) {
    bot.sendMessage(msg.chat.id, 'No tienes notas guardadas.');
    return;
  }
  let texto = 'TUS NOTAS:\n\n';
  res.rows.forEach((n) => {
    texto += `- ${n.texto}\n`;
  });
  bot.sendMessage(msg.chat.id, texto);
});

// --- 6. RECORDATORIOS ---

// /recordar 30 llamar al cliente
bot.onText(/\/recordar (\d+) (.+)/, async (msg, match) => {
  const minutos = parseInt(match[1]);
  const texto = match[2].trim();
  const cuando = new Date(Date.now() + minutos * 60000);
  await db.query(
    'INSERT INTO recordatorios (usuario_id, texto, cuando) VALUES ($1, $2, $3)',
    [msg.from.id, texto, cuando]
  );
  bot.sendMessage(msg.chat.id,
    `Listo. Te recordare "${texto}" en ${minutos} minutos.`
  );
});

bot.onText(/\/recordatorios/, async (msg) => {
  const res = await db.query(
    'SELECT texto, cuando FROM recordatorios WHERE usuario_id=$1 AND avisado=FALSE ORDER BY cuando',
    [msg.from.id]
  );
  if (res.rows.length === 0) {
    bot.sendMessage(msg.chat.id, 'No tienes recordatorios activos.');
    return;
  }
  let texto = 'RECORDATORIOS ACTIVOS:\n\n';
  res.rows.forEach((r) => {
    const hora = new Date(r.cuando).toLocaleString('es-AR');
    texto += `- ${r.texto}  (${hora})\n`;
  });
  bot.sendMessage(msg.chat.id, texto);
});

// Revisa cada 60 segundos si hay recordatorios que disparar.
setInterval(async () => {
  try {
    const res = await db.query(
      'SELECT id, usuario_id, texto FROM recordatorios WHERE avisado=FALSE AND cuando<=NOW()'
    );
    for (const r of res.rows) {
      await bot.sendMessage(r.usuario_id, `RECORDATORIO: ${r.texto}`);
      await db.query('UPDATE recordatorios SET avisado=TRUE WHERE id=$1', [r.id]);
    }
  } catch (e) {
    console.error('Error revisando recordatorios:', e.message);
  }
}, 60000);

// --- 7. ESTADISTICAS ---

bot.onText(/\/stats/, async (msg) => {
  const pendientes = await db.query(
    'SELECT COUNT(*) FROM tareas WHERE usuario_id=$1 AND hecha=FALSE',
    [msg.from.id]
  );
  const hechas = await db.query(
    'SELECT COUNT(*) FROM tareas WHERE usuario_id=$1 AND hecha=TRUE',
    [msg.from.id]
  );
  const notas = await db.query(
    'SELECT COUNT(*) FROM notas WHERE usuario_id=$1',
    [msg.from.id]
  );
  bot.sendMessage(msg.chat.id,
    `TU RESUMEN:\n\n` +
    `Tareas pendientes: ${pendientes.rows[0].count}\n` +
    `Tareas completadas: ${hechas.rows[0].count}\n` +
    `Notas guardadas: ${notas.rows[0].count}`
  );
});

// --- 8. RESPUESTA A MENSAJES SUELTOS ---
// Si el usuario escribe algo que no es un comando.
bot.on('message', (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;
  bot.sendMessage(msg.chat.id,
    'Recibido. Por ahora respondo a comandos. Escribe /ayuda para ver que puedo hacer.'
  );
});

// --- 9. ARRANQUE ---
prepararBase()
  .then(() => console.log('Bot funcionando.'))
  .catch((e) => console.error('Error al arrancar:', e));

bot.on('polling_error', (e) => console.error('Polling error:', e.message));
