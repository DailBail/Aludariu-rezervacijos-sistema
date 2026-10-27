# Aludarių g. and Matau Vilnių listing monitor

The monitor collects sale and rent listings for buildings on Aludarių g. in Vilnius and for the "Matau Vilnių" project. It runs automatically every 2 hours in GitHub Actions.

## How the monitor works

1. The monitor opens the search pages of aruodas.lt, domoplius.lt, skelbiu.lt, rinka.lt, and kampas.lt in a headless Chromium browser.
2. It collects the links to listings from each search page.
3. It opens each listing and reads the title, price, area, rooms, floor, and address.
4. It keeps a listing only if the text contains "Aludarių" or "Matau Vilnių".
5. It keeps a listing that contains "Pakalnės g." and "Vilnius" as a possible match. Some Matau Vilnių buildings have Pakalnės g. addresses.
6. It saves the results in `docs/data/listings.json`.
7. It sends an email for each new listing, price change, removed listing, and listing that comes back on the market.

The monitor opens the known active listings again on each run. If a listing is not available for 3 runs, the monitor marks it as removed.

## Setup

### 1. Merge the code into the default branch

GitHub runs scheduled workflows only from the default branch (`main`).

### 2. Add the email secrets

Go to **Settings → Secrets and variables → Actions → New repository secret**. Add these secrets:

| Secret | Value |
|---|---|
| `SMTP_USER` | The Gmail address that sends the alerts |
| `SMTP_PASS` | A Gmail app password (not the usual password) |
| `ALERT_TO` | The address that receives the alerts. You can use more than one address, separated by commas. |
| `SMTP_HOST` | Optional. The default is `smtp.gmail.com`. |
| `SMTP_PORT` | Optional. The default is `465`. |

To make a Gmail app password, turn on 2-Step Verification, then go to <https://myaccount.google.com/apppasswords>.

If you do not add the secrets, the monitor collects the listings but does not send emails.

### 3. Turn on the web page

1. Go to **Settings → Pages**.
2. Set **Source** to "Deploy from a branch".
3. Select the `main` branch and the `/docs` folder.
4. Optional: Go to **Settings → Secrets and variables → Actions → Variables** and add `SITE_URL` with the page address. The emails then include a link to the page.

NOTE: GitHub Pages for a private repository requires a paid GitHub plan. If the repository is private and you do not have a paid plan, open `docs/index.html` from a local copy of the repository with a local web server (for example, `npx serve docs`).

### 4. Do the first run

Go to **Actions → Listing monitor → Run workflow**. The first run reports all current listings as new.

## Configuration

Edit `monitor/config.json` to change the monitor:

- `keywords`: The words that a listing must contain. The monitor ignores letter case and Lithuanian diacritics.
- `portals[].searches`: The search pages for each portal. `deal` is `sale`, `rent`, or `auto`. With `auto`, the monitor finds the deal type from the listing text.
- `portals[].listingPattern`: A regular expression for the listing links on the portal.
- `removeAfterMisses`: The number of failed checks before the monitor marks a listing as removed.

To change the schedule, edit the `cron` line in `.github/workflows/listing-monitor.yml`.

## Run the monitor on a computer

```bash
cd monitor
npm install
npx playwright install chromium
npm test
npm start
```

To check only some portals, set `PORTALS`, for example: `PORTALS=aruodas,skelbiu npm start`.

## Limits

- The portals can change their web pages or search addresses at any time. If a portal shows "0 found" or "warnings" on the web page for many days, examine the workflow log and update `monitor/config.json`.
- aruodas.lt uses anti-bot protection. It can block the GitHub servers. The web page shows "blocked" when this occurs. The other portals continue to operate.
- The same apartment can appear on more than one portal. The monitor shows each listing separately.
- A listing that mentions Aludarių g. only in a "similar listings" section can appear as a false match. Use the link to examine the listing.
- GitHub can stop scheduled workflows in a repository without activity for 60 days. The monitor saves a status update each day, and this prevents the stop.
