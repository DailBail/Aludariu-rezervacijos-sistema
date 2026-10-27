import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAlertMails } from './mail.js';
import { parseAlertEmail } from './parse-mail.js';
import { readJson, writeJson, upsert, stableView } from './store.js';
import { sendAlert } from './notify.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const config = readJson(process.env.CONFIG_FILE || path.join(here, '..', 'config.json'));
const dataDir = process.env.DATA_DIR || path.join(here, '..', '..', 'docs', 'data');
const listingsFile = path.join(dataDir, 'listings.json');
const alertsFile = path.join(dataDir, 'alerts.json');
const statusFile = path.join(dataDir, 'status.json');

// MAIL_FIXTURES=<dir> reads *.json messages from a folder instead of the mailbox (for tests).
async function loadMails() {
  if (process.env.MAIL_FIXTURES) {
    const dir = process.env.MAIL_FIXTURES;
    return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => readJson(path.join(dir, f)));
  }
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    const err = new Error('Nenustatyti GMAIL_USER ir GMAIL_APP_PASSWORD. Žr. MONITOR.md.');
    err.notConfigured = true;
    throw err;
  }
  return fetchAlertMails({
    user,
    pass,
    days: Number(process.env.MAIL_LOOKBACK_DAYS || config.mailLookbackDays),
    domains: config.portals.map((p) => p.domain),
  });
}

async function main() {
  const now = new Date().toISOString();
  const previous = readJson(listingsFile, { listings: [] });
  const prevAlerts = readJson(alertsFile, { alerts: [] });
  const prevStatus = readJson(statusFile, {});
  const store = new Map(previous.listings.map((l) => [l.id, l]));
  const before = stableView(previous.listings);
  // A message is processed only once. Else an older email can undo a newer price.
  const seen = new Set(prevAlerts.alerts.map((a) => a.id));

  const status = { lastRun: now, mailsChecked: 0, newMails: 0, newAlerts: 0, error: null };
  const events = [];
  const alerts = [...prevAlerts.alerts];

  try {
    const mails = (await loadMails()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    status.mailsChecked = mails.length;
    for (const mail of mails) {
      if (seen.has(mail.id)) continue;
      seen.add(mail.id);
      const parsed = parseAlertEmail(mail, config);
      if (!parsed) continue;
      status.newMails++;
      alerts.push(parsed.alert);
      if (parsed.alert.relevant) status.newAlerts++;
      for (const listing of parsed.listings) events.push(...upsert(store, listing, mail.date));
      console.log(
        `${mail.date} ${parsed.alert.portal}: „${mail.subject}“ – skelbimų laiške: ${parsed.listings.length}, ` +
          `${parsed.alert.relevant ? 'atitinka' : 'neatitinka'} paieškos žodžių`,
      );
    }
  } catch (err) {
    status.error = err.message.split('\n')[0];
    console.error(`Klaida: ${status.error}`);
    // Missing secrets are a setup step, not a failure. Do not send a failed-run email every hour.
    if (!err.notConfigured) process.exitCode = 1;
  }

  const listings = [...store.values()].sort((a, b) => String(b.firstSeen).localeCompare(String(a.firstSeen)));
  const listingsChanged = stableView(listings) !== before;
  if (listingsChanged) writeJson(listingsFile, { updatedAt: now, listings });

  const alertsChanged = alerts.length !== prevAlerts.alerts.length;
  if (alertsChanged) {
    alerts.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    writeJson(alertsFile, { updatedAt: now, alerts: alerts.slice(0, config.keepAlerts) });
  }

  // Write the status file only when something changed or once a day, to keep the git history short.
  const stale = !prevStatus.lastRun || Date.parse(now) - Date.parse(prevStatus.lastRun) > 20 * 3600e3;
  if (listingsChanged || alertsChanged || stale || status.error !== (prevStatus.error ?? null)) {
    writeJson(statusFile, { ...status, lastChange: listingsChanged || alertsChanged ? now : prevStatus.lastChange ?? null });
  }

  console.log(`Patikrinta laiškų: ${status.mailsChecked}, naujų: ${status.newMails}. Įvykių: ${events.length}.`);
  await sendAlert(events, process.env.SITE_URL);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
