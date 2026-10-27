import nodemailer from 'nodemailer';

const LABEL = { new: 'NAUJAS', price: 'PASIKEITĖ KAINA', back: 'VĖL AKTYVUS', removed: 'PAŠALINTAS' };

const eur = (n) => (n ? `${n.toLocaleString('lt-LT')} €` : '—');

function line(e) {
  const l = e.listing;
  const price = e.type === 'price' ? `${eur(e.oldPrice)} → ${eur(l.price)}` : eur(l.price);
  const facts = [l.deal === 'rent' ? 'Nuoma' : 'Pardavimas', price, l.area && `${l.area} m²`, l.rooms && `${l.rooms} kamb.`, l.address]
    .filter(Boolean)
    .join(' · ');
  return { text: `[${LABEL[e.type]}] ${l.title}\n  ${facts}\n  ${l.url}`, facts, l, label: LABEL[e.type] };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export async function sendAlert(events, siteUrl) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ALERT_TO } = process.env;
  if (!events.length) return;
  if (!SMTP_USER || !SMTP_PASS || !ALERT_TO) {
    console.log(`El. paštas nenustatytas. Neišsiųsta įvykių: ${events.length}.`);
    return;
  }
  const lines = events.map(line);
  const subject = `Aludarių g. / Matau Vilnių: pokyčių ${events.length}`;
  const footer = siteUrl ? `\nVisi skelbimai: ${siteUrl}\n` : '';
  const html =
    lines
      .map(
        ({ l, facts, label }) =>
          `<p><b>[${label}]</b> <a href="${esc(l.url)}">${esc(l.title || l.url)}</a><br>${esc(facts)}<br><small>${esc(l.portal)}</small></p>`,
      )
      .join('') + (siteUrl ? `<p><a href="${esc(siteUrl)}">Visi skelbimai</a></p>` : '');

  const transport = nodemailer.createTransport({
    host: SMTP_HOST || 'smtp.gmail.com',
    port: Number(SMTP_PORT || 465),
    secure: Number(SMTP_PORT || 465) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  await transport.sendMail({
    from: `Skelbimų stebėjimas <${SMTP_USER}>`,
    to: ALERT_TO,
    subject,
    text: lines.map((x) => x.text).join('\n\n') + footer,
    html,
  });
  console.log(`El. laiškas išsiųstas: ${ALERT_TO}, įvykių: ${events.length}.`);
}
