import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  matchKeywords,
  parsePrice,
  parseArea,
  parseRooms,
  parseFloor,
  parseAddress,
  detectDeal,
  extractListing,
  listingId,
  looksRemoved,
} from '../src/extract.js';
import { upsert, registerMiss } from '../src/store.js';

const { keywords } = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url)));

test('keyword match ignores Lithuanian diacritics and case', () => {
  assert.equal(matchKeywords('Parduodamas butas ALUDARIŲ g. 7', keywords).confidence, 'sure');
  assert.deepEqual(matchKeywords('Projektas „Matau Vilnių“', keywords).reasons, ['Matau Vilnių']);
  assert.equal(matchKeywords('Vilnius, Pakalnės g. 2', keywords).confidence, 'possible');
  assert.equal(matchKeywords('Kaunas, Pakalnės g. 2', keywords), null);
  assert.equal(matchKeywords('Vilnius, Gedimino pr. 1', keywords), null);
});

test('price parsing', () => {
  assert.equal(parsePrice('Kaina: 245 000 €'), 245000);
  assert.equal(parsePrice('245.000 €'), 245000);
  assert.equal(parsePrice('1 250,50 €/mėn.'), 1251);
  assert.equal(parsePrice('950 EUR per mėnesį'), 950);
  assert.equal(parsePrice('no price'), null);
});

test('area, rooms, floor, address', () => {
  assert.equal(parseArea('Plotas: 66,6 m²'), 66.6);
  assert.equal(parseArea('54 kv. m'), 54);
  assert.equal(parseRooms('Kambarių sk.: 3'), 3);
  assert.equal(parseRooms('2 kambarių butas'), 2);
  assert.equal(parseFloor('Aukštas: 3 Aukštų sk.: 5'), '3');
  assert.equal(parseFloor('3/5 aukšte'), '3/5');
  assert.equal(parseAddress('Vilnius, Senamiestis, Aludarių g. 7A'), 'Aludarių g. 7A');
});

test('deal detection', () => {
  assert.equal(detectDeal('auto', 'Išnuomojamas 2 kamb. butas', '', 700), 'rent');
  assert.equal(detectDeal('auto', 'Parduodamas butas', '', 300000), 'sale');
  assert.equal(detectDeal('auto', 'Butas', '', 800), 'rent');
  assert.equal(detectDeal('sale', 'Išnuomojamas', '', 800), 'sale');
});

test('extractListing returns null for unrelated pages', () => {
  const page = { url: 'https://www.aruodas.lt/1-111111/', title: 'Butas Žirmūnuose', text: 'Vilnius, Žirmūnų g. 1, 300 000 €' };
  assert.equal(extractListing(page, { portalId: 'aruodas', searchDeal: 'sale', kind: 'flat', keywords }), null);
});

test('extractListing reads a full listing', () => {
  const page = {
    url: 'https://www.skelbiu.lt/skelbimai/isnuomojamas-2-kambariu-butas-86033600.html',
    title: 'Išnuomojamas 2 kambarių butas',
    h1: 'Išnuomojamas 2 kambarių butas Aludarių g. 7',
    text: 'Vilnius, Senamiestis\nKaina 1 100 €/mėn.\nPlotas 50 m²\nAukštas: 3\nProjektas Matau Vilnių',
    jsonLd: [],
  };
  const l = extractListing(page, { portalId: 'skelbiu', searchDeal: 'auto', kind: 'flat', keywords });
  assert.equal(l.id, 'skelbiu:86033600');
  assert.equal(l.deal, 'rent');
  assert.equal(l.price, 1100);
  assert.equal(l.area, 50);
  assert.equal(l.pricePerM2, 22);
  assert.equal(l.rooms, 2);
  assert.equal(l.address, 'Aludarių g. 7');
});

test('listingId and removed markers', () => {
  assert.equal(listingId('aruodas', 'https://www.aruodas.lt/1-3456789/'), 'aruodas:3456789');
  assert.ok(looksRemoved('Šis skelbimas nebegalioja'));
});

test('store tracks new, price change, removal and return', () => {
  const store = new Map();
  const base = { id: 'a:1', portal: 'a', url: 'u', deal: 'sale', price: 100000, title: 't' };
  assert.equal(upsert(store, base, 'd1')[0].type, 'new');
  assert.equal(upsert(store, { ...base, price: 95000 }, 'd2')[0].type, 'price');
  assert.equal(store.get('a:1').priceHistory.length, 2);
  assert.deepEqual(registerMiss(store, 'a:1', 2), []);
  assert.equal(registerMiss(store, 'a:1', 2)[0].type, 'removed');
  assert.equal(upsert(store, { ...base, price: 95000 }, 'd3')[0].type, 'back');
});
