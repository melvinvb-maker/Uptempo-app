# Gratis Instagram-import voor UPTEMPO

Deze workflow controleert wekelijks openbare Instagram-posts en probeert duidelijke timetable-afbeeldingen lokaal met Tesseract te lezen. De OCR draait op een standaard GitHub Actions-runner. Er wordt geen betaalde AI, Firebase Cloud Functions of Cloud Scheduler gebruikt.

## Wat automatisch wordt opgeslagen

- Alleen posts van de geconfigureerde festivalaccounts uit de laatste acht dagen.
- Alleen afbeeldingen en carousels; Stories en video worden niet uitgelezen.
- Alleen timetable-achtige tekst met minstens vier herkende artiesten en drie verschillende starttijden.
- Herkende tijden, artiesten, bronpost en importdatum komen in de gedeelde Firestore-catalogus. Bij bestaande groepsfestivals worden de geïmporteerde regels toegevoegd; handmatig ingevoerde regels blijven staan.

OCR kan tijden, artiestennamen of stages verkeerd lezen. Controleer de bronpost in de app voordat je op de geïmporteerde timetable vertrouwt.

## Eenmalig activeren

De importer kan pas draaien nadat de eigenaar van de accounts de benodigde toegang heeft ingesteld. Plaats deze waarden uitsluitend in **GitHub → Uptempo-app → Settings → Secrets and variables → Actions**. Zet ze nooit in code, issues of chat.

- `FIREBASE_SERVICE_ACCOUNT_JSON`: JSON van een serviceaccount voor het Firebase-project `uptempo-43116`. Bewaar de sleutel als GitHub secret.
- `INSTAGRAM_ACCESS_TOKEN`: Meta access token dat toegang heeft tot Instagram Business Discovery.
- `INSTAGRAM_USER_ID`: Instagram-account-ID van het professionele account dat de Meta-app gebruikt.
- `INSTAGRAM_ACCOUNTS_JSON`: JSON-array met festivalnamen, exacte openbare Instagram-gebruikersnamen en eventuele namen waarmee ze in de app voorkomen.

Voorbeeldstructuur (vul zelf de gecontroleerde gebruikersnamen in):

```json
[
  { "festival": "Rebirth", "username": "OFFICIELE_HANDLE", "aliases": ["Rebirth Festival"] },
  { "festival": "Rebellion", "username": "OFFICIELE_HANDLE", "aliases": [] },
  { "festival": "Intents", "username": "OFFICIELE_HANDLE", "aliases": ["Intents Festival"] },
  { "festival": "Harmony of Hardcore", "username": "OFFICIELE_HANDLE", "aliases": ["HOH"] },
  { "festival": "Snakepit", "username": "OFFICIELE_HANDLE", "aliases": [] },
  { "festival": "Dominator", "username": "OFFICIELE_HANDLE", "aliases": [] },
  { "festival": "Annihilation", "username": "OFFICIELE_HANDLE", "aliases": [] },
  { "festival": "Classified", "username": "OFFICIELE_HANDLE", "aliases": [] },
  { "festival": "Rocketfest", "username": "OFFICIELE_HANDLE", "aliases": [] },
  { "festival": "Tmo Bday Bash", "username": "OFFICIELE_HANDLE", "aliases": ["TMO Bday Bash"] },
  { "festival": "Titanium", "username": "OFFICIELE_HANDLE", "aliases": [] },
  { "festival": "Decibel", "username": "OFFICIELE_HANDLE", "aliases": ["Decibel Outdoor"] }
]
```

Vervang elke `OFFICIELE_HANDLE` door de geverifieerde naam zonder `@`. Business Discovery vereist dat de bronaccounts professionele Instagram-accounts zijn en dat de Meta-app de juiste toegang heeft. Als een festivalaccount persoonlijk is of de API geen toegang verleent, kan dat account niet via deze route worden uitgelezen.

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

De workflow start wekelijks op dinsdag rond 09:15 Nederlandse tijd (08:15 UTC), en kan ook handmatig worden gestart via **Actions → Import festival timetable → Run workflow**. Het repository is openbaar; GitHub documenteert standaard runners voor openbare repositories als gratis. Firebase Spark heeft gratis Firestore-quota. Houd het project op Spark en schakel geen betaalde Google Cloud-diensten in. Bij overschrijding van de Firestore-quota moet je gebruik beperken; zet billing niet aan om dit op te lossen.
