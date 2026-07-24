import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import developmentRoutes from './routes/developments.js';
import taskRoutes from './routes/tasks.js';
import roleRoutes from './routes/roles.js';

export function createApp() {
  const app = express();

  const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: CLIENT_ORIGIN }));
  app.use(express.json({ limit: '100kb' }));

  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      limit: 120,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/developments', developmentRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/roles', roleRoutes);

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
