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
    ├── main.ts                  # amorçage : préférences, volume, resync d'horloge
    ├── state.ts                 # état global, groupé par domaine
    ├── dom.ts                   # helpers DOM partagés (qs, setText, bindSelect…)
    ├── ui.ts                    # formatage, focus, animation de score
    ├── services.ts              # singletons partagés (volume)
    ├── api.ts                   # iTunes : thèmes, filtrage, dédup, cache, retry
    ├── song.ts                  # identité et canonicalisation des morceaux
    ├── game.ts                  # règles, options, scoring et autocomplete
    ├── solo.ts                  # orchestration du mode solo
    ├── guess/
    │   ├── area.ts              # combobox accessible de saisie
    │   ├── search.ts            # surlignage des correspondances
    │   └── recap.ts             # timeline et récapitulatif des manches
    ├── round/
    │   ├── timer.ts             # horloge de manche (départ, temps, seuils)
    │   ├── guess.ts             # boucle de saisie partagée solo / multi
    │   └── stage.ts             # scène commune (artwork + horloge + résultat)
    ├── screens/
    │   ├── home.ts              # accueil et réglages solo
    │   └── lobby.ts             # salle d'attente multijoueur
    └── multiplayer/
        ├── protocol.ts          # types et validateurs du protocole
        ├── transport.ts         # Supabase Presence / Broadcast / clock ping
        ├── clock.ts             # horloge synchronisée avec l'hôte
        ├── session.ts           # cycle de vie de la partie (hôte, manches, reset)
        ├── lobby-view.ts        # rendu du lobby
        ├── game-screen.ts       # écran de manche multijoueur
        ├── game.ts              # scoring autoritaire côté hôte
        ├── leaderboard.ts       # classement live
        ├── game-ui.ts           # lignes du classement
        └── result-screens.ts    # fin de partie et départ de l'hôte

### Comment ça se relie

- **Accueil** (`screens/home.ts`) règle la partie solo ou appelle `openRoom`.
- **Solo** (`solo.ts`) et **multijoueur** (`multiplayer/game-screen.ts`) partagent
  la même scène (`round/stage.ts`), la même horloge (`round/timer.ts`) et la même
  boucle de saisie (`round/guess.ts`) ; seul le transport des réponses diffère.
- **Multijoueur** : `openRoom` ouvre la connexion (`transport.ts`), `session.ts`
  redistribue les événements, fait autorité sur les manches et délègue le scoring
  à `multiplayer/game.ts`. Les horloges se recalent via `clock.ts`.
- Le **protocole** est décrit une seule fois dans `multiplayer/protocol.ts` :
  types + validateurs, consommés par le transport et les gestionnaires.
- Le **catalogue** (`api.ts`) et l'**identité des morceaux** (`song.ts`) sont la
  source de vérité partagée par les deux modes.

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

Les tests couvrent les règles du jeu, le protocole multijoueur (transport en
mémoire, hôte + invité), l'autocomplete, le stockage, le volume, ainsi que les
écrans de manche solo et multijoueur (rendu, envoi de réponse, nettoyage).

## Audio

Les métadonnées et extraits audio sont fournis par l’iTunes Search API et utilisés dans le cadre de ce projet de démonstration.
