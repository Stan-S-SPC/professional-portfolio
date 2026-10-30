/*
 * Toutes les écritures dans le vault passent ici. Elles sont sérialisées (une à la fois) pour
 * éviter les courses quand on valide plusieurs quêtes en rafale, puis le store relit les notes touchées.
 */
import { isKey } from "../engine/dates.ts";
import {
	isArchived,
	newlyReached,
	weekSummary,
	type BadgeStatus,
	type Period,
	type Progress,
	type Quest,
} from "../engine/progress.ts";
import { formatDays, type ClassId } from "../engine/rules.ts";
import {
	TYPES,
	composeNote,
	flattenStrings,
	formatPeriods,
	journalPath,
	linkTarget,
	parsePeriods,
	questPath,
	sanitizeFileName,
	wikilink,
	type Paths,
	type QuestDraft,
} from "../notes/schema.ts";
import {
	appendToNotesSection,
	dashboardBody,
	dashboardProperties,
	dayNoteBody,
	guideNote,
	replaceAutoBlock,
	reviewAutoBlock,
	reviewBody,
	reviewProperties,
	templateNotes,
} from "../notes/text.ts";
import { weekLabel } from "../engine/dates.ts";
import type { VaultPort } from "./port.ts";
import type { GameStore } from "./store.ts";

/** Erreur destinée à être affichée telle quelle à l'utilisateur. */
export class GameError extends Error {}

export interface ToggleResult {
	done: boolean;
	before: Progress;
	after: Progress;
	newBadges: BadgeStatus[];
}

const DASHBOARD_DELAY_MS = 1500;

export class Actions {
	private readonly port: VaultPort;
	private readonly store: GameStore;
	private readonly getPaths: () => Paths;
	private readonly getToday: () => string;
	private readonly now: () => Date;
	private queue: Promise<unknown> = Promise.resolve();
	private dashboardTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(port: VaultPort, store: GameStore, getPaths: () => Paths, getToday: () => string, now: () => Date = () => new Date()) {
		this.port = port;
		this.store = store;
		this.getPaths = getPaths;
		this.getToday = getToday;
		this.now = now;
	}

	private run<T>(fn: () => Promise<T>): Promise<T> {
		const next = this.queue.then(() => fn());
		this.queue = next.then(
			() => undefined,
			() => undefined,
		);
		return next;
	}

	dispose(): void {
		if (this.dashboardTimer) clearTimeout(this.dashboardTimer);
		this.dashboardTimer = null;
	}

	/* ---------- journal ---------- */

	/** Crée la note du jour si besoin et renvoie son chemin. */
	private async ensureJournal(date: string): Promise<string> {
		const path = journalPath(this.getPaths(), date);
		if (!this.port.stat(path)) {
			const yaml = this.port.stringifyProperties({ type: TYPES.day, quetes: [] });
			try {
				await this.port.create(path, composeNote(yaml, dayNoteBody()));
			} catch (err) {
				if (!this.port.stat(path)) throw err; // créée entre-temps par une autre synchronisation : on continue
			}
		}
		return path;
	}

	/** Chemin de la note du jour (créée au besoin), pour l'ouvrir. */
	openDayNote(date: string): Promise<string> {
		return this.run(async () => {
			const path = await this.ensureJournal(date);
			await this.store.reload(path);
			return path;
		});
	}

	toggleQuest(questId: string, date: string): Promise<ToggleResult> {
		return this.run(async () => {
			const today = this.getToday();
			if (!isKey(date) || date > today) throw new GameError("On ne peut pas valider une quête à une date future.");
			if (!this.store.quest(questId)) throw new GameError(`Quête introuvable : ${questId}`);
			const before = this.store.progress();
			const path = await this.ensureJournal(date);
			let done = false;
			await this.port.updateProperties(path, (props) => {
				const current = flattenStrings(props["quetes"]);
				const rest = current.filter((entry) => linkTarget(entry) !== questId);
				done = rest.length === current.length;
				props["quetes"] = done ? [...current, wikilink(questId)] : rest;
				if (!props["type"]) props["type"] = TYPES.day;
			});
			await this.store.reload(path);
			const after = this.store.progress();
			const newBadges = done ? newlyReached(this.store.hero.badges, after) : [];
			if (newBadges.length) await this.recordBadgesNow(newBadges, today);
			this.scheduleDashboard();
			return { done, before, after, newBadges };
		});
	}

	/** Jour de repos / congé ; accepte aussi des dates futures (congés planifiés). */
	toggleRestDay(date: string): Promise<boolean> {
		return this.run(async () => {
			if (!isKey(date)) throw new GameError("Date invalide.");
			const path = await this.ensureJournal(date);
			let rest = false;
			await this.port.updateProperties(path, (props) => {
				if (props["repos"] === true) {
					delete props["repos"];
				} else {
					props["repos"] = true;
					rest = true;
				}
				if (!props["type"]) props["type"] = TYPES.day;
			});
			await this.store.reload(path);
			this.scheduleDashboard();
			return rest;
		});
	}

	/** Ajoute une ligne horodatée sous « Notes du jour », avec un lien vers la quête si précisée. */
	appendNote(date: string, text: string, questId?: string): Promise<string> {
		return this.run(async () => {
			const clean = text.replace(/\r\n/g, "\n").trim();
			if (!clean) throw new GameError("La note est vide.");
			if (!isKey(date)) throw new GameError("Date invalide.");
			const path = await this.ensureJournal(date);
			const t = this.now();
			const time = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
			const [first = "", ...more] = clean.split("\n");
			const prefix = questId ? `- ${time} — ${wikilink(questId)} — ` : `- ${time} — `;
			const line = [prefix + first.trim(), ...more.map((l) => "  " + l.trim())].join("\n");
			await this.port.process(path, (content) => appendToNotesSection(content, line));
			return path;
		});
	}

	/* ---------- quêtes ---------- */

	createQuest(draft: QuestDraft): Promise<Quest> {
		return this.run(async () => {
			const name = sanitizeFileName(draft.name);
			if (!name) throw new GameError("Donne un nom à la quête.");
			if (!draft.days.length) throw new GameError("Choisis au moins un jour de la semaine.");
			const paths = this.getPaths();
			const path = questPath(paths, name);
			if (this.port.stat(path)) throw new GameError(`Une note « ${name} » existe déjà dans les quêtes.`);
			const today = this.getToday();
			const yaml = this.port.stringifyProperties({
				type: TYPES.quest,
				icone: draft.icon.trim() || "⚔️",
				competence: draft.skill,
				difficulte: draft.difficulty,
				jours: formatDays(draft.days),
				periodes: formatPeriods([{ from: today, to: null }]),
			});
			await this.port.create(path, composeNote(yaml, "## Pourquoi cette quête ?\n\n## Critères de réussite\n\n## Retours d'expérience\n"));
			await this.store.reload(path);
			this.scheduleDashboard();
			const quest = this.store.quest(name);
			if (!quest) throw new GameError("La quête n'a pas pu être relue après sa création.");
			return quest;
		});
	}

	updateQuest(questId: string, draft: QuestDraft): Promise<void> {
		return this.run(async () => {
			const paths = this.getPaths();
			let path = this.store.questPath(questId);
			if (!path) throw new GameError(`Quête introuvable : ${questId}`);
			const name = sanitizeFileName(draft.name);
			if (!name) throw new GameError("Donne un nom à la quête.");
			if (!draft.days.length) throw new GameError("Choisis au moins un jour de la semaine.");

			if (name !== questId) {
				const target = questPath(paths, name);
				if (this.port.stat(target)) throw new GameError(`Une note « ${name} » existe déjà dans les quêtes.`);
				const referencing = this.store.journalPathsReferencing(questId);
				await this.port.rename(path, target);
				path = target;
				// Obsidian met à jour les liens selon les préférences de l'utilisateur ; on s'assure nous-mêmes
				// que l'historique suit la quête renommée, quelle que soit cette préférence.
				for (const journal of referencing) {
					await this.port.updateProperties(journal, (props) => {
						props["quetes"] = flattenStrings(props["quetes"]).map((e) => (linkTarget(e) === questId ? wikilink(name) : e));
					});
				}
				await this.store.reloadMany([...referencing, path, oldQuestPath(paths, questId)]);
			}
			await this.port.updateProperties(path, (props) => {
				props["type"] = props["type"] ?? TYPES.quest;
				props["icone"] = draft.icon.trim() || "⚔️";
				props["competence"] = draft.skill;
				props["difficulte"] = draft.difficulty;
				props["jours"] = formatDays(draft.days);
				// Matérialise les périodes déduites (quête créée à la main sans `periodes`).
				if (!props["periodes"]) props["periodes"] = formatPeriods(this.store.quest(name)?.periods ?? this.store.quest(questId)?.periods ?? []);
			});
			await this.store.reloadMany([path, questPath(paths, questId)]);
			this.scheduleDashboard();
		});
	}

	archiveQuest(questId: string): Promise<void> {
		return this.mutatePeriods(questId, (periods, today) => {
			const next = periods.map((p) => (p.to === null ? { from: p.from, to: today } : p));
			return next;
		});
	}

	restoreQuest(questId: string): Promise<void> {
		return this.mutatePeriods(questId, (periods, today) => (periods.some((p) => p.to === null) ? periods : [...periods, { from: today, to: null }]));
	}

	private mutatePeriods(questId: string, fn: (periods: Period[], today: string) => Period[]): Promise<void> {
		return this.run(async () => {
			const path = this.store.questPath(questId);
			const quest = this.store.quest(questId);
			if (!path || !quest) throw new GameError(`Quête introuvable : ${questId}`);
			const today = this.getToday();
			await this.port.updateProperties(path, (props) => {
				const existing = parsePeriods(props["periodes"]);
				props["periodes"] = formatPeriods(fn(existing.length ? existing : quest.periods, today));
			});
			await this.store.reload(path);
			this.scheduleDashboard();
		});
	}

	/* ---------- héros ---------- */

	private async ensureHero(): Promise<string> {
		const path = this.getPaths().hero;
		if (!this.port.stat(path)) {
			const yaml = this.port.stringifyProperties({ type: TYPES.hero, nom: "", classe: null, succes: {} });
			await this.port.create(path, composeNote(yaml, "# Héros\n\nNotes libres sur ton parcours : motivations, objectifs, citations.\n"));
		}
		return path;
	}

	setHero(hero: { name: string; heroClass: ClassId }): Promise<void> {
		return this.run(async () => {
			const path = await this.ensureHero();
			await this.port.updateProperties(path, (props) => {
				props["type"] = props["type"] ?? TYPES.hero;
				props["nom"] = hero.name.trim().slice(0, 40);
				props["classe"] = hero.heroClass;
				if (!props["succes"] || typeof props["succes"] !== "object") props["succes"] = {};
			});
			await this.store.reload(path);
			this.scheduleDashboard();
		});
	}

	private async recordBadgesNow(badges: BadgeStatus[], date: string): Promise<void> {
		const path = await this.ensureHero();
		await this.port.updateProperties(path, (props) => {
			const raw = props["succes"];
			const succes: Record<string, unknown> = raw && typeof raw === "object" && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
			for (const b of badges) succes[b.id] = date;
			props["succes"] = succes;
		});
		await this.store.reload(path);
	}

	/* ---------- structure de notes ---------- */

	/** Crée ce qui manque : guide, modèles, note du héros. `forceGuide` réécrit le guide. */
	scaffold(opts: { forceGuide?: boolean } = {}): Promise<{ created: string[] }> {
		return this.run(async () => {
			const paths = this.getPaths();
			const created: string[] = [];
			const put = async (path: string, content: string, overwrite = false): Promise<void> => {
				if (this.port.stat(path)) {
					if (!overwrite) return;
					await this.port.process(path, () => content);
				} else {
					await this.port.create(path, content);
					created.push(path);
				}
			};
			await put(paths.guide, guideNote(paths), opts.forceGuide === true);
			for (const t of templateNotes(paths)) await put(t.path, t.content);
			await this.ensureHero();
			await this.store.reload(paths.hero);
			return { created };
		});
	}

	/* ---------- revue hebdomadaire & tableau de bord ---------- */

	generateReview(anyDayOfWeek: string): Promise<{ path: string; created: boolean }> {
		return this.run(async () => {
			const paths = this.getPaths();
			const progress = this.store.progress();
			const summary = weekSummary(this.store.world(), progress, anyDayOfWeek);
			const days = this.store.journalDates().filter((d) => d >= summary.weekStart && d <= summary.weekEnd);
			const input = { summary, journalDays: days, paths };
			const path = `${paths.reviews}/${weekLabel(summary.weekStart)}.md`;
			if (!this.port.stat(path)) {
				await this.port.create(path, composeNote(this.port.stringifyProperties(reviewProperties(input)), reviewBody(input)));
				return { path, created: true };
			}
			const block = reviewAutoBlock(input);
			await this.port.process(path, (content) => replaceAutoBlock(content, block) ?? `${content.replace(/\s*$/, "")}\n\n${block}\n`);
			await this.port.updateProperties(path, (props) => Object.assign(props, reviewProperties(input)));
			return { path, created: false };
		});
	}

	scheduleDashboard(): void {
		if (this.dashboardTimer) clearTimeout(this.dashboardTimer);
		this.dashboardTimer = setTimeout(() => void this.flushDashboard().catch((e) => console.warn("[Pixel Quest] tableau de bord", e)), DASHBOARD_DELAY_MS);
	}

	/** Réécrit le tableau de bord, seulement si son contenu a changé (limite le bruit de synchronisation). */
	flushDashboard(): Promise<boolean> {
		if (this.dashboardTimer) clearTimeout(this.dashboardTimer);
		this.dashboardTimer = null;
		return this.run(async () => {
			const paths = this.getPaths();
			if (!this.store.hero.exists && !this.store.questList().length) return false;
			const input = {
				name: this.store.hero.name,
				heroClass: this.store.hero.heroClass,
				progress: this.store.progress(),
				quests: this.store.questList(),
				today: this.getToday(),
			};
			const content = composeNote(this.port.stringifyProperties(dashboardProperties(input)), dashboardBody(input));
			if (this.port.stat(paths.dashboard)) {
				if ((await this.port.read(paths.dashboard)) === content) return false;
				await this.port.process(paths.dashboard, () => content);
			} else {
				await this.port.create(paths.dashboard, content);
			}
			return true;
		});
	}

	/** Pour l'interface : quêtes actives / archivées. */
	static partition(quests: Quest[]): { active: Quest[]; archived: Quest[] } {
		return { active: quests.filter((q) => !isArchived(q)), archived: quests.filter(isArchived) };
	}
}

/** Ancien chemin d'une quête renommée (pour purger le cache). */
function oldQuestPath(paths: Paths, questId: string): string {
	return questPath(paths, questId);
}
