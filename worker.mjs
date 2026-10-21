import nextWorker from './.open-next/worker.js';
import { cleanupDatabase } from './lib/databaseMaintenance';
import { consumeLeads } from './lib/leadConsumer';
import { recoverOutbox } from './lib/leadService';
import { processSocialInbox } from './lib/socialLeadProcessor';
import { reportAccess } from './lib/reportAuth';

const worker = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const reportingHost = url.hostname === 'reports.bestcardash.com';
    if (reportingHost || /^\/(reports|api\/reports)(\/|$)/.test(url.pathname)) {
      const denied = reportAccess(request, env.REPORTING_PASSWORD);
      if (denied) return denied;
      if (reportingHost && url.pathname === '/') {
        url.pathname = '/reports';
        return Response.redirect(url.toString(), 302);
      }
      const response = new Response(await nextWorker.fetch(request, env, ctx));
      response.headers.set('Cache-Control', 'private, no-store');
      response.headers.set('X-Robots-Tag', 'noindex, nofollow');
      response.headers.set('Referrer-Policy', 'no-referrer');
      return response;
    }
    return nextWorker.fetch(request, env, ctx);
  },
  async queue(batch, env) {
    await consumeLeads(batch, env);
  },
  async scheduled(controller, env) {
    await recoverOutbox(env);
    await processSocialInbox(env);
    if (controller.cron === '17 2 * * *') await cleanupDatabase(env.DB);
  },
};

export default worker;

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from './.open-next/worker.js';
