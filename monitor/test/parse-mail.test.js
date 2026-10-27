import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseAlertEmail } from '../src/parse-mail.js';

const config = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url)));
const fixture = (name) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

test('aruodas summary email (real 2022 layout) gives an alert with count and link, no listings', () => {
  const r = parseAlertEmail(fixture('aruodas-summary.json'), config);
  assert.equal(r.alert.portal, 'aruodas');
  assert.equal(r.alert.count, 3);
  assert.equal(r.alert.search, 'Butai pardavimui Vilniuje, Aludarių g.');
  assert.match(r.alert.url, /^https:\/\/www\.aruodas\.lt\/mail_subscriptions\//);
  assert.doesNotMatch(r.alert.url, /hash=|utm_/);
  assert.match(r.alert.url, /sid=1/);
  assert.equal(r.alert.relevant, true);
  assert.equal(r.listings.length, 0);
});

test('summary email for another area is not relevant', () => {
  const mail = fixture('aruodas-summary.json');
  mail.html = mail.html.replace('Butai pardavimui Vilniuje, Aludarių g.', 'Butai nuomai Vilniaus rajone');
  mail.subject = 'Nauji skelbimai: Butai nuomai Vilniaus rajone';
  const r = parseAlertEmail(mail, config);
  assert.equal(r.alert.relevant, false);
});

test('email with listing cards gives one listing per card and drops unrelated cards', () => {
  const r = parseAlertEmail(fixture('listing-cards.json'), config);
  assert.equal(r.alert.portal, 'domoplius');
  assert.equal(r.listings.length, 2);
  const [a, b] = r.listings;
  assert.equal(a.id, 'domoplius:7001234');
  assert.equal(a.deal, 'sale');
  assert.equal(a.price, 405000);
  assert.equal(a.area, 66.6);
  assert.equal(a.rooms, 3);
  assert.equal(a.floor, '1/5');
  assert.equal(a.address, 'Aludarių g. 5');
  assert.equal(a.image, 'https://img.example/1.jpg');
  assert.equal(b.deal, 'rent');
  assert.equal(b.price, 1100);
  assert.equal(b.match.confidence, 'possible');
});

test('plain-text email is parsed too', () => {
  const r = parseAlertEmail(
    {
      id: 'x',
      date: '2026-10-27T10:00:00Z',
      from: 'Skelbiu.lt <info@skelbiu.lt>',
      subject: 'Nauji skelbimai',
      html: '',
      text: 'Parduodamas butas Vilnius, Aludarių g. 3, 250 000 €, 45 m²\nhttps://www.skelbiu.lt/skelbimai/parduodamas-butas-87654321.html',
    },
    config,
  );
  assert.equal(r.listings.length, 1);
  assert.equal(r.listings[0].price, 250000);
});

test('unknown sender is ignored', () => {
  assert.equal(parseAlertEmail({ id: 'y', from: 'news@example.com', html: '<a href="x">x</a>' }, config), null);
});
