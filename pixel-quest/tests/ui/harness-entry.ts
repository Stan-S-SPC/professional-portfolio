/* Banc d'essai navigateur : le vrai code de l'interface, sur un coffre en mémoire et un faux hôte. */
import { todayKey, addDays } from "../../src/engine/dates.ts";
import { Actions } from "../../src/game/actions.ts";
import { GameStore } from "../../src/game/store.ts";
import { pathsFor, questPath, journalPath } from "../../src/notes/schema.ts";
import { formatDays } from "../../src/engine/rules.ts";
import { guideNote } from "../../src/notes/text.ts";
import { mountApp } from "../../src/ui/app.ts";
import type { Host } from "../../src/ui/context.ts";
import { MemoryPort } from "../support/memory-port.ts";

const params = new URLSearchParams(location.search);
const clock = { today: params.get("today") ?? todayKey() };
const port = new MemoryPort(Date.now() - 100 * 86_400_000);
const paths = pathsFor("Pixel Quest");
const store = new GameStore(port, () => paths, () => clock.today);
const actions = new Actions(port, store, () => paths, () => clock.today);
const opened: string[] = [];
const notices: string[] = [];
let confirmAnswer = true;

let dialog: HTMLDialogElement | null = null;
const host: Host = {
	openNote: (p) => void opened.push(p),
	notice: (m) => void notices.push(m),
	confirm: async () => confirmAnswer,
	modal(build, opts) {
		dialog?.close();
		const d = document.createElement("dialog");
		d.className = "test-dialog";
		let closed = false;
		const close = (): void => {
			if (!closed) d.close();
		};
		d.append(build(close));
		d.addEventListener("close", () => {
			closed = true;
			d.remove();
			opts?.onClose?.();
		});
		document.body.append(d);
		d.showModal();
		dialog = d;
	},
	closeModal: () => dialog?.close(),
};

/* ---------- jeux de données ---------- */

function put(path: string, props: Record<string, unknown>, body = ""): void {
	port.files.set(path, { content: `---\n${port.stringifyProperties(props)}---\n${body}`, ctime: Date.now() - 100 * 86_400_000, mtime: Date.now() });
}

function quest(name: string, o: { icon: string; skill: string; difficulty: string; days: number[]; periods: string[] }): void {
	put(questPath(paths, name), { type: "pq-quete", icone: o.icon, competence: o.skill, difficulte: o.difficulty, jours: formatDays(o.days), periodes: o.periods }, "## Pourquoi cette quête ?\n");
}

function day(date: string, quetes: string[], extra: Record<string, unknown> = {}): void {
	put(journalPath(paths, date), { type: "pq-jour", quetes: quetes.map((q) => `[[${q}]]`), ...extra }, "## Notes du jour\n\n");
}

function seedFull(): void {
	const today = clock.today;
	const start = addDays(today, -69);
	const WEEK = [1, 2, 3, 4, 5];
	const ALL = [0, 1, 2, 3, 4, 5, 6];
	const defs = [
		["Planifier ma journée (3 priorités)", "🗓️", "methode", "facile", WEEK],
		["Bloc de travail profond (90 min)", "🎯", "concentration", "difficile", WEEK],
		["Apprendre 20 minutes", "📚", "savoir", "moyen", ALL],
		["Échanger avec quelqu'un de mon réseau", "🤝", "charisme", "moyen", [2, 4]],
		["Revue de fin de journée", "📝", "methode", "facile", WEEK],
		["Pause active (marche, étirements)", "🚶", "vitalite", "facile", WEEK],
		["Mettre à jour mon portfolio LinkedIn", "🚀", "ambition", "moyen", [5]],
	] as const;
	for (const [name, icon, skill, difficulty, days] of defs) quest(name, { icon, skill, difficulty, days: [...days], periods: [`${start} →`] });
	quest("Newsletter interne", { icon: "📰", skill: "savoir", difficulty: "facile", days: WEEK, periods: [`${start} → ${addDays(today, -20)}`] });
	let seed = 11;
	const rnd = (): number => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
	for (let n = 69; n >= 1; n--) {
		const date = addDays(today, -n);
		if (n >= 25 && n <= 29) {
			day(date, [], { repos: true });
			continue;
		}
		const motivation = 0.55 + 0.4 * Math.min(1, (70 - n) / 40);
		const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
		const done = defs.filter(([, , , , days]) => (days as readonly number[]).includes(wd)).filter(() => rnd() < motivation).map(([name]) => name);
		if (done.length) day(date, done);
	}
	put(paths.hero, { type: "pq-heros", nom: "Camille", classe: "batisseur", succes: { first_step: addDays(today, -68), streak_7: addDays(today, -50) } }, "# Héros\n");
	port.files.set(paths.guide, { content: guideNote(paths), ctime: 0, mtime: 0 });
}

function seedLevelUp(): void {
	const today = clock.today;
	quest("Lire un article", { icon: "📚", skill: "savoir", difficulty: "moyen", days: [0, 1, 2, 3, 4, 5, 6], periods: [`${addDays(today, -3)} →`] });
	day(addDays(today, -3), ["Lire un article"]);
	day(addDays(today, -1), ["Lire un article"]);
	put(paths.hero, { type: "pq-heros", nom: "Alex", classe: "erudit", succes: {} }, "# Héros\n");
}

function seedBoss(): void {
	quest("Revue de code", { icon: "🔍", skill: "concentration", difficulty: "moyen", days: [1, 2, 3, 4, 5], periods: ["2026-10-26 →"] });
	day("2026-10-26", ["Revue de code"]);
	day("2026-10-27", ["Revue de code"]);
	day("2026-10-28", ["Revue de code"]);
	put(paths.hero, { type: "pq-heros", nom: "Sam", classe: "batisseur", succes: { first_step: "2026-10-26", perfect_1: "2026-10-26" } }, "# Héros\n");
}

/** Une quête facile, deux jours déjà validés : valider le mercredi donne une journée parfaite, sans boss ni niveau. */
function seedPerfect(): void {
	quest("Revue de code", { icon: "🔍", skill: "concentration", difficulty: "facile", days: [1, 2, 3, 4, 5], periods: ["2026-10-26 →"] });
	day("2026-10-26", ["Revue de code"]);
	day("2026-10-27", ["Revue de code"]);
	put(paths.hero, { type: "pq-heros", nom: "Sam", classe: "batisseur", succes: { first_step: "2026-10-26", perfect_1: "2026-10-26" } }, "# Héros\n");
}

(async () => {
	const seed = params.get("seed") ?? "none";
	if (seed === "perfect") seedPerfect();
	if (seed === "full") seedFull();
	if (seed === "levelup") seedLevelUp();
	if (seed === "boss") seedBoss();
	await store.loadAll();
	store.watch();
	const app = mountApp(document.getElementById("app")!, { store, actions, host, paths: () => paths, today: () => clock.today });
	Object.assign(window, { pq: { port, store, actions, clock, opened, notices, app, setConfirm: (v: boolean) => (confirmAnswer = v) }, ready: true });
})();
