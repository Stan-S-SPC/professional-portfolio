/*
 * Le « monde » du jeu, reconstruit à partir des notes du vault et tenu à jour quand elles changent.
 * Source de vérité = les notes ; ce store n'est qu'un cache en mémoire.
 */
import type { Progress, Quest, World } from "../engine/progress.ts";
import { computeProgress, firstActiveDay } from "../engine/progress.ts";
import {
	basename,
	emptyHero,
	isUnder,
	parseHeroNote,
	parseJournalNote,
	parseQuestNote,
	type HeroNote,
	type JournalEntry,
	type Paths,
} from "../notes/schema.ts";
import type { PortEvent, VaultPort } from "./port.ts";

const DEBOUNCE_MS = 150;
const READ_CONCURRENCY = 12;

export class GameStore {
	hero: HeroNote = emptyHero();
	private quests = new Map<string, Quest>();
	private journal = new Map<string, JournalEntry>();
	private listeners = new Set<() => void>();
	private version = 0;
	private cache: { version: number; today: string; progress: Progress } | null = null;
	private pending = new Set<string>();
	private timer: ReturnType<typeof setTimeout> | null = null;
	private unwatch: (() => void) | null = null;

	private readonly port: VaultPort;
	private readonly getPaths: () => Paths;
	private readonly getToday: () => string;

	constructor(port: VaultPort, getPaths: () => Paths, getToday: () => string) {
		this.port = port;
		this.getPaths = getPaths;
		this.getToday = getToday;
	}

	/* ---------- lecture ---------- */

	questList(): Quest[] {
		return [...this.quests.values()].sort((a, b) => {
			const fa = firstActiveDay(a);
			const fb = firstActiveDay(b);
			return fa < fb ? -1 : fa > fb ? 1 : a.name.localeCompare(b.name, "fr");
		});
	}

	quest(id: string): Quest | undefined {
		for (const q of this.quests.values()) if (q.id === id) return q;
		return undefined;
	}

	questPath(id: string): string | undefined {
		for (const [path, q] of this.quests) if (q.id === id) return path;
		return undefined;
	}

	journalEntry(date: string): JournalEntry | undefined {
		for (const e of this.journal.values()) if (e.date === date) return e;
		return undefined;
	}

	journalDates(): string[] {
		return [...this.journal.values()].map((e) => e.date).sort();
	}

	/** Notes de journal dont la liste `quetes` référence cette quête. */
	journalPathsReferencing(questId: string): string[] {
		return [...this.journal].filter(([, e]) => e.quests.includes(questId)).map(([path]) => path);
	}

	world(): World {
		const log: Record<string, string[]> = {};
		const offDays: string[] = [];
		for (const e of this.journal.values()) {
			if (e.quests.length) log[e.date] = e.quests;
			if (e.rest) offDays.push(e.date);
		}
		return { quests: this.questList(), log, offDays: offDays.sort(), heroClass: this.hero.heroClass, badges: this.hero.badges };
	}

	progress(): Progress {
		const today = this.getToday();
		if (this.cache && this.cache.version === this.version && this.cache.today === today) return this.cache.progress;
		const progress = computeProgress(this.world(), today);
		this.cache = { version: this.version, today, progress };
		return progress;
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/* ---------- chargement ---------- */

	async loadAll(): Promise<void> {
		const paths = this.getPaths();
		this.quests.clear();
		this.journal.clear();
		this.hero = emptyHero();
		const files = [...this.port.list(paths.quests), ...this.port.list(paths.journal)];
		for (let i = 0; i < files.length; i += READ_CONCURRENCY) {
			await Promise.all(files.slice(i, i + READ_CONCURRENCY).map((f) => this.load(f.path)));
		}
		await this.load(paths.hero);
		this.touch();
	}

	/** Relit une note et met le cache à jour (création, modification ou suppression). */
	async reload(path: string): Promise<void> {
		await this.load(path);
		this.touch();
	}

	async reloadMany(paths: Iterable<string>): Promise<void> {
		for (const p of paths) await this.load(p);
		this.touch();
	}

	private async load(path: string): Promise<void> {
		const paths = this.getPaths();
		const file = this.port.stat(path);
		const inQuests = isUnder(path, paths.quests);
		const inJournal = isUnder(path, paths.journal);
		if (!inQuests && !inJournal && path !== paths.hero) return;
		if (!file) {
			this.quests.delete(path);
			this.journal.delete(path);
			if (path === paths.hero) this.hero = emptyHero();
			return;
		}
		try {
			const props = this.port.parseProperties(await this.port.read(path));
			if (inQuests) {
				const quest = parseQuestNote(file, props);
				if (quest) this.quests.set(path, quest);
				else this.quests.delete(path);
			} else if (inJournal) {
				const entry = parseJournalNote(path, props);
				if (entry) this.journal.set(path, entry);
				else this.journal.delete(path);
			} else {
				this.hero = parseHeroNote(props);
			}
		} catch (err) {
			console.warn(`[Pixel Quest] note illisible : ${path}`, err);
			this.quests.delete(path);
			this.journal.delete(path);
		}
	}

	/* ---------- suivi des changements du coffre ---------- */

	watch(): void {
		this.unwatch?.();
		this.unwatch = this.port.onChange((event) => this.handle(event));
	}

	dispose(): void {
		this.unwatch?.();
		this.unwatch = null;
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
		this.listeners.clear();
	}

	private handle(event: PortEvent): void {
		this.pending.add(event.path);
		if (event.type === "rename") this.pending.add(event.oldPath);
		if (this.timer) clearTimeout(this.timer);
		this.timer = setTimeout(() => void this.flush(), DEBOUNCE_MS);
	}

	/** Traite tout de suite les changements en attente (utile aux tests). */
	async flush(): Promise<void> {
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
		const batch = [...this.pending];
		this.pending.clear();
		if (!batch.length) return;
		const paths = this.getPaths();
		const relevant = batch.filter((p) => isUnder(p, paths.quests) || isUnder(p, paths.journal) || p === paths.hero);
		if (!relevant.length) return;
		await this.reloadMany(relevant);
	}

	private touch(): void {
		this.version++;
		for (const fn of [...this.listeners]) fn();
	}

	/** Nom lisible d'une quête à partir de son identifiant (liens orphelins inclus). */
	static label(id: string): string {
		return basename(id);
	}
}
