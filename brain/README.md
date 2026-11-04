# 🧠 Brain

Application Android de notes en Markdown, **locale d'abord** et **boostée par l'IA** (API Claude).
Vos notes sont de simples fichiers `.md` avec liens `[[wiki]]` et `#tags`, donc compatibles avec Obsidian.

## Fonctions IA

| Fonction | Principe |
|---|---|
| **Demander** (chat avec vos notes) | RAG : un classement BM25 choisit les notes pertinentes, Claude répond en les citant en `[[Titre]]`. Si les notes ne contiennent pas la réponse, il le dit. |
| **Résumer** une note | Puces concises plus « À retenir », sans rien inventer. |
| **Suggérer tags et liens** | Claude ne peut proposer que des liens vers des notes **existantes** (validé côté code). Un bouton « Appliquer » les ajoute. |
| **Capture intelligente** | « Partager » un texte depuis n'importe quelle appli : l'IA crée une note propre avec titre, `[[liens]]` et tags. Sans clé API, la note est créée brute. |
| **Copier le contexte** | Génère sans réseau un dossier Markdown des notes liées au sujet, à coller dans n'importe quelle IA. |

## Confidentialité

- La clé API reste sur l'appareil (SharedPreferences privées).
- Seules les notes sélectionnées pour une requête sont envoyées à l'API, pas tout le coffre.

## Lancer

1. Ouvrir le dossier `brain/` dans **Android Studio** (Koala ou plus récent, JDK 17).
2. Lancer sur un appareil ou un émulateur (Android 8.0+, `minSdk 26`).
3. Onglet **Réglages** : coller votre clé API Anthropic. Le modèle par défaut est `claude-sonnet-5-5` et il est modifiable.

Tests de la logique pure (liens, BM25, parsing IA) : `./gradlew :app:testDebugUnitTest`.

## Architecture

```
data/  Note, LinkParser, Bm25, Vault (liens/rétroliens/recherche), NoteRepository (fichiers .md)
ai/    ClaudeClient (API Messages via HttpURLConnection), AiService (RAG, résumé, suggestions, capture)
ui/    Jetpack Compose : Notes, Éditeur, Demander, Réglages
```

## Pistes suivantes

- Rendu Markdown et liens cliquables directement dans le texte.
- Embeddings pour la recherche sémantique, en complément de BM25.
- Dictée vocale, widget de capture rapide, synchronisation (Syncthing, Drive).
- Stockage de la clé dans le Keystore.
