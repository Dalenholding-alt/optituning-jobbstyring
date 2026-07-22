# Publiser Optituning på samme måte som Sikra

GitHub-delen er ferdig. Appfilene ligger i repository-roten og prosjektet er klargjort for Cloudflare Workers Builds.

## 1. Koble repositoryet til Cloudflare

1. Logg inn i Cloudflare Dashboard.
2. Gå til **Workers & Pages**.
3. Velg **Create application** eller **Import a repository**.
4. Velg GitHub-kontoen `Dalenholding-alt`.
5. Velg repositoryet `optituning-jobbstyring`.
6. Bruk produksjonsgrenen `optituning-jobbstyring`.

## 2. Byggeinnstillinger

Bruk disse verdiene:

- **Root directory:** `/`
- **Build command:** `npm run build`
- **Deploy command:** `npm run deploy`
- **Node.js:** 22

Trykk deretter **Save and Deploy**.

Publiseringsskriptet vil automatisk:

1. finne eller opprette D1-databasen `optituning-jobbstyring`
2. opprette ny database i EU-jurisdiksjon
3. oppdatere databasebindingen under byggingen
4. kjøre migreringene
5. publisere Worker-appen

## 3. Aktiver sikker innlogging

Appen er med vilje låst til Cloudflare Access er ferdig konfigurert.

1. Åpne Worker-appen `optituning-jobbstyring` i Cloudflare.
2. Aktiver Cloudflare Access på `workers.dev`-adressen.
3. Lag en Allow-policy for e-postadressene til Steffen, Henrik, Sæter, Nyansatt 1 og eier/daglig leder.
4. Finn **Team domain** og **Application AUD tag** i Access-oppsettet.
5. Legg inn følgende Worker secrets:
   - `TEAM_DOMAIN` = Team domain
   - `POLICY_AUD` = Application AUD tag
   - `ADMIN_EMAILS` = kommaseparert liste over administratorenes e-postadresser
6. Publiser på nytt dersom Cloudflare ikke gjør det automatisk etter at secrets er lagret.

Ikke legg API-token, passord eller andre hemmeligheter i GitHub-filene.

## 4. Kontroller etter publisering

- Åpne `workers.dev`-adressen på mobil.
- Logg inn med en godkjent e-postadresse.
- Opprett en testjobb.
- Kontroller at jobben vises i ukeplanen på en annen telefon eller PC.
- Test geotag og kartlenke.
- Fullfør en fakturajobb og kontroller fakturastatus.
- Slett testjobben etterpå.

Når dette er kontrollert, kan repositoryet endres fra Public til Private dersom ønskelig.
