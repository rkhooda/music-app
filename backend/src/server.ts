import express from 'express';
import cors from 'cors';
import { config } from './config';
import { health } from './controllers/musicController';
import { errorHandler } from './middleware/errorHandler';
import musicRoutes from './routes/musicRoutes';
import { pingYtDlp, stopYtDlpWorker } from './services/ytDlpService';
import logger from './utils/logger';

const app = express();

app.use(cors());
app.use(express.json({ limit: '16kb' }));

app.get('/health', health);
app.use('/api/music', musicRoutes);
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

const server = app.listen(config.port, config.host, () => {
  logger.info(`Listening on http://${config.host}:${config.port} (${config.isDev ? 'development' : 'production'})`);
  logger.info(`Search: ${config.youtubeApiKey ? 'YouTube Data API' : 'yt-dlp fallback (set YOUTUBE_DATA_API_KEY for fast search)'}`);

  pingYtDlp()
    .then((pong) => logger.info(`yt-dlp ${pong.version} ready`))
    .catch((error: Error) => logger.error(error.message));
});

// Long audio proxies must not be cut off by the default 5s keep-alive.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

const shutdown = (signal: string) => {
  logger.info(`${signal} received, shutting down`);
  stopYtDlpWorker();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2_000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
