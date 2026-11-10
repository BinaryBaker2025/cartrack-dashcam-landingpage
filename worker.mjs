import nextWorker from './.open-next/worker.js';
import { httpsRedirect } from './lib/httpsRedirect.mjs';
import { cleanupDatabase } from './lib/databaseMaintenance';
import { consumeLeads } from './lib/leadConsumer';
import { recoverOutbox } from './lib/leadService';
import { processSocialInbox } from './lib/socialLeadProcessor';
import { reportAccess } from './lib/reportAuth';
import { privateReportResponse } from './lib/reportResponse';

const worker = {
  async fetch(request, env, ctx) {
    const secureRedirect = httpsRedirect(request);
    if (secureRedirect) return secureRedirect;
    const url = new URL(request.url);
    const reportingHost = url.hostname === 'reports.bestcardash.com';
    if (url.pathname === '/reports/sign-in')
      return privateReportResponse(await nextWorker.fetch(request, env, ctx));
    if (reportingHost || /^\/(reports|api\/reports)(\/|$)/.test(url.pathname)) {
      const denied = reportAccess(request, env.REPORTING_PASSWORD);
      if (denied) {
        if (denied.status !== 401 || url.pathname.startsWith('/api/')) return denied;
        return privateReportResponse(Response.redirect(new URL('/reports/sign-in', url), 302));
      }
      if (reportingHost && url.pathname === '/') {
        url.pathname = '/reports';
        return Response.redirect(url.toString(), 302);
      }
      return privateReportResponse(await nextWorker.fetch(request, env, ctx));
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
