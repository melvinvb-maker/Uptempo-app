# Gratis festivalimport voor UPTEMPO

De wekelijkse GitHub Actions-workflow controleert de openbare officiële websites van de festivals en kan daarnaast Instagram Business Discovery gebruiken. Website-invoer vereist geen Instagram-token. Er worden geen betaalde AI-diensten, Firebase Functions of Cloud Scheduler gebruikt; de website-invoer en OCR draaien op een standaard GitHub Actions-runner.

## Bronnen

De importer controleert de officiële festivalpagina's voor REBiRTH, REBELLiON Outdoor, Intents, Harmony of Hardcore, Snakepit, Dominator, Annihilation, Classified, Rocketfest, T.M.O. B-Day Bash, TITANIUM en Decibel outdoor. Voor T.M.O. B-Day Bash wordt de officiële evenementpagina van Willem Twee gebruikt.

De importer leest openbare pagina's en probeert duidelijke timetable-regels of performers uit gestructureerde Event-gegevens te halen. Sommige websites laden line-ups dynamisch of tonen artiesten alleen op afbeeldingen; die inhoud kan deze importer mogelijk niet herkennen. De Instagram-route leest afbeeldingen en carousels met lokale Tesseract-OCR. Stories en video's worden niet verwerkt.

Alleen herkende, gepubliceerde namen en tijden worden opgeslagen. Controleer de bron en editie in de app; automatische tekstherkenning kan fouten maken. Niet-herkende pagina's worden overgeslagen, niet met verzonnen gegevens aangevuld.

## Eenmalig activeren

Voeg in **GitHub → Uptempo-app → Settings → Secrets and variables → Actions** de volgende GitHub secret toe:

- `FIREBASE_SERVICE_ACCOUNT_JSON`: JSON van een serviceaccount voor het Firebase-project `uptempo-43116`. Zet de JSON alleen in GitHub Secrets, nooit in code of chat.

Dit is voldoende voor de officiële websites. Wil je ook Instagram gebruiken, dan zijn daarnaast alle drie deze secrets/configwaarden nodig:

- `INSTAGRAM_ACCESS_TOKEN`: Meta-token met toegang tot Business Discovery.
- `INSTAGRAM_USER_ID`: ID van het professionele account dat de Meta-app gebruikt.
- `INSTAGRAM_ACCOUNTS_JSON`: JSON-array met de festivals, gecontroleerde Instagram-gebruikersnamen en eventuele appnamen.

Instagram Business Discovery vereist de juiste Meta-toegang en professionele bronaccounts. Zonder deze optionele Instagram-instellingen blijft website-import gewoon werken.

## Firestore-regels

De app moet de gedeelde catalogus kunnen lezen. Voeg onderstaande match toe binnen de bestaande `rules_version = '2'` en `service cloud.firestore`-blokken. Vervang je bestaande regels niet; behoud de bestaande beveiliging voor groepen en andere gegevens.

```text
match /festivalLineups/{festivalId} {
  allow read: if request.auth != null;
  allow write: if false;
}
```

De workflow schrijft server-side met de serviceaccount. De browser krijgt geen schrijfrecht op deze catalogus.

## Planning en kosten

De workflow start wekelijks op dinsdag om 08:15 UTC (09:15 Nederlandse wintertijd of 10:15 zomertijd). Handmatig starten kan via **Actions → Import festival timetable → Run workflow**. De repository is openbaar, waardoor standaard GitHub Actions-runners gratis zijn. Firebase Spark biedt gratis Firestore-quota; laat billing uitgeschakeld. Als een gratis quota wordt bereikt, beperken we het gebruik in plaats van over te stappen op een betaald plan.

## Artiestenfoto's automatisch aanvullen

Na elke import draait `collect-photos.js`. Het zoekt in de geïmporteerde line-ups naar artiesten zonder foto waarvan de festivalsite wel een afbeelding toont. Die afbeelding wordt bijgesneden tot een portret, omgezet naar zwart-wit en aan de randen donkerder gemaakt, zodat hij past bij de andere foto's. Het resultaat komt in `images/acts/auto/` en `auto-photos.js` en wordt automatisch gecommit.

- Handgekozen foto's in `timetable-photos.js` gaan altijd voor. Een artiest die daar al staat, ook onder een showtitel zoals "D-STURB UNIVERSE", wordt overgeslagen.
- Sets met meerdere artiesten (vs, b2b, &) worden overgeslagen.
- Is een automatische afbeelding niet geschikt, zet de artiestennaam dan in `scripts/photo-skip.json` en verwijder het bestand uit `images/acts/auto/` en de regel uit `auto-photos.js`.
- Per run komen er maximaal 40 nieuwe foto's bij. Dit kost niets: het draait op dezelfde gratis GitHub Actions-runner.


## Automatische test

Bij elke pull request en elke wijziging op `main` draait `.github/workflows/test.yml`. Die controleert de code met ESLint en opent de app in Chromium (`tests/smoke.mjs`): alle tabbladen, Nu & straks, overlap, agenda-export, planningsafbeelding, artiestenvenster, starten met beschadigde opslag en zonder verbinding, en of alle artiestenfoto's bestaan. Lokaal draaien: `cd tests && npm install && npx playwright install chromium && npm run lint && npm run smoke`.
