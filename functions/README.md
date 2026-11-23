# UPTEMPO Instagram-import

De scheduled functie controleert elke dinsdag om 09.00 uur Nederlandse tijd openbare Instagram-posts van opgegeven festivalaccounts. Ze gebruikt Meta Business Discovery om posts te lezen en de OpenAI API om duidelijke line-up- en timetablegegevens uit captions en afbeeldingen te halen.

De functie schrijft alleen updates met een hoge extractie-score naar bestaande festivaldocumenten in `groups/{groupId}/festivals`. Handmatig ingevoerde artiesten blijven staan. Geïmporteerde regels worden bijgewerkt als tijden veranderen. Bestaande geïmporteerde regels worden alleen vervangen als een post duidelijk de complete timetable voor het hele festival laat zien. Handmatige regels blijven staan. De bestaande app ontvangt de wijziging via de Firestore-listener.

## Nodig voordat je dit uitrolt

- Een Meta Developer-app met Instagram Graph API, Facebook Login for Business en toegang via een Instagram Business- of Creator-account. Business Discovery moet toegang kunnen geven tot de openbare professionele festivalaccounts.
- Een Meta access token voor het gekoppelde professionele account.
- Een OpenAI API key. Het verwerken van posts kan API-kosten veroorzaken.
- Firebase Functions ingeschakeld voor project `uptempo-43116`. Firebase kan voor geplande functies een betaalde Blaze-configuratie vereisen.
- De app moet in Firestore leesrechten krijgen op de nieuwe collectie `festivalLineups`. Voeg de volgende regel toe binnen de bestaande `match /databases/{database}/documents`-sectie in Firestore Rules. Behoud de overige bestaande regels.\n\n```text\nmatch /festivalLineups/{festivalId} {\n  allow read: if request.auth != null;\n  allow write: if false;\n}\n```\n\nGebruikers kunnen alleen lezen. De geplande functie schrijft met de Firebase Admin SDK. De bestaande app moet Firebase-anoniem inloggen.\n- De gebruiker moet ingelogd zijn met de bestaande anonieme Firebase-login. De update wordt getoond bij festivals die lokaal of in een groep zijn opgeslagen en qua naam of alias overeenkomen.

Instagram stories en videobeelden worden niet verwerkt. Captions van feedposts worden wel gelezen, en de importer kan afbeeldingen en carouselafbeeldingen verwerken. Data uit posts wordt direct opgeslagen zonder handmatige goedkeuring.

## Geheimen instellen

Voer dit uit in de Firebase CLI voor project `uptempo-43116`. De CLI vraagt om de waarde, zodat je die niet in een chatbericht of in de repository hoeft te zetten.

```sh
firebase functions:secrets:set INSTAGRAM_ACCESS_TOKEN --project uptempo-43116
firebase functions:secrets:set OPENAI_API_KEY --project uptempo-43116
firebase functions:secrets:set INSTAGRAM_ACCOUNTS_JSON --project uptempo-43116
```

De waarde van `INSTAGRAM_ACCOUNTS_JSON` is een JSON-array met voor elk festival de exacte Instagram-gebruikersnaam en eventuele naamvarianten. Voorbeeld:

```json
[
  {
    "festival": "Dominator",
    "username": "officieel_instagram_account",
    "aliases": ["Dominator Festival"]
  }
]
```

Vul voor alle twaalf festivals de juiste openbare professionele Instagram-gebruikersnamen in en controleer de aliases. De import slaat een post over als de herkende festivalnaam niet overeenkomt met de ingestelde festivalnaam of alias. Instagram Business Discovery en beeldherkenning zijn externe diensten. Meta-toegang kan goedkeuring vereisen. OpenAI API-gebruik en Firebase Functions/Cloud Scheduler kunnen kosten veroorzaken. De functie is nog niet uitgerold en er worden nog geen kosten gemaakt.

## Uitrollen

```sh
npm install -g firebase-tools
firebase login
firebase use uptempo-43116
cd functions
npm install
cd ..
firebase deploy --only functions --project uptempo-43116
```

Na de uitrol maakt Firebase een wekelijkse Cloud Scheduler-taak aan. Gebruik `firebase functions:log --only importFestivalUpdates --project uptempo-43116` om fouten en uitgevoerde imports te bekijken.
