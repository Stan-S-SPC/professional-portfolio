import assert from "node:assert/strict";
import test from "node:test";
import { Actions, GameError } from "../src/game/actions.ts";
import { GameStore } from "../src/game/store.ts";
import { STARTERS } from "../src/game/starters.ts";
import { journalPath, pathsFor, questPath } from "../src/notes/schema.ts";
import { AUTO_END, AUTO_START } from "../src/notes/text.ts";
import { MemoryPort } from "./support/memory-port.ts";

const paths = pathsFor("Pixel Quest");
const MON = "2026-10-26";

async function setup(today = MON) {
	const clock = { today };
	const port = new MemoryPort();
	const store = new GameStore(port, () => paths, () => clock.today);
	const actions = new Actions(port, store, () => paths, () => clock.today, () => new Date(2026, 9, 26, 18, 5));
	await store.loadAll();
	store.watch();
	const draft = (name: string, extra = {}) => ({ name, icon: "🎯", skill: "concentration" as const, difficulty: "moyen" as const, days: [0, 1, 2, 3, 4, 5, 6], ...extra });
	return { clock, port, store, actions, draft };
}

test("scaffold crée le guide, les modèles et la note du héros, sans écraser l'existant", async () => {
	const { port, actions } = await setup();
	const { created } = await actions.scaffold();
	assert.ok(created.includes(paths.guide));
	assert.ok(created.some((p) => p.endsWith("Modele - Quete.md")));
	assert.ok(port.files.has(paths.hero));
	assert.match(port.text(paths.guide), /Pixel Quest\/\n/);
	assert.match(port.text(paths.guide), /pq-quete/);
	port.files.get(paths.guide)!.content = "MODIFIÉ PAR L'UTILISATEUR";
	const again = await actions.scaffold();
	assert.deepEqual(again.created, []);
	assert.equal(port.text(paths.guide), "MODIFIÉ PAR L'UTILISATEUR");
	await actions.scaffold({ forceGuide: true });
	assert.match(port.text(paths.guide), /guide du cadre de notes/);
});

test("createQuest écrit une vraie note avec des propriétés lisibles", async () => {
	const { port, store, actions, draft } = await setup();
	const quest = await actions.createQuest(draft("Bloc de travail profond", { days: [1, 2, 3, 4, 5], difficulty: "difficile" }));
	assert.equal(quest.id, "Bloc de travail profond");
	const props = port.props(questPath(paths, "Bloc de travail profond"));
	assert.equal(props["type"], "pq-quete");
	assert.equal(props["competence"], "concentration");
	assert.equal(props["difficulte"], "difficile");
	assert.deepEqual(props["jours"], ["lun", "mar", "mer", "jeu", "ven"]);
	assert.deepEqual(props["periodes"], [`${MON} →`]);
	assert.equal(store.questList().length, 1);
	await assert.rejects(() => actions.createQuest(draft("Bloc de travail profond")), (e) => e instanceof GameError && /existe déjà/.test(e.message));
	await assert.rejects(() => actions.createQuest(draft("   ")), GameError);
	await assert.rejects(() => actions.createQuest(draft("Sans jour", { days: [] })), GameError);
});

test("les caractères interdits dans un nom de note sont retirés", async () => {
	const { actions, draft } = await setup();
	const q = await actions.createQuest(draft('Revue: "OKR" / équipe #1 [Q4]'));
	assert.equal(q.name, "Revue OKR équipe 1 Q4");
});

test("toggleQuest crée la note du jour, écrit un lien, puis l'annule", async () => {
	const { port, store, actions, draft } = await setup();
	await actions.createQuest(draft("Planifier"));
	const r1 = await actions.toggleQuest("Planifier", MON);
	assert.equal(r1.done, true);
	assert.ok(r1.after.totalXp > r1.before.totalXp);
	const day = journalPath(paths, MON);
	assert.deepEqual(port.props(day)["quetes"], ["[[Planifier]]"]);
	assert.equal(port.props(day)["type"], "pq-jour");
	assert.match(port.text(day), /## Notes du jour/);
	assert.deepEqual(store.world().log[MON], ["Planifier"]);

	const r2 = await actions.toggleQuest("Planifier", MON);
	assert.equal(r2.done, false);
	assert.equal(r2.after.totalXp, 0);
	assert.deepEqual(port.props(day)["quetes"], []);
});

test("toggleQuest refuse le futur et les quêtes inconnues", async () => {
	const { actions, draft } = await setup();
	await actions.createQuest(draft("A"));
	await assert.rejects(() => actions.toggleQuest("A", "2026-10-27"), /future/);
	await assert.rejects(() => actions.toggleQuest("Inconnue", MON), /introuvable/);
	await assert.rejects(() => actions.toggleQuest("A", "pas-une-date"), GameError);
});

test("des validations en rafale sont toutes enregistrées (écritures sérialisées)", async () => {
	const { port, actions, draft } = await setup();
	const names = Array.from({ length: 8 }, (_, i) => `Quête ${i + 1}`);
	for (const n of names) await actions.createQuest(draft(n));
	await Promise.all(names.map((n) => actions.toggleQuest(n, MON)));
	assert.equal((port.props(journalPath(paths, MON))["quetes"] as string[]).length, 8);
});

test("un succès débloqué est enregistré une seule fois dans la note du héros", async () => {
	const { port, actions, draft } = await setup();
	await actions.createQuest(draft("A"));
	const r = await actions.toggleQuest("A", MON);
	assert.deepEqual(r.newBadges.map((b) => b.id).sort(), ["first_step", "perfect_1"]);
	const succes = port.props(paths.hero)["succes"] as Record<string, string>;
	assert.equal(succes["first_step"], MON);
	await actions.toggleQuest("A", MON); // annule
	const again = await actions.toggleQuest("A", MON); // revalide
	assert.deepEqual(again.newBadges, [], "déjà débloqués");
	assert.equal((port.props(paths.hero)["succes"] as Record<string, string>)["first_step"], MON);
});

test("une modification externe (agent, autre appareil) est prise en compte", async () => {
	const { port, store, actions, draft } = await setup();
	await actions.createQuest(draft("A"));
	let notified = 0;
	store.subscribe(() => notified++);
	port.external(journalPath(paths, MON), `---\ntype: pq-jour\nquetes:\n  - "[[A]]"\n---\n## Notes du jour\n`);
	await store.flush();
	assert.deepEqual(store.world().log[MON], ["A"]);
	assert.ok(notified >= 1);
	assert.ok(store.progress().totalXp > 0);
});

test("lecture tolérante : liens non guillemetés, alias, chemins, noms simples", async () => {
	const { port, store, actions, draft } = await setup();
	for (const n of ["A", "B", "C", "D"]) await actions.createQuest(draft(n));
	// `quetes: [[A]], ...` non guillemeté est lu par YAML comme un tableau imbriqué
	port.external(journalPath(paths, MON), `---\nquetes: [[A]]\n---\n`);
	await store.flush();
	assert.deepEqual(store.world().log[MON], ["A"]);
	port.external(journalPath(paths, MON), `---\nquetes:\n  - "[[Pixel Quest/Quetes/B|autre nom]]"\n  - C\n  - "[[D#titre]]"\n  - "[[Inexistante]]"\n---\n`);
	await store.flush();
	assert.deepEqual(store.world().log[MON], ["B", "C", "D", "Inexistante"]);
	// la quête inexistante n'apporte rien
	assert.equal(store.progress().totalCompletions, 3);
});

test("seules les notes AAAA-MM-JJ.md comptent comme journées (copies en conflit ignorées)", async () => {
	const { port, store, actions, draft } = await setup();
	await actions.createQuest(draft("A"));
	port.external(`${paths.journal}/2026-10-26 (conflict 2026-10-27).md`, `---\nquetes: ["[[A]]"]\n---\n`);
	port.external(`${paths.journal}/brouillon.md`, `---\nquetes: ["[[A]]"]\n---\n`);
	await store.flush();
	assert.deepEqual(store.journalDates(), []);
});

test("jour de repos : bascule, et ne casse pas la série", async () => {
	const { clock, port, store, actions, draft } = await setup();
	await actions.createQuest(draft("A"));
	await actions.toggleQuest("A", MON);
	assert.equal(await actions.toggleRestDay("2026-10-27"), true);
	assert.equal(port.props(journalPath(paths, "2026-10-27"))["repos"], true);
	clock.today = "2026-10-28";
	await actions.toggleQuest("A", "2026-10-28");
	assert.equal(store.progress().questStats["A"]!.current, 2);
	assert.equal(await actions.toggleRestDay("2026-10-27"), false);
	assert.equal("repos" in port.props(journalPath(paths, "2026-10-27")), false);
	assert.equal(store.progress().questStats["A"]!.current, 1, "sans le repos, le 27 est manqué");
});

test("archiver puis reprendre une quête passe par la propriété periodes", async () => {
	const { clock, port, store, actions, draft } = await setup();
	await actions.createQuest(draft("A"));
	clock.today = "2026-10-30";
	await actions.archiveQuest("A");
	assert.deepEqual(port.props(questPath(paths, "A"))["periodes"], ["2026-10-26 → 2026-10-30"]);
	assert.equal(store.progress().days["2026-10-30"]?.scheduled, 0);
	clock.today = "2026-11-03";
	await actions.restoreQuest("A");
	assert.deepEqual(port.props(questPath(paths, "A"))["periodes"], ["2026-10-26 → 2026-10-30", "2026-11-03 →"]);
	assert.equal(store.progress().days["2026-11-03"]?.scheduled, 1);
	assert.equal(store.progress().days["2026-11-01"]?.scheduled, 0, "la pause n'est pas comptée comme des jours manqués");
});

test("une quête écrite à la main sans propriétés a des valeurs par défaut sensées", async () => {
	const { port, store } = await setup();
	port.external(questPath(paths, "Ma quête manuelle"), "Juste du texte.\n");
	await store.flush();
	const q = store.quest("Ma quête manuelle")!;
	assert.equal(q.skill, "methode");
	assert.equal(q.difficulty, "moyen");
	assert.deepEqual(q.days, [1, 2, 3, 4, 5]);
	assert.equal(q.periods[0]!.to, null);
	assert.equal(q.periods[0]!.from, "2026-10-26");
});

test("renommer une quête conserve son historique (liens mis à jour par Obsidian)", async () => {
	const { port, store, actions, draft } = await setup();
	await actions.createQuest(draft("Ancien nom"));
	await actions.toggleQuest("Ancien nom", MON);
	await actions.updateQuest("Ancien nom", draft("Nouveau nom", { difficulty: "difficile" }));
	assert.deepEqual(store.questList().map((q) => q.name), ["Nouveau nom"]);
	assert.deepEqual(store.world().log[MON], ["Nouveau nom"]);
	assert.equal(store.quest("Nouveau nom")!.difficulty, "difficile");
	assert.deepEqual(port.props(journalPath(paths, MON))["quetes"], ["[[Nouveau nom]]"]);
});

test("renommer fonctionne aussi si la mise à jour automatique des liens est désactivée", async () => {
	const { port, store, actions, draft } = await setup();
	port.updateLinksOnRename = false;
	await actions.createQuest(draft("Ancien"));
	await actions.toggleQuest("Ancien", MON);
	await actions.updateQuest("Ancien", draft("Nouveau"));
	assert.deepEqual(store.world().log[MON], ["Nouveau"]);
	assert.ok(store.progress().totalXp > 0);
});

test("renommer vers un nom déjà pris est refusé sans rien casser", async () => {
	const { store, actions, draft } = await setup();
	await actions.createQuest(draft("A"));
	await actions.createQuest(draft("B"));
	await assert.rejects(() => actions.updateQuest("A", draft("B")), /existe déjà/);
	assert.deepEqual(store.questList().map((q) => q.name).sort(), ["A", "B"]);
});

test("appendNote ajoute sous « Notes du jour », avec heure et lien de quête", async () => {
	const { port, actions, draft } = await setup();
	await actions.createQuest(draft("Réseau"));
	await actions.appendNote(MON, "Café avec Sam\nIdée : proposer un atelier", "Réseau");
	await actions.appendNote(MON, "Seconde note");
	const text = port.text(journalPath(paths, MON));
	assert.match(text, /## Notes du jour\n\n- 18:05 — \[\[Réseau\]\] — Café avec Sam\n {2}Idée : proposer un atelier\n- 18:05 — Seconde note\n/);
	assert.equal(port.props(journalPath(paths, MON))["type"], "pq-jour", "les propriétés sont conservées");
	await assert.rejects(() => actions.appendNote(MON, "   "), /vide/);
});

test("appendNote respecte les sections qui suivent", async () => {
	const { port, actions } = await setup();
	port.external(journalPath(paths, MON), `---\ntype: pq-jour\nquetes: []\n---\n## Notes du jour\n\n- première\n\n## Autre section\n\ntexte\n`);
	await actions.appendNote(MON, "insérée");
	const text = port.text(journalPath(paths, MON));
	assert.ok(text.indexOf("— insérée") < text.indexOf("## Autre section"));
	assert.ok(text.indexOf("- première") < text.indexOf("— insérée"));
	assert.match(text, /texte\n$/);
});

test("revue hebdomadaire : créée puis régénérée sans écraser les réflexions", async () => {
	const { clock, port, actions, draft } = await setup();
	await actions.createQuest(draft("A", { skill: "savoir" }));
	await actions.createQuest(draft("B", { skill: "methode" }));
	clock.today = "2026-10-28";
	for (const d of [MON, "2026-10-27", "2026-10-28"]) await actions.toggleQuest("A", d);
	await actions.toggleQuest("B", MON);

	const first = await actions.generateReview(MON);
	assert.equal(first.created, true);
	assert.equal(first.path, "Pixel Quest/Revues/2026-S44.md");
	const props = port.props(first.path);
	assert.equal(props["type"], "pq-revue");
	assert.equal(props["semaine"], "2026-S44");
	assert.equal(props["quetes_validees"], 4);
	assert.equal(props["quetes_prevues"], 6);
	assert.match(port.text(first.path), /\| \[\[A\]\] \| Savoir \| 3 \| 3 \| 100 % \|/);
	assert.match(port.text(first.path), /\[\[2026-10-26\]\]/);

	// l'utilisateur écrit sa réflexion
	port.files.get(first.path)!.content = port.text(first.path).replace("## Ce qui a bien marché\n", "## Ce qui a bien marché\n\nMa réflexion personnelle.\n");
	clock.today = "2026-10-29";
	await actions.toggleQuest("A", "2026-10-29");
	const second = await actions.generateReview("2026-10-29");
	assert.equal(second.created, false);
	const text = port.text(first.path);
	assert.match(text, /Ma réflexion personnelle\./);
	assert.match(text, /\| \[\[A\]\] \| Savoir \| 4 \| 4 \| 100 % \|/);
	assert.equal(text.split(AUTO_START).length, 2, "un seul bloc généré");
	assert.ok(text.includes(AUTO_END));
	assert.equal(port.props(first.path)["quetes_validees"], 5);
});

test("revue : si les repères ont été supprimés, le bloc est ajouté sans rien perdre", async () => {
	const { port, actions, draft } = await setup();
	await actions.createQuest(draft("A"));
	const { path } = await actions.generateReview(MON);
	port.files.get(path)!.content = "---\ntype: pq-revue\n---\nMon texte libre\n";
	await actions.generateReview(MON);
	assert.match(port.text(path), /Mon texte libre/);
	assert.ok(port.text(path).includes(AUTO_START));
});

test("tableau de bord : écrit une fois, puis seulement si son contenu change", async () => {
	const { port, actions, draft } = await setup();
	await actions.setHero({ name: "Camille", heroClass: "batisseur" });
	await actions.createQuest(draft("A"));
	assert.equal(await actions.flushDashboard(), true);
	const props = port.props(paths.dashboard);
	assert.equal(props["type"], "pq-tableau");
	assert.equal(props["genere"], true);
	assert.equal(props["nom"], "Camille");
	assert.equal(props["classe"], "batisseur");
	assert.equal(props["niveau"], 1);
	assert.deepEqual(props["quetes_actives"], ["A"]);
	assert.ok((props["competences"] as Record<string, unknown>)["concentration"]);
	assert.equal(await actions.flushDashboard(), false, "inchangé : aucune écriture");
	await actions.toggleQuest("A", MON);
	assert.equal(await actions.flushDashboard(), true);
	assert.ok((port.props(paths.dashboard)["xp_total"] as number) > 0);
	actions.dispose();
});

test("la classe donne +25 % d'XP sur ses compétences favorites", async () => {
	const { store, actions, draft } = await setup();
	await actions.createQuest(draft("Focus", { skill: "concentration", difficulty: "difficile" }));
	await actions.setHero({ name: "A", heroClass: "diplomate" });
	await actions.toggleQuest("Focus", MON);
	assert.equal(store.progress().skills.concentration.xp, 40);
	await actions.setHero({ name: "A", heroClass: "batisseur" });
	assert.equal(store.progress().skills.concentration.xp, 50);
	assert.equal(store.hero.heroClass, "batisseur");
});

test("les quêtes de départ sont valides et créables", async () => {
	const { store, actions } = await setup();
	for (const s of STARTERS) await actions.createQuest({ name: s.name, icon: s.icon, skill: s.skill, difficulty: s.difficulty, days: s.days });
	assert.equal(store.questList().length, STARTERS.length);
	assert.equal(new Set(STARTERS.map((s) => s.name)).size, STARTERS.length);
});

test("rechargement complet depuis un vault existant", async () => {
	const a = await setup();
	await a.actions.setHero({ name: "Camille", heroClass: "erudit" });
	await a.actions.createQuest(a.draft("Lire", { skill: "savoir" }));
	await a.actions.toggleQuest("Lire", MON);
	// nouvelle session de plugin sur le même vault
	const store2 = new GameStore(a.port, () => paths, () => MON);
	await store2.loadAll();
	assert.equal(store2.hero.name, "Camille");
	assert.equal(store2.hero.heroClass, "erudit");
	assert.equal(store2.progress().totalXp, a.store.progress().totalXp);
	assert.deepEqual(store2.progress().skills.savoir, a.store.progress().skills.savoir);
});
