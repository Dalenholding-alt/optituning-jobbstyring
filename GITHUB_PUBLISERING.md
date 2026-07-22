# Publiser Optituning Jobbstyring via GitHub

Denne utgaven er laget for automatisk publisering fra GitHub til Cloudflare Workers.

## Resultatet

Når kode legges på `main`:

1. GitHub Actions installerer pakkene.
2. JavaScript-filene kontrolleres.
3. D1-databasen `optituning-jobbstyring` opprettes i EU dersom den ikke finnes.
4. Databasemigreringene kjøres.
5. Worker, API og mobilgrensesnitt publiseres.
6. Cloudflare Access-hemmeligheter synkroniseres når de er konfigurert.

## Del 1 – opprett repository

Bruk GitHub-kontoen `Dalenholding-alt`.

1. Opprett et nytt **privat** repository.
2. Navn: `optituning-jobbstyring`.
3. Ikke legg til README, `.gitignore` eller lisens i opprettelsesbildet.
4. Last opp hele innholdet i denne mappen, ikke selve ZIP-filen.
5. Commit til branchen `main`.

Workflowen starter automatisk, men første kjøring vil stoppe til Cloudflare-hemmelighetene er lagt inn.

## Del 2 – lag Cloudflare API-token

Opprett et token i Cloudflare med minst:

- Workers Scripts: Edit
- D1: Edit/Write

Begrens tokenet til riktig Cloudflare-konto. Ikke legg tokenet i kode eller dokumenter.

Finn også Cloudflare Account ID.

## Del 3 – legg inn GitHub Secrets

I repositoryet:

`Settings → Secrets and variables → Actions → New repository secret`

Legg inn:

| Navn | Innhold |
|---|---|
| `CLOUDFLARE_API_TOKEN` | API-tokenet fra Cloudflare |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |

Workflowen kan nå kjøres fra:

`Actions → Publiser Optituning til Cloudflare → Run workflow`

Første vellykkede kjøring oppretter/finner D1-databasen, kjører migreringen og publiserer Worker-appen. Appen er bevisst låst fram til Access er ferdig konfigurert.

## Del 4 – aktiver Cloudflare Access

I Cloudflare:

1. Åpne `Workers & Pages`.
2. Velg `optituning-jobbstyring`.
3. Åpne `Settings → Domains & Routes`.
4. Aktiver Cloudflare Access på produksjonsadressen under `workers.dev`.
5. Tillat kun e-postadressene som skal bruke appen.
6. Finn team-domenet og Access-applikasjonens AUD-verdi.

Legg deretter inn disse GitHub Secrets:

| Navn | Innhold |
|---|---|
| `CLOUDFLARE_ACCESS_TEAM_DOMAIN` | For eksempel `https://firma.cloudflareaccess.com` |
| `CLOUDFLARE_ACCESS_POLICY_AUD` | AUD-taggen fra Access-applikasjonen |
| `OPTITUNING_ADMIN_EMAILS` | Kommaseparert liste over administratorer |

Eksempel på administratorliste:

`henrik@optituning.no,eier@optituning.no`

Kjør workflowen på nytt. Den legger da verdiene inn som krypterte Worker-hemmeligheter.

## Del 5 – kontroller før bruk

Test i et privat nettleservindu:

- Innlogging kreves.
- En e-post som ikke er tillatt, avvises.
- Henrik/eier har administratorrettigheter.
- En testjobb kan opprettes og redigeres.
- Testjobben vises på en annen mobil.
- Fakturavarsel og geotag fungerer.

Ikke legg inn ekte kunde- eller fakturaopplysninger før tilgangskontrollen er testet.

## Senere oppdateringer

Ved endringer:

1. Last opp eller push de oppdaterte filene til `main`.
2. GitHub Actions kjører kontroll og publisering automatisk.
3. D1-migreringer kjøres før ny Worker-versjon publiseres.

Databasen slettes ikke ved vanlig publisering.
