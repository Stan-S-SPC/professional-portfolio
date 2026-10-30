/* Couche de liaison avec Obsidian, exercée contre une fausse API (voir tests/support/fake-obsidian.ts). */
import assert from "node:assert/strict";
import test from "node:test";
import PixelQuestPlugin from "../src/main.ts";
import { Actions } from "../src/game/actions.ts";
import { GameStore } from "../src/game/store.ts";
import { ObsidianVaultPort } from "../src/obsidian/port.ts";
import { journalPath, pathsFor, questPath } from "../src/notes/schema.ts";
// Même module que celui substitué à `obsidian` par le chargeur (mêmes instances de classes et de statiques).
import { App, FuzzySuggestModal, Notice } from "./support/fake-obsidian.ts";

const paths = pathsFor("Pixel Quest");
const TODAY = "2026-10-26";

function setup() {
	const app = new App();
	const port = new ObsidianVaultPort(app as never);
	const store = new GameStore(port, () => paths, () => TODAY);
	const actions = new Actions(port, store, () => paths, () => TODAY, () => new Date(2026, 9, 26, 9, 0));
	return { app, port, store, actions };
}

test("port : création avec dossiers imbriqués, liste récursive, lecture et stat", async () => {
	const { port, app } = setup();
	await port.create("Pixel Quest/Journal/2026-10-26.md", "---\na: 1\n---\ncorps");
	await port.create("Pixel Quest/Quetes/Sport.md", "x");
	assert.ok(app.vault.folders.has("Pixel Quest") && app.vault.folders.has("Pixel Quest/Journal"));
	assert.deepEqual(port.list("Pixel Quest").map((f) => f.path).sort(), ["Pixel Quest/Journal/2026-10-26.md", "Pixel Quest/Quetes/Sport.md"]);
	assert.deepEqual(port.list("Pixel Quest/Journal").map((f) => f.path), ["Pixel Quest/Journal/2026-10-26.md"]);
	assert.deepEqual(port.list("Inexistant"), []);
	assert.equal(port.stat("Pixel Quest/Quetes/Sport.md")?.path, "Pixel Quest/Quetes/Sport.md");
	assert.equal(port.stat("nope.md"), null);
	assert.equal(await port.read("Pixel Quest/Quetes/Sport.md"), "x");
	await assert.rejects(() => port.create("Pixel Quest/Quetes/Sport.md", "y"));
	await assert.rejects(() => port.read("absent.md"), /introuvable/);
});

test("port : propriétés lues, écrites, ajoutées à une note sans frontmatter", async () => {
	const { port } = setup();
	await port.create("N/a.md", "---\ntype: t\nliste:\n  - x\n---\nCorps\n");
	await port.create("N/b.md", "Juste du texte\n");
	assert.deepEqual(port.parseProperties(await port.read("N/a.md")), { type: "t", liste: ["x"] });
	assert.deepEqual(port.parseProperties("pas de frontmatter"), {});
	assert.deepEqual(port.parseProperties("---\n- a\n- b\n---\n"), {}, "un frontmatter qui n'est pas une table est ignoré");
	await port.updateProperties("N/a.md", (p) => ((p["liste"] as string[]).push("y"), (p["n"] = 2)));
	await port.updateProperties("N/b.md", (p) => (p["type"] = "nouveau"));
	assert.match(await port.read("N/a.md"), /liste:\n {2}- x\n {2}- y\nn: 2\n---\nCorps\n$/);
	assert.match(await port.read("N/b.md"), /^---\ntype: nouveau\n---\nJuste du texte\n$/);
	await port.process("N/b.md", (c) => c + "fin\n");
	assert.match(await port.read("N/b.md"), /fin\n$/);
	assert.match(port.stringifyProperties({ a: ["[[X]]"], b: true }), /a:\n {2}- "\[\[X\]\]"\nb: true/);
});

test("port : renommage avec dossier cible et événements", async () => {
	const { port, app } = setup();
	const seen: string[] = [];
	const off = port.onChange((e) => seen.push(e.type + ":" + e.path + (e.type === "rename" ? "<" + e.oldPath : "")));
	await port.create("A/vieux.md", "[[vieux]]");
	await port.create("A/ref.md", "voir [[vieux]]");
	await port.rename("A/vieux.md", "B/neuf.md");
	assert.ok(app.vault.folders.has("B"));
	assert.equal(port.stat("A/vieux.md"), null);
	assert.ok(port.stat("B/neuf.md"));
	assert.equal(await port.read("A/ref.md"), "voir [[neuf]]");
	assert.ok(seen.includes("rename:B/neuf.md<A/vieux.md"));
	assert.ok(seen.includes("modify:A/ref.md"));
	off();
	const before = seen.length;
	await port.create("A/autre.md", "x");
	assert.equal(seen.length, before, "plus d'événements après désinscription");
	assert.equal(app.vault.listeners("create"), 0, "toutes les références sont retirées");
});

test("port : les dossiers et fichiers non Markdown ne produisent pas d'événements", async () => {
	const { port, app } = setup();
	const seen: string[] = [];
	port.onChange((e) => seen.push(e.path));
	const folder = await app.vault.createFolder("Dossier");
	app.vault.trigger("create", folder);
	assert.deepEqual(seen, []);
});

test("jeu complet sur la fausse API : scaffold, quête, validation, revue, tableau de bord", async () => {
	const { app, store, actions } = setup();
	await store.loadAll();
	store.watch();
	await actions.scaffold();
	await actions.setHero({ name: "Camille", heroClass: "stratege" });
	await actions.createQuest({ name: "Plan", icon: "🗓️", skill: "ambition", difficulty: "moyen", days: [0, 1, 2, 3, 4, 5, 6] });
	const r = await actions.toggleQuest("Plan", TODAY);
	assert.equal(r.done, true);
	assert.equal(r.after.skills.ambition.xp, 25, "Stratège : +25 % sur Ambition");
	assert.match(app.vault.files.get(journalPath(paths, TODAY))!.content, /quetes:\n {2}- "\[\[Plan\]\]"/);
	await actions.generateReview(TODAY);
	await actions.flushDashboard();
	for (const p of [paths.hero, paths.guide, paths.dashboard, "Pixel Quest/Revues/2026-S44.md", questPath(paths, "Plan")]) assert.ok(app.vault.files.has(p), `manque ${p}`);
	await actions.updateQuest("Plan", { name: "Planifier", icon: "🗓️", skill: "ambition", difficulty: "moyen", days: [1, 2, 3, 4, 5] });
	assert.deepEqual(store.world().log[TODAY], ["Planifier"]);
	// un second plugin sur le même coffre retrouve tout
	const store2 = new GameStore(new ObsidianVaultPort(app as never), () => paths, () => TODAY);
	await store2.loadAll();
	assert.equal(store2.progress().totalXp, store.progress().totalXp);
	assert.equal(store2.hero.heroClass, "stratege");
	actions.dispose();
	store.dispose();
});

test("plugin : enregistre vue, icône, réglages et commandes ; la commande de validation rapide fonctionne", async () => {
	const app = new App();
	const plugin = new PixelQuestPlugin(app as never, { id: "pixel-quest" } as never) as unknown as InstanceType<typeof PixelQuestPlugin> & {
		commands: Map<string, { callback: () => void }>;
		views: Map<string, unknown>;
		ribbons: string[];
		tabs: unknown[];
		stored: unknown;
	};
	await plugin.onload();
	await new Promise((r) => setTimeout(r, 20)); // onLayoutReady → start()
	assert.ok(plugin.views.has("pixel-quest-view"));
	assert.deepEqual(plugin.ribbons, ["swords"]);
	assert.equal(plugin.tabs.length, 1);
	for (const id of ["open", "complete-quest", "quick-note", "day-note", "new-quest", "weekly-review", "dashboard", "scaffold"]) assert.ok(plugin.commands.has(id), `commande absente : ${id}`);

	// sans quête : message clair, pas de sélecteur
	Notice.messages.length = 0;
	plugin.commands.get("complete-quest")!.callback();
	assert.match(Notice.messages.at(-1) ?? "", /Toutes les quêtes/);

	// avec une quête prévue aujourd'hui : le sélecteur propose la quête et la valide
	const today = new Date();
	const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
	await plugin.actions.createQuest({ name: "Lire", icon: "📚", skill: "savoir", difficulty: "facile", days: [0, 1, 2, 3, 4, 5, 6] });
	plugin.commands.get("complete-quest")!.callback();
	const picker = FuzzySuggestModal.last!;
	assert.deepEqual((picker.getItems() as { name: string }[]).map((q) => q.name), ["Lire"]);
	assert.equal(picker.getItemText(picker.getItems()[0]), "📚 Lire");
	picker.onChooseItem(picker.getItems()[0]);
	await new Promise((r) => setTimeout(r, 30));
	assert.ok(app.vault.files.get(journalPath(paths, key))?.content.includes("[[Lire]]"));
	assert.match(Notice.messages.at(-1) ?? "", /Lire : \+\d+ XP/);

	// revue : crée la note et l'ouvre
	plugin.commands.get("weekly-review")!.callback();
	await new Promise((r) => setTimeout(r, 30));
	assert.ok([...app.vault.files.keys()].some((p) => p.startsWith("Pixel Quest/Revues/")));
	assert.ok(app.workspace.leaves.some((l) => l.opened.length > 0), "la revue est ouverte dans un onglet");

	// réglage : changer de dossier racine recharge un monde vide
	plugin.settings.root = "Autre";
	await plugin.saveSettings();
	assert.deepEqual(plugin.store.questList(), []);
	assert.deepEqual(plugin.stored, { root: "Autre" });
	plugin.onunload();
});
