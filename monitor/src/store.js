import fs from 'node:fs';
import path from 'node:path';

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

// Merges one fresh listing into the store and returns the events it caused.
export function upsert(store, fresh, now) {
  const events = [];
  const old = store.get(fresh.id);
  if (!old) {
    store.set(fresh.id, {
      ...fresh,
      active: true,
      missCount: 0,
      firstSeen: now,
      lastSeen: now,
      priceHistory: fresh.price ? [{ date: now, price: fresh.price }] : [],
    });
    events.push({ type: 'new', listing: store.get(fresh.id) });
    return events;
  }

  const wasActive = old.active;
  const oldPrice = old.price;
  // Keep the first deal type: a listing found by a sale search stays a sale.
  Object.assign(old, { ...fresh, deal: old.deal ?? fresh.deal, active: true, missCount: 0, lastSeen: now });
  if (fresh.price && fresh.price !== oldPrice) {
    old.priceHistory.push({ date: now, price: fresh.price });
    if (oldPrice) events.push({ type: 'price', listing: old, oldPrice });
  }
  if (!wasActive) events.push({ type: 'back', listing: old });
  return events;
}

export function registerMiss(store, id, limit) {
  const l = store.get(id);
  if (!l || !l.active) return [];
  l.missCount = (l.missCount ?? 0) + 1;
  if (l.missCount >= limit) {
    l.active = false;
    return [{ type: 'removed', listing: l }];
  }
  return [];
}

// Strips run-specific fields so that a comparison shows only real changes.
export function stableView(listings) {
  return JSON.stringify(listings.map(({ lastSeen, ...rest }) => rest));
}
