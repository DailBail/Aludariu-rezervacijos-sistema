// Pure functions that read listing data from text. No network access here,
// so the tests can run without a mailbox.

export function normalize(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

// Returns null when the text does not refer to the target buildings.
export function matchKeywords(text, keywords) {
  const t = normalize(text);
  const sure = keywords.sure.filter((k) => t.includes(k.pattern)).map((k) => k.label);
  if (sure.length) return { confidence: 'sure', reasons: sure };
  if (keywords.cityPattern && !t.includes(keywords.cityPattern)) return null;
  const possible = keywords.possible.filter((k) => t.includes(k.pattern)).map((k) => k.label);
  if (possible.length) return { confidence: 'possible', reasons: possible };
  return null;
}

function toNumber(raw) {
  // "245 000", "245.000", "245,000" are thousands. "1 250,50" has decimals.
  let s = raw.replace(/[\s  ]/g, '');
  s = s.replace(/[.,](\d{1,2})$/, 'D$1');
  s = s.replace(/[.,]/g, '').replace('D', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const NUM = String.raw`(\d{1,3}(?:[   .,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)`;

export function parsePrice(text) {
  const re = new RegExp(NUM + String.raw`\s*(?:€|eur\b)(?!\s*\/\s*(?:m²|m2|kv))`, 'gi');
  for (const m of String(text ?? '').matchAll(re)) {
    const n = toNumber(m[1]);
    if (n !== null && n >= 50) return Math.round(n);
  }
  return null;
}

export function parseArea(text) {
  const re = new RegExp(NUM + String.raw`\s*(?:m²|m2|kv\.?\s?m)`, 'i');
  const m = String(text ?? '').match(re);
  if (!m) return null;
  const n = toNumber(m[1]);
  return n !== null && n >= 10 && n <= 2000 ? n : null;
}

export function parseRooms(text) {
  const t = normalize(text);
  let m = t.match(/kambariu (?:sk\w*|skaicius)\.?:?\s*(\d{1,2})/);
  if (m) return Number(m[1]);
  m = t.match(/\b(\d{1,2})[ -]?(?:kamb\b|kambari)/);
  return m ? Number(m[1]) : null;
}

export function parseFloor(text) {
  const t = normalize(text);
  // "1/5 aukštas", then "Aukštas: 3", then "3 aukštas". The label needs a colon,
  // else the number of the next line (for example the price) can be read as the floor.
  let m = t.match(/\b(\d{1,2})\s*(?:\/|is)\s*(\d{1,2})\s*(?:aukst|a\.)/);
  if (!m) m = t.match(/aukstas:\s*(\d{1,2})\b(?:\s*(?:\/|is)\s*(\d{1,2})\b)?/);
  if (!m) m = t.match(/\b(\d{1,2})\s*aukst/);
  if (!m) return null;
  return m[2] ? `${m[1]}/${m[2]}` : m[1];
}

export function parseAddress(text) {
  const m = String(text ?? '').match(/(Aludari\S*|Pakaln\S*)\s+g\.?(?:\s*\d+[A-Za-z]?)?/i);
  return m ? m[0].trim() : null;
}

export function detectDeal(context, price) {
  const t = normalize(context);
  if (/nuom|isnuomoj|€\s*\/\s*men|eur\s*\/\s*men|per menesi/.test(t)) return 'rent';
  if (/parduod|pardavim/.test(t)) return 'sale';
  if (price !== null && price < 5000) return 'rent';
  return 'sale';
}

export function listingId(portalId, url) {
  const m = url.match(/(\d{5,})(?!.*\d{5,})/);
  return `${portalId}:${m ? m[1] : url}`;
}

// block: the text of one listing inside an alert email. context: the alert subject and search name.
export function extractListing({ url, title, block, image }, { portalId, context, match }) {
  const price = parsePrice(block);
  const area = parseArea(block);
  return {
    id: listingId(portalId, url),
    portal: portalId,
    url,
    deal: detectDeal(`${title} ${block} ${context}`, price),
    title: String(title || block.split('\n')[0] || '').trim().slice(0, 200),
    price,
    area,
    pricePerM2: price && area ? Math.round(price / area) : null,
    rooms: parseRooms(`${title} ${block}`),
    floor: parseFloor(block),
    address: parseAddress(`${title} ${block}`),
    image: image || null,
    match,
  };
}
