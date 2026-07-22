# Optituning Jobbstyring – klar for Cloudflare

Dette er publiseringsutgaven av Optituning-appen. Den er bygget for samme type drift som ukeplanen på `workers.dev`:

- **Cloudflare Worker** leverer nettsiden og API-et
- **Cloudflare D1** lagrer alle jobber i en felles database
- **Cloudflare Access** gir personlig innlogging for godkjente ansatte
- Appen kan åpnes på mobil, PC og nettbrett
- GPS/geotag fungerer over HTTPS
- Alle opprettelser, endringer og slettinger registreres i en endringslogg

Den gamle lokale `jobs.json`-filen brukes ikke i denne utgaven.

## Dette er ferdig

- Felles ukeplan for Steffen, Henrik, Sæter og Nyansatt 1
- 2–10 jobber per ansatt per dag
- Kunde-, kjøretøy-, lokasjons- og fakturainformasjon
- Kortbetaling eller faktura
- Fakturavarsel etter 7 dager
- Geotag fra telefon
- Dagsrute og ukesrute i Google Maps
- Mobilvennlig PWA som kan legges på hjemskjermen
- D1-database i EU-jurisdiksjon
- Cloudflare Access/JWT-validering
- Administratorstyring av import, sletting og eksempeldata
- Sikkerhetsheadere og blokkering av cross-site skrivekall
- Myk sletting og intern endringslogg
- Eksport/import av sikkerhetskopi

---

# Rask publisering

## Krav

Installer:

1. **Node.js 20 eller nyere**
2. En **Cloudflare-konto**

## Windows

1. Pakk ut ZIP-filen.
2. Dobbeltklikk `PUBLISER_WINDOWS.bat`.
3. Logg inn hos Cloudflare når nettleseren åpnes.
4. Skriptet oppretter databasen, kjører migrering og publiserer Worker-appen.

## Mac/Linux

Åpne Terminal i prosjektmappen og kjør:

```bash
./publiser_mac_linux.sh
```

Eller:

```bash
npm install
npm run publish
```

Publiseringsskriptet vil:

1. Kontrollere Cloudflare-innlogging
2. Opprette eller finne D1-databasen `optituning-jobbstyring`
3. Legge databasen i EU-jurisdiksjon ved nyopprettelse
4. Oppdatere `wrangler.jsonc` med riktig database-ID
5. Opprette tabeller og indekser
6. Publisere appen på en `workers.dev`-adresse

---

# Viktig: aktiver innlogging etter første publisering

Appen er satt opp i **låst modus**. Den viser ikke kundeinformasjon før Cloudflare Access er konfigurert.

Etter publisering:

1. Åpne **Cloudflare Dashboard**.
2. Gå til **Workers & Pages**.
3. Velg `optituning-jobbstyring`.
4. Gå til **Settings → Domains & Routes**.
5. Finn `workers.dev`-ruten og velg **Enable Cloudflare Access**.
6. Opprett en Allow-policy for e-postadressene til de ansatte.
7. Kopier:
   - **Team domain**, for eksempel `https://firma.cloudflareaccess.com`
   - **Application AUD tag**
8. Kjør i prosjektmappen:

```bash
npx wrangler secret put TEAM_DOMAIN
```

Lim inn Team domain.

Deretter:

```bash
npx wrangler secret put POLICY_AUD
```

Lim inn AUD-taggen.

Når begge er satt, er appen klar til bruk. Cloudflare vil be hver godkjent bruker om innlogging.

## Anbefalt Access-policy

Tillat kun:

- Steffen
- Henrik
- Sæter
- Nyansatt 1 når e-post er opprettet
- Eier/daglig leder

Bruk e-postkode eller bedriftens Google/Microsoft-innlogging.

---

# Administratorer

I `wrangler.jsonc` finnes:

```json
"ADMIN_EMAILS": ""
```

Når feltet er tomt, er alle innloggede brukere administratorer. For bedre kontroll kan det endres til for eksempel:

```json
"ADMIN_EMAILS": "henrik@optituning.no,eier@optituning.no"
```

Publiser deretter på nytt:

```bash
npm run deploy
```

Administratorer kan:

- slette jobber
- slette alle jobber
- importere sikkerhetskopi
- legge inn eksempeljobber
- hente endringslogg via `/api/audit`

Vanlige brukere kan fortsatt opprette, redigere, starte og fullføre jobber.

---

# Lokal test før publisering

Installer pakker:

```bash
npm install
```

Opprett lokal database:

```bash
npm run db:migrate:local
```

Start appen:

```bash
npm run dev
```

Åpne:

```text
http://localhost:8787
```

Lokal utvikling hopper automatisk over Cloudflare Access og bruker en lokal D1-database.

---

# Flytte data fra den gamle appen

Hvis den gamle appen inneholder jobber:

1. Åpne den gamle appen.
2. Velg **Data → Eksporter sikkerhetskopi**.
3. Åpne den nye publiserte appen som administrator.
4. Velg **Data → Importer sikkerhetskopi**.
5. Kontroller ukeplanen og fakturavarslene.

Import erstatter den aktive jobblisten. Eksisterende data mykslettes og bevares i databasen/endringsloggen.

---

# Sikkerhetskopi

Appen har to nivåer:

## Enkel jobbliste

I appen:

**Data → Eksporter sikkerhetskopi**

Dette lager en JSON-fil som kan importeres senere.

## Komplett D1-eksport

Kjør:

```bash
npm run db:backup
```

Dette lager `optituning-d1-backup.sql` lokalt. Filen er ignorert av Git og må lagres på et sikkert sted.

Cloudflare D1 tar også backup ved database-migreringer.

---

# Eget domenenavn

Dere kan bruke `workers.dev` direkte eller koble til eksempelvis:

```text
jobb.optituning.no
```

Legg domenet til under:

**Workers & Pages → optituning-jobbstyring → Settings → Domains & Routes**

Oppdater deretter Cloudflare Access-applikasjonen slik at det nye domenet er beskyttet.

---

# Oppdatering av appen

Etter en endring:

```bash
npm run check
npm run deploy
```

Ved nye databasefiler i `migrations/`:

```bash
npm run db:migrate:remote
npm run deploy
```

---

# Teknisk oppsett

```text
public/                 Mobilapp, CSS, JavaScript og PWA-filer
src/worker.js           API, tilgangskontroll og sikkerhetsheadere
migrations/             D1-databaseskjema
scripts/publish.mjs     Automatisk publiseringsskript
wrangler.jsonc          Cloudflare-konfigurasjon
```

## API

- `GET /api/health`
- `GET /api/me`
- `GET /api/employees`
- `GET /api/jobs`
- `POST /api/jobs`
- `PUT /api/jobs/:id`
- `DELETE /api/jobs/:id` – administrator
- `POST /api/jobs/replace` – administrator
- `GET /api/audit` – administrator

---

# Før ordinær bruk

Kontroller dette:

- [ ] Cloudflare Access er aktivert
- [ ] Kun godkjente e-postadresser har tilgang
- [ ] `TEAM_DOMAIN` er satt
- [ ] `POLICY_AUD` er satt
- [ ] Henrik/eier er satt som administrator
- [ ] Testjobb kan opprettes fra mobil
- [ ] GPS/geotag fungerer
- [ ] Kort og faktura kan registreres
- [ ] Fakturavarsel vises på en testjobb eldre enn 7 dager
- [ ] Sikkerhetskopi er eksportert og lagret
- [ ] Eksempeldata er slettet før produksjonsstart

Ikke legg inn ekte kunde- eller fakturadata før Access-oppsettet er testet i et privat nettleservindu.

---

# Automatisk publisering via GitHub

Repositoryet inneholder workflowen `.github/workflows/deploy-cloudflare.yml`.
Den kontrollerer koden, oppretter/finner D1-databasen, kjører migreringer og publiserer ved push til `main`.

Se [GITHUB_PUBLISERING.md](GITHUB_PUBLISERING.md) før første publisering.
