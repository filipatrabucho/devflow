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
import dashboardRoutes from './routes/dashboard.js';

export function createApp() {
  const app = express();

  const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: CLIENT_ORIGIN }));

  // Under serverless-http (Netlify Functions), the request arrives with
  // `req.body` already pre-set to the raw request Buffer and `req.complete`
  // forced to `true`. Express's body-parser (express.json()) checks
  // `onFinished.isFinished(req)` before reading the stream, sees it already
  // "finished", and silently skips parsing — leaving req.body as that raw
  // Buffer instead of the parsed object. Parse it ourselves in that case;
  // this is a no-op in local dev, where req.body isn't pre-set and
  // express.json() below does the real parsing off the live stream.
  app.use((req, res, next) => {
    if (!Buffer.isBuffer(req.body)) return next();
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) return next();
    const raw = req.body.toString('utf8').trim();
    try {
      req.body = raw ? JSON.parse(raw) : {};
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    next();
  });
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
  app.use('/api/dashboard', dashboardRoutes);

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
