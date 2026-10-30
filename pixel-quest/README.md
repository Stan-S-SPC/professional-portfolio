# ⚔️ Pixel Quest — plugin Obsidian

Un habit tracker **RPG en pixel art** qui vit dans Obsidian (ordinateur **et** mobile) et alimente ton second brain :
chaque habitude est une **quête**, chaque jour une **note de journal**, et tes progrès s'écrivent dans des notes
Markdown que tu peux lire, éditer, lier… ou faire lire à un agent.

## Ce que ça fait

- **Classes** (Bâtisseur, Érudit, Diplomate, Stratège, Sage) : +25 % d'XP sur deux compétences favorites.
- **6 compétences** (Savoir, Charisme, Concentration, Vitalité, Ambition, Méthode) avec niveaux et rangs.
- **Héros pixel art** dont l'équipement évolue avec ton titre (de Novice à Légende) : écharpe, cape, épaulières, heaume, couronne, aura, armure.
- **Boss hebdomadaire** : valide 80 % des quêtes prévues de la semaine pour le vaincre (+50 XP). 5 boss : le Gobelin des Mails, le Golem des Réunions, l'Hydre du Backlog, le Spectre des Notifications, le Dragon de la Deadline.
- **Séries**, journées parfaites, jours de repos/congés qui ne cassent rien, 25 succès avec progression.
- **Second brain** : notes de quêtes, journal quotidien (avec « Notes du jour » liées aux quêtes), revue hebdomadaire générée, tableau de bord lisible par un agent, guide du cadre de notes et modèles.

## Installation

Le plugin n'est pas (encore) dans le catalogue officiel : il s'installe à la main ou via BRAT. **Active d'abord les plugins
communautaires** dans Obsidian (Réglages → Plugins communautaires). Prérequis : Obsidian ≥ 1.5.7.

### À la main (ordinateur ou Android)

1. Récupère le dossier [`pixel-quest/dist`](dist) du dépôt (bouton vert **Code → Download ZIP** sur GitHub, ou `git pull` si tu as cloné le dépôt, par exemple dans Termux).
2. Copie ses trois fichiers `main.js`, `manifest.json` et `styles.css` dans le dossier **`<ton vault>/.obsidian/plugins/pixel-quest/`** (crée-le s'il n'existe pas ; `.obsidian` est un dossier caché).
3. Redémarre Obsidian, puis active **Pixel Quest** dans Réglages → Plugins communautaires.

À refaire sur chaque appareil : le dossier `.obsidian` n'est pas synchronisé par la plupart des outils de synchro de notes
(et c'est volontaire : les *notes* du jeu, elles, se synchronisent comme toutes les autres).

### Via BRAT (mises à jour automatiques)

Quand un *release* existe sur GitHub (voir « Publier une version » plus bas), installe le plugin **BRAT** puis
*Add beta plugin* avec l'adresse du dépôt. Fonctionne aussi sur mobile.

## Premier lancement

Clique sur l'icône ⚔️ du ruban (ou commande **Ouvrir Pixel Quest**). Choisis un nom, une classe et tes quêtes de départ :
le plugin crée le dossier **`Pixel Quest/`** dans ton vault (modifiable dans les réglages) avec le guide et les modèles.

## Le cadre de notes (« harnais »)

```
Pixel Quest/
├── Heros.md              nom, classe, succès débloqués
├── Tableau de bord.md    état courant — GÉNÉRÉ, lisible par un agent
├── Guide.md              le schéma complet des notes, pour toi et pour un agent
├── Quetes/               une note par quête   (type: pq-quete)
├── Journal/              une note par jour    (type: pq-jour, nom = AAAA-MM-JJ)
├── Revues/               une revue par semaine (type: pq-revue)
└── Modeles/              modèles pour le plugin « Modèles » d'Obsidian
```

Exemple de note de journal : les quêtes validées sont des **liens** (rétroliens dans chaque quête, rename-safe).

```markdown
---
type: pq-jour
quetes:
  - "[[Bloc de travail profond (90 min)]]"
  - "[[Planifier ma journée (3 priorités)]]"
---
## Notes du jour

- 18:05 — [[Bloc de travail profond (90 min)]] — Atelier OKR : décider du périmètre.
```

- **Les notes sont la source de vérité.** XP, niveaux, séries et boss sont *recalculés* à partir d'elles : modifier une note
  à la main (ou par un agent) est pris en compte immédiatement, et annuler une validation retire exactement l'XP gagnée.
- Un agent peut **lire** `Tableau de bord.md` et **valider** une quête en ajoutant un lien dans `quetes` : tout est décrit dans `Guide.md`.
- Les noms de dossiers structurants sont volontairement en ASCII (`Quetes`, `Heros`…) pour éviter tout problème d'accents
  entre systèmes de fichiers et outils de synchronisation. Tes quêtes, elles, peuvent porter n'importe quel nom.

## Commandes (palette de commandes)

| Commande | Effet |
|---|---|
| Ouvrir Pixel Quest | ouvre la vue de jeu |
| Valider une quête du jour | sélecteur rapide, pratique sur mobile |
| Ajouter une note au journal du jour | note horodatée sous « Notes du jour », liée à une quête |
| Ouvrir la note du journal du jour | crée la note du jour si besoin |
| Nouvelle quête | crée la note de quête |
| Générer la revue de la semaine | crée/met à jour `Revues/AAAA-Snn.md` (tes réflexions sont conservées) |
| Ouvrir le tableau de bord | |
| Créer ou réparer la structure de notes | crée ce qui manque, ne modifie jamais tes quêtes ni ton journal |

## Règles du jeu

| | |
|---|---|
| XP par validation | Facile 10 · Moyen 20 · Difficile 40 |
| Série (jours prévus d'affilée) | ×1,25 dès 7 · ×1,5 dès 14 · ×2 dès 30 |
| Classe | +25 % sur ses 2 compétences favorites |
| Journée parfaite | +15 XP |
| Boss de la semaine | 80 % des quêtes prévues validées (5 minimum) : +50 XP |
| Niveau de héros N | 50 × (N − 1) × N XP cumulés (100 → niv. 2, 300 → niv. 3…) |
| Niveau de compétence N | 25 × (N − 1) × N XP |
| Titres | Novice → Initié (3) → Adepte (6) → Vétéran (10) → Champion (15) → Héros (20) → Mythe (30) → Légende (40) |

Un jour non prévu, de repos ou en pause ne casse jamais une série ; un jour prévu manqué la remet à zéro.

## À savoir

- **Tests** : le moteur, les notes et la liaison avec Obsidian sont testés, ainsi que l'interface dans un navigateur sur un
  coffre simulé. **Le plugin n'a pas pu être lancé dans un vrai Obsidian pendant son développement** : un premier essai sur
  ton vault peut révéler des détails que les tests ne voient pas. Signale-les.
- **Changer de classe recalcule tout l'historique** (le bonus s'applique rétroactivement).
- **Synchronisation** : si deux appareils modifient la même note de journal en même temps, ton outil de synchro peut créer une
  copie « en conflit » (ignorée par le jeu car son nom n'est pas une date) : fusionne les listes `quetes` à la main.
  Le tableau de bord peut simplement être supprimé : il se régénère.
- **Quête renommée dans Obsidian** : les liens du journal suivent si l'option « Mettre à jour automatiquement les liens
  internes » est active (par défaut). Renommer depuis le Grimoire du plugin répare les liens dans tous les cas.

## Développement

```bash
cd pixel-quest
npm ci
npm run typecheck   # TypeScript strict, contre les types officiels d'Obsidian
npm test            # 49 tests (node:test, TypeScript exécuté directement par Node ≥ 22.18)
npm run build       # → dist/main.js, dist/manifest.json, dist/styles.css  (à committer)
npm run test:ui     # scénarios dans Chromium via Playwright (à installer à part)
```

Architecture, de la plus pure à la plus fine couche :

```
src/engine/    règles et calculs purs (XP, séries, boss, succès)        — testé
src/notes/     schéma des notes, lecture tolérante, textes générés     — testé
src/game/      store (cache des notes) + actions (écritures sérialisées) derrière VaultPort — testé
src/ui/        interface DOM, sprites pixel art, modales (indépendante d'Obsidian) — testé en navigateur
src/obsidian/  adaptateurs Obsidian (coffre, modales, vue, réglages) + src/main.ts — typé + testé sur fausse API
```

### Publier une version

Mets à jour `version` dans `manifest.json` et `package.json`, lance `npm run build`, committe `dist/`, puis
`git tag X.Y.Z && git push origin X.Y.Z` : le workflow GitHub crée le release (assets pour BRAT).

## Licences

Code : MIT. Police « Press Start 2P » © The Press Start 2P Project Authors, [SIL OFL 1.1](OFL.txt). Palette de base : Sweetie 16 (GrafxKid).
Les sprites sont dessinés en code pour ce projet.
