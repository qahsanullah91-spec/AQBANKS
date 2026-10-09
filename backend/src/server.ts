import { createApp } from './app.js';
import { config } from './config/index.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(`AQ Companies Logistics & Financial Management API`);
  console.log(`Server running at http://localhost:${config.port}`);
  console.log(`Health check at http://localhost:${config.port}/api/health`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`=======================================================`);
});
