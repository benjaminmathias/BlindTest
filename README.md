# BlindTest

Blindtest musical jouable en solo ou en multijoueur temps réel.

Devine le titre à partir d’un extrait audio, avec autocomplete, cinq essais maximum et score basé sur le temps et le nombre de tentatives.

**Live :** https://blind-test-neon.vercel.app/

## Fonctionnalités

- Solo et multijoueur temps réel
- Autocomplete par titre ou artiste
- 5 essais maximum par manche
- Score basé sur le temps restant et le numéro de tentative
- Timeline et récapitulatif des manches
- Classement en direct et classement final
- Revanche multijoueur
- Durée des manches : 15, 20 ou 30 secondes
- Parties de 5, 10, 15 ou 20 manches
- Thèmes :
  - Tous
  - Pop
  - Rock
  - Rap / Hip-Hop
  - Électro
  - Chanson française
  - Funk / Disco
- Volume mémorisé localement

## Multijoueur

Le multijoueur repose sur Supabase Realtime.

L’hôte fait autorité sur la partie :

- sélection du morceau ;
- démarrage des manches ;
- validation des réponses ;
- calcul des scores ;
- progression et fin de partie.

Les clients envoient uniquement l’identifiant de leur réponse. Le résultat est validé côté hôte avant d’être renvoyé au joueur.

Une synchronisation d’horloge permet aux joueurs de démarrer chaque extrait au même moment malgré la latence réseau.

## Catalogue musical

Les morceaux et extraits audio proviennent de l’iTunes Search API.

Le catalogue est :

- filtré par thème ;
- dédupliqué ;
- nettoyé de certaines versions parasites ;
- normalisé pour regrouper les éditions équivalentes d’un même morceau.

Par exemple :

`Wonderwall` et `Wonderwall (2014 Remaster)` sont considérés comme la même chanson.

Le catalogue est mis en cache en mémoire et dans `localStorage` pendant 24 heures. Les erreurs réseau temporaires sont automatiquement retentées.

## Stack

- TypeScript
- HTML / CSS
- Vite
- Supabase Realtime
- iTunes Search API
- Vitest
- happy-dom
- Vercel

Aucun framework frontend.

## Structure

    src/
    ├── api.ts                  # iTunes, catalogue, cache et retry
    ├── game.ts                 # règles du jeu, scoring et autocomplete
    ├── song.ts                 # identité et canonicalisation des morceaux
    ├── solo.ts                 # orchestration du mode solo
    ├── guess-ui.ts             # UI de saisie et historique des essais
    ├── ui.ts                   # helpers UI
    ├── multiplayer/
    │   ├── game.ts             # validation et scoring côté hôte
    │   ├── game-ui.ts          # classement multijoueur
    │   └── realtime.ts         # Supabase Presence / Broadcast / clock sync
    ├── main.ts                 # navigation et orchestration principale
    └── style.css

## Lancer le projet

    git clone https://github.com/benjaminmathias/BlindTest.git
    cd BlindTest
    npm install
    cp .env.example .env.local

Configurer ensuite :

    VITE_SUPABASE_URL=
    VITE_SUPABASE_PUBLISHABLE_KEY=

Puis :

    npm run dev

## Tests

    npm test

Vérification TypeScript + tests :

    npm run check

Build de production :

    npm run build

## Audio

Les métadonnées et extraits audio sont fournis par l’iTunes Search API et utilisés dans le cadre de ce projet de démonstration.
