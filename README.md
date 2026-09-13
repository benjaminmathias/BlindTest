# Blindtest

Joue à un blindtest musical en solo ou entre amis : devine le titre à partir d'un court extrait.

## Fonctionnalités

- Réponse par saisie avec suggestions et cinq essais par manche ;
- Mode solo avec possibilité de passer un titre ;
- Multijoueur temps réel via Supabase Realtime ;
- Thèmes musicaux (tous, pop, rock, rap, électro) ;
- Choix du nombre de manches : 5, 10, 15 ou 20 ;
- Durée des manches réglable : 15, 20 ou 30 secondes ;
- Classement en direct et classement final ;
- Revanche entre joueurs ;
- Volume réglable et mémorisé localement.

## Stack

- TypeScript
- Vite
- Supabase Realtime
- iTunes Search API

## Lancer localement

```sh
npm install
cp .env.example .env.local
npm run dev
```

Renseigne ensuite dans `.env.local` les deux variables d'environnement nécessaires :

- `VITE_SUPABASE_URL` : URL de ton projet Supabase ;
- `VITE_SUPABASE_PUBLISHABLE_KEY` : clé publishable Supabase (utilisable côté client).

## Build

```sh
npm run build
```

## Source audio

Les métadonnées des morceaux et les extraits audio proviennent de l'iTunes Search API.
Les previews sont utilisées dans le cadre de ce projet de démonstration.
