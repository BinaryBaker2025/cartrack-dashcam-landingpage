import nextWorker from './.open-next/worker.js';
import { cleanupDatabase } from './lib/databaseMaintenance';
import { consumeLeads } from './lib/leadConsumer';
import { recoverOutbox } from './lib/leadService';

const worker = {
  fetch: nextWorker.fetch,
  async queue(batch, env) {
    await consumeLeads(batch, env);
  },
  async scheduled(controller, env) {
    await recoverOutbox(env);
    if (controller.cron === '17 2 * * *') await cleanupDatabase(env.DB);
  },
};

export default worker;

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from './.open-next/worker.js';
