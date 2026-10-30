/* Textes générés dans le vault : guide du cadre de notes, modèles, revue hebdomadaire, tableau de bord. */
import { DISPLAY_ORDER, CLASSES, DIFFICULTIES, SKILLS, SKILL_IDS, formatDays, type ClassId } from "../engine/rules.ts";
import { weekLabel } from "../engine/dates.ts";
import { isArchived, type Progress, type Quest, type WeekSummary } from "../engine/progress.ts";
import { TYPES, type Paths, wikilink } from "./schema.ts";

export const NOTES_HEADING = "## Notes du jour";
export const AUTO_START = "<!-- pq:auto:start -->";
export const AUTO_END = "<!-- pq:auto:end -->";

const pct = (r: number | null): string => (r === null ? "–" : `${Math.round(r * 100)} %`);
const frDay = (key: string): string => `${key.slice(8)}/${key.slice(5, 7)}`;
const cell = (text: string): string => text.replace(/\|/g, "\\|");

/* ------------------------------------------------------------------ */
/* Guide                                                               */
/* ------------------------------------------------------------------ */

export function guideNote(paths: Paths): string {
	const skills = SKILL_IDS.map((s) => `| \`${s}\` | ${SKILLS[s].label} | ${SKILLS[s].blurb} |`).join("\n");
	const difficulties = Object.entries(DIFFICULTIES).map(([id, d]) => `| \`${id}\` | ${d.label} | ${d.xp} XP |`).join("\n");
	const classes = Object.entries(CLASSES)
		.map(([id, c]) => `| \`${id}\` | ${c.label} | ${c.favored.map((s) => SKILLS[s].label).join(", ")} |`)
		.join("\n");
	const days = DISPLAY_ORDER.map((d) => formatDays([d])[0]).join(", ");
	return `# Pixel Quest — guide du cadre de notes

Ce guide décrit comment Pixel Quest range ses données dans ton vault. Il s'adresse à toi **et** à tout agent
(par exemple un assistant IA) qui lit ou écrit dans ces notes. Tout est du Markdown avec des propriétés (frontmatter) :
aucune base de données cachée. Le plugin recalcule XP, niveaux, séries et boss à partir de ces notes.

## Arborescence

\`\`\`
${paths.root}/
├── Heros.md              profil : nom, classe, succès débloqués
├── Tableau de bord.md    état courant (GÉNÉRÉ, ne pas modifier)
├── Guide.md              ce guide
├── Quetes/               une note par quête (habitude)
├── Journal/              une note par jour : AAAA-MM-JJ.md
├── Revues/               une revue par semaine : AAAA-Snn.md
└── Modeles/              modèles pour le plugin « Modèles » d'Obsidian (à ignorer pour l'analyse)
\`\`\`

## Types de notes

Chaque note du jeu a une propriété \`type\`.

### Quête — \`${TYPES.quest}\` (dans \`Quetes/\`)

| Propriété | Valeurs | Rôle |
|---|---|---|
| \`icone\` | un emoji | affichage |
| \`competence\` | ${SKILL_IDS.map((s) => `\`${s}\``).join(", ")} | compétence qui gagne l'XP |
| \`difficulte\` | ${Object.keys(DIFFICULTIES).map((d) => `\`${d}\``).join(", ")} | XP de base |
| \`jours\` | liste parmi ${days} (ou \`tous\`, \`semaine\`) | jours où la quête est prévue |
| \`periodes\` | liste de \`AAAA-MM-JJ →\` (en cours) ou \`AAAA-MM-JJ → AAAA-MM-JJ\` (en pause) | périodes d'activité ; le dernier jour n'est pas inclus |

Le **nom de la note** est l'identifiant de la quête. Renomme-la dans Obsidian : les liens du journal suivent.
Le corps de la note est libre : pourquoi cette quête, critères de réussite, retours d'expérience.
Pour archiver une quête, ferme sa dernière période (\`2026-10-26 → 2026-11-10\`) ; pour la reprendre, ajoute \`2026-11-20 →\`.

### Jour — \`${TYPES.day}\` (dans \`Journal/\`, nom de fichier = date)

| Propriété | Valeurs | Rôle |
|---|---|---|
| \`quetes\` | liste de liens \`"[[Nom de la quête]]"\` | **quêtes validées ce jour-là** |
| \`repos\` | \`true\` | jour de repos / congé : aucune quête prévue, aucune série cassée |

Le corps contient une section \`${NOTES_HEADING}\` : tes notes, idées et retours de la journée. Les liens vers les quêtes y
créent des rétroliens dans la note de chaque quête.

### Héros — \`${TYPES.hero}\` (\`Heros.md\`)

| Propriété | Valeurs |
|---|---|
| \`nom\` | texte |
| \`classe\` | ${Object.keys(CLASSES).map((c) => `\`${c}\``).join(", ")} |
| \`succes\` | table \`identifiant: date de déblocage\` |

### Revue — \`${TYPES.review}\` (dans \`Revues/\`) et Tableau de bord — \`${TYPES.dashboard}\`

Notes **générées**. Le tableau de bord est réécrit à chaque changement : ne le modifie pas. Dans une revue, seul
le bloc entre \`${AUTO_START}\` et \`${AUTO_END}\` est régénéré ; tout ce qui est écrit en dehors est conservé.

## Règles du jeu

- XP d'une validation : XP de la difficulté × multiplicateur de série × bonus de classe (+25 % sur ses deux compétences favorites).
- Multiplicateur de série (jours prévus validés d'affilée) : ×1,25 dès 7, ×1,5 dès 14, ×2 dès 30.
- Journée parfaite (toutes les quêtes prévues validées) : +15 XP.
- Boss hebdomadaire : vaincu quand au moins 80 % des quêtes prévues de la semaine sont validées (5 quêtes prévues minimum) : +50 XP.
- Niveau N de héros : 50 × (N − 1) × N XP cumulés. Niveau N de compétence : 25 × (N − 1) × N XP cumulés.

### Difficultés

| Valeur | Libellé | XP de base |
|---|---|---|
${difficulties}

### Compétences

| Valeur | Libellé | Contenu |
|---|---|---|
${skills}

### Classes

| Valeur | Libellé | Compétences favorites |
|---|---|---|
${classes}

## Pour un agent : lire et écrire sans casser le jeu

- **Lire l'état** : ouvre \`${paths.dashboard.slice(paths.root.length + 1)}\` (niveau, XP, compétences, séries, boss, quêtes actives).
- **Valider une quête** : ajoute \`"[[Nom de la quête]]"\` à la propriété \`quetes\` de la note du jour (crée-la si besoin avec \`type: ${TYPES.day}\`). Ne valide jamais une date future.
- **Ajouter une note** : ajoute une ligne sous \`${NOTES_HEADING}\`, par exemple \`- 18:30 — [[Nom de la quête]] — ce qui s'est passé\`.
- **Créer une quête** : crée une note dans \`Quetes/\` avec les propriétés ci-dessus (modèle dans \`Modeles/\`).
- **Ne pas faire** : modifier \`Tableau de bord.md\`, inventer des valeurs hors des listes ci-dessus, supprimer une note de journal pour « annuler » (retire plutôt le lien dans \`quetes\`).
- Le plugin relit les notes dès qu'elles changent : pas besoin de le prévenir.

## Synchronisation

Si tu synchronises le vault entre plusieurs appareils, les notes du jeu se synchronisent comme n'importe quelle note.
Si deux appareils modifient la même note de journal en même temps, ton outil de synchronisation peut créer une copie
« en conflit » : fusionne les deux listes \`quetes\` à la main. Le tableau de bord, lui, peut simplement être supprimé :
il se régénère.
`;
}

/* ------------------------------------------------------------------ */
/* Modèles (pour le plugin « Modèles » d'Obsidian)                     */
/* ------------------------------------------------------------------ */

export function templateNotes(paths: Paths): { path: string; content: string }[] {
	return [
		{
			path: `${paths.templates}/Modele - Quete.md`,
			content: `---
type: ${TYPES.quest}
modele: true
icone: ⚔️
competence: methode
difficulte: moyen
jours: [lun, mar, mer, jeu, ven]
periodes:
  - "{{date}} →"
---
## Pourquoi cette quête ?

## Critères de réussite

## Retours d'expérience
`,
		},
		{
			path: `${paths.templates}/Modele - Jour.md`,
			content: `---
type: ${TYPES.day}
modele: true
quetes: []
---
${NOTES_HEADING}

`,
		},
		{
			path: `${paths.templates}/Modele - Revue.md`,
			content: `---
type: ${TYPES.review}
modele: true
---
${AUTO_START}
${AUTO_END}

## Ce qui a bien marché

## À améliorer

## Intentions pour la semaine prochaine
`,
		},
	];
}

/* ------------------------------------------------------------------ */
/* Journal                                                             */
/* ------------------------------------------------------------------ */

export function dayNoteBody(): string {
	return `${NOTES_HEADING}\n\n`;
}

/** Ajoute une ligne à la fin de la section « Notes du jour » (la crée si elle manque). */
export function appendToNotesSection(content: string, line: string): string {
	const normalized = content.replace(/\r\n/g, "\n");
	const heading = normalized.indexOf(NOTES_HEADING);
	if (heading < 0) {
		const base = normalized.replace(/\s*$/, "");
		return `${base}\n\n${NOTES_HEADING}\n\n${line}\n`;
	}
	const afterHeading = heading + NOTES_HEADING.length;
	const next = normalized.slice(afterHeading).search(/\n#{1,6} /);
	const end = next < 0 ? normalized.length : afterHeading + next;
	const before = normalized.slice(0, end).replace(/\s*$/, "");
	// Section vide : on garde une ligne vide sous le titre, comme dans la note créée par le plugin.
	const sep = before.endsWith(NOTES_HEADING) ? "\n\n" : "\n";
	const rest = normalized.slice(end);
	return `${before}${sep}${line}\n${rest.startsWith("\n") ? rest : "\n" + rest}`.replace(/\n+$/, "\n");
}

/* ------------------------------------------------------------------ */
/* Revue hebdomadaire                                                  */
/* ------------------------------------------------------------------ */

export interface ReviewInput {
	summary: WeekSummary;
	/** jours de la semaine pour lesquels une note de journal existe */
	journalDays: string[];
	paths: Paths;
}

export function reviewProperties(input: ReviewInput): Record<string, unknown> {
	const { summary: s } = input;
	return {
		type: TYPES.review,
		semaine: weekLabel(s.weekStart),
		debut: s.weekStart,
		fin: s.weekEnd,
		xp: s.xp,
		taux: s.rate === null ? null : Math.round(s.rate * 100),
		quetes_validees: s.done,
		quetes_prevues: s.scheduled,
		jours_parfaits: s.perfectDays,
		jours_repos: s.restDays,
		boss: s.boss ? s.boss.boss.name : null,
		boss_vaincu: s.boss ? s.boss.defeated : null,
	};
}

export function reviewAutoBlock(input: ReviewInput): string {
	const { summary: s, journalDays } = input;
	const lines: string[] = [AUTO_START, `> Bloc généré par Pixel Quest : il est mis à jour à chaque génération. Écris tes réflexions en dehors des repères.`, ""];
	if (s.boss) {
		const b = s.boss;
		lines.push(`**Boss : ${b.boss.name}** — ${b.defeated ? "vaincu ✅" : b.slots < 5 ? "semaine trop légère pour un boss" : "encore debout"} (${b.damage} / ${b.required} dégâts requis, ${b.slots} quêtes prévues sur la semaine)`, "");
	}
	lines.push(`**XP de la semaine :** ${s.xp} · **Taux de réussite :** ${pct(s.rate)} (${s.done}/${s.scheduled}) · **Journées parfaites :** ${s.perfectDays} · **Jours de repos :** ${s.restDays}`, "");
	if (s.perQuest.length) {
		lines.push("| Quête | Compétence | Validées | Prévues | Taux |", "|---|---|---|---|---|");
		for (const r of s.perQuest) {
			lines.push(`| ${wikilink(cell(r.quest.name))} | ${SKILLS[r.quest.skill].label} | ${r.done} | ${r.scheduled} | ${pct(r.scheduled ? r.done / r.scheduled : null)} |`);
		}
		lines.push("");
	}
	const gained = SKILL_IDS.filter((id) => s.skillXp[id] > 0).map((id) => `${SKILLS[id].label} +${s.skillXp[id]}`);
	if (gained.length) lines.push(`**XP par compétence :** ${gained.join(" · ")}`, "");
	if (journalDays.length) lines.push("**Journal :** " + journalDays.map((d) => wikilink(d)).join(" · "), "");
	lines.push(AUTO_END);
	return lines.join("\n");
}

export function reviewTitle(summary: WeekSummary): string {
	return `# Revue ${weekLabel(summary.weekStart)} (${frDay(summary.weekStart)} → ${frDay(summary.weekEnd)})`;
}

export function reviewBody(input: ReviewInput): string {
	return `${reviewTitle(input.summary)}\n\n${reviewAutoBlock(input)}\n\n## Ce qui a bien marché\n\n## À améliorer\n\n## Intentions pour la semaine prochaine\n`;
}

/** Remplace le bloc généré en conservant tout le reste ; renvoie null si les repères sont introuvables. */
export function replaceAutoBlock(content: string, block: string): string | null {
	const start = content.indexOf(AUTO_START);
	const end = content.indexOf(AUTO_END);
	if (start < 0 || end < start) return null;
	return content.slice(0, start) + block + content.slice(end + AUTO_END.length);
}

/* ------------------------------------------------------------------ */
/* Tableau de bord                                                     */
/* ------------------------------------------------------------------ */

export interface DashboardInput {
	name: string;
	heroClass: ClassId | null;
	progress: Progress;
	quests: Quest[];
	today: string;
}

export function dashboardProperties(input: DashboardInput): Record<string, unknown> {
	const { progress: p } = input;
	const competences: Record<string, unknown> = {};
	for (const id of SKILL_IDS) {
		const s = p.skills[id];
		competences[id] = { niveau: s.level, rang: s.rank, xp: s.xp };
	}
	const boss = p.bosses.find((b) => b.current) ?? null;
	return {
		type: TYPES.dashboard,
		genere: true,
		maj: input.today,
		nom: input.name || null,
		classe: input.heroClass,
		niveau: p.level.level,
		titre: p.level.title,
		xp_total: p.totalXp,
		xp_avant_niveau_suivant: p.level.toNext,
		serie_en_cours: p.currentStreak,
		serie_record: p.bestStreak,
		jours_parfaits: p.perfectDays,
		quetes_validees: p.totalCompletions,
		boss_vaincus: p.bossesDefeated,
		boss_semaine: boss ? boss.boss.name : null,
		boss_degats: boss ? `${boss.damage}/${boss.required}` : null,
		competences,
		quetes_actives: input.quests.filter((q) => !isArchived(q)).map((q) => q.name),
	};
}

export function dashboardBody(input: DashboardInput): string {
	const { progress: p, quests } = input;
	const cls = input.heroClass ? CLASSES[input.heroClass].label : "sans classe";
	const lines: string[] = [
		`# Tableau de bord — ${input.name || "Héros"}, ${cls}`,
		"",
		"> Note générée par Pixel Quest et réécrite à chaque changement : ne la modifie pas.",
		"",
		`**Niveau ${p.level.level} · ${p.level.title}** — ${p.totalXp} XP (encore ${p.level.toNext} avant le niveau ${p.level.level + 1}).`,
		`Série en cours : ${p.currentStreak} j · record : ${p.bestStreak} j · journées parfaites : ${p.perfectDays} · boss vaincus : ${p.bossesDefeated}.`,
		"",
		"## Compétences",
		"",
		"| Compétence | Niveau | Rang | XP | Validations |",
		"|---|---|---|---|---|",
		...SKILL_IDS.map((id) => {
			const s = p.skills[id];
			return `| ${SKILLS[id].label}${s.favored ? " ★" : ""} | ${s.level} | ${s.rank} | ${s.xp} | ${s.count} |`;
		}),
		"",
	];
	const boss = p.bosses.find((b) => b.current);
	if (boss) {
		lines.push("## Boss de la semaine", "", `${boss.boss.name} — ${boss.damage} / ${boss.required} dégâts requis${boss.defeated ? " (vaincu ✅)" : ""}.`, "");
	}
	const active = quests.filter((q) => !isArchived(q));
	lines.push("## Quêtes actives", "");
	if (active.length) {
		lines.push("| Quête | Compétence | Difficulté | Jours | Série | Record |", "|---|---|---|---|---|---|");
		for (const q of active) {
			const st = p.questStats[q.id];
			lines.push(`| ${wikilink(cell(q.name))} | ${SKILLS[q.skill].label} | ${DIFFICULTIES[q.difficulty].label} | ${formatDays(q.days).join(", ")} | ${st?.current ?? 0} | ${st?.best ?? 0} |`);
		}
	} else {
		lines.push("Aucune quête active.");
	}
	return lines.join("\n") + "\n";
}
