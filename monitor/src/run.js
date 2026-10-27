import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { extractListing, looksBlocked, looksRemoved, listingId } from './extract.js';
import { readJson, writeJson, upsert, registerMiss, stableView } from './store.js';
import { sendAlert } from './notify.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const config = readJson(process.env.CONFIG_FILE || path.join(here, '..', 'config.json'));
const dataDir = process.env.DATA_DIR || path.join(here, '..', '..', 'docs', 'data');
const listingsFile = path.join(dataDir, 'listings.json');
const statusFile = path.join(dataDir, 'status.json');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pause = () => sleep(config.delayMs[0] + Math.random() * (config.delayMs[1] - config.delayMs[0]));
const cleanUrl = (u) => u.split('#')[0].split('?')[0];

async function snapshot(page) {
  return page.evaluate(() => {
    const meta = (sel) => document.querySelector(sel)?.getAttribute('content') || '';
    const jsonLd = [];
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const d = JSON.parse(s.textContent);
        jsonLd.push(...(Array.isArray(d) ? d : [d]));
      } catch {}
    }
    const root = document.querySelector('main, article, [role="main"]') || document.body;
    return {
      title: document.title || '',
      h1: document.querySelector('h1')?.innerText || '',
      description: meta('meta[property="og:description"]') || meta('meta[name="description"]'),
      ogImage: meta('meta[property="og:image"]'),
      text: (root?.innerText || '').slice(0, 30000),
      jsonLd,
      links: [...document.querySelectorAll('a[href]')].map((a) => a.href),
    };
  });
}

async function load(page, url) {
  let status = 0;
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    status = resp?.status() ?? 0;
  } catch (err) {
    return { error: err.message.split('\n')[0], status };
  }
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  let snap = await snapshot(page);
  if (looksBlocked(snap.title, snap.text)) {
    // A bot challenge can clear itself after some seconds.
    await page.waitForTimeout(15000);
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    snap = await snapshot(page);
  }
  const blocked = looksBlocked(snap.title, snap.text) || ([403, 429].includes(status) && snap.text.length < 2000);
  return { ...snap, status, finalUrl: page.url(), blocked };
}

async function collectCandidates(page, portal, pattern, report) {
  const found = new Map();
  for (const search of portal.searches) {
    const pages = search.pageUrl ? (search.maxPages ?? 1) : 1;
    for (let n = 1; n <= pages; n++) {
      const url = n === 1 ? search.url : search.pageUrl.replace('{page}', n);
      await pause();
      const res = await load(page, url);
      report.searchPages++;
      if (res.blocked) {
        report.blocked = true;
        report.errors.push(`Blocked at ${url}`);
        return found;
      }
      if (res.error || res.status >= 400) {
        report.errors.push(`${res.error || 'HTTP ' + res.status} at ${url}`);
        break;
      }
      let added = 0;
      for (const href of res.links) {
        const u = cleanUrl(href);
        if (!pattern.test(u) || found.has(u)) continue;
        found.set(u, { deal: search.deal, kind: search.kind });
        added++;
      }
      if (!added) break;
    }
  }
  return found;
}

async function processPortal(context, portal, store, now) {
  const report = { portal: portal.id, name: portal.name, searchPages: 0, candidates: 0, matched: 0, blocked: false, errors: [] };
  const events = [];
  const pattern = new RegExp(portal.listingPattern);
  const page = await context.newPage();
  try {
    const candidates = await collectCandidates(page, portal, pattern, report);
    if (report.blocked) return { report, events };
    report.candidates = candidates.size;

    // Also re-check the known active listings, so that price changes and removals are visible.
    const known = [...store.values()].filter((l) => l.portal === portal.id && l.active);
    const queue = new Map(candidates);
    for (const l of known) if (!queue.has(l.url)) queue.set(l.url, { deal: l.deal, kind: l.kind });

    let visits = 0;
    for (const [url, meta] of queue) {
      if (visits++ >= config.maxDetailPagesPerPortal) {
        report.errors.push(`Stopped after ${config.maxDetailPagesPerPortal} detail pages`);
        break;
      }
      const id = listingId(portal.id, url);
      const isKnown = store.has(id) && store.get(id).active;
      await pause();
      const res = await load(page, url);
      if (res.blocked) {
        report.blocked = true;
        report.errors.push(`Blocked at ${url}`);
        break;
      }
      if (res.error) {
        report.errors.push(`${res.error} at ${url}`);
        continue; // A network error is not proof that the listing is gone.
      }
      const gone =
        res.status === 404 || res.status === 410 || looksRemoved(res.text) || !pattern.test(cleanUrl(res.finalUrl));
      const listing = gone
        ? null
        : extractListing({ ...res, url }, { portalId: portal.id, searchDeal: meta.deal, kind: meta.kind, keywords: config.keywords });
      if (listing) {
        report.matched++;
        events.push(...upsert(store, listing, now));
      } else if (isKnown) {
        events.push(...registerMiss(store, id, config.removeAfterMisses));
      }
    }
  } catch (err) {
    report.errors.push(err.message.split('\n')[0]);
  } finally {
    await page.close();
  }
  return { report, events };
}

async function main() {
  const now = new Date().toISOString();
  const previous = readJson(listingsFile, { listings: [] });
  const prevStatus = readJson(statusFile, {});
  const store = new Map(previous.listings.map((l) => [l.id, l]));
  const before = stableView(previous.listings);

  const only = process.env.PORTALS?.split(',').map((s) => s.trim());
  const portals = config.portals.filter((p) => !only || only.includes(p.id));

  const browser = await chromium.launch();
  const context = await browser.newContext({
    userAgent: UA,
    locale: 'lt-LT',
    timezoneId: 'Europe/Vilnius',
    viewport: { width: 1366, height: 900 },
    extraHTTPHeaders: { 'Accept-Language': 'lt-LT,lt;q=0.9,en;q=0.8' },
  });

  const reports = [];
  const events = [];
  for (const portal of portals) {
    console.log(`Checking ${portal.name}...`);
    const r = await processPortal(context, portal, store, now);
    console.log(JSON.stringify(r.report));
    reports.push(r.report);
    events.push(...r.events);
  }
  await browser.close();

  const listings = [...store.values()].sort((a, b) => (b.firstSeen || '').localeCompare(a.firstSeen || ''));
  const changed = stableView(listings) !== before;
  if (changed) writeJson(listingsFile, { updatedAt: now, listings });

  // Write the status file only when something changed or once a day, to keep the git history short.
  const summary = (rs) => JSON.stringify((rs ?? []).map(({ portal, blocked, matched }) => ({ portal, blocked, matched })));
  const stale = !prevStatus.lastRun || Date.parse(now) - Date.parse(prevStatus.lastRun) > 20 * 3600e3;
  if (changed || stale || summary(prevStatus.portals) !== summary(reports)) {
    writeJson(statusFile, { lastRun: now, lastChange: changed ? now : prevStatus.lastChange ?? null, portals: reports });
  }

  console.log(`${events.length} event(s): ${events.map((e) => `${e.type} ${e.listing.id}`).join(', ') || 'none'}`);
  await sendAlert(events, process.env.SITE_URL);

  if (reports.length && reports.every((r) => r.blocked || r.searchPages === 0)) {
    console.error('All portals failed. Examine the log.');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
