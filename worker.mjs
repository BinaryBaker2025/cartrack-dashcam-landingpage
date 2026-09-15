import nextWorker from './.open-next/worker.js';
import { cleanupDatabase } from './lib/databaseMaintenance';

const worker = {
  fetch: nextWorker.fetch,
  async scheduled(_controller, env) {
    await cleanupDatabase(env.DB);
  },
};

export default worker;

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from './.open-next/worker.js';
