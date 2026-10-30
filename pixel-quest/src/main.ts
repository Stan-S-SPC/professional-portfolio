import { FuzzySuggestModal, Notice, Plugin, type App } from "obsidian";
import { todayKey } from "./engine/dates.ts";
import { isScheduled, type Quest } from "./engine/progress.ts";
import { Actions } from "./game/actions.ts";
import { GameStore } from "./game/store.ts";
import { pathsFor, type Paths } from "./notes/schema.ts";
import { ObsidianHost } from "./obsidian/host.ts";
import { ObsidianVaultPort } from "./obsidian/port.ts";
import { DEFAULT_SETTINGS, PixelQuestSettingTab, type PixelQuestSettings } from "./obsidian/settings.ts";
import { PixelQuestView, VIEW_TYPE } from "./obsidian/view.ts";
import type { Ctx } from "./ui/context.ts";
import { openNoteModal, openQuestModal } from "./ui/modals.ts";

/** Sélecteur rapide : valider une quête du jour sans ouvrir la vue (pratique sur mobile). */
class QuestPicker extends FuzzySuggestModal<Quest> {
	private readonly quests: Quest[];
	private readonly onPick: (quest: Quest) => void;

	constructor(app: App, quests: Quest[], onPick: (quest: Quest) => void) {
		super(app);
		this.quests = quests;
		this.onPick = onPick;
		this.setPlaceholder("Quelle quête as-tu accomplie ?");
	}

	getItems(): Quest[] {
		return this.quests;
	}

	getItemText(quest: Quest): string {
		return `${quest.icon} ${quest.name}`;
	}

	onChooseItem(quest: Quest): void {
		this.onPick(quest);
	}
}

export default class PixelQuestPlugin extends Plugin {
	override settings: PixelQuestSettings = { ...DEFAULT_SETTINGS };
	store!: GameStore;
	actions!: Actions;
	host!: ObsidianHost;
	private ctx!: Ctx;
	private resolveReady: () => void = () => undefined;
	private readonly ready = new Promise<void>((resolve) => (this.resolveReady = resolve));

	override async onload(): Promise<void> {
		await this.loadSettings();

		const port = new ObsidianVaultPort(this.app);
		const paths = (): Paths => pathsFor(this.settings.root);
		this.store = new GameStore(port, paths, todayKey);
		this.actions = new Actions(port, this.store, paths, todayKey);
		this.host = new ObsidianHost(this.app);
		this.ctx = { store: this.store, actions: this.actions, host: this.host, paths, today: todayKey };

		this.registerView(VIEW_TYPE, (leaf) => new PixelQuestView(leaf, () => this.ctx, () => this.ready));
		this.addRibbonIcon("swords", "Pixel Quest", () => void this.activateView());
		this.addSettingTab(new PixelQuestSettingTab(this.app, this));
		this.registerCommands();

		// Les événements « create » sont émis pour chaque note au chargement du coffre : on attend la fin.
		this.app.workspace.onLayoutReady(() => void this.start());
	}

	override onunload(): void {
		this.store.dispose();
		this.actions.dispose();
	}

	private async start(): Promise<void> {
		try {
			await this.store.loadAll();
			this.store.watch();
		} catch (err) {
			console.error("[Pixel Quest] chargement impossible", err);
			new Notice("Pixel Quest : impossible de lire les notes du jeu (voir la console).");
		}
		this.resolveReady();
	}

	async loadSettings(): Promise<void> {
		this.settings = { ...DEFAULT_SETTINGS, ...((await this.loadData()) as Partial<PixelQuestSettings> | null) };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		await this.store.loadAll();
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
		if (!leaf) {
			leaf = workspace.getLeaf("tab");
			await leaf.setViewState({ type: VIEW_TYPE, active: true });
		}
		await workspace.revealLeaf(leaf);
	}

	private registerCommands(): void {
		const today = todayKey;
		this.addCommand({ id: "open", name: "Ouvrir Pixel Quest", callback: () => void this.activateView() });
		this.addCommand({
			id: "complete-quest",
			name: "Valider une quête du jour",
			callback: () => {
				const key = today();
				const world = this.store.world();
				const off = new Set(world.offDays);
				const done = new Set(world.log[key] ?? []);
				const todo = world.quests.filter((q) => isScheduled(q, key, off) && !done.has(q.id));
				if (!todo.length) {
					new Notice("Toutes les quêtes du jour sont accomplies, ou aucune n'est prévue.");
					return;
				}
				new QuestPicker(this.app, todo, (quest) => {
					void this.actions
						.toggleQuest(quest.id, key)
						.then((r) => new Notice(`${quest.name} : +${r.after.totalXp - r.before.totalXp} XP${r.after.level.level > r.before.level.level ? ` — niveau ${r.after.level.level} !` : ""}`))
						.catch((err: unknown) => new Notice(String(err)));
				}).open();
			},
		});
		this.addCommand({ id: "quick-note", name: "Ajouter une note au journal du jour", callback: () => openNoteModal(this.ctx, today()) });
		this.addCommand({
			id: "day-note",
			name: "Ouvrir la note du journal du jour",
			callback: () => void this.actions.openDayNote(today()).then((path) => this.host.openNote(path)),
		});
		this.addCommand({ id: "new-quest", name: "Nouvelle quête", callback: () => openQuestModal(this.ctx) });
		this.addCommand({
			id: "weekly-review",
			name: "Générer la revue de la semaine",
			callback: () =>
				void this.actions.generateReview(today()).then(({ path, created }) => {
					new Notice(created ? `Revue créée : ${path}` : `Revue mise à jour : ${path}`);
					this.host.openNote(path);
				}),
		});
		this.addCommand({
			id: "dashboard",
			name: "Ouvrir le tableau de bord",
			callback: () => void this.actions.flushDashboard().then(() => this.host.openNote(this.ctx.paths().dashboard)),
		});
		this.addCommand({
			id: "scaffold",
			name: "Créer ou réparer la structure de notes",
			callback: () => void this.actions.scaffold().then(({ created }) => new Notice(created.length ? `${created.length} note(s) créée(s).` : "La structure est déjà complète.")),
		});
	}
}
