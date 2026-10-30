"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../js/core.js");

/* ---------- utilitaires ---------- */

// 2026-10-26 est un lundi.
const MON = "2026-10-26";
const day = (offset) => C.addDays(MON, offset);

function setup(habitDefs, today) {
  const state = C.createInitialState();
  const habits = habitDefs.map((def) =>
    C.createHabit(
      state,
      { name: "H", icon: "x", category: "focus", difficulty: "medium", days: C.ALL_DAYS, ...def },
      def.since || MON
    )
  );
  return { state, habits, today };
}

const done = (state, habit, key, today) => C.toggleCompletion(state, habit.id, key, today || key);

/* ---------- dates ---------- */

test("addDays / weekday / startOfWeek", () => {
  assert.equal(C.weekday(MON), 1);
  assert.equal(C.addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(C.addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(C.startOfWeek("2026-11-01"), MON); // dimanche -> lundi précédent
  assert.equal(C.startOfWeek(MON), MON);
  assert.deepEqual(C.weekKeys("2026-10-28"), [0, 1, 2, 3, 4, 5, 6].map(day));
});

test("l'arithmétique de dates traverse les changements d'heure", () => {
  // Passage à l'heure d'été (Europe/Paris) : 2026-03-29. À l'heure d'hiver : 2026-10-25.
  assert.equal(C.addDays("2026-03-28", 1), "2026-03-29");
  assert.equal(C.addDays("2026-03-29", 1), "2026-03-30");
  assert.equal(C.diffDays("2026-03-28", "2026-03-30"), 2);
  assert.equal(C.diffDays("2026-10-24", "2026-10-26"), 2);
  const keys = [];
  for (let i = 0; i < 400; i++) keys.push(C.addDays("2026-01-01", i));
  assert.equal(new Set(keys).size, 400, "aucune clé dupliquée ou sautée");
});

test("isKey refuse les dates impossibles", () => {
  assert.ok(C.isKey("2026-02-28"));
  assert.ok(!C.isKey("2026-02-30"));
  assert.ok(!C.isKey("2026-13-01"));
  assert.ok(!C.isKey("26-01-01"));
  assert.ok(!C.isKey(20260101));
});

/* ---------- niveaux ---------- */

test("seuils de niveau", () => {
  assert.equal(C.xpForLevel(1), 0);
  assert.equal(C.xpForLevel(2), 100);
  assert.equal(C.xpForLevel(3), 300);
  assert.equal(C.levelInfo(0).level, 1);
  assert.equal(C.levelInfo(99).level, 1);
  assert.equal(C.levelInfo(100).level, 2);
  assert.equal(C.levelInfo(299).level, 2);
  assert.equal(C.levelInfo(300).level, 3);
  for (let level = 1; level <= 60; level++) {
    assert.equal(C.levelInfo(C.xpForLevel(level)).level, level);
    assert.equal(C.levelInfo(C.xpForLevel(level + 1) - 1).level, level);
  }
});

test("levelInfo : progression et titres", () => {
  const info = C.levelInfo(150);
  assert.equal(info.level, 2);
  assert.equal(info.into, 50);
  assert.equal(info.needed, 200);
  assert.equal(info.toNext, 150);
  assert.equal(info.progress, 0.25);
  assert.equal(info.title, "Stagiaire");
  assert.deepEqual(info.nextTitle, { title: "Junior", level: 3 });
  assert.equal(C.levelInfo(C.xpForLevel(3)).title, "Junior");
  assert.equal(C.levelInfo(C.xpForLevel(50)).nextTitle, null);
  assert.equal(C.levelInfo(-20).level, 1);
});

/* ---------- XP ---------- */

test("multiplicateur de série", () => {
  assert.equal(C.streakMultiplier(0), 1);
  assert.equal(C.streakMultiplier(6), 1);
  assert.equal(C.streakMultiplier(7), 1.25);
  assert.equal(C.streakMultiplier(14), 1.5);
  assert.equal(C.streakMultiplier(30), 2);
  assert.equal(C.completionXp({ difficulty: "hard" }, 30), 80);
  assert.equal(C.completionXp({ difficulty: "easy" }, 7), 13); // 12,5 arrondi
});

test("une validation rapporte l'XP de sa difficulté, + bonus si la journée est parfaite", () => {
  const { state, habits } = setup([{ difficulty: "easy" }, { difficulty: "hard" }]);
  done(state, habits[0], MON);
  let p = C.computeProgress(state, MON);
  assert.equal(p.totalXp, 10);
  assert.equal(p.perfectDays, 0);
  done(state, habits[1], MON);
  p = C.computeProgress(state, MON);
  assert.equal(p.totalXp, 10 + 40 + C.PERFECT_DAY_BONUS);
  assert.equal(p.perfectDays, 1);
  assert.equal(p.xpByDay[MON], 65);
});

test("annuler une validation retire exactement l'XP gagnée (état dérivé)", () => {
  const { state, habits } = setup([{}, {}]);
  for (let i = 0; i < 10; i++) {
    const k = day(i);
    done(state, habits[0], k, day(9));
    done(state, habits[1], k, day(9));
  }
  const full = C.computeProgress(state, day(9)).totalXp;
  done(state, habits[0], day(4), day(9)); // annule
  const without = C.computeProgress(state, day(9)).totalXp;
  assert.ok(without < full);
  done(state, habits[0], day(4), day(9)); // revalide
  assert.equal(C.computeProgress(state, day(9)).totalXp, full);
});

test("le multiplicateur s'applique dès le 7e jour de série", () => {
  const { state, habits } = setup([{ difficulty: "medium" }]);
  for (let i = 0; i < 7; i++) done(state, habits[0], day(i), day(6));
  const p = C.computeProgress(state, day(6));
  // 6 × 20 + 1 × 25 + 7 bonus de journée parfaite
  assert.equal(p.totalXp, 6 * 20 + 25 + 7 * C.PERFECT_DAY_BONUS);
  assert.equal(p.habitStats[habits[0].id].streakAt[day(6)], 7);
});

/* ---------- séries ---------- */

test("série : un jour prévu manqué la remet à zéro", () => {
  const { state, habits } = setup([{}]);
  const id = habits[0].id;
  [0, 1, 2].forEach((i) => done(state, habits[0], day(i), day(4)));
  // jour 3 manqué, jour 4 validé
  done(state, habits[0], day(4), day(4));
  const stat = C.computeProgress(state, day(4)).habitStats[id];
  assert.equal(stat.best, 3);
  assert.equal(stat.current, 1);
});

test("série : aujourd'hui pas encore validé ne casse pas la série", () => {
  const { state, habits } = setup([{}]);
  [0, 1, 2].forEach((i) => done(state, habits[0], day(i), day(3)));
  const stat = C.computeProgress(state, day(3)).habitStats[habits[0].id];
  assert.equal(stat.current, 3);
  // mais le lendemain sans validation, elle est perdue
  assert.equal(C.computeProgress(state, day(4)).habitStats[habits[0].id].current, 0);
});

test("série : les jours non prévus (week-end) sont neutres", () => {
  const { state, habits } = setup([{ days: C.WEEKDAYS }]);
  // vendredi (4) puis lundi suivant (7) : le week-end ne coupe pas la série
  [0, 1, 2, 3, 4, 7].forEach((i) => done(state, habits[0], day(i), day(7)));
  const stat = C.computeProgress(state, day(7)).habitStats[habits[0].id];
  assert.equal(stat.current, 6);
  assert.equal(stat.best, 6);
});

test("série : un jour de repos / congé est neutre, y compris sans validation", () => {
  const { state, habits } = setup([{}]);
  done(state, habits[0], day(0), day(3));
  done(state, habits[0], day(1), day(3));
  C.toggleOffDay(state, day(2));
  done(state, habits[0], day(3), day(3));
  const p = C.computeProgress(state, day(3));
  assert.equal(p.habitStats[habits[0].id].current, 3);
  assert.equal(p.days[day(2)].scheduled, 0);
  assert.equal(p.days[day(2)].off, true);
  assert.equal(p.days[day(2)].perfect, false);
});

test("une habitude créée plus tard ne compte pas les jours précédents comme manqués", () => {
  const { state, habits } = setup([{ since: day(5) }]);
  done(state, habits[0], day(5), day(6));
  done(state, habits[0], day(6), day(6));
  const p = C.computeProgress(state, day(6));
  assert.equal(p.habitStats[habits[0].id].current, 2);
  assert.equal(p.days[day(4)], undefined);
});

test("archiver puis restaurer met en pause sans casser la série", () => {
  const { state, habits } = setup([{}]);
  [0, 1, 2].forEach((i) => done(state, habits[0], day(i), day(10)));
  C.archiveHabit(state, habits[0].id, day(3));
  assert.ok(C.isArchived(habits[0]));
  C.restoreHabit(state, habits[0].id, day(8));
  assert.ok(!C.isArchived(habits[0]));
  [8, 9].forEach((i) => done(state, habits[0], day(i), day(10)));
  const stat = C.computeProgress(state, day(10)).habitStats[habits[0].id];
  assert.equal(stat.best, 5, "3 jours avant la pause + 2 après");
  assert.equal(stat.current, 5);
});

test("une habitude archivée n'est plus prévue ni comptée dans les journées parfaites", () => {
  const { state, habits } = setup([{}, {}]);
  C.archiveHabit(state, habits[1].id, day(1));
  done(state, habits[0], day(1), day(1));
  const p = C.computeProgress(state, day(1));
  assert.equal(p.days[day(1)].scheduled, 1);
  assert.equal(p.days[day(1)].perfect, true);
});

/* ---------- journées parfaites ---------- */

test("série de journées parfaites : aujourd'hui incomplet ne la casse pas", () => {
  const { state, habits } = setup([{}, {}]);
  [0, 1, 2].forEach((i) => habits.forEach((h) => done(state, h, day(i), day(3))));
  done(state, habits[0], day(3), day(3)); // aujourd'hui à moitié fait
  const p = C.computeProgress(state, day(3));
  assert.equal(p.perfectStreak.current, 3);
  assert.equal(p.perfectStreak.best, 3);
  assert.equal(C.computeProgress(state, day(4)).perfectStreak.current, 0);
});

/* ---------- mutations ---------- */

test("toggleCompletion refuse le futur, les dates invalides et les habitudes inconnues", () => {
  const { state, habits } = setup([{}]);
  assert.equal(C.toggleCompletion(state, habits[0].id, day(2), day(1)), null);
  assert.equal(C.toggleCompletion(state, habits[0].id, "pas-une-date", day(1)), null);
  assert.equal(C.toggleCompletion(state, "inconnue", day(0), day(1)), null);
  assert.equal(C.toggleCompletion(state, habits[0].id, day(0), day(1)), true);
  assert.equal(C.toggleCompletion(state, habits[0].id, day(0), day(1)), false);
  assert.deepEqual(state.log, {}, "les jours vides sont nettoyés");
});

test("createHabit / updateHabit valident leurs entrées", () => {
  const state = C.createInitialState();
  assert.throws(() => C.createHabit(state, { name: "   ", days: [1] }, MON), /nom/);
  assert.throws(() => C.createHabit(state, { name: "Ok", days: [] }, MON), /jour/);
  const h = C.createHabit(state, { name: "  Lire   un   article ", days: [3, 1, 1, 9, "x"], category: "nope", difficulty: "nope" }, MON);
  assert.equal(h.name, "Lire un article");
  assert.deepEqual(h.days, [1, 3]);
  assert.equal(h.category, "focus");
  assert.equal(h.difficulty, "medium");
  assert.equal(h.icon, "✅");
  C.updateHabit(state, h.id, { ...h, name: "Nouveau nom", difficulty: "hard" });
  assert.equal(state.habits[0].name, "Nouveau nom");
  assert.equal(state.habits[0].difficulty, "hard");
});

test("deleteHabit retire aussi son historique", () => {
  const { state, habits } = setup([{}, {}]);
  done(state, habits[0], day(0), day(0));
  done(state, habits[1], day(0), day(0));
  done(state, habits[0], day(1), day(1));
  C.deleteHabit(state, habits[0].id);
  assert.equal(state.habits.length, 1);
  assert.deepEqual(state.log, { [day(0)]: [habits[1].id] });
});

/* ---------- statistiques ---------- */

test("windowStats : taux par habitude et global", () => {
  const { state, habits } = setup([{}, { days: [1] }]);
  [0, 1, 2, 3].forEach((i) => done(state, habits[0], day(i), day(6)));
  done(state, habits[1], day(0), day(6));
  const w = C.windowStats(state, day(0), day(6));
  const byId = Object.fromEntries(w.perHabit.map((r) => [r.habit.id, r]));
  assert.equal(byId[habits[0].id].scheduled, 7);
  assert.equal(byId[habits[0].id].done, 4);
  assert.equal(byId[habits[1].id].scheduled, 1);
  assert.equal(w.scheduled, 8);
  assert.equal(w.done, 5);
  assert.equal(w.rate, 5 / 8);
  assert.equal(C.windowStats(C.createInitialState(), day(0), day(6)).rate, null);
});

test("heatLevel", () => {
  assert.equal(C.heatLevel(undefined), 0);
  assert.equal(C.heatLevel({ scheduled: 0, done: 0 }), 0);
  assert.equal(C.heatLevel({ scheduled: 4, done: 0 }), 1);
  assert.equal(C.heatLevel({ scheduled: 4, done: 1 }), 2);
  assert.equal(C.heatLevel({ scheduled: 4, done: 2 }), 3);
  assert.equal(C.heatLevel({ scheduled: 4, done: 3 }), 4);
  assert.equal(C.heatLevel({ scheduled: 4, done: 4 }), 5);
});

test("xpPreview : valeur affichée avant et après validation", () => {
  const { state, habits } = setup([{ difficulty: "hard" }]);
  for (let i = 0; i < 6; i++) done(state, habits[0], day(i), day(6));
  const p = C.computeProgress(state, day(6));
  // La 7e validation d'affilée vaudra ×1,25
  assert.equal(C.xpPreview(habits[0], p, day(6), false), 50);
  done(state, habits[0], day(6), day(6));
  assert.equal(C.xpPreview(habits[0], C.computeProgress(state, day(6)), day(6), true), 50);
});

/* ---------- succès ---------- */

test("succès : déblocage unique, daté, et conservé après annulation", () => {
  const { state, habits } = setup([{}]);
  done(state, habits[0], day(0), day(0));
  let p = C.computeProgress(state, day(0));
  const first = C.unlockBadges(state, p, day(0));
  assert.deepEqual(first.map((b) => b.id).sort(), ["first_step", "perfect_1"]);
  assert.equal(state.badges.first_step, day(0));
  assert.deepEqual(C.unlockBadges(state, p, day(0)), [], "pas de doublon");
  done(state, habits[0], day(0), day(0)); // annule
  p = C.computeProgress(state, day(0));
  C.unlockBadges(state, p, day(1));
  assert.equal(state.badges.first_step, day(0), "la date d'origine est conservée");
});

test("succès de série et de catégorie", () => {
  const { state, habits } = setup([{ category: "learning" }]);
  for (let i = 0; i < 25; i++) done(state, habits[0], C.addDays(MON, i), C.addDays(MON, 24));
  const p = C.computeProgress(state, C.addDays(MON, 24));
  const reached = C.evaluateBadges(p).filter((b) => b.reached).map((b) => b.id);
  assert.ok(reached.includes("streak_14"));
  assert.ok(!reached.includes("streak_30"));
  assert.ok(reached.includes("cat_learning"));
  assert.ok(!reached.includes("cat_network"));
});

/* ---------- import / normalisation ---------- */

test("normalizeState : refuse les contenus qui ne sont pas une sauvegarde", () => {
  assert.throws(() => C.normalizeState(null), /valide/);
  assert.throws(() => C.normalizeState({}), /valide/);
  assert.throws(() => C.normalizeState({ habits: "non" }), /valide/);
});

test("normalizeState : nettoie les données corrompues ou malveillantes", () => {
  const raw = JSON.parse(`{
    "habits": [
      {"id":"a","name":"Valide","days":[1,2],"periods":[{"from":"2026-10-26","to":null}]},
      {"id":"a","name":"Doublon","days":[1]},
      {"id":"b","name":"","days":[1]},
      {"id":"c","name":"Sans jours","days":[]},
      {"id":"d","name":"Période cassée","days":[3],"periods":[{"from":"nope","to":null}]},
      42, null
    ],
    "log": {
      "2026-10-26": ["a","zzz","a"],
      "__proto__": ["a"],
      "2026-13-40": ["a"],
      "2026-10-27": "pas-un-tableau"
    },
    "offDays": ["2026-10-28","2026-10-28","oops"],
    "badges": {"first_step":"2026-10-26","inconnu":"2026-10-26","streak_3":"pas-une-date"},
    "settings": {"theme":"neon"},
    "profile": {"name": "  Camille  "}
  }`);
  const s = C.normalizeState(raw, "2026-10-30");
  assert.deepEqual(s.habits.map((h) => h.id), ["a", "d"]);
  assert.deepEqual(s.habits[1].periods, [{ from: "2026-10-30", to: null }], "période invalide -> repli sur aujourd'hui");
  assert.deepEqual(s.log, { "2026-10-26": ["a"] });
  assert.deepEqual(s.offDays, ["2026-10-28"]);
  assert.deepEqual(s.badges, { first_step: "2026-10-26" });
  assert.equal(s.settings.theme, "auto");
  assert.equal(s.profile.name, "Camille");
  assert.equal({}.polluted, undefined);
  assert.equal(Object.getPrototypeOf(s.log), Object.prototype);
});

test("normalizeState : aller-retour JSON sans perte", () => {
  const { state, habits } = setup([{}, { days: C.WEEKDAYS, difficulty: "hard" }]);
  done(state, habits[0], day(0), day(2));
  done(state, habits[1], day(1), day(2));
  C.toggleOffDay(state, day(2));
  C.archiveHabit(state, habits[1].id, day(2));
  state.profile.name = "Alex";
  state.onboarded = true;
  const again = C.normalizeState(JSON.parse(JSON.stringify(state)), day(2));
  assert.deepEqual(again, state);
  assert.deepEqual(C.computeProgress(again, day(2)), C.computeProgress(state, day(2)));
});
