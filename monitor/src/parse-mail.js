import { parse } from 'node-html-parser';
import { extractListing, matchKeywords } from './extract.js';

const cleanUrl = (u) => String(u).trim().split('#')[0].split('?')[0];
const squash = (s) => String(s ?? '').replace(/[ \t ]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
const escapeHtml = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

// Plain-text emails get a minimal HTML form, so that one parser handles both.
function textToHtml(text) {
  return String(text ?? '')
    .split(/\n{2,}/)
    .map((para) => `<div>${escapeHtml(para).replace(/https?:\/\/[^\s<>"]+/g, (u) => `<a href="${u}">${u}</a>`).replace(/\n/g, '<br>')}</div>`)
    .join('');
}

// Finds the largest element around an anchor that still holds only one listing.
function listingBlock(anchor, pattern, root) {
  let el = anchor;
  while (el.parentNode && el.parentNode !== root) {
    const parent = el.parentNode;
    const urls = new Set(
      parent.querySelectorAll('a[href]').map((a) => cleanUrl(a.getAttribute('href'))).filter((u) => pattern.test(u)),
    );
    if (urls.size > 1 || parent.text.length > 1000) break;
    el = parent;
  }
  return el;
}

// Removes personal tokens and tracking from a link, because the data can be public on GitHub Pages.
const PRIVATE_PARAMS = /^(hash|_hash|uid|token|key|sig|signature|email|utm_.*)$/i;
export function safeLink(href) {
  try {
    const u = new URL(href);
    for (const k of [...u.searchParams.keys()]) if (PRIVATE_PARAMS.test(k)) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return null;
  }
}

const SUMMARY_LINK = /ziureti skelbimus|perziureti|visi skelbimai|rodyti skelbimus|naujus skelbimus/;
const plain = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// msg: { id, date, from, subject, html, text }
// Returns null when the email does not come from a known portal.
export function parseAlertEmail(msg, config) {
  const from = String(msg.from ?? '').toLowerCase();
  const portal = config.portals.find((p) => from.includes(p.domain));
  if (!portal) return null;

  const root = parse(msg.html || textToHtml(msg.text));
  const pattern = new RegExp(portal.listingPattern);
  const anchors = root.querySelectorAll('a[href]').map((a) => ({ a, url: cleanUrl(a.getAttribute('href')), text: squash(a.text) }));

  const search = squash(root.querySelector('.criteria')?.text) || String(msg.subject ?? '').replace(/^[^:]*:\s*/, '');
  const context = `${msg.subject ?? ''}\n${search}`;

  const byUrl = new Map();
  for (const x of anchors) {
    if (!pattern.test(x.url)) continue;
    if (!byUrl.has(x.url)) byUrl.set(x.url, []);
    byUrl.get(x.url).push(x);
  }

  const listings = [];
  for (const [url, group] of byUrl) {
    const block = listingBlock(group[0].a, pattern, root);
    const blockText = squash(block.structuredText ?? block.text);
    const title = group.map((g) => g.text).sort((a, b) => b.length - a.length)[0] || '';
    const match =
      matchKeywords(`${title}\n${blockText}`, config.keywords) ||
      matchKeywords(context, config.keywords) ||
      (config.acceptAllAlerts ? { confidence: 'sure', reasons: ['Išsaugota paieška'] } : null);
    if (!match) continue;
    const image = block.querySelector('img')?.getAttribute('src');
    listings.push(extractListing({ url, title, block: blockText, image }, { portalId: portal.id, context, match }));
  }

  const bodyText = plain(root.text);
  const count = Number(bodyText.match(/\(\+(\d+)\)/)?.[1] ?? bodyText.match(/(\d+)\s+nauj\w*\s+skelbim/)?.[1] ?? 0) || listings.length || null;
  const summaryHref =
    anchors.find((x) => SUMMARY_LINK.test(plain(x.text)))?.a.getAttribute('href') ||
    anchors.find((x) => /mail_subscriptions|paieska|search/i.test(x.a.getAttribute('href')))?.a.getAttribute('href');
  const summaryLink = summaryHref ? safeLink(summaryHref) : null;

  const relevant =
    listings.length > 0 || Boolean(matchKeywords(context, config.keywords)) || Boolean(config.acceptAllAlerts);

  return {
    alert: {
      id: msg.id,
      portal: portal.id,
      date: msg.date,
      subject: msg.subject ?? '',
      search,
      count,
      url: summaryLink,
      listings: listings.length,
      relevant,
    },
    listings,
  };
}
