# ⚔️ Habit Quest — habit tracker gamifié pour la vie pro

Une application web pour installer des habitudes professionnelles (planification, travail en profondeur,
formation, réseau, feedback…) en les transformant en jeu : **XP, séries, niveaux et succès**.

Aucune dépendance, aucun build, aucun compte : tout tourne dans le navigateur et reste sur ton appareil.

## Lancer l'application

```bash
npm start            # sert le dossier sur http://localhost:8080 (nécessite python3)
```

ou simplement ouvrir `index.html` dans un navigateur récent. Au premier lancement, un écran d'accueil propose
des habitudes pro prêtes à l'emploi.

## Fonctionnalités

- **Aujourd'hui** : valide tes habitudes d'un clic (clavier compatible), anneau de progression, XP du jour,
  correction possible des jours passés.
- **Semaine** : grille habitudes × jours pour valider ou corriger rapidement.
- **Stats** : indicateurs clés, carte de régularité sur 17 semaines, réussite par habitude, XP par catégorie
  (chaque graphique a une vue « Tableau » équivalente).
- **Succès** : 21 succès avec progression (séries, volume, journées parfaites, niveaux, catégories).
- **Habitudes** : création / modification, jours prévus par habitude (ex. lun–ven), difficulté, catégorie,
  suggestions, archivage (mise en pause sans perdre sa série).
- **Jours de repos / congés** : suspendent les habitudes du jour sans casser les séries.
- **Réglages** : thème clair / sombre / auto, export et import JSON, réinitialisation.

## Règles du jeu

| Règle | Détail |
|---|---|
| XP par validation | Facile **10** · Moyen **20** · Difficile **40** |
| Multiplicateur de série | ×1,25 dès 7 jours · ×1,5 dès 14 · ×2 dès 30 (jours *prévus* validés d'affilée) |
| Journée parfaite | Toutes les habitudes prévues du jour validées : **+15 XP** |
| Séries | Un jour prévu manqué remet la série à zéro (le jour en cours reste jouable). Les jours non prévus, de repos ou en pause sont neutres. |
| Niveaux | Niveau N = 50 × (N − 1) × N XP cumulés (100 XP → niv. 2, 300 → niv. 3, 600 → niv. 4…) |
| Titres | Stagiaire → Junior (3) → Spécialiste (6) → Senior (10) → Stratège (15) → Leader (20) → Mentor (30) → Visionnaire (40) → Légende (50) |

L'XP, les séries et les niveaux sont **toujours recalculés** à partir de l'historique des validations : annuler une
validation retire exactement l'XP gagnée, sans dérive possible. Les succès, eux, restent acquis une fois débloqués.

> Modifier les jours prévus d'une habitude s'applique aussi à son historique : les séries sont recalculées.

## Structure

```
index.html          page unique
css/styles.css      styles (thème clair/sombre, responsive, mouvement réduit respecté)
js/core.js          logique de jeu pure, sans DOM (dates, séries, XP, niveaux, succès, import)
js/app.js           interface : rendu, événements, modales, effets, persistance
tests/core.test.js  tests de la logique (node:test)
```

## Tests

```bash
npm test             # 28 tests, Node >= 18, aucune dépendance
```

Les tests couvrent notamment le passage à l'heure d'été/hiver (les dates passent par des numéros de jour UTC),
les séries avec jours non prévus, jours de repos et archivage, les bonus d'XP et la validation des imports
corrompus. Pour vérifier un autre fuseau : `TZ=America/New_York npm test`.

## Données et confidentialité

Les données sont enregistrées dans le `localStorage` du navigateur (clé `habit-quest:v1`), sur cet appareil
uniquement : rien n'est envoyé nulle part. **Exporte régulièrement une sauvegarde JSON** depuis les réglages
(vider les données du site ou changer de navigateur efface la progression). Les fichiers importés sont validés
et nettoyés avant d'être utilisés ; une sauvegarde locale illisible est conservée sous `habit-quest:v1:corrupt`
au lieu d'être écrasée.

## Accessibilité et design

- Navigation et validations entièrement utilisables au clavier ; le focus est conservé après chaque action.
- L'état d'une habitude n'est jamais porté par la couleur seule (coche, bordure pointillée pour un jour manqué).
- Les graphiques suivent une palette validée (écarts de couleur sous daltonisme, contraste, mode sombre
  dédié) : barres à une seule teinte, rampe séquentielle bleue pour la carte de régularité, info-bulles au
  survol, au toucher et au focus, et vue « Tableau » pour chaque graphique.
- `prefers-reduced-motion` désactive confettis et animations.

---

## ⚔️ Pixel Quest — la version RPG pour Obsidian

Habit Quest ci-dessus est une page web autonome. Pour un usage quotidien branché sur ton second brain, le dossier
[`pixel-quest/`](pixel-quest) contient **Pixel Quest**, un plugin Obsidian (ordinateur et mobile) : classes, compétences,
héros et boss en pixel art, et des habitudes stockées comme notes Markdown (quêtes, journal, revues, tableau de bord)
lisibles par toi et par un agent. Installation et détails : [pixel-quest/README.md](pixel-quest/README.md).

