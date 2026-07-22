# Sikkerhet

## Produksjonskrav

- `AUTH_MODE` skal være `cloudflare-access`.
- `TEAM_DOMAIN` og `POLICY_AUD` skal være satt som Worker secrets.
- Cloudflare Access skal beskytte både `workers.dev`-ruten og eventuelt eget domene.
- Tilgangspolicyen skal være en eksplisitt Allow-liste. Alle andre blir avvist.
- Ekte kundeopplysninger skal ikke brukes før tilgangskontrollen er testet.

## Data

Appen lagrer kunde-, kontakt-, lokasjons- og fakturaopplysninger. Tilgangen må derfor begrenses til personer som trenger opplysningene i arbeidet.

D1-databasen opprettes med EU-jurisdiksjon av publiseringsskriptet når den ikke finnes fra før.

## Endringslogg

Opprettelse, oppdatering, sletting og full import registreres i `job_events`. Loggen kan hentes av administrator via:

```text
GET /api/audit?limit=100
```

## Sletting

En enkelt jobb slettes mykt. Den forsvinner fra appen, men slettetidspunkt og tidligere innhold bevares i databasen/endringsloggen. Dette reduserer risikoen for utilsiktet datatap.

## Rapportering

Ved mistanke om uvedkommende tilgang:

1. Fjern brukeren fra Cloudflare Access-policyen.
2. Kontroller Access-loggene.
3. Kontroller `/api/audit`.
4. Roter eventuelle secrets.
5. Eksporter og sikre databasen før videre endringer.
