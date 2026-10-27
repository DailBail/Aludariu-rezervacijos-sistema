# Aludarių g. ir „Matau Vilnių“ skelbimų stebėjimas

Programa renka Vilniaus Aludarių g. pastatų ir projekto „Matau Vilnių“ pardavimo ir nuomos skelbimus. GitHub Actions ją automatiškai paleidžia kas 2 valandas.

## Kaip programa veikia

1. Programa atidaro aruodas.lt, domoplius.lt, skelbiu.lt, rinka.lt ir kampas.lt paieškos puslapius naršyklėje Chromium be grafinės sąsajos.
2. Programa surenka skelbimų nuorodas iš paieškos puslapių.
3. Programa atidaro kiekvieną skelbimą ir nuskaito pavadinimą, kainą, plotą, kambarių skaičių, aukštą ir adresą.
4. Programa išsaugo skelbimą tik tada, kai tekste yra žodis „Aludarių“ arba „Matau Vilnių“.
5. Skelbimą, kuriame yra „Pakalnės g.“ ir „Vilnius“, programa pažymi kaip galimą atitikmenį. Kai kurie „Matau Vilnių“ pastatai turi Pakalnės g. adresus.
6. Programa įrašo rezultatus į failą `docs/data/listings.json`.
7. Programa siunčia el. laišką apie naujus skelbimus, kainų pokyčius, pašalintus skelbimus ir skelbimus, kurie vėl tapo aktyvūs.

Kiekvienos patikros metu programa vėl atidaro žinomus aktyvius skelbimus. Jei skelbimo nėra 3 patikras iš eilės, programa jį pažymi kaip pašalintą.

## Nustatymas

### 1. El. pašto slaptieji raktai

Atidarykite **Settings → Secrets and variables → Actions → New repository secret**. Pridėkite šiuos raktus:

| Raktas | Reikšmė |
|---|---|
| `SMTP_USER` | Gmail adresas, iš kurio siunčiami pranešimai |
| `SMTP_PASS` | Gmail programos slaptažodis (ne įprastas slaptažodis) |
| `ALERT_TO` | Adresas, kuris gauna pranešimus. Kelis adresus atskirkite kableliais. |
| `SMTP_HOST` | Nebūtina. Numatytoji reikšmė yra `smtp.gmail.com`. |
| `SMTP_PORT` | Nebūtina. Numatytoji reikšmė yra `465`. |

Norėdami sukurti Gmail programos slaptažodį, įjunkite patvirtinimą dviem veiksmais. Tada atidarykite <https://myaccount.google.com/apppasswords>.

Be šių raktų programa renka skelbimus, bet nesiunčia el. laiškų.

### 2. Tinklalapis

1. Atidarykite **Settings → Pages**.
2. Lauke **Source** pasirinkite „Deploy from a branch“.
3. Pasirinkite šaką `main` ir aplanką `/docs`.
4. Nebūtina: atidarykite **Settings → Secrets and variables → Actions → Variables** ir pridėkite kintamąjį `SITE_URL` su tinklalapio adresu. Tada el. laiškuose bus nuoroda į tinklalapį.

PASTABA: privačiai saugyklai GitHub Pages reikia mokamo GitHub plano. Jei saugykla privati ir plano nėra, atidarykite `docs/index.html` vietinėje kopijoje per vietinį serverį, pavyzdžiui, `npx serve docs`.

### 3. Pirmoji patikra

Atidarykite **Actions → Skelbimų stebėjimas → Run workflow**. Pirmoji patikra visus esamus skelbimus pažymi kaip naujus.

## Konfigūracija

Programos nustatymai yra faile `monitor/config.json`:

- `keywords` – žodžiai, kurie turi būti skelbime. Programa nekreipia dėmesio į didžiąsias raides ir lietuviškas raides su diakritiniais ženklais.
- `portals[].searches` – kiekvieno portalo paieškos puslapiai. `deal` reikšmė yra `sale` (pardavimas), `rent` (nuoma) arba `auto`. Su `auto` programa sandorio tipą nustato iš skelbimo teksto.
- `portals[].listingPattern` – reguliarioji išraiška portalo skelbimų nuorodoms.
- `removeAfterMisses` – nesėkmingų patikrų skaičius, po kurio skelbimas pažymimas kaip pašalintas.

Norėdami pakeisti tvarkaraštį, pakeiskite eilutę `cron` faile `.github/workflows/listing-monitor.yml`.

## Paleidimas kompiuteryje

```bash
cd monitor
npm install
npx playwright install chromium
npm test
npm start
```

Norėdami tikrinti tik kai kuriuos portalus, nustatykite `PORTALS`, pavyzdžiui: `PORTALS=aruodas,skelbiu npm start`.

## Apribojimai

- Portalai gali bet kada pakeisti puslapius arba paieškos adresus. Jei tinklalapyje portalas kelias dienas rodo „rasta 0“ arba „įspėjimai“, peržiūrėkite darbo eigos žurnalą ir pataisykite `monitor/config.json`.
- aruodas.lt naudoja apsaugą nuo robotų. Ji gali blokuoti GitHub serverius. Tada tinklalapyje rodoma „užblokuota“. Kiti portalai veikia toliau.
- Tas pats butas gali būti keliuose portaluose. Programa kiekvieną skelbimą rodo atskirai.
- Skelbimas, kuriame Aludarių g. paminėta tik skiltyje „panašūs skelbimai“, gali būti klaidingai atrinktas. Patikrinkite skelbimą pagal nuorodą.
- GitHub gali sustabdyti suplanuotas darbo eigas saugykloje, kurioje 60 dienų nėra veiklos. Programa kartą per dieną įrašo būsenos atnaujinimą, todėl sustabdymo nebūna.
