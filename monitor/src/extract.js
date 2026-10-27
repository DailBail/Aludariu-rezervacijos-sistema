// Pure functions that read listing data from page text. No network or browser access here,
// so the tests can run without the portals.

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
  const re = new RegExp(NUM + String.raw`\s*(?:€|eur\b)`, 'gi');
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
  let m = t.match(/aukstas:?\s*(\d{1,2})(?:\s*(?:\/|is)\s*(\d{1,2}))?/);
  if (!m) m = t.match(/(\d{1,2})\s*(?:\/|is)\s*(\d{1,2})\s*(?:aukst|a\.)/);
  if (!m) return null;
  return m[2] ? `${m[1]}/${m[2]}` : m[1];
}

export function parseAddress(text) {
  const m = String(text ?? '').match(/(Aludari\S*|Pakaln\S*)\s+g\.?(?:\s*\d+[A-Za-z]?)?/i);
  return m ? m[0].trim() : null;
}

export function detectDeal(searchDeal, title, text, price) {
  if (searchDeal === 'sale' || searchDeal === 'rent') return searchDeal;
  const t = normalize(title);
  if (/nuom|isnuomoj/.test(t)) return 'rent';
  if (/parduod|pardavim/.test(t)) return 'sale';
  const body = normalize(text).slice(0, 3000);
  if (/€\s*\/\s*men|eur\s*\/\s*men|per menesi/.test(body)) return 'rent';
  if (price !== null && price < 5000) return 'rent';
  return 'sale';
}

// Pages that show these phrases no longer offer the listing.
const REMOVED_MARKERS = [
  'skelbimas nebegalioja',
  'skelbimas pasalintas',
  'skelbimas neaktyvus',
  'skelbimas nerastas',
  'puslapis nerastas',
  'nebeaktualus',
];

export function looksRemoved(text) {
  const t = normalize(text).slice(0, 5000);
  return REMOVED_MARKERS.some((m) => t.includes(m));
}

const BLOCK_MARKERS = ['just a moment', 'attention required', 'verify you are human', 'captcha', 'access denied'];

export function looksBlocked(title, text) {
  const t = normalize(`${title} ${String(text ?? '').slice(0, 1500)}`);
  return BLOCK_MARKERS.some((m) => t.includes(m));
}

export function listingId(portalId, url) {
  const m = url.match(/(\d{5,})(?!.*\d{5,})/);
  return `${portalId}:${m ? m[1] : url}`;
}

// page: { url, title, h1, description, ogImage, text, jsonLd: [] }
export function extractListing(page, { portalId, searchDeal, kind, keywords }) {
  const head = [page.title, page.h1, page.description].filter(Boolean).join(' \n ');
  const match = matchKeywords(`${head}\n${page.text}`, keywords);
  if (!match) return null;

  let price = null;
  for (const d of page.jsonLd ?? []) {
    const offer = Array.isArray(d?.offers) ? d.offers[0] : d?.offers;
    if (offer?.price) {
      price = toNumber(String(offer.price));
      break;
    }
  }
  price ??= parsePrice(head) ?? parsePrice(page.text);
  const area = parseArea(head) ?? parseArea(page.text);
  const deal = detectDeal(searchDeal, head, page.text, price);

  return {
    id: listingId(portalId, page.url),
    portal: portalId,
    url: page.url,
    deal,
    kind,
    title: (page.h1 || page.title || '').trim().slice(0, 200),
    price,
    area,
    pricePerM2: price && area ? Math.round(price / area) : null,
    rooms: parseRooms(head) ?? parseRooms(page.text),
    floor: parseFloor(page.text),
    address: parseAddress(head) ?? parseAddress(page.text),
    image: page.ogImage || null,
    match,
  };
}
