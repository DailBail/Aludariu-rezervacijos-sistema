import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

// Reads the portal alert emails of the last `days` days from a Gmail mailbox over IMAP.
// The program only reads. It does not change, move or delete messages.
export async function fetchAlertMails({ user, pass, days, domains }) {
  const client = new ImapFlow({
    host: process.env.IMAP_HOST || 'imap.gmail.com',
    port: Number(process.env.IMAP_PORT || 993),
    secure: true,
    auth: { user, pass },
    logger: false,
  });
  await client.connect();
  try {
    // "All Mail" has a different name in each Gmail language, so find it by its special use.
    const boxes = await client.list();
    const mailbox = boxes.find((b) => b.specialUse === '\\All')?.path || 'INBOX';
    const lock = await client.getMailboxLock(mailbox, { readOnly: true });
    try {
      const since = new Date(Date.now() - days * 864e5);
      const uids = new Set();
      for (const domain of domains) {
        const found = await client.search({ since, from: domain }, { uid: true });
        for (const uid of found || []) uids.add(uid);
      }
      const mails = [];
      if (uids.size) {
        for await (const m of client.fetch([...uids].join(','), { source: true }, { uid: true })) {
          const p = await simpleParser(m.source);
          mails.push({
            id: p.messageId || `uid:${m.uid}`,
            date: (p.date || new Date()).toISOString(),
            from: p.from?.text || '',
            subject: p.subject || '',
            html: typeof p.html === 'string' ? p.html : '',
            text: p.text || '',
          });
        }
      }
      console.log(`Pašto dėžutė „${mailbox}“: rasta portalų laiškų: ${mails.length}.`);
      return mails;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}
