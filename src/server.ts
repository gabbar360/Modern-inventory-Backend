import app from './app';
import { env } from './config/env';
import { connectDB } from './config/database';
import { logger } from './config/logger';
import { authService } from './modules/auth/auth.service';

async function startServer() {
  await connectDB();
  await authService.seedChauhanAdmin();
  await authService.seedDefaultAdmin();

  app.listen(env.PORT, () => {
    logger.info(`🚀 [Enterprise Modular Monolith] Server listening at http://localhost:${env.PORT}`);
    logger.info(`🌐 Environment: ${env.NODE_ENV}`);
    logger.info(`🔗 API Endpoint: http://localhost:${env.PORT}/api/v1/health`);
  });
}

startServer();
