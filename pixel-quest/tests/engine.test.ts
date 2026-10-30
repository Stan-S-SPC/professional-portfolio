import assert from "node:assert/strict";
import test from "node:test";
import { addDays, isKey, isoWeek, startOfWeek, weekKeys, weekLabel } from "../src/engine/dates.ts";
import {
	BADGES,
	completionXp,
	computeProgress,
	emptyWorld,
	evaluateBadges,
	isArchived,
	levelInfo,
	newlyReached,
	skillLevelInfo,
	streakMultiplier,
	weekSummary,
	xpForLevel,
	xpPreview,
	type Quest,
	type World,
} from "../src/engine/progress.ts";
import { formatDays, parseClass, parseDays, parseDifficulty, parseSkill } from "../src/engine/rules.ts";

// 2026-10-26 est un lundi.
const MON = "2026-10-26";
const day = (n: number): string => addDays(MON, n);
const ALL = [0, 1, 2, 3, 4, 5, 6];

function quest(id: string, extra: Partial<Quest> = {}): Quest {
	return { id, name: id, icon: "🎯", skill: "concentration", difficulty: "moyen", days: ALL, periods: [{ from: MON, to: null }], ...extra };
}

function world(quests: Quest[], done: Record<string, number[]> = {}, extra: Partial<World> = {}): World {
	const w: World = { ...emptyWorld(), quests, ...extra };
	for (const [id, offsets] of Object.entries(done)) for (const n of offsets) (w.log[day(n)] ??= []).push(id);
	return w;
}

/* ---------- dates ---------- */

test("semaines ISO", () => {
	assert.deepEqual(isoWeek("2026-10-26"), { year: 2026, week: 44 });
	assert.deepEqual(isoWeek("2026-01-01"), { year: 2026, week: 1 });
	assert.deepEqual(isoWeek("2027-01-01"), { year: 2026, week: 53 }); // vendredi : rattaché à la dernière semaine de 2026
	assert.deepEqual(isoWeek("2024-12-30"), { year: 2025, week: 1 }); // lundi : déjà la semaine 1 de 2025
	assert.equal(weekLabel("2026-10-30"), "2026-S44");
	assert.equal(weekLabel("2026-03-02"), "2026-S10");
});

test("arithmétique de dates et changements d'heure", () => {
	assert.equal(addDays("2026-03-28", 2), "2026-03-30");
	assert.equal(addDays("2026-10-24", 2), "2026-10-26");
	assert.equal(startOfWeek("2026-11-01"), MON);
	assert.deepEqual(weekKeys("2026-10-28"), [0, 1, 2, 3, 4, 5, 6].map(day));
	assert.ok(isKey("2028-02-29"));
	assert.ok(!isKey("2026-02-30"));
});

/* ---------- niveaux ---------- */

test("niveaux de héros et de compétence", () => {
	for (let level = 1; level <= 60; level++) {
		assert.equal(levelInfo(xpForLevel(level)).level, level);
		assert.equal(levelInfo(xpForLevel(level + 1) - 1).level, level);
	}
	assert.equal(skillLevelInfo(49).level, 1);
	assert.equal(skillLevelInfo(50).level, 2);
	assert.equal(skillLevelInfo(150).level, 3);
	assert.equal(skillLevelInfo(150).rank, "Initié");
	assert.equal(skillLevelInfo(0).rank, "Novice");
});

test("titres et équipement suivent le niveau", () => {
	assert.equal(levelInfo(0).title, "Novice");
	assert.equal(levelInfo(0).tier, 0);
	assert.equal(levelInfo(xpForLevel(6)).title, "Adepte");
	assert.equal(levelInfo(xpForLevel(6)).tier, 2);
	assert.deepEqual(levelInfo(xpForLevel(6)).nextTitle, { title: "Vétéran", level: 10 });
	assert.equal(levelInfo(xpForLevel(40)).nextTitle, null);
});

/* ---------- XP et classes ---------- */

test("multiplicateur de série et bonus de classe se cumulent", () => {
	assert.equal(streakMultiplier(6), 1);
	assert.equal(streakMultiplier(7), 1.25);
	const q = quest("a", { difficulty: "difficile", skill: "concentration" });
	assert.equal(completionXp(q, 0, null), 40);
	assert.equal(completionXp(q, 0, "batisseur"), 50); // Bâtisseur favorise Concentration
	assert.equal(completionXp(q, 0, "diplomate"), 40); // pas Diplomate
	assert.equal(completionXp(q, 14, "batisseur"), 40 * 1.5 * 1.25);
	assert.equal(completionXp(quest("b", { difficulty: "facile" }), 7, "erudit"), Math.round(10 * 1.25 * 1.25));
});

test("l'XP d'une validation va aussi à la compétence correspondante", () => {
	const w = world([quest("a", { skill: "savoir", difficulty: "difficile" }), quest("b", { skill: "methode", difficulty: "facile" })], { a: [0], b: [0] }, { heroClass: "erudit" });
	const p = computeProgress(w, day(0));
	assert.equal(p.skills.savoir.xp, 50); // 40 × 1,25 (Érudit favorise Savoir)
	assert.equal(p.skills.methode.xp, 10);
	assert.equal(p.skills.savoir.favored, true);
	assert.equal(p.skills.methode.favored, false);
	assert.equal(p.xpBreakdown.completions, 60);
	assert.equal(p.xpBreakdown.perfectDays, 15);
	assert.equal(p.totalXp, 75);
	assert.equal(p.skills.savoir.level, 2);
});

test("changer de classe recalcule l'historique (état dérivé)", () => {
	const quests = [quest("a", { skill: "ambition", difficulty: "moyen" })];
	const base = computeProgress(world(quests, { a: [0, 1] }), day(1)).totalXp;
	const withClass = computeProgress(world(quests, { a: [0, 1] }, { heroClass: "stratege" }), day(1)).totalXp;
	assert.equal(withClass - base, 2 * 5); // 20 → 25 par validation
});

test("annuler une validation retire exactement l'XP gagnée", () => {
	const quests = [quest("a"), quest("b")];
	const all = { a: [0, 1, 2, 3, 4, 5, 6, 7], b: [0, 1, 2, 3, 4, 5, 6, 7] };
	const full = computeProgress(world(quests, all), day(7)).totalXp;
	const missing = computeProgress(world(quests, { ...all, a: all.a.filter((n) => n !== 3) }), day(7)).totalXp;
	assert.ok(missing < full);
});

/* ---------- séries ---------- */

test("série : jour manqué = zéro ; aujourd'hui en attente ne casse rien", () => {
	const w = world([quest("a")], { a: [0, 1, 2, 4] });
	const stat = computeProgress(w, day(4)).questStats.a!;
	assert.equal(stat.best, 3);
	assert.equal(stat.current, 1);
	const pending = computeProgress(world([quest("a")], { a: [0, 1, 2] }), day(3)).questStats.a!;
	assert.equal(pending.current, 3);
	assert.equal(computeProgress(world([quest("a")], { a: [0, 1, 2] }), day(4)).questStats.a!.current, 0);
});

test("série : jours non prévus, repos et pause sont neutres", () => {
	const weekdays = world([quest("a", { days: [1, 2, 3, 4, 5] })], { a: [0, 1, 2, 3, 4, 7] });
	assert.equal(computeProgress(weekdays, day(7)).questStats.a!.current, 6);
	const off = world([quest("a")], { a: [0, 1, 3] }, { offDays: [day(2)] });
	assert.equal(computeProgress(off, day(3)).questStats.a!.current, 3);
	const paused = quest("a", { periods: [{ from: MON, to: day(3) }, { from: day(8), to: null }] });
	const w = world([paused], { a: [0, 1, 2, 8, 9] });
	const stat = computeProgress(w, day(9)).questStats.a!;
	assert.equal(stat.best, 5);
	assert.ok(isArchived(quest("x", { periods: [{ from: MON, to: day(3) }] })));
	assert.ok(!isArchived(paused));
});

/* ---------- journées parfaites ---------- */

test("journée parfaite, série de journées parfaites", () => {
	const w = world([quest("a"), quest("b")], { a: [0, 1, 2, 3], b: [0, 1, 2] });
	const p = computeProgress(w, day(3));
	assert.equal(p.perfectDays, 3);
	assert.equal(p.perfectStreak.current, 3); // aujourd'hui incomplet ne casse pas la série
	assert.equal(computeProgress(w, day(4)).perfectStreak.current, 0);
});

/* ---------- boss ---------- */

test("boss : vaincu quand 80 % des quêtes de la semaine sont validées", () => {
	// 1 quête quotidienne = 7 créneaux ; 80 % → 6 coups requis
	const five = world([quest("a")], { a: [0, 1, 2, 3, 4] });
	let boss = computeProgress(five, day(4)).bosses[0]!;
	assert.equal(boss.slots, 7);
	assert.equal(boss.required, 6);
	assert.equal(boss.damage, 5);
	assert.equal(boss.defeated, false);
	assert.equal(boss.current, true);

	const six = world([quest("a")], { a: [0, 1, 2, 3, 4, 5] });
	const p = computeProgress(six, day(5));
	boss = p.bosses[0]!;
	assert.equal(boss.defeated, true);
	assert.equal(boss.defeatedOn, day(5));
	assert.equal(p.bossesDefeated, 1);
	assert.equal(p.xpBreakdown.bosses, 50);
	// jour du coup fatal : validation (série < 7 → 20) + journée parfaite (15, une seule quête) + bonus de boss (50)
	assert.equal(p.xpByDay[day(5)], 20 + 15 + 50);
});

test("boss : une semaine trop légère n'a pas de boss à vaincre", () => {
	const w = world([quest("a", { days: [1, 3] })], { a: [0, 2] }); // 2 créneaux seulement
	const boss = computeProgress(w, day(6)).bosses[0]!;
	assert.equal(boss.slots, 2);
	assert.equal(boss.defeated, false);
});

test("boss : le boss change chaque semaine et cycle sur la liste", () => {
	const w = world([quest("a")], {}, {});
	w.quests[0]!.periods = [{ from: day(-28), to: null }];
	const p = computeProgress(w, MON);
	assert.equal(p.bosses.length, 5);
	assert.equal(new Set(p.bosses.map((b) => b.boss.id)).size, 5);
});

/* ---------- bilan hebdo ---------- */

test("weekSummary : bilan par quête, XP et boss de la semaine", () => {
	const quests = [quest("a", { skill: "savoir" }), quest("b", { skill: "methode", days: [1, 2, 3, 4, 5] })];
	const w = world(quests, { a: [0, 1, 2], b: [0, 1] }, { offDays: [day(3)] });
	const p = computeProgress(w, day(4));
	const s = weekSummary(w, p, day(2));
	assert.equal(s.weekStart, MON);
	assert.equal(s.weekEnd, day(6));
	assert.equal(s.restDays, 1);
	const a = s.perQuest.find((r) => r.quest.id === "a")!;
	assert.deepEqual([a.scheduled, a.done], [4, 3]); // 5 jours écoulés − 1 jour de repos
	assert.equal(s.done, 5);
	assert.equal(s.skillXp.savoir, 60);
	assert.equal(s.skillXp.methode, 40);
	assert.ok(s.xp >= 100);
	assert.equal(s.boss?.weekStart, MON);
});

/* ---------- prévisualisation ---------- */

test("xpPreview : aujourd'hui annonce l'XP de la prochaine validation", () => {
	const q = quest("a", { difficulty: "difficile" });
	const w = world([q], { a: [0, 1, 2, 3, 4, 5] });
	const p = computeProgress(w, day(6));
	assert.equal(xpPreview(q, p, day(6), false, null), 50); // 7e jour d'affilée : ×1,25
	assert.equal(xpPreview(q, p, day(2), true, null), 40);
});

/* ---------- succès ---------- */

test("succès : progression et déblocage unique", () => {
	const w = world([quest("a", { skill: "savoir" })], { a: [0] });
	const p = computeProgress(w, day(0));
	const reached = evaluateBadges(p).filter((b) => b.reached).map((b) => b.id);
	assert.deepEqual(reached.sort(), ["first_step", "perfect_1"]);
	assert.deepEqual(newlyReached({ first_step: day(0), perfect_1: day(0) }, p), []);
	assert.deepEqual(newlyReached({ first_step: day(0) }, p).map((b) => b.id), ["perfect_1"]);
	assert.equal(new Set(BADGES.map((b) => b.id)).size, BADGES.length, "identifiants uniques");
});

/* ---------- lecture tolérante des propriétés ---------- */

test("parseDays accepte plusieurs écritures", () => {
	assert.deepEqual(parseDays(["lun", "mar", "mer", "jeu", "ven"]), [1, 2, 3, 4, 5]);
	assert.deepEqual(parseDays(["Lundi", "SAMEDI", "dimanche"]), [0, 1, 6]);
	assert.deepEqual(parseDays("semaine"), [1, 2, 3, 4, 5]);
	assert.deepEqual(parseDays("tous"), [0, 1, 2, 3, 4, 5, 6]);
	assert.deepEqual(parseDays([1, 3]), [1, 3]);
	assert.equal(parseDays([]), null);
	assert.equal(parseDays(["blabla"]), null);
	assert.deepEqual(formatDays([0, 1, 5]), ["lun", "ven", "dim"]);
});

test("parseSkill / parseClass / parseDifficulty ignorent accents et casse", () => {
	assert.equal(parseSkill("Vitalité"), "vitalite");
	assert.equal(parseSkill(" MÉTHODE "), "methode");
	assert.equal(parseSkill("inconnue"), null);
	assert.equal(parseClass("Bâtisseur"), "batisseur");
	assert.equal(parseClass("Érudit"), "erudit");
	assert.equal(parseDifficulty("Difficile"), "difficile");
	assert.equal(parseDifficulty(3), null);
});
