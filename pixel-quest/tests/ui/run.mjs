// Tests de l'interface dans Chromium (Playwright doit être résoluble, ex. via NODE_PATH).
import { build } from "esbuild";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildStyles } from "../../scripts/build.mjs";
import { writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SHOTS = process.env.PQ_SHOTS ?? join(root, ".test-build/shots");
mkdirSync(SHOTS, { recursive: true });
mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist/styles.css"), buildStyles());
await build({ entryPoints: [join(root, "tests/ui/harness-entry.ts")], bundle: true, outfile: join(root, ".test-build/harness.js"), format: "iife", target: "es2020", logLevel: "error" });

const URL = (q = "") => pathToFileURL(join(root, "tests/ui/harness.html")).href + q;
const browser = await chromium.launch();
const problems = [];
let passed = 0;

async function open(query, viewport = { width: 420, height: 900 }, opts = {}) {
	const ctx = await browser.newContext({ viewport, locale: "fr-FR", timezoneId: "Europe/Paris", ...opts });
	const page = await ctx.newPage();
	page.on("console", (m) => ["error", "warning"].includes(m.type()) && problems.push(`${query} ${m.type()}: ${m.text()}`));
	page.on("pageerror", (e) => problems.push(`${query} pageerror: ${e.message}`));
	await page.goto(URL(query));
	await page.waitForFunction(() => window.ready === true);
	return { page, ctx };
}
const shot = (page, name, full = true) => page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: full });
async function scenario(name, fn) {
	try {
		await fn();
		passed++;
		console.log(`  ✓ ${name}`);
	} catch (err) {
		console.error(`  ✗ ${name}\n`, err);
		process.exitCode = 1;
	}
}
const noOverflow = async (page, label) => {
	const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
	assert.ok(over <= 0, `${label} : la page déborde de ${over}px`);
};
const waitText = (page, sel, re) => page.waitForFunction(([s, r]) => new RegExp(r).test(document.querySelector(s)?.textContent ?? ""), [sel, re.source]);

console.log("Pixel Quest — tests d'interface");

await scenario("premier lancement : création du héros, structure de notes et quêtes de départ", async () => {
	const { page, ctx } = await open("?today=2026-10-28"); // un mercredi
	await page.waitForSelector("dialog[open] .pq-class-grid");
	await shot(page, "01-creation", false);
	// sans classe, la création est refusée
	await page.fill("#pq-name", "Camille");
	await page.click("dialog button[type=submit]");
	assert.match(await page.textContent("dialog .pq-error"), /classe/);
	await page.click('dialog input[value="erudit"]');
	await page.click("dialog button[type=submit]");
	await page.waitForFunction(() => !document.querySelector("dialog[open]"));
	await page.waitForSelector(".pq-quest");
	assert.match(await page.textContent(".pq-name"), /Camille/);
	assert.match(await page.textContent(".pq-sub"), /Érudit · Niv\. 1 Novice/);
	const files = await page.evaluate(() => [...window.pq.port.files.keys()]);
	for (const f of ["Pixel Quest/Heros.md", "Pixel Quest/Guide.md", "Pixel Quest/Modeles/Modele - Quete.md"]) assert.ok(files.includes(f), `manquant : ${f}`);
	assert.equal(files.filter((f) => f.startsWith("Pixel Quest/Quetes/")).length, 5, "5 quêtes de départ cochées par défaut");
	assert.equal(await page.evaluate(() => window.pq.port.props("Pixel Quest/Heros.md").classe), "erudit");
	await noOverflow(page, "accueil");
	await ctx.close();
});

await scenario("valider des quêtes : XP, journée parfaite, notes écrites dans le journal", async () => {
	const { page, ctx } = await open("?seed=perfect&today=2026-10-28"); // mercredi : 2 jours déjà validés
	await page.waitForSelector(".pq-quest");
	const before = await page.textContent(".pq-chip:nth-of-type(2)");
	await page.click(".pq-quest-main");
	await page.waitForSelector(".pq-quest.done");
	await page.waitForSelector(".pq-banner");
	assert.match(await page.textContent(".pq-summary-head"), /1 quête accomplie sur 1/);
	assert.match(await page.textContent(".pq-toast"), /Journée parfaite/);
	const note = await page.evaluate(() => window.pq.port.text("Pixel Quest/Journal/2026-10-28.md"));
	assert.match(note, /quetes:\n {2}- "\[\[Revue de code\]\]"/);
	assert.match(note, /type: pq-jour/);
	// annuler
	await page.click(".pq-quest-main");
	await page.waitForFunction(() => !document.querySelector(".pq-quest.done"));
	assert.equal(await page.textContent(".pq-chip:nth-of-type(2)"), before);
	await ctx.close();
});

await scenario("montée de niveau : fenêtre de célébration et nouveau grade", async () => {
	const { page, ctx } = await open("?seed=levelup");
	await page.waitForSelector(".pq-quest");
	await page.click(".pq-quest-main");
	await page.waitForSelector("dialog[open] .pq-celebrate");
	assert.match(await page.textContent("dialog h2"), /Niveau 2/);
	await page.waitForTimeout(1300);
	assert.ok((await page.$$(".pq-toast")).length >= 2, "toasts de succès");
	await shot(page, "02-levelup", false);
	await page.keyboard.press("Escape");
	await page.waitForFunction(() => !document.querySelector("dialog[open]"));
	assert.match(await page.textContent(".pq-sub"), /Niv\. 2/);
	await ctx.close();
});

await scenario("boss hebdomadaire vaincu : fenêtre de victoire et bonus d'XP", async () => {
	const { page, ctx } = await open("?seed=boss&today=2026-10-30"); // vendredi : 3 coups portés, 4 requis
	await page.waitForSelector(".pq-quest");
	await page.click(".pq-quest-main");
	await page.waitForSelector("dialog[open] .pq-celebrate");
	assert.match(await page.textContent("dialog h2"), /Boss vaincu/);
	await shot(page, "03-boss-victory", false);
	await page.keyboard.press("Escape");
	await page.click('.pq-tab:has-text("Boss")');
	await page.waitForSelector(".pq-boss.defeated");
	assert.match(await page.textContent(".pq-boss"), /VAINCU/);
	const bonus = await page.evaluate(() => window.pq.store.progress().xpBreakdown.bosses);
	assert.equal(bonus, 50);
	await ctx.close();
});

await scenario("historique complet : les quatre onglets, sans débordement (mobile et bureau)", async () => {
	for (const [label, viewport] of [["mobile", { width: 390, height: 900 }], ["desktop", { width: 1100, height: 900 }]]) {
		const { page, ctx } = await open("?seed=full&today=2026-10-30", viewport);
		await page.waitForSelector(".pq-quest");
		await noOverflow(page, `${label}/quêtes`);
		await shot(page, `10-${label}-quetes`);
		for (const [tab, sel] of [["Héros", ".pq-skills"], ["Boss", ".pq-week"], ["Grimoire", ".pq-manage-list"]]) {
			await page.click(`.pq-tab:has-text("${tab}")`);
			await page.waitForSelector(sel);
			await noOverflow(page, `${label}/${tab}`);
			await shot(page, `11-${label}-${tab.toLowerCase()}`);
		}
		await ctx.close();
	}
});

await scenario("nouvelle quête, modification (renommage), archivage et reprise", async () => {
	const { page, ctx } = await open("?seed=full&today=2026-10-30");
	await page.click('.pq-tab:has-text("Grimoire")');
	await page.waitForSelector(".pq-manage-list");
	const count = async () => (await page.$$(".pq-manage:not(.archived)")).length;
	const n0 = await count();
	await page.click("text=+ Nouvelle quête");
	await page.waitForSelector("dialog[open] form");
	await page.click("dialog button[type=submit]");
	assert.match(await page.textContent("dialog .pq-error"), /nom/);
	await page.fill("#pq-qname", 'Préparer le comité <b>de pilotage</b>');
	await page.click('dialog input[value="difficile"]');
	await page.click('dialog input[value="ambition"]');
	await shot(page, "04-quest-form", false);
	await page.click("dialog button[type=submit]");
	await page.waitForFunction(() => !document.querySelector("dialog[open]"));
	await page.waitForFunction((n) => document.querySelectorAll(".pq-manage:not(.archived)").length === n + 1, n0);
	assert.equal(await page.$(".pq-manage .pq-link b"), null, "pas d'injection HTML");
	const created = await page.evaluate(() => window.pq.port.props("Pixel Quest/Quetes/Préparer le comité b de pilotage b.md"));
	assert.equal(created.difficulte, "difficile");
	assert.equal(created.competence, "ambition");

	// renommer une quête existante : l'historique suit
	const xpBefore = await page.evaluate(() => window.pq.store.progress().totalXp);
	await page.click('[aria-label="Modifier Revue de fin de journée"]');
	await page.waitForSelector("dialog[open] form");
	await page.fill("#pq-qname", "Revue du soir");
	await page.click("dialog button[type=submit]");
	await page.waitForFunction(() => !document.querySelector("dialog[open]"));
	await page.waitForSelector('[aria-label="Modifier Revue du soir"]');
	assert.equal(await page.evaluate(() => window.pq.store.progress().totalXp), xpBefore, "XP inchangée après renommage");

	// archiver puis reprendre
	await page.click('[aria-label="Archiver Revue du soir"]');
	await page.waitForFunction((n) => document.querySelectorAll(".pq-manage:not(.archived)").length === n, n0);
	await page.click(".pq-details summary");
	await page.click('.pq-manage.archived button:has-text("Reprendre")');
	await page.waitForFunction((n) => document.querySelectorAll(".pq-manage:not(.archived)").length === n + 1, n0);
	await ctx.close();
});

await scenario("notes : ajout au journal avec lien vers la quête, revue hebdomadaire", async () => {
	const { page, ctx } = await open("?seed=full&today=2026-10-30");
	await page.waitForSelector(".pq-quest");
	await page.click('[aria-label="Ajouter une note à « Planifier ma journée (3 priorités) »"]');
	await page.waitForSelector("dialog[open] textarea");
	await page.fill("#pq-note", "Atelier OKR : décider du périmètre.\nÀ relancer lundi.");
	await shot(page, "05-note", false);
	await page.click('dialog button:text-is("Ajouter")');
	await page.waitForFunction(() => !document.querySelector("dialog[open]"));
	const day = await page.evaluate(() => window.pq.port.text("Pixel Quest/Journal/2026-10-30.md"));
	assert.match(day, /## Notes du jour\n\n- \d\d:\d\d — \[\[Planifier ma journée \(3 priorités\)\]\] — Atelier OKR : décider du périmètre\.\n {2}À relancer lundi\./);
	// revue
	await page.click('.pq-tab:has-text("Boss")');
	await page.click("text=Générer la revue de la semaine");
	await page.waitForFunction(() => window.pq.opened.length > 0);
	const path = await page.evaluate(() => window.pq.opened[0]);
	assert.equal(path, "Pixel Quest/Revues/2026-S44.md");
	const review = await page.evaluate((p) => window.pq.port.text(p), path);
	assert.match(review, /type: pq-revue/);
	assert.match(review, /\| \[\[Planifier ma journée \(3 priorités\)\]\] \| Méthode \|/);
	await ctx.close();
});

await scenario("une modification externe (agent, synchronisation) met l'interface à jour", async () => {
	const { page, ctx } = await open("?seed=boss&today=2026-10-29");
	await page.waitForSelector(".pq-quest");
	assert.equal(await page.$(".pq-quest.done"), null);
	await page.evaluate(() => window.pq.port.external("Pixel Quest/Journal/2026-10-29.md", '---\ntype: pq-jour\nquetes:\n  - "[[Revue de code]]"\n---\n## Notes du jour\n'));
	await page.waitForSelector(".pq-quest.done");
	assert.match(await page.textContent(".pq-summary-head"), /1 quête accomplie sur 1/);
	await ctx.close();
});

await scenario("jour de repos, navigation dans le passé, pas de futur", async () => {
	const { page, ctx } = await open("?seed=boss&today=2026-10-29");
	await page.waitForSelector(".pq-quest");
	await page.click(".pq-switch");
	await page.waitForFunction(() => /Jour de repos/.test(document.querySelector(".pq-summary-head")?.textContent ?? ""));
	assert.equal(await page.$(".pq-quest"), null);
	assert.equal(await page.evaluate(() => window.pq.port.props("Pixel Quest/Journal/2026-10-29.md").repos), true);
	await page.click('[aria-label="Jour précédent"]');
	assert.match(await page.textContent(".pq-nav-title h2"), /mercredi 28 octobre/i);
	assert.equal(await page.isDisabled('[aria-label="Jour suivant"]'), false);
	await page.click('[aria-label="Jour suivant"]');
	assert.equal(await page.isDisabled('[aria-label="Jour suivant"]'), true);
	await ctx.close();
});

await scenario("clavier seul : Espace valide, le focus reste sur la quête", async () => {
	const { page, ctx } = await open("?seed=full&today=2026-10-30");
	await page.waitForSelector(".pq-quest");
	await page.focus(".pq-quest-main");
	const id = await page.evaluate(() => document.activeElement.dataset.focusId);
	await page.keyboard.press("Space");
	await page.waitForSelector(".pq-quest.done");
	assert.equal(await page.evaluate(() => document.activeElement.dataset.focusId), id);
	assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-pressed")), "true");
	await ctx.close();
});

await scenario("changement de classe : l'XP est recalculée", async () => {
	const { page, ctx } = await open("?seed=full&today=2026-10-30");
	await page.click('.pq-tab:has-text("Héros")');
	const xp1 = await page.evaluate(() => window.pq.store.progress().totalXp);
	await page.click("text=Changer de classe");
	await page.waitForSelector("dialog[open] .pq-class-grid");
	await page.click('dialog input[value="diplomate"]');
	await page.click('dialog button:has-text("Choisir cette classe")');
	await page.waitForFunction(() => !document.querySelector("dialog[open]"));
	await page.waitForFunction((x) => window.pq.store.progress().totalXp !== x, xp1);
	assert.match(await page.textContent(".pq-identity"), /Diplomate/);
	await ctx.close();
});

await browser.close();
console.log(`\n${passed} scénarios réussis.`);
if (problems.length) {
	console.error("Problèmes de console :", problems);
	process.exitCode = 1;
} else console.log("Console : aucune erreur ni avertissement.");
