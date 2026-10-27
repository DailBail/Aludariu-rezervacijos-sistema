# Aludarių g. ir „Matau Vilnių“ skelbimų stebėjimas

Programa renka Vilniaus Aludarių g. pastatų ir projekto „Matau Vilnių“ pardavimo ir nuomos skelbimus. Programa skaito NT portalų el. pašto pranešimus apie jūsų išsaugotas paieškas. GitHub Actions ją automatiškai paleidžia kas valandą.

Programa neatidaro portalų puslapių. Ji skaito tik jūsų Gmail pašto dėžutę ir nieko joje nekeičia.

## Kaip programa veikia

1. Jūs išsaugote paieškas portaluose ir įjungiate el. pašto pranešimus.
2. Portalai siunčia laiškus apie naujus skelbimus į jūsų Gmail pašto dėžutę.
3. Kas valandą programa per IMAP perskaito paskutinių 14 dienų portalų laiškus.
4. Jei laiške yra atskiri skelbimai, programa nuskaito pavadinimą, kainą, plotą, kambarių skaičių, aukštą ir adresą.
5. Programa išsaugo skelbimą tik tada, kai skelbime arba paieškos pavadinime yra žodis „Aludarių“ arba „Matau Vilnių“.
6. Skelbimą su „Pakalnės g.“ ir „Vilnius“ programa pažymi kaip galimą atitikmenį. Kai kurie „Matau Vilnių“ pastatai turi Pakalnės g. adresus.
7. Jei laiške yra tik naujų skelbimų skaičius, programa išsaugo pranešimą su nuoroda į paieškos rezultatus. aruodas.lt laiškai gali būti tokio tipo.
8. Programa įrašo rezultatus į aplanką `docs/data` ir rodo juos tinklalapyje.

Programa kiekvieną laišką apdoroja tik vieną kartą. Jei tas pats skelbimas vėliau ateina su kita kaina, programa įrašo kainos pokytį į kainų istoriją.

## Nustatymas

### 1. Išsaugokite paieškas portaluose

Prisijunkite prie kiekvieno portalo su tuo Gmail adresu, kurį skaitys programa. Išsaugokite šias paieškas ir įjunkite pranešimus el. paštu:

| Portalas | Paieškos | Pranešimų dažnis |
|---|---|---|
| aruodas.lt | Butai pardavimui ir butai nuomai, Vilnius, Senamiestis, gatvė „Aludarių g.“. Tada atskira paieška su raktažodžiu „Matau Vilnių“. | Kartą per valandą |
| domoplius.lt | Tos pačios paieškos | Dažniausias galimas |
| skelbiu.lt | Raktažodžiai „Aludarių“ ir „Matau Vilnių“, kategorija „Nekilnojamasis turtas“ | Dažniausias galimas |

PASTABA: į paieškos pavadinimą įtraukite žodį „Aludarių“ arba „Matau Vilnių“. Tada programa atpažins pranešimą, net jei laiške nėra skelbimo adreso.

### 2. Sukurkite Gmail programos slaptažodį

1. Įjunkite Google paskyros patvirtinimą dviem veiksmais.
2. Atidarykite <https://myaccount.google.com/apppasswords>.
3. Sukurkite slaptažodį, pavyzdžiui, pavadinimu „Skelbimų stebėjimas“.
4. Nukopijuokite 16 raidžių slaptažodį.

Gmail nustatymuose IMAP turi būti įjungtas. Naujose Gmail paskyrose jis įjungtas automatiškai.

### 3. Pridėkite slaptuosius raktus GitHub saugykloje

Atidarykite **Settings → Secrets and variables → Actions → New repository secret**. Pridėkite šiuos raktus:

| Raktas | Reikšmė | Būtina |
|---|---|---|
| `GMAIL_USER` | Gmail adresas, kuris gauna portalų pranešimus | Taip |
| `GMAIL_APP_PASSWORD` | Gmail programos slaptažodis iš 2 žingsnio | Taip |
| `ALERT_TO` | Adresas, kuris gauna programos suvestinę apie naujus skelbimus ir kainų pokyčius | Ne |

### 4. Įjunkite tinklalapį

1. Atidarykite **Settings → Pages**.
2. Lauke **Source** pasirinkite „Deploy from a branch“.
3. Pasirinkite šaką `main` ir aplanką `/docs`.
4. Nebūtina: atidarykite **Settings → Secrets and variables → Actions → Variables** ir pridėkite kintamąjį `SITE_URL` su tinklalapio adresu.

PASTABA: privačiai saugyklai GitHub Pages reikia mokamo GitHub plano. Viešos saugyklos tinklalapį gali matyti visi. Programa iš nuorodų pašalina asmeninius prenumeratos raktus.

### 5. Paleiskite pirmą patikrą

Atidarykite **Actions → Skelbimų stebėjimas → Run workflow**.

## Konfigūracija

Programos nustatymai yra faile `monitor/config.json`:

- `keywords` – žodžiai, kurie turi būti skelbime arba paieškos pavadinime. Programa nekreipia dėmesio į didžiąsias raides ir lietuviškas raides su diakritiniais ženklais.
- `acceptAllAlerts` – jei `true`, programa priima visus portalų pranešimus be žodžių patikros. Naudokite tik tada, kai Gmail paskyra gauna tik šių paieškų pranešimus.
- `mailLookbackDays` – kiek dienų atgal programa skaito laiškus.
- `portals[].listingPattern` – reguliarioji išraiška portalo skelbimų nuorodoms laiškuose.

Norėdami vieną kartą perskaityti senesnius laiškus, paleiskite programą su `MAIL_LOOKBACK_DAYS`, pavyzdžiui, `MAIL_LOOKBACK_DAYS=90`.

## Paleidimas kompiuteryje

```bash
cd monitor
npm ci
npm test
GMAIL_USER=jusu@gmail.com GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx npm start
```

## Apribojimai

- Programa mato tik tuos skelbimus, apie kuriuos portalai praneša el. paštu.
- Programa nežino, kada skelbimas pašalinamas iš portalo.
- Jei portalas pakeičia laiškų formatą, gali reikėti pataisyti `monitor/src/parse-mail.js`.
- Tas pats butas gali būti keliuose portaluose. Programa kiekvieną skelbimą rodo atskirai.
