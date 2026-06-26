// ============================================================
// API REST del Casino Online - Experiencia 2 (DevOps)
// ============================================================
const express = require('express');
const cors = require('cors');
const { pool, esperarBD } = require('./db/pool');
const { sembrarUsuariosDemo } = require('./db/seed');

const app = express();

// PORT desde variable de entorno: patrón 12-factor App.
const PORT = Number(process.env.PORT || 3000);

// CORS configurable: en producción se restringe a los dominios del frontend.
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin: corsOrigin === '*' ? true : corsOrigin.split(',').map(s => s.trim())
}));
app.use(express.json({ limit: '1mb' }));

// /health
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'up', uptime: process.uptime() });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'down', error: err.message });
  }
});

// liveness → ¿el proceso está vivo? NO depende de la BD.
app.get('/livez', (req, res) => {
  res.json({ status: 'ok', service: 'casino-backend', uptime: process.uptime() });
});

// readiness → ¿listo para recibir tráfico? Verifica la BD.
app.get('/readyz', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready', db: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'not-ready', db: 'down', error: err.message });
  }
});

// Bienvenida
app.get('/', (req, res) => {
  res.json({
    mensaje: 'API Casino Online',
    version: '1.0.0',
    endpoints: ['/api/auth', '/api/usuarios/me', '/api/juegos', '/api/transacciones']
  });
});

// Rutas de la API
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/usuarios',      require('./routes/users'));
app.use('/api/juegos',        require('./routes/games'));
app.use('/api/transacciones', require('./routes/transactions'));

// Manejador global de errores
app.use((err, req, res, next) => {
  console.error('[ERR]', err);
  res.status(err.status || 500).json({ error: err.message || 'Error interno' });
});

(async () => {
  // Espera a que Postgres esté listo antes de levantar el servidor HTTP.
  await esperarBD();
  await sembrarUsuariosDemo();

  // Bind a 0.0.0.0 es obligatorio dentro de un contenedor.
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[API] Casino escuchando en http://0.0.0.0:${PORT}`);
  });
})();