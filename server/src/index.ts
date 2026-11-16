import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes.js';
import schoolRoutes from './routes/schools.routes.js';
import regionRoutes from './routes/regions.routes.js';
import userRoutes from './routes/users.routes.js';
import routingRoutes from './routes/routing.routes.js';
import { connectPostgres, isPostgresConnected } from './db/postgres.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'SKITA API Backend',
    version: '1.0.0',
    database: isPostgresConnected ? 'PostgreSQL' : 'in-memory (fallback)',
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/regions', regionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/route', routingRoutes);

// 404 Handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan.' });
});

export { app };

if (process.env.NODE_ENV !== 'test' && !process.env.TEST_MODE) {
  connectPostgres().finally(() => {
    app.listen(PORT, () => {
      console.log(`[SKITA Backend] Server berjalan di http://localhost:${PORT}`);
    });
  });
}
