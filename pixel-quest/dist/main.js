"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => PixelQuestPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");

// src/engine/dates.ts
var DAY_MS = 864e5;
var pad = (n) => String(n).padStart(2, "0");
function toKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function todayKey() {
  return toKey(/* @__PURE__ */ new Date());
}
function dayNumber(key) {
  const [y = 0, m = 1, d = 1] = key.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}
function fromDayNumber(n) {
  const dt = new Date(n * DAY_MS);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}
function isKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && fromDayNumber(dayNumber(value)) === value;
}
var addDays = (key, n) => fromDayNumber(dayNumber(key) + n);
var weekday = (key) => new Date(dayNumber(key) * DAY_MS).getUTCDay();
var startOfWeek = (key) => addDays(key, -((weekday(key) + 6) % 7));
function weekKeys(key) {
  const start = startOfWeek(key);
  return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(start, i));
}
function keyToDate(key) {
  const [y = 0, m = 1, d = 1] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}
function isoWeek(key) {
  const thursday = dayNumber(key) + 3 - (weekday(key) + 6) % 7;
  const year = new Date(thursday * DAY_MS).getUTCFullYear();
  const jan1 = Math.round(Date.UTC(year, 0, 1) / DAY_MS);
  return { year, week: Math.floor((thursday - jan1) / 7) + 1 };
}
function weekLabel(key) {
  const { year, week } = isoWeek(key);
  return `${year}-S${pad(week)}`;
}

// src/engine/rules.ts
var SKILL_IDS = ["savoir", "charisme", "concentration", "vitalite", "ambition", "methode"];
var CLASS_IDS = ["batisseur", "erudit", "diplomate", "stratege", "sage"];
var DIFFICULTY_IDS = ["facile", "moyen", "difficile"];
var SKILLS = {
  savoir: { label: "Savoir", emoji: "\u{1F4DA}", blurb: "Apprendre, lire, se former, faire de la veille." },
  charisme: { label: "Charisme", emoji: "\u{1F91D}", blurb: "R\xE9seau, communication, feedback, relations." },
  concentration: { label: "Concentration", emoji: "\u{1F3AF}", blurb: "Travail en profondeur, focus, livrables." },
  vitalite: { label: "Vitalit\xE9", emoji: "\u{1F33F}", blurb: "\xC9nergie, pauses, sommeil, \xE9quilibre." },
  ambition: { label: "Ambition", emoji: "\u{1F680}", blurb: "Carri\xE8re, visibilit\xE9, objectifs \xE0 long terme." },
  methode: { label: "M\xE9thode", emoji: "\u{1F5C2}\uFE0F", blurb: "Organisation, planification, revues." }
};
var CLASSES = {
  batisseur: { label: "B\xE2tisseur", blurb: "Pose des fondations solides : on livre, proprement et \xE0 l'heure.", favored: ["concentration", "methode"] },
  erudit: { label: "\xC9rudit", blurb: "Avance par la connaissance : toujours un livre ou une id\xE9e d'avance.", favored: ["savoir", "concentration"] },
  diplomate: { label: "Diplomate", blurb: "Gagne par les alliances : un r\xE9seau vivant ouvre toutes les portes.", favored: ["charisme", "ambition"] },
  stratege: { label: "Strat\xE8ge", blurb: "Pense long terme : chaque action sert une trajectoire de carri\xE8re.", favored: ["ambition", "methode"] },
  sage: { label: "Sage", blurb: "Tient la distance : l'\xE9nergie et la curiosit\xE9 avant tout.", favored: ["vitalite", "savoir"] }
};
var CLASS_BONUS = 1.25;
var DIFFICULTIES = {
  facile: { label: "Facile", xp: 10, stars: 1 },
  moyen: { label: "Moyen", xp: 20, stars: 2 },
  difficile: { label: "Difficile", xp: 40, stars: 3 }
};
var PERFECT_DAY_BONUS = 15;
var BOSS_BONUS = 50;
var BOSS_THRESHOLD = 0.8;
var BOSS_MIN_SLOTS = 5;
var STREAK_TIERS = [
  { min: 30, mult: 2 },
  { min: 14, mult: 1.5 },
  { min: 7, mult: 1.25 }
];
var HERO_TITLES = [
  { from: 1, title: "Novice", gear: "Tenue de voyage" },
  { from: 3, title: "Initi\xE9", gear: "\xC9charpe d'initi\xE9" },
  { from: 6, title: "Adepte", gear: "Cape d'adepte" },
  { from: 10, title: "V\xE9t\xE9ran", gear: "\xC9pauli\xE8res de v\xE9t\xE9ran" },
  { from: 15, title: "Champion", gear: "Heaume de champion" },
  { from: 20, title: "H\xE9ros", gear: "Couronne de h\xE9ros" },
  { from: 30, title: "Mythe", gear: "Aura de mythe" },
  { from: 40, title: "L\xE9gende", gear: "Armure de l\xE9gende" }
];
var SKILL_RANKS = [
  { from: 1, rank: "Novice" },
  { from: 3, rank: "Initi\xE9" },
  { from: 5, rank: "Adepte" },
  { from: 8, rank: "Expert" },
  { from: 12, rank: "Ma\xEEtre" },
  { from: 20, rank: "Grand ma\xEEtre" }
];
var BOSSES = [
  { id: "gobelin", name: "Le Gobelin des Mails", blurb: "Il se multiplie d\xE8s que tu tournes le dos \xE0 ta bo\xEEte de r\xE9ception." },
  { id: "golem", name: "Le Golem des R\xE9unions", blurb: "Massif, lent, et il avale des heures enti\xE8res de ton agenda." },
  { id: "hydre", name: "L'Hydre du Backlog", blurb: "Tranche une t\xEAte, deux repoussent. Reste m\xE9thodique." },
  { id: "spectre", name: "Le Spectre des Notifications", blurb: "Il te souffle \xE0 l'oreille pour casser ta concentration." },
  { id: "dragon", name: "Le Dragon de la Deadline", blurb: "Il crache le feu sur ceux qui remettent \xE0 demain." }
];
function parseSkill(value) {
  if (typeof value !== "string") return null;
  const norm = value.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return SKILL_IDS.includes(norm) ? norm : null;
}
function parseClass(value) {
  if (typeof value !== "string") return null;
  const norm = value.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return CLASS_IDS.includes(norm) ? norm : null;
}
function parseDifficulty(value) {
  if (typeof value !== "string") return null;
  const norm = value.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return DIFFICULTY_IDS.includes(norm) ? norm : null;
}
var DAY_NAMES = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
var DAY_LABELS = DAY_NAMES;
var DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
function parseDays(value) {
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[\s,;]+/) : [];
  const out = /* @__PURE__ */ new Set();
  for (const raw of list) {
    if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw <= 6) {
      out.add(raw);
      continue;
    }
    if (typeof raw !== "string") continue;
    const norm = raw.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (!norm) continue;
    if (norm === "tous" || norm === "tout" || norm === "quotidien") [0, 1, 2, 3, 4, 5, 6].forEach((d) => out.add(d));
    else if (norm === "semaine" || norm === "ouvres" || norm === "ouvre") [1, 2, 3, 4, 5].forEach((d) => out.add(d));
    else if (/^\d$/.test(norm) && Number(norm) <= 6) out.add(Number(norm));
    else {
      const idx = DAY_NAMES.findIndex((d) => norm.startsWith(d));
      if (idx >= 0) out.add(idx);
    }
  }
  return out.size ? [...out].sort((a, b) => a - b) : null;
}
function formatDays(days) {
  return DISPLAY_ORDER.filter((d) => days.includes(d)).map((d) => DAY_NAMES[d]);
}

// src/engine/progress.ts
function isActiveOn(quest, key) {
  return quest.periods.some((p) => key >= p.from && (p.to === null || key < p.to));
}
var isArchived = (quest) => !quest.periods.some((p) => p.to === null);
function firstActiveDay(quest) {
  let min = quest.periods[0]?.from ?? "9999-12-31";
  for (const p of quest.periods) if (p.from < min) min = p.from;
  return min;
}
function isScheduled(quest, key, offDays) {
  return isActiveOn(quest, key) && quest.days.includes(weekday(key)) && !offDays.has(key);
}
function streakMultiplier(streak) {
  for (const tier of STREAK_TIERS) if (streak >= tier.min) return tier.mult;
  return 1;
}
function isFavored(heroClass, skill) {
  return heroClass !== null && CLASSES[heroClass].favored.includes(skill);
}
function completionXp(quest, streak, heroClass) {
  const mult = streakMultiplier(streak) * (isFavored(heroClass, quest.skill) ? CLASS_BONUS : 1);
  return Math.round(DIFFICULTIES[quest.difficulty].xp * mult);
}
function levelFor(xp, k) {
  const total = (l) => k * (l - 1) * l;
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + 4 * xp / k)) / 2));
  while (total(level + 1) <= xp) level++;
  while (level > 1 && total(level) > xp) level--;
  return level;
}
var xpForLevel = (level) => 50 * (level - 1) * level;
var xpForSkillLevel = (level) => 25 * (level - 1) * level;
function levelInfo(xpRaw) {
  const xp = Math.max(0, Math.floor(xpRaw));
  const level = levelFor(xp, 50);
  const base = xpForLevel(level);
  const needed = xpForLevel(level + 1) - base;
  let tier = 0;
  HERO_TITLES.forEach((t, i) => {
    if (level >= t.from) tier = i;
  });
  const current = HERO_TITLES[tier] ?? HERO_TITLES[0];
  const next = HERO_TITLES.find((t) => t.from > level) ?? null;
  return {
    level,
    xp,
    title: current.title,
    gear: current.gear,
    tier,
    into: xp - base,
    needed,
    toNext: needed - (xp - base),
    progress: (xp - base) / needed,
    nextTitle: next ? { title: next.title, level: next.from } : null
  };
}
function skillLevelInfo(xpRaw) {
  const xp = Math.max(0, Math.floor(xpRaw));
  const level = levelFor(xp, 25);
  const base = xpForSkillLevel(level);
  const needed = xpForSkillLevel(level + 1) - base;
  let rank = SKILL_RANKS[0].rank;
  for (const r of SKILL_RANKS) if (level >= r.from) rank = r.rank;
  return { xp, level, rank, into: xp - base, needed, progress: (xp - base) / needed };
}
function bossForWeek(weekStart) {
  const index = Math.floor(dayNumber(weekStart) / 7) % BOSSES.length;
  return BOSSES[index] ?? BOSSES[0];
}
function computeProgress(world, today) {
  const offDays = new Set(world.offDays);
  const questsById = new Map(world.quests.map((q) => [q.id, q]));
  const doneByDay = /* @__PURE__ */ new Map();
  for (const [key, ids] of Object.entries(world.log)) if (key <= today) doneByDay.set(key, new Set(ids));
  const isDone = (id, key) => doneByDay.get(key)?.has(id) ?? false;
  const questStats = {};
  let bestStreak = 0;
  let currentStreak = 0;
  for (const quest of world.quests) {
    const stat = { current: 0, best: 0, streakAt: {}, scheduled: 0, done: 0 };
    let streak = 0;
    for (let n = dayNumber(firstActiveDay(quest)); n <= dayNumber(today); n++) {
      const key = fromDayNumber(n);
      if (!isScheduled(quest, key, offDays)) continue;
      stat.scheduled++;
      if (isDone(quest.id, key)) {
        streak++;
        stat.done++;
        stat.streakAt[key] = streak;
        if (streak > stat.best) stat.best = streak;
      } else if (key !== today) {
        streak = 0;
      }
    }
    stat.current = streak;
    questStats[quest.id] = stat;
    if (stat.best > bestStreak) bestStreak = stat.best;
    if (stat.current > currentStreak) currentStreak = stat.current;
  }
  let completionsXp = 0;
  let totalCompletions = 0;
  const xpByDay = {};
  const skillXpByDay = {};
  const skillXp = Object.fromEntries(SKILL_IDS.map((s) => [s, 0]));
  const skillCount = Object.fromEntries(SKILL_IDS.map((s) => [s, 0]));
  const activeDays = /* @__PURE__ */ new Set();
  for (const [key, ids] of doneByDay) {
    for (const id of ids) {
      const quest = questsById.get(id);
      if (!quest) continue;
      const xp = completionXp(quest, questStats[id]?.streakAt[key] ?? 0, world.heroClass);
      completionsXp += xp;
      totalCompletions++;
      activeDays.add(key);
      xpByDay[key] = (xpByDay[key] ?? 0) + xp;
      skillXp[quest.skill] += xp;
      skillCount[quest.skill]++;
      const perDay = skillXpByDay[key] ?? (skillXpByDay[key] = {});
      perDay[quest.skill] = (perDay[quest.skill] ?? 0) + xp;
    }
  }
  const days = {};
  let perfectDays = 0;
  let perfectStreak = 0;
  let bestPerfectStreak = 0;
  let perfectXp = 0;
  let firstDay = today;
  for (const q of world.quests) if (firstActiveDay(q) < firstDay) firstDay = firstActiveDay(q);
  if (world.quests.length) {
    for (let n = dayNumber(firstDay); n <= dayNumber(today); n++) {
      const key = fromDayNumber(n);
      let scheduled = 0;
      let done = 0;
      for (const quest of world.quests) {
        if (!isScheduled(quest, key, offDays)) continue;
        scheduled++;
        if (isDone(quest.id, key)) done++;
      }
      const perfect = scheduled > 0 && done === scheduled;
      days[key] = { scheduled, done, perfect, off: offDays.has(key) };
      if (perfect) {
        perfectDays++;
        perfectXp += PERFECT_DAY_BONUS;
        xpByDay[key] = (xpByDay[key] ?? 0) + PERFECT_DAY_BONUS;
        perfectStreak++;
        if (perfectStreak > bestPerfectStreak) bestPerfectStreak = perfectStreak;
      } else if (scheduled > 0 && key !== today) {
        perfectStreak = 0;
      }
    }
  }
  const bosses = [];
  let bossXp = 0;
  if (world.quests.length) {
    const thisWeek = startOfWeek(today);
    for (let week = startOfWeek(firstDay); week <= thisWeek; week = addDays(week, 7)) {
      let slots = 0;
      for (let i = 0; i < 7; i++) {
        const key = addDays(week, i);
        for (const quest of world.quests) if (isScheduled(quest, key, offDays)) slots++;
      }
      if (slots === 0) continue;
      const required = Math.ceil(slots * BOSS_THRESHOLD);
      let damage = 0;
      let defeatedOn = null;
      for (let i = 0; i < 7; i++) {
        const key = addDays(week, i);
        if (key > today) break;
        damage += days[key]?.done ?? 0;
        if (defeatedOn === null && slots >= BOSS_MIN_SLOTS && damage >= required) defeatedOn = key;
      }
      const defeated = defeatedOn !== null;
      if (defeatedOn) {
        bossXp += BOSS_BONUS;
        xpByDay[defeatedOn] = (xpByDay[defeatedOn] ?? 0) + BOSS_BONUS;
      }
      bosses.push({ weekStart: week, boss: bossForWeek(week), slots, damage, required, defeated, defeatedOn, current: week === thisWeek });
    }
  }
  const totalXp = completionsXp + perfectXp + bossXp;
  const skills = Object.fromEntries(
    SKILL_IDS.map((id) => [id, { id, count: skillCount[id], favored: isFavored(world.heroClass, id), ...skillLevelInfo(skillXp[id]) }])
  );
  return {
    today,
    totalXp,
    xpBreakdown: { completions: completionsXp, perfectDays: perfectXp, bosses: bossXp },
    level: levelInfo(totalXp),
    skills,
    totalCompletions,
    activeDays: activeDays.size,
    xpByDay,
    skillXpByDay,
    questStats,
    days,
    perfectDays,
    perfectStreak: { current: perfectStreak, best: bestPerfectStreak },
    bestStreak,
    currentStreak,
    bosses,
    bossesDefeated: bosses.filter((b) => b.defeated).length
  };
}
function xpPreview(quest, progress, key, done, heroClass) {
  const stat = progress.questStats[quest.id];
  if (!stat) return completionXp(quest, 0, heroClass);
  if (done) return completionXp(quest, stat.streakAt[key] ?? 0, heroClass);
  if (key === progress.today) return completionXp(quest, stat.current + 1, heroClass);
  return completionXp(quest, 0, heroClass);
}
function weekSummary(world, progress, anyDayOfWeek) {
  const weekStart = startOfWeek(anyDayOfWeek);
  const weekEnd = addDays(weekStart, 6);
  const offDays = new Set(world.offDays);
  const perQuest = world.quests.map((quest) => {
    let scheduled2 = 0;
    let done2 = 0;
    for (let i = 0; i < 7; i++) {
      const key = addDays(weekStart, i);
      if (key > progress.today || !isScheduled(quest, key, offDays)) continue;
      scheduled2++;
      if (world.log[key]?.includes(quest.id)) done2++;
    }
    return { quest, scheduled: scheduled2, done: done2 };
  }).filter((r) => r.scheduled > 0);
  const skillXp = Object.fromEntries(SKILL_IDS.map((s) => [s, 0]));
  let xp = 0;
  let perfectDays = 0;
  let restDays = 0;
  for (let i = 0; i < 7; i++) {
    const key = addDays(weekStart, i);
    xp += progress.xpByDay[key] ?? 0;
    if (progress.days[key]?.perfect) perfectDays++;
    if (offDays.has(key) && key <= progress.today) restDays++;
    for (const [skill, value] of Object.entries(progress.skillXpByDay[key] ?? {})) skillXp[skill] += value ?? 0;
  }
  const scheduled = perQuest.reduce((s, r) => s + r.scheduled, 0);
  const done = perQuest.reduce((s, r) => s + r.done, 0);
  return {
    weekStart,
    weekEnd,
    perQuest,
    scheduled,
    done,
    rate: scheduled ? done / scheduled : null,
    perfectDays,
    restDays,
    xp,
    skillXp,
    boss: progress.bosses.find((b) => b.weekStart === weekStart) ?? null
  };
}
var maxSkillLevel = (p) => Math.max(...SKILL_IDS.map((s) => p.skills[s].level));
var minSkillLevel = (p) => Math.min(...SKILL_IDS.map((s) => p.skills[s].level));
var BADGES = [
  { id: "first_step", icon: "\u{1F331}", name: "Premier pas", desc: "Valider une premi\xE8re qu\xEAte", target: 1, value: (p) => p.totalCompletions },
  { id: "completions_50", icon: "\u2705", name: "R\xE9gularit\xE9", desc: "Valider 50 qu\xEAtes", target: 50, value: (p) => p.totalCompletions },
  { id: "completions_250", icon: "\u2699\uFE0F", name: "Rouleau compresseur", desc: "Valider 250 qu\xEAtes", target: 250, value: (p) => p.totalCompletions },
  { id: "completions_1000", icon: "\u{1F3C5}", name: "Marathon", desc: "Valider 1 000 qu\xEAtes", target: 1e3, value: (p) => p.totalCompletions },
  { id: "streak_3", icon: "\u2728", name: "\xC9chauffement", desc: "S\xE9rie de 3 jours sur une qu\xEAte", target: 3, value: (p) => p.bestStreak },
  { id: "streak_7", icon: "\u{1F525}", name: "Semaine de feu", desc: "S\xE9rie de 7 jours sur une qu\xEAte", target: 7, value: (p) => p.bestStreak },
  { id: "streak_14", icon: "\u{1F4AA}", name: "Double semaine", desc: "S\xE9rie de 14 jours sur une qu\xEAte", target: 14, value: (p) => p.bestStreak },
  { id: "streak_30", icon: "\u{1F6E1}\uFE0F", name: "Mois d'acier", desc: "S\xE9rie de 30 jours sur une qu\xEAte", target: 30, value: (p) => p.bestStreak },
  { id: "streak_100", icon: "\u{1F451}", name: "Centurion", desc: "S\xE9rie de 100 jours sur une qu\xEAte", target: 100, value: (p) => p.bestStreak },
  { id: "perfect_1", icon: "\u2B50", name: "Journ\xE9e parfaite", desc: "Valider toutes les qu\xEAtes pr\xE9vues en un jour", target: 1, value: (p) => p.perfectDays },
  { id: "perfect_streak_3", icon: "\u{1F3A9}", name: "Tripl\xE9", desc: "3 journ\xE9es parfaites d'affil\xE9e", target: 3, value: (p) => p.perfectStreak.best },
  { id: "perfect_streak_7", icon: "\u{1F31F}", name: "Sans faute", desc: "7 journ\xE9es parfaites d'affil\xE9e", target: 7, value: (p) => p.perfectStreak.best },
  { id: "boss_1", icon: "\u{1F5E1}\uFE0F", name: "Tueur de boss", desc: "Vaincre un premier boss hebdomadaire", target: 1, value: (p) => p.bossesDefeated },
  { id: "boss_5", icon: "\u{1F409}", name: "Chasseur de dragons", desc: "Vaincre 5 boss hebdomadaires", target: 5, value: (p) => p.bossesDefeated },
  { id: "level_5", icon: "\u{1F4C8}", name: "Mont\xE9e en puissance", desc: "Atteindre le niveau 5", target: 5, value: (p) => p.level.level },
  { id: "level_10", icon: "\u{1F3C6}", name: "Cap des dix", desc: "Atteindre le niveau 10", target: 10, value: (p) => p.level.level },
  { id: "level_20", icon: "\u{1F48E}", name: "\xC9lite", desc: "Atteindre le niveau 20", target: 20, value: (p) => p.level.level },
  { id: "skill_10", icon: "\u{1F52E}", name: "Virtuose", desc: "Une comp\xE9tence au niveau 10", target: 10, value: maxSkillLevel },
  { id: "skill_all_3", icon: "\u{1F9E9}", name: "Polyvalent", desc: "Les six comp\xE9tences au niveau 3", target: 3, value: minSkillLevel },
  ...[
    ["savoir", "\u{1F9E0}", "Esprit curieux"],
    ["charisme", "\u{1F310}", "R\xE9seau actif"],
    ["concentration", "\u{1F52D}", "Mode focus"],
    ["vitalite", "\u{1F33F}", "\xC9quilibre"],
    ["ambition", "\u{1F9ED}", "Cap sur la carri\xE8re"],
    ["methode", "\u{1F4D0}", "Bien organis\xE9"]
  ].map(
    ([skill, icon, name]) => ({
      id: `skill_${skill}_25`,
      icon,
      name,
      desc: `Valider 25 qu\xEAtes de ${SKILLS[skill].label}`,
      target: 25,
      value: (p) => p.skills[skill].count
    })
  )
];
function evaluateBadges(progress) {
  return BADGES.map((b) => {
    const value = b.value(progress);
    return { id: b.id, icon: b.icon, name: b.name, desc: b.desc, target: b.target, value, reached: value >= b.target };
  });
}
function newlyReached(stored, progress) {
  return evaluateBadges(progress).filter((b) => b.reached && !stored[b.id]);
}

// src/notes/schema.ts
var DEFAULT_ROOT = "Pixel Quest";
function pathsFor(rootRaw) {
  const root = rootRaw.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "") || DEFAULT_ROOT;
  return {
    root,
    quests: `${root}/Quetes`,
    journal: `${root}/Journal`,
    reviews: `${root}/Revues`,
    templates: `${root}/Modeles`,
    hero: `${root}/Heros.md`,
    dashboard: `${root}/Tableau de bord.md`,
    guide: `${root}/Guide.md`
  };
}
var TYPES = {
  quest: "pq-quete",
  day: "pq-jour",
  hero: "pq-heros",
  review: "pq-revue",
  dashboard: "pq-tableau"
};
var isUnder = (path, folder) => path.startsWith(folder + "/");
function basename(path) {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return name.replace(/\.md$/i, "");
}
var questPath = (paths, name) => `${paths.quests}/${name}.md`;
var journalPath = (paths, date) => `${paths.journal}/${date}.md`;
function sanitizeFileName(name) {
  return name.replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").replace(/^\.+/, "").trim().slice(0, 80).trim();
}
var wikilink = (name) => `[[${name}]]`;
function linkTarget(entry) {
  if (typeof entry !== "string") return null;
  let s = entry.trim();
  const m = /^\[\[([^\]]+)\]\]$/.exec(s);
  if (m?.[1]) s = m[1];
  s = (s.split("|")[0] ?? "").split("#")[0] ?? "";
  s = s.trim().replace(/\.md$/i, "");
  const slash = s.lastIndexOf("/");
  if (slash >= 0) s = s.slice(slash + 1);
  return s.trim() || null;
}
function flattenStrings(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenStrings);
  return [];
}
var DATE_RE = /\d{4}-\d{2}-\d{2}/g;
function parsePeriods(value) {
  const out = [];
  for (const raw of flattenStrings(value)) {
    const dates = raw.match(DATE_RE)?.filter(isKey) ?? [];
    const from = dates[0];
    if (!from) continue;
    const to = dates[1] ?? null;
    if (to !== null && to < from) continue;
    out.push({ from, to });
  }
  return out.sort((a, b) => a.from < b.from ? -1 : a.from > b.from ? 1 : 0);
}
function formatPeriods(periods) {
  return periods.map((p) => p.to ? `${p.from} \u2192 ${p.to}` : `${p.from} \u2192`);
}
var ymd = (ms) => toKey(new Date(ms));
function parseQuestNote(file, props) {
  const type = props["type"];
  if (typeof type === "string" && type !== TYPES.quest) return null;
  const name = basename(file.path);
  if (!name) return null;
  let periods = parsePeriods(props["periodes"]);
  if (!periods.length) {
    const debut = flattenStrings(props["debut"]).find(isKey);
    periods = [{ from: debut ?? ymd(file.ctime), to: null }];
  }
  const icon = typeof props["icone"] === "string" && props["icone"].trim() ? Array.from(props["icone"].trim()).slice(0, 4).join("") : "\u2694\uFE0F";
  return {
    id: name,
    name,
    icon,
    skill: parseSkill(props["competence"]) ?? "methode",
    difficulty: parseDifficulty(props["difficulte"]) ?? "moyen",
    days: parseDays(props["jours"]) ?? [1, 2, 3, 4, 5],
    periods
  };
}
function parseJournalNote(path, props) {
  const date = basename(path);
  if (!isKey(date)) return null;
  const ids = /* @__PURE__ */ new Set();
  for (const entry of flattenStrings(props["quetes"])) {
    const id = linkTarget(entry);
    if (id) ids.add(id);
  }
  const rest = props["repos"] === true || props["repos"] === "true" || props["repos"] === "oui";
  return { date, quests: [...ids], rest };
}
var emptyHero = () => ({ exists: false, name: "", heroClass: null, badges: {} });
function parseHeroNote(props) {
  const badges = {};
  const raw = props["succes"];
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [id, date] of Object.entries(raw)) {
      const key = date instanceof Date ? toKey(date) : typeof date === "string" ? date.slice(0, 10) : "";
      if (isKey(key)) badges[id] = key;
    }
  }
  return {
    exists: true,
    name: typeof props["nom"] === "string" ? props["nom"].trim().slice(0, 40) : "",
    heroClass: parseClass(props["classe"]),
    badges
  };
}
function composeNote(yaml, body) {
  const props = yaml.endsWith("\n") ? yaml : yaml + "\n";
  return `---
${props}---
${body}`;
}

// src/notes/text.ts
var NOTES_HEADING = "## Notes du jour";
var AUTO_START = "<!-- pq:auto:start -->";
var AUTO_END = "<!-- pq:auto:end -->";
var pct = (r) => r === null ? "\u2013" : `${Math.round(r * 100)} %`;
var frDay = (key) => `${key.slice(8)}/${key.slice(5, 7)}`;
var cell = (text) => text.replace(/\|/g, "\\|");
function guideNote(paths) {
  const skills = SKILL_IDS.map((s) => `| \`${s}\` | ${SKILLS[s].label} | ${SKILLS[s].blurb} |`).join("\n");
  const difficulties = Object.entries(DIFFICULTIES).map(([id, d]) => `| \`${id}\` | ${d.label} | ${d.xp} XP |`).join("\n");
  const classes = Object.entries(CLASSES).map(([id, c]) => `| \`${id}\` | ${c.label} | ${c.favored.map((s) => SKILLS[s].label).join(", ")} |`).join("\n");
  const days = DISPLAY_ORDER.map((d) => formatDays([d])[0]).join(", ");
  return `# Pixel Quest \u2014 guide du cadre de notes

Ce guide d\xE9crit comment Pixel Quest range ses donn\xE9es dans ton vault. Il s'adresse \xE0 toi **et** \xE0 tout agent
(par exemple un assistant IA) qui lit ou \xE9crit dans ces notes. Tout est du Markdown avec des propri\xE9t\xE9s (frontmatter) :
aucune base de donn\xE9es cach\xE9e. Le plugin recalcule XP, niveaux, s\xE9ries et boss \xE0 partir de ces notes.

## Arborescence

\`\`\`
${paths.root}/
\u251C\u2500\u2500 Heros.md              profil : nom, classe, succ\xE8s d\xE9bloqu\xE9s
\u251C\u2500\u2500 Tableau de bord.md    \xE9tat courant (G\xC9N\xC9R\xC9, ne pas modifier)
\u251C\u2500\u2500 Guide.md              ce guide
\u251C\u2500\u2500 Quetes/               une note par qu\xEAte (habitude)
\u251C\u2500\u2500 Journal/              une note par jour : AAAA-MM-JJ.md
\u251C\u2500\u2500 Revues/               une revue par semaine : AAAA-Snn.md
\u2514\u2500\u2500 Modeles/              mod\xE8les pour le plugin \xAB Mod\xE8les \xBB d'Obsidian (\xE0 ignorer pour l'analyse)
\`\`\`

## Types de notes

Chaque note du jeu a une propri\xE9t\xE9 \`type\`.

### Qu\xEAte \u2014 \`${TYPES.quest}\` (dans \`Quetes/\`)

| Propri\xE9t\xE9 | Valeurs | R\xF4le |
|---|---|---|
| \`icone\` | un emoji | affichage |
| \`competence\` | ${SKILL_IDS.map((s) => `\`${s}\``).join(", ")} | comp\xE9tence qui gagne l'XP |
| \`difficulte\` | ${Object.keys(DIFFICULTIES).map((d) => `\`${d}\``).join(", ")} | XP de base |
| \`jours\` | liste parmi ${days} (ou \`tous\`, \`semaine\`) | jours o\xF9 la qu\xEAte est pr\xE9vue |
| \`periodes\` | liste de \`AAAA-MM-JJ \u2192\` (en cours) ou \`AAAA-MM-JJ \u2192 AAAA-MM-JJ\` (en pause) | p\xE9riodes d'activit\xE9 ; le dernier jour n'est pas inclus |

Le **nom de la note** est l'identifiant de la qu\xEAte. Renomme-la dans Obsidian : les liens du journal suivent.
Le corps de la note est libre : pourquoi cette qu\xEAte, crit\xE8res de r\xE9ussite, retours d'exp\xE9rience.
Pour archiver une qu\xEAte, ferme sa derni\xE8re p\xE9riode (\`2026-10-26 \u2192 2026-11-10\`) ; pour la reprendre, ajoute \`2026-11-20 \u2192\`.

### Jour \u2014 \`${TYPES.day}\` (dans \`Journal/\`, nom de fichier = date)

| Propri\xE9t\xE9 | Valeurs | R\xF4le |
|---|---|---|
| \`quetes\` | liste de liens \`"[[Nom de la qu\xEAte]]"\` | **qu\xEAtes valid\xE9es ce jour-l\xE0** |
| \`repos\` | \`true\` | jour de repos / cong\xE9 : aucune qu\xEAte pr\xE9vue, aucune s\xE9rie cass\xE9e |

Le corps contient une section \`${NOTES_HEADING}\` : tes notes, id\xE9es et retours de la journ\xE9e. Les liens vers les qu\xEAtes y
cr\xE9ent des r\xE9troliens dans la note de chaque qu\xEAte.

### H\xE9ros \u2014 \`${TYPES.hero}\` (\`Heros.md\`)

| Propri\xE9t\xE9 | Valeurs |
|---|---|
| \`nom\` | texte |
| \`classe\` | ${Object.keys(CLASSES).map((c) => `\`${c}\``).join(", ")} |
| \`succes\` | table \`identifiant: date de d\xE9blocage\` |

### Revue \u2014 \`${TYPES.review}\` (dans \`Revues/\`) et Tableau de bord \u2014 \`${TYPES.dashboard}\`

Notes **g\xE9n\xE9r\xE9es**. Le tableau de bord est r\xE9\xE9crit \xE0 chaque changement : ne le modifie pas. Dans une revue, seul
le bloc entre \`${AUTO_START}\` et \`${AUTO_END}\` est r\xE9g\xE9n\xE9r\xE9 ; tout ce qui est \xE9crit en dehors est conserv\xE9.

## R\xE8gles du jeu

- XP d'une validation : XP de la difficult\xE9 \xD7 multiplicateur de s\xE9rie \xD7 bonus de classe (+25 % sur ses deux comp\xE9tences favorites).
- Multiplicateur de s\xE9rie (jours pr\xE9vus valid\xE9s d'affil\xE9e) : \xD71,25 d\xE8s 7, \xD71,5 d\xE8s 14, \xD72 d\xE8s 30.
- Journ\xE9e parfaite (toutes les qu\xEAtes pr\xE9vues valid\xE9es) : +15 XP.
- Boss hebdomadaire : vaincu quand au moins 80 % des qu\xEAtes pr\xE9vues de la semaine sont valid\xE9es (5 qu\xEAtes pr\xE9vues minimum) : +50 XP.
- Niveau N de h\xE9ros : 50 \xD7 (N \u2212 1) \xD7 N XP cumul\xE9s. Niveau N de comp\xE9tence : 25 \xD7 (N \u2212 1) \xD7 N XP cumul\xE9s.

### Difficult\xE9s

| Valeur | Libell\xE9 | XP de base |
|---|---|---|
${difficulties}

### Comp\xE9tences

| Valeur | Libell\xE9 | Contenu |
|---|---|---|
${skills}

### Classes

| Valeur | Libell\xE9 | Comp\xE9tences favorites |
|---|---|---|
${classes}

## Pour un agent : lire et \xE9crire sans casser le jeu

- **Lire l'\xE9tat** : ouvre \`${paths.dashboard.slice(paths.root.length + 1)}\` (niveau, XP, comp\xE9tences, s\xE9ries, boss, qu\xEAtes actives).
- **Valider une qu\xEAte** : ajoute \`"[[Nom de la qu\xEAte]]"\` \xE0 la propri\xE9t\xE9 \`quetes\` de la note du jour (cr\xE9e-la si besoin avec \`type: ${TYPES.day}\`). Ne valide jamais une date future.
- **Ajouter une note** : ajoute une ligne sous \`${NOTES_HEADING}\`, par exemple \`- 18:30 \u2014 [[Nom de la qu\xEAte]] \u2014 ce qui s'est pass\xE9\`.
- **Cr\xE9er une qu\xEAte** : cr\xE9e une note dans \`Quetes/\` avec les propri\xE9t\xE9s ci-dessus (mod\xE8le dans \`Modeles/\`).
- **Ne pas faire** : modifier \`Tableau de bord.md\`, inventer des valeurs hors des listes ci-dessus, supprimer une note de journal pour \xAB annuler \xBB (retire plut\xF4t le lien dans \`quetes\`).
- Le plugin relit les notes d\xE8s qu'elles changent : pas besoin de le pr\xE9venir.

## Synchronisation

Si tu synchronises le vault entre plusieurs appareils, les notes du jeu se synchronisent comme n'importe quelle note.
Si deux appareils modifient la m\xEAme note de journal en m\xEAme temps, ton outil de synchronisation peut cr\xE9er une copie
\xAB en conflit \xBB : fusionne les deux listes \`quetes\` \xE0 la main. Le tableau de bord, lui, peut simplement \xEAtre supprim\xE9 :
il se r\xE9g\xE9n\xE8re.
`;
}
function templateNotes(paths) {
  return [
    {
      path: `${paths.templates}/Modele - Quete.md`,
      content: `---
type: ${TYPES.quest}
modele: true
icone: \u2694\uFE0F
competence: methode
difficulte: moyen
jours: [lun, mar, mer, jeu, ven]
periodes:
  - "{{date}} \u2192"
---
## Pourquoi cette qu\xEAte ?

## Crit\xE8res de r\xE9ussite

## Retours d'exp\xE9rience
`
    },
    {
      path: `${paths.templates}/Modele - Jour.md`,
      content: `---
type: ${TYPES.day}
modele: true
quetes: []
---
${NOTES_HEADING}

`
    },
    {
      path: `${paths.templates}/Modele - Revue.md`,
      content: `---
type: ${TYPES.review}
modele: true
---
${AUTO_START}
${AUTO_END}

## Ce qui a bien march\xE9

## \xC0 am\xE9liorer

## Intentions pour la semaine prochaine
`
    }
  ];
}
function dayNoteBody() {
  return `${NOTES_HEADING}

`;
}
function appendToNotesSection(content, line) {
  const normalized = content.replace(/\r\n/g, "\n");
  const heading = normalized.indexOf(NOTES_HEADING);
  if (heading < 0) {
    const base = normalized.replace(/\s*$/, "");
    return `${base}

${NOTES_HEADING}

${line}
`;
  }
  const afterHeading = heading + NOTES_HEADING.length;
  const next = normalized.slice(afterHeading).search(/\n#{1,6} /);
  const end = next < 0 ? normalized.length : afterHeading + next;
  const before = normalized.slice(0, end).replace(/\s*$/, "");
  const sep = before.endsWith(NOTES_HEADING) ? "\n\n" : "\n";
  const rest = normalized.slice(end);
  return `${before}${sep}${line}
${rest.startsWith("\n") ? rest : "\n" + rest}`.replace(/\n+$/, "\n");
}
function reviewProperties(input) {
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
    boss_vaincu: s.boss ? s.boss.defeated : null
  };
}
function reviewAutoBlock(input) {
  const { summary: s, journalDays } = input;
  const lines = [AUTO_START, `> Bloc g\xE9n\xE9r\xE9 par Pixel Quest : il est mis \xE0 jour \xE0 chaque g\xE9n\xE9ration. \xC9cris tes r\xE9flexions en dehors des rep\xE8res.`, ""];
  if (s.boss) {
    const b = s.boss;
    lines.push(`**Boss : ${b.boss.name}** \u2014 ${b.defeated ? "vaincu \u2705" : b.slots < 5 ? "semaine trop l\xE9g\xE8re pour un boss" : "encore debout"} (${b.damage} / ${b.required} d\xE9g\xE2ts requis, ${b.slots} qu\xEAtes pr\xE9vues sur la semaine)`, "");
  }
  lines.push(`**XP de la semaine :** ${s.xp} \xB7 **Taux de r\xE9ussite :** ${pct(s.rate)} (${s.done}/${s.scheduled}) \xB7 **Journ\xE9es parfaites :** ${s.perfectDays} \xB7 **Jours de repos :** ${s.restDays}`, "");
  if (s.perQuest.length) {
    lines.push("| Qu\xEAte | Comp\xE9tence | Valid\xE9es | Pr\xE9vues | Taux |", "|---|---|---|---|---|");
    for (const r of s.perQuest) {
      lines.push(`| ${wikilink(cell(r.quest.name))} | ${SKILLS[r.quest.skill].label} | ${r.done} | ${r.scheduled} | ${pct(r.scheduled ? r.done / r.scheduled : null)} |`);
    }
    lines.push("");
  }
  const gained = SKILL_IDS.filter((id) => s.skillXp[id] > 0).map((id) => `${SKILLS[id].label} +${s.skillXp[id]}`);
  if (gained.length) lines.push(`**XP par comp\xE9tence :** ${gained.join(" \xB7 ")}`, "");
  if (journalDays.length) lines.push("**Journal :** " + journalDays.map((d) => wikilink(d)).join(" \xB7 "), "");
  lines.push(AUTO_END);
  return lines.join("\n");
}
function reviewTitle(summary) {
  return `# Revue ${weekLabel(summary.weekStart)} (${frDay(summary.weekStart)} \u2192 ${frDay(summary.weekEnd)})`;
}
function reviewBody(input) {
  return `${reviewTitle(input.summary)}

${reviewAutoBlock(input)}

## Ce qui a bien march\xE9

## \xC0 am\xE9liorer

## Intentions pour la semaine prochaine
`;
}
function replaceAutoBlock(content, block) {
  const start = content.indexOf(AUTO_START);
  const end = content.indexOf(AUTO_END);
  if (start < 0 || end < start) return null;
  return content.slice(0, start) + block + content.slice(end + AUTO_END.length);
}
function dashboardProperties(input) {
  const { progress: p } = input;
  const competences = {};
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
    quetes_actives: input.quests.filter((q) => !isArchived(q)).map((q) => q.name)
  };
}
function dashboardBody(input) {
  const { progress: p, quests } = input;
  const cls = input.heroClass ? CLASSES[input.heroClass].label : "sans classe";
  const lines = [
    `# Tableau de bord \u2014 ${input.name || "H\xE9ros"}, ${cls}`,
    "",
    "> Note g\xE9n\xE9r\xE9e par Pixel Quest et r\xE9\xE9crite \xE0 chaque changement : ne la modifie pas.",
    "",
    `**Niveau ${p.level.level} \xB7 ${p.level.title}** \u2014 ${p.totalXp} XP (encore ${p.level.toNext} avant le niveau ${p.level.level + 1}).`,
    `S\xE9rie en cours : ${p.currentStreak} j \xB7 record : ${p.bestStreak} j \xB7 journ\xE9es parfaites : ${p.perfectDays} \xB7 boss vaincus : ${p.bossesDefeated}.`,
    "",
    "## Comp\xE9tences",
    "",
    "| Comp\xE9tence | Niveau | Rang | XP | Validations |",
    "|---|---|---|---|---|",
    ...SKILL_IDS.map((id) => {
      const s = p.skills[id];
      return `| ${SKILLS[id].label}${s.favored ? " \u2605" : ""} | ${s.level} | ${s.rank} | ${s.xp} | ${s.count} |`;
    }),
    ""
  ];
  const boss = p.bosses.find((b) => b.current);
  if (boss) {
    lines.push("## Boss de la semaine", "", `${boss.boss.name} \u2014 ${boss.damage} / ${boss.required} d\xE9g\xE2ts requis${boss.defeated ? " (vaincu \u2705)" : ""}.`, "");
  }
  const active = quests.filter((q) => !isArchived(q));
  lines.push("## Qu\xEAtes actives", "");
  if (active.length) {
    lines.push("| Qu\xEAte | Comp\xE9tence | Difficult\xE9 | Jours | S\xE9rie | Record |", "|---|---|---|---|---|---|");
    for (const q of active) {
      const st = p.questStats[q.id];
      lines.push(`| ${wikilink(cell(q.name))} | ${SKILLS[q.skill].label} | ${DIFFICULTIES[q.difficulty].label} | ${formatDays(q.days).join(", ")} | ${st?.current ?? 0} | ${st?.best ?? 0} |`);
    }
  } else {
    lines.push("Aucune qu\xEAte active.");
  }
  return lines.join("\n") + "\n";
}

// src/game/actions.ts
var GameError = class extends Error {
};
var DASHBOARD_DELAY_MS = 1500;
var Actions = class {
  constructor(port, store, getPaths, getToday, now = () => /* @__PURE__ */ new Date()) {
    this.queue = Promise.resolve();
    this.dashboardTimer = null;
    this.port = port;
    this.store = store;
    this.getPaths = getPaths;
    this.getToday = getToday;
    this.now = now;
  }
  run(fn) {
    const next = this.queue.then(() => fn());
    this.queue = next.then(
      () => void 0,
      () => void 0
    );
    return next;
  }
  dispose() {
    if (this.dashboardTimer) clearTimeout(this.dashboardTimer);
    this.dashboardTimer = null;
  }
  /* ---------- journal ---------- */
  /** Crée la note du jour si besoin et renvoie son chemin. */
  async ensureJournal(date) {
    const path = journalPath(this.getPaths(), date);
    if (!this.port.stat(path)) {
      const yaml = this.port.stringifyProperties({ type: TYPES.day, quetes: [] });
      try {
        await this.port.create(path, composeNote(yaml, dayNoteBody()));
      } catch (err) {
        if (!this.port.stat(path)) throw err;
      }
    }
    return path;
  }
  /** Chemin de la note du jour (créée au besoin), pour l'ouvrir. */
  openDayNote(date) {
    return this.run(async () => {
      const path = await this.ensureJournal(date);
      await this.store.reload(path);
      return path;
    });
  }
  toggleQuest(questId, date) {
    return this.run(async () => {
      const today = this.getToday();
      if (!isKey(date) || date > today) throw new GameError("On ne peut pas valider une qu\xEAte \xE0 une date future.");
      if (!this.store.quest(questId)) throw new GameError(`Qu\xEAte introuvable : ${questId}`);
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
  toggleRestDay(date) {
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
  appendNote(date, text, questId) {
    return this.run(async () => {
      const clean = text.replace(/\r\n/g, "\n").trim();
      if (!clean) throw new GameError("La note est vide.");
      if (!isKey(date)) throw new GameError("Date invalide.");
      const path = await this.ensureJournal(date);
      const t = this.now();
      const time = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
      const [first = "", ...more] = clean.split("\n");
      const prefix = questId ? `- ${time} \u2014 ${wikilink(questId)} \u2014 ` : `- ${time} \u2014 `;
      const line = [prefix + first.trim(), ...more.map((l) => "  " + l.trim())].join("\n");
      await this.port.process(path, (content) => appendToNotesSection(content, line));
      return path;
    });
  }
  /* ---------- quêtes ---------- */
  createQuest(draft) {
    return this.run(async () => {
      const name = sanitizeFileName(draft.name);
      if (!name) throw new GameError("Donne un nom \xE0 la qu\xEAte.");
      if (!draft.days.length) throw new GameError("Choisis au moins un jour de la semaine.");
      const paths = this.getPaths();
      const path = questPath(paths, name);
      if (this.port.stat(path)) throw new GameError(`Une note \xAB ${name} \xBB existe d\xE9j\xE0 dans les qu\xEAtes.`);
      const today = this.getToday();
      const yaml = this.port.stringifyProperties({
        type: TYPES.quest,
        icone: draft.icon.trim() || "\u2694\uFE0F",
        competence: draft.skill,
        difficulte: draft.difficulty,
        jours: formatDays(draft.days),
        periodes: formatPeriods([{ from: today, to: null }])
      });
      await this.port.create(path, composeNote(yaml, "## Pourquoi cette qu\xEAte ?\n\n## Crit\xE8res de r\xE9ussite\n\n## Retours d'exp\xE9rience\n"));
      await this.store.reload(path);
      this.scheduleDashboard();
      const quest = this.store.quest(name);
      if (!quest) throw new GameError("La qu\xEAte n'a pas pu \xEAtre relue apr\xE8s sa cr\xE9ation.");
      return quest;
    });
  }
  updateQuest(questId, draft) {
    return this.run(async () => {
      const paths = this.getPaths();
      let path = this.store.questPath(questId);
      if (!path) throw new GameError(`Qu\xEAte introuvable : ${questId}`);
      const name = sanitizeFileName(draft.name);
      if (!name) throw new GameError("Donne un nom \xE0 la qu\xEAte.");
      if (!draft.days.length) throw new GameError("Choisis au moins un jour de la semaine.");
      if (name !== questId) {
        const target = questPath(paths, name);
        if (this.port.stat(target)) throw new GameError(`Une note \xAB ${name} \xBB existe d\xE9j\xE0 dans les qu\xEAtes.`);
        const referencing = this.store.journalPathsReferencing(questId);
        await this.port.rename(path, target);
        path = target;
        for (const journal of referencing) {
          await this.port.updateProperties(journal, (props) => {
            props["quetes"] = flattenStrings(props["quetes"]).map((e) => linkTarget(e) === questId ? wikilink(name) : e);
          });
        }
        await this.store.reloadMany([...referencing, path, oldQuestPath(paths, questId)]);
      }
      await this.port.updateProperties(path, (props) => {
        props["type"] = props["type"] ?? TYPES.quest;
        props["icone"] = draft.icon.trim() || "\u2694\uFE0F";
        props["competence"] = draft.skill;
        props["difficulte"] = draft.difficulty;
        props["jours"] = formatDays(draft.days);
        if (!props["periodes"]) props["periodes"] = formatPeriods(this.store.quest(name)?.periods ?? this.store.quest(questId)?.periods ?? []);
      });
      await this.store.reloadMany([path, questPath(paths, questId)]);
      this.scheduleDashboard();
    });
  }
  archiveQuest(questId) {
    return this.mutatePeriods(questId, (periods, today) => {
      const next = periods.map((p) => p.to === null ? { from: p.from, to: today } : p);
      return next;
    });
  }
  restoreQuest(questId) {
    return this.mutatePeriods(questId, (periods, today) => periods.some((p) => p.to === null) ? periods : [...periods, { from: today, to: null }]);
  }
  mutatePeriods(questId, fn) {
    return this.run(async () => {
      const path = this.store.questPath(questId);
      const quest = this.store.quest(questId);
      if (!path || !quest) throw new GameError(`Qu\xEAte introuvable : ${questId}`);
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
  async ensureHero() {
    const path = this.getPaths().hero;
    if (!this.port.stat(path)) {
      const yaml = this.port.stringifyProperties({ type: TYPES.hero, nom: "", classe: null, succes: {} });
      await this.port.create(path, composeNote(yaml, "# H\xE9ros\n\nNotes libres sur ton parcours : motivations, objectifs, citations.\n"));
    }
    return path;
  }
  setHero(hero) {
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
  async recordBadgesNow(badges, date) {
    const path = await this.ensureHero();
    await this.port.updateProperties(path, (props) => {
      const raw = props["succes"];
      const succes = raw && typeof raw === "object" && !Array.isArray(raw) ? { ...raw } : {};
      for (const b of badges) succes[b.id] = date;
      props["succes"] = succes;
    });
    await this.store.reload(path);
  }
  /* ---------- structure de notes ---------- */
  /** Crée ce qui manque : guide, modèles, note du héros. `forceGuide` réécrit le guide. */
  scaffold(opts = {}) {
    return this.run(async () => {
      const paths = this.getPaths();
      const created = [];
      const put = async (path, content, overwrite = false) => {
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
  generateReview(anyDayOfWeek) {
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
      await this.port.process(path, (content) => replaceAutoBlock(content, block) ?? `${content.replace(/\s*$/, "")}

${block}
`);
      await this.port.updateProperties(path, (props) => Object.assign(props, reviewProperties(input)));
      return { path, created: false };
    });
  }
  scheduleDashboard() {
    if (this.dashboardTimer) clearTimeout(this.dashboardTimer);
    this.dashboardTimer = setTimeout(() => void this.flushDashboard().catch((e) => console.warn("[Pixel Quest] tableau de bord", e)), DASHBOARD_DELAY_MS);
  }
  /** Réécrit le tableau de bord, seulement si son contenu a changé (limite le bruit de synchronisation). */
  flushDashboard() {
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
        today: this.getToday()
      };
      const content = composeNote(this.port.stringifyProperties(dashboardProperties(input)), dashboardBody(input));
      if (this.port.stat(paths.dashboard)) {
        if (await this.port.read(paths.dashboard) === content) return false;
        await this.port.process(paths.dashboard, () => content);
      } else {
        await this.port.create(paths.dashboard, content);
      }
      return true;
    });
  }
  /** Pour l'interface : quêtes actives / archivées. */
  static partition(quests) {
    return { active: quests.filter((q) => !isArchived(q)), archived: quests.filter(isArchived) };
  }
};
function oldQuestPath(paths, questId) {
  return questPath(paths, questId);
}

// src/game/store.ts
var DEBOUNCE_MS = 150;
var READ_CONCURRENCY = 12;
var GameStore = class {
  constructor(port, getPaths, getToday) {
    this.hero = emptyHero();
    this.quests = /* @__PURE__ */ new Map();
    this.journal = /* @__PURE__ */ new Map();
    this.listeners = /* @__PURE__ */ new Set();
    this.version = 0;
    this.cache = null;
    this.pending = /* @__PURE__ */ new Set();
    this.timer = null;
    this.unwatch = null;
    this.port = port;
    this.getPaths = getPaths;
    this.getToday = getToday;
  }
  /* ---------- lecture ---------- */
  questList() {
    return [...this.quests.values()].sort((a, b) => {
      const fa = firstActiveDay(a);
      const fb = firstActiveDay(b);
      return fa < fb ? -1 : fa > fb ? 1 : a.name.localeCompare(b.name, "fr");
    });
  }
  quest(id) {
    for (const q of this.quests.values()) if (q.id === id) return q;
    return void 0;
  }
  questPath(id) {
    for (const [path, q] of this.quests) if (q.id === id) return path;
    return void 0;
  }
  journalEntry(date) {
    for (const e of this.journal.values()) if (e.date === date) return e;
    return void 0;
  }
  journalDates() {
    return [...this.journal.values()].map((e) => e.date).sort();
  }
  /** Notes de journal dont la liste `quetes` référence cette quête. */
  journalPathsReferencing(questId) {
    return [...this.journal].filter(([, e]) => e.quests.includes(questId)).map(([path]) => path);
  }
  world() {
    const log = {};
    const offDays = [];
    for (const e of this.journal.values()) {
      if (e.quests.length) log[e.date] = e.quests;
      if (e.rest) offDays.push(e.date);
    }
    return { quests: this.questList(), log, offDays: offDays.sort(), heroClass: this.hero.heroClass, badges: this.hero.badges };
  }
  progress() {
    const today = this.getToday();
    if (this.cache && this.cache.version === this.version && this.cache.today === today) return this.cache.progress;
    const progress = computeProgress(this.world(), today);
    this.cache = { version: this.version, today, progress };
    return progress;
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  /* ---------- chargement ---------- */
  async loadAll() {
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
  async reload(path) {
    await this.load(path);
    this.touch();
  }
  async reloadMany(paths) {
    for (const p of paths) await this.load(p);
    this.touch();
  }
  async load(path) {
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
  watch() {
    this.unwatch?.();
    this.unwatch = this.port.onChange((event) => this.handle(event));
  }
  dispose() {
    this.unwatch?.();
    this.unwatch = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.listeners.clear();
  }
  handle(event) {
    this.pending.add(event.path);
    if (event.type === "rename") this.pending.add(event.oldPath);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), DEBOUNCE_MS);
  }
  /** Traite tout de suite les changements en attente (utile aux tests). */
  async flush() {
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
  touch() {
    this.version++;
    for (const fn of [...this.listeners]) fn();
  }
  /** Nom lisible d'une quête à partir de son identifiant (liens orphelins inclus). */
  static label(id) {
    return basename(id);
  }
};

// src/obsidian/host.ts
var import_obsidian = require("obsidian");
var BuilderModal = class extends import_obsidian.Modal {
  constructor(app, build, onClose) {
    super(app);
    this.build = build;
    this.onCloseCb = onClose;
  }
  onOpen() {
    this.modalEl.addClass("pq-modal-shell");
    this.contentEl.empty();
    this.contentEl.appendChild(this.build(() => this.close()));
  }
  onClose() {
    this.contentEl.empty();
    this.onCloseCb?.();
  }
};
var ConfirmModal = class extends import_obsidian.Modal {
  constructor(app, text, done) {
    super(app);
    this.answered = false;
    this.text = text;
    this.done = done;
  }
  onOpen() {
    this.modalEl.addClass("pq-modal-shell");
    const wrap = this.contentEl.createDiv({ cls: "pq-theme pq-modal" });
    const body = wrap.createDiv({ cls: "pq-modal-body" });
    body.createEl("p", { text: this.text });
    const actions = body.createDiv({ cls: "pq-modal-actions" });
    actions.createEl("button", { text: "Annuler", cls: "pq-btn" }).addEventListener("click", () => this.answer(false));
    const ok = actions.createEl("button", { text: "Confirmer", cls: "pq-btn pq-primary" });
    ok.addEventListener("click", () => this.answer(true));
    ok.focus();
  }
  answer(ok) {
    this.answered = true;
    this.done(ok);
    this.close();
  }
  onClose() {
    this.contentEl.empty();
    if (!this.answered) this.done(false);
  }
};
var ObsidianHost = class {
  constructor(app) {
    this.current = null;
    this.app = app;
  }
  openNote(path) {
    const file = this.app.vault.getAbstractFileByPath((0, import_obsidian.normalizePath)(path));
    if (file instanceof import_obsidian.TFile) void this.app.workspace.getLeaf("tab").openFile(file);
    else new import_obsidian.Notice(`Note introuvable : ${path}`);
  }
  notice(message2) {
    new import_obsidian.Notice(message2);
  }
  confirm(message2) {
    return new Promise((resolve) => new ConfirmModal(this.app, message2, resolve).open());
  }
  modal(build, opts) {
    this.current?.close();
    const modal = new BuilderModal(this.app, build, opts?.onClose);
    this.current = modal;
    modal.open();
  }
  closeModal() {
    this.current?.close();
    this.current = null;
  }
};

// src/obsidian/port.ts
var import_obsidian2 = require("obsidian");
var ObsidianVaultPort = class {
  constructor(app) {
    this.app = app;
  }
  file(path) {
    const f = this.app.vault.getAbstractFileByPath((0, import_obsidian2.normalizePath)(path));
    if (!(f instanceof import_obsidian2.TFile)) throw new Error(`Note introuvable : ${path}`);
    return f;
  }
  async ensureFolder(path) {
    const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    if (!dir) return;
    let current = "";
    for (const part of dir.split("/")) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath((0, import_obsidian2.normalizePath)(current))) {
        try {
          await this.app.vault.createFolder((0, import_obsidian2.normalizePath)(current));
        } catch {
        }
      }
    }
  }
  list(folder) {
    const root = this.app.vault.getAbstractFileByPath((0, import_obsidian2.normalizePath)(folder));
    if (!(root instanceof import_obsidian2.TFolder)) return [];
    const out = [];
    const walk = (dir) => {
      for (const child of dir.children) {
        if (child instanceof import_obsidian2.TFolder) walk(child);
        else if (child instanceof import_obsidian2.TFile && child.extension === "md") out.push({ path: child.path, ctime: child.stat.ctime, mtime: child.stat.mtime });
      }
    };
    walk(root);
    return out;
  }
  stat(path) {
    const f = this.app.vault.getAbstractFileByPath((0, import_obsidian2.normalizePath)(path));
    return f instanceof import_obsidian2.TFile ? { path: f.path, ctime: f.stat.ctime, mtime: f.stat.mtime } : null;
  }
  async read(path) {
    return this.app.vault.read(this.file(path));
  }
  async create(path, content) {
    const p = (0, import_obsidian2.normalizePath)(path);
    await this.ensureFolder(p);
    await this.app.vault.create(p, content);
  }
  async process(path, fn) {
    await this.app.vault.process(this.file(path), fn);
  }
  async updateProperties(path, fn) {
    await this.app.fileManager.processFrontMatter(this.file(path), (fm) => fn(fm));
  }
  async rename(path, newPath) {
    const target = (0, import_obsidian2.normalizePath)(newPath);
    await this.ensureFolder(target);
    await this.app.fileManager.renameFile(this.file(path), target);
  }
  parseProperties(content) {
    const info = (0, import_obsidian2.getFrontMatterInfo)(content);
    if (!info.exists) return {};
    const parsed = (0, import_obsidian2.parseYaml)(info.frontmatter);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  }
  stringifyProperties(props) {
    return (0, import_obsidian2.stringifyYaml)(props);
  }
  onChange(handler) {
    const { vault } = this.app;
    const isNote = (f) => f instanceof import_obsidian2.TFile && f.extension === "md";
    const refs = [
      vault.on("create", (f) => isNote(f) && handler({ type: "create", path: f.path })),
      vault.on("modify", (f) => isNote(f) && handler({ type: "modify", path: f.path })),
      vault.on("delete", (f) => isNote(f) && handler({ type: "delete", path: f.path })),
      vault.on("rename", (f, oldPath) => isNote(f) && handler({ type: "rename", path: f.path, oldPath }))
    ];
    return () => refs.forEach((ref) => vault.offref(ref));
  }
};

// src/obsidian/settings.ts
var import_obsidian3 = require("obsidian");
var DEFAULT_SETTINGS = { root: DEFAULT_ROOT };
var PixelQuestSettingTab = class extends import_obsidian3.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian3.Setting(containerEl).setName("Dossier des notes").setDesc("Dossier du vault o\xF9 Pixel Quest range ses notes (qu\xEAtes, journal, revues\u2026). Les notes existantes ne sont pas d\xE9plac\xE9es.").addText(
      (text) => text.setPlaceholder(DEFAULT_ROOT).setValue(this.plugin.settings.root).onChange(async (value) => {
        this.plugin.settings.root = value.trim() || DEFAULT_ROOT;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Cr\xE9er ou r\xE9parer la structure de notes").setDesc("Cr\xE9e le guide, les mod\xE8les et la note du h\xE9ros s'ils manquent. Ne modifie jamais tes qu\xEAtes ni ton journal.").addButton(
      (button) => button.setButtonText("Cr\xE9er / r\xE9parer").onClick(async () => {
        const { created } = await this.plugin.actions.scaffold();
        this.plugin.host.notice(created.length ? `${created.length} note(s) cr\xE9\xE9e(s).` : "La structure est d\xE9j\xE0 compl\xE8te.");
      })
    );
    new import_obsidian3.Setting(containerEl).setName("R\xE9\xE9crire le guide").setDesc("Remplace le guide du cadre de notes par la version du plugin (utile apr\xE8s une mise \xE0 jour).").addButton(
      (button) => button.setButtonText("R\xE9\xE9crire").onClick(async () => {
        await this.plugin.actions.scaffold({ forceGuide: true });
        this.plugin.host.notice("Guide mis \xE0 jour.");
      })
    );
  }
};

// src/obsidian/view.ts
var import_obsidian4 = require("obsidian");

// src/ui/dom.ts
function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === void 0) continue;
      if (k === "class") el.className = String(v);
      else if (k === "style") for (const [p, val] of Object.entries(v)) el.style.setProperty(p, val);
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k.startsWith("aria-")) el.setAttribute(k, String(v));
      else if (k === "value" || k === "checked" || k === "selected" || k === "disabled" || k === "hidden") el[k] = v;
      else if (v === true) el.setAttribute(k, "");
      else if (v !== false) el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const child of children) {
    if (child === null || child === void 0 || child === false) continue;
    if (Array.isArray(child)) append(el, child);
    else el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}
var plural = (n, one, many) => n > 1 ? many : one;
var nf = new Intl.NumberFormat("fr-FR");

// src/game/starters.ts
var WEEK = [1, 2, 3, 4, 5];
var ALL = [0, 1, 2, 3, 4, 5, 6];
var STARTERS = [
  { name: "Planifier ma journ\xE9e (3 priorit\xE9s)", icon: "\u{1F5D3}\uFE0F", skill: "methode", difficulty: "facile", days: WEEK, popular: true },
  { name: "Bloc de travail profond (90 min)", icon: "\u{1F3AF}", skill: "concentration", difficulty: "difficile", days: WEEK, popular: true },
  { name: "Apprendre 20 minutes", icon: "\u{1F4DA}", skill: "savoir", difficulty: "moyen", days: ALL, popular: true },
  { name: "\xC9changer avec quelqu'un de mon r\xE9seau", icon: "\u{1F91D}", skill: "charisme", difficulty: "moyen", days: [2, 4], popular: true },
  { name: "Revue de fin de journ\xE9e", icon: "\u{1F4DD}", skill: "methode", difficulty: "facile", days: WEEK, popular: true },
  { name: "Vider ma bo\xEEte de r\xE9ception", icon: "\u{1F4E5}", skill: "methode", difficulty: "facile", days: WEEK },
  { name: "Pause active (marche, \xE9tirements)", icon: "\u{1F6B6}", skill: "vitalite", difficulty: "facile", days: WEEK },
  { name: "Veille sectorielle (15 min)", icon: "\u{1F4F0}", skill: "savoir", difficulty: "facile", days: WEEK },
  { name: "Demander un feedback", icon: "\u{1F4AC}", skill: "charisme", difficulty: "difficile", days: [5] },
  { name: "Mettre \xE0 jour mon portfolio LinkedIn", icon: "\u{1F680}", skill: "ambition", difficulty: "moyen", days: [5] }
];

// src/ui/sprites.ts
var SIZE = 16;
var COLORS = {
  O: "#1a1c2c",
  // contour
  F: "#f2c9a5",
  // peau
  H: "#566c86",
  // cheveux
  B: "#333c57",
  // bottes
  W: "#f4f4f4",
  S: "#94b0c2",
  s: "#566c86",
  n: "#a05a2c",
  // bois
  Y: "#ffcd75",
  E: "#ef7d57",
  R: "#b13e53",
  P: "#5d275d",
  G: "#a7f070",
  g: "#38b764",
  t: "#257179",
  d: "#29366f",
  b: "#3b5dc9",
  l: "#41a6f6",
  c: "#73eff7",
  k: "#333c57"
};
var LOOKS = {
  batisseur: { a: "#ef7d57", A: "#b13e53", x: "#ffcd75", H: "#5d275d" },
  erudit: { a: "#3b5dc9", A: "#29366f", x: "#ffcd75", H: "#333c57" },
  diplomate: { a: "#38b764", A: "#257179", x: "#ffcd75", H: "#a05a2c" },
  stratege: { a: "#b13e53", A: "#5d275d", x: "#ffcd75", H: "#1a1c2c" },
  sage: { a: "#f4f4f4", A: "#94b0c2", x: "#41a6f6", H: "#94b0c2" },
  none: { a: "#94b0c2", A: "#566c86", x: "#f4f4f4", H: "#566c86" }
};
var blank = () => Array.from({ length: SIZE }, () => Array(SIZE).fill("."));
function stamp(grid, map, x, y) {
  map.forEach((row, dy) => {
    [...row].forEach((ch, dx) => {
      const gx = x + dx;
      const gy = y + dy;
      if (ch !== "." && ch !== " " && gx >= 0 && gx < SIZE && gy >= 0 && gy < SIZE) grid[gy][gx] = ch;
    });
  });
}
function plot(grid, pixels) {
  for (const [x, y, ch] of pixels) if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) grid[y][x] = ch;
}
var toRows = (grid) => grid.map((r) => r.join(""));
function mirror(half) {
  return half.map((row) => row + [...row].reverse().join(""));
}
function outlined(content) {
  const h2 = content.length;
  const w = Math.max(...content.map((r) => r.length));
  const x0 = Math.floor((SIZE - w) / 2);
  const y0 = 14 - h2 + 1;
  const grid = blank();
  stamp(grid, content, x0, y0);
  const filled = (x, y) => x >= 0 && x < SIZE && y >= 0 && y < SIZE && grid[y][x] !== ".";
  const edge = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (grid[y][x] === "." && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) edge.push([x, y]);
    }
  }
  for (const [x, y] of edge) grid[y][x] = "O";
  return toRows(grid);
}
var HERO_BASE = [
  "................",
  ".....OOOOOO.....",
  "....OHHHHHHO....",
  "...OHHHHHHHHO...",
  "...OHHFFFFHHO...",
  "...OHFOFFOFHO...",
  "...OFFFFFFFFO...",
  "....OFFFFFFO....",
  "...OOOaaaaOOO...",
  "..OaaaaxxaaaaO..",
  "..OFOaaaaaaOFO..",
  "...OOaaaaaaOO...",
  "....OAAAAAAO....",
  "....OAAOOAAO....",
  "...OBBO..OBBO...",
  "................"
];
var ITEMS = {
  batisseur: { x: 13, y: 7, map: ["SSS", "SsS", "SSS", ".n.", ".n.", ".n.", ".n."] },
  erudit: { x: 13, y: 9, map: ["lll", "lWl", "lWl", "lll"] },
  diplomate: { x: 13, y: 8, map: ["YYY", "WWW", "WRW", "WWW", "YYY"] },
  stratege: { x: 13, y: 5, map: [".W.", ".S.", ".W.", ".S.", ".W.", "YYY", ".n."] },
  sage: { x: 13, y: 5, map: [".c.", "cWc", ".c.", ".n.", ".n.", ".n.", ".n.", ".n."] }
};
function heroArt(heroClass, tier) {
  const look = LOOKS[heroClass ?? "none"];
  const colors = { ...COLORS, a: look.a, A: look.A, x: look.x, H: look.H };
  const g = blank();
  if (tier >= 2) {
    stamp(g, ["AA", "AA", "AA", "AA", "AA", "A."], 1, 9);
    stamp(g, ["AA", "AA", "AA", "AA", "AA", ".A"], 13, 9);
  }
  stamp(g, HERO_BASE, 0, 0);
  if (tier >= 1) plot(g, [[6, 8, "x"], [7, 8, "x"], [8, 8, "x"], [9, 8, "x"], [9, 9, "x"], [9, 10, "x"]]);
  if (tier >= 3) plot(g, [[3, 8, "S"], [4, 8, "S"], [11, 8, "S"], [12, 8, "S"], [3, 9, "s"], [12, 9, "s"]]);
  if (tier >= 4) {
    for (let x = 4; x <= 11; x++) plot(g, [[x, 3, "S"]]);
    for (let x = 5; x <= 10; x++) plot(g, [[x, 2, "S"]]);
    plot(g, [[7, 1, "R"], [8, 1, "R"], [7, 0, "R"], [8, 0, "R"], [4, 4, "s"], [11, 4, "s"]]);
  }
  if (tier >= 5) {
    plot(g, [[5, 1, "Y"], [6, 1, "Y"], [7, 1, "Y"], [8, 1, "Y"], [9, 1, "Y"], [10, 1, "Y"], [5, 0, "Y"], [7, 0, "Y"], [8, 0, "Y"], [10, 0, "Y"]]);
  }
  if (heroClass) {
    const item = ITEMS[heroClass];
    stamp(g, item.map, item.x, item.y);
  }
  if (tier >= 7) {
    colors["a"] = "#94b0c2";
    colors["A"] = "#566c86";
    colors["x"] = "#ffcd75";
  }
  let aura = null;
  if (tier >= 6) {
    const a = blank();
    plot(a, [[1, 3, "c"], [14, 2, "c"], [0, 8, "W"], [15, 9, "c"], [2, 13, "W"], [13, 14, "c"], [1, 5, "W"], [14, 12, "W"]]);
    aura = toRows(a);
  }
  return { grid: toRows(g), colors, aura };
}
var BOSS_CONTENT = {
  // enveloppe en colère
  gobelin: {
    half: [
      "SSSSSSS",
      "WSSSSSS",
      "WWSSRRS",
      "WWWSRRS",
      "WWWWSSS",
      "WWWWWSS",
      "WWWWWWS",
      "WWWWWWW",
      "WWWWkkk",
      "WWWWWWW",
      "WWWWWWW",
      ".kk..kk",
      ".kk..kk"
    ]
  },
  // golem de pierre avec une horloge sur le torse
  golem: {
    half: [
      ".SSSSSS",
      ".SSSSSS",
      ".SYYSSS",
      ".SSSSSS",
      "..SSSSS",
      "sssssss",
      "sSSSSSS",
      "sSSSSWW",
      "sSSSWWk",
      "sSSSWWW",
      "sSSSSWW",
      ".sSSSSS",
      "..SSsss",
      "..SS..s"
    ]
  },
  // blob violet aux multiples yeux
  hydre: {
    half: [
      ".....PP",
      "...PPPP",
      "..PPPPP",
      ".PPWWPP",
      ".PPWkPW",
      "PPPPPPW",
      "PPWWPPP",
      "PPWkPPP",
      "PPPPPPP",
      "PPPPkkk",
      "PPPPPPP",
      ".PP.PP.",
      "..P..P."
    ]
  },
  // spectre à la pastille de notification
  spectre: {
    half: [
      "...WWWW",
      "..WWWWW",
      ".WWWWWW",
      ".WWkkWW",
      ".WWkkWW",
      "WWWWWWW",
      "WWWWWkk",
      "WWWWWkk",
      "WWWWWWW",
      "WWWWWWW",
      "WWWWWWW",
      "WW.WW.W",
      "W.WW.WW"
    ],
    extra: [[11, 3, "R"], [12, 3, "R"], [11, 4, "R"], [12, 4, "R"]]
  },
  // dragon rouge qui crache du feu
  dragon: {
    half: [
      ".W.....",
      ".WW....",
      "..RRRRR",
      ".RRRRRR",
      ".RYkRRR",
      ".RRRRRR",
      "RRRRRRs",
      ".RRRRRR",
      ".RRWRWR",
      "..RRRRR",
      "...EEEE",
      "..EEYYY",
      "...EEYY"
    ]
  }
};
function bossArt(bossId) {
  const def = BOSS_CONTENT[bossId] ?? BOSS_CONTENT["gobelin"];
  const grid = outlined(mirror(def.half));
  if (def.extra) {
    const g = grid.map((r) => [...r]);
    plot(g, def.extra);
    return { grid: toRows(g), colors: COLORS, aura: null };
  }
  return { grid, colors: COLORS, aura: null };
}
var BOSS_IDS = Object.keys(BOSS_CONTENT);
function drawGrid(canvas, grid, colors) {
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, SIZE, SIZE);
  grid.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = colors[ch];
      if (ch === "." || !color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    });
  });
}
function spriteElement(art, className = "") {
  const wrap = document.createElement("span");
  wrap.className = `pq-sprite ${className}`.trim();
  if (art.aura) {
    const aura = document.createElement("canvas");
    aura.className = "pq-sprite-aura";
    drawGrid(aura, art.aura, art.colors);
    wrap.append(aura);
  }
  const body = document.createElement("canvas");
  body.className = "pq-sprite-body";
  drawGrid(body, art.grid, art.colors);
  wrap.append(body);
  return wrap;
}

// src/ui/modals.ts
var EMOJIS = ["\u2694\uFE0F", "\u{1F3AF}", "\u{1F4DA}", "\u{1F91D}", "\u{1F9D8}", "\u{1F680}", "\u{1F5C2}\uFE0F", "\u{1F4DD}", "\u{1F4AC}", "\u{1F4C8}", "\u{1F9E0}", "\u26A1", "\u{1F5D3}\uFE0F", "\u{1F4E5}", "\u{1F6B6}", "\u2615", "\u{1F3A4}", "\u{1F6E0}\uFE0F", "\u{1F50D}", "\u{1F3C3}", "\u{1F4A1}", "\u{1F4DE}", "\u270D\uFE0F", "\u{1F331}"];
var message = (err) => err instanceof GameError || err instanceof Error ? err.message : String(err);
function choice(type, name, value, checked, content, className = "") {
  return h("label", { class: `pq-choice ${className}`.trim() }, h("input", { type, name, value, checked }), h("span", {}, ...content));
}
function classCards(selected) {
  const el = h(
    "div",
    { class: "pq-class-grid", role: "radiogroup", "aria-label": "Classe" },
    CLASS_IDS.map((id) => {
      const def = CLASSES[id];
      return h(
        "label",
        { class: "pq-class-card" },
        h("input", { type: "radio", name: "classe", value: id, checked: id === selected }),
        h(
          "span",
          { class: "pq-class-body" },
          spriteElement(heroArt(id, 0), "pq-class-sprite"),
          h("strong", {}, def.label),
          h("small", {}, def.blurb),
          h("small", { class: "pq-class-fav" }, `\u2605 +${Math.round((CLASS_BONUS - 1) * 100)} % XP : ${def.favored.map((s) => SKILLS[s].label).join(", ")}`)
        )
      );
    })
  );
  return { el, value: () => el.querySelector("input:checked")?.value ?? null };
}
function openHeroCreation(ctx) {
  ctx.host.modal((close) => {
    const error = h("p", { class: "pq-error", role: "alert", hidden: true });
    const name = h("input", { class: "pq-input", id: "pq-name", type: "text", maxlength: 40, value: ctx.store.hero.name, placeholder: "Ton nom de h\xE9ros", autocomplete: "off" });
    const cards = classCards(ctx.store.hero.heroClass);
    const existing = new Set(ctx.store.questList().map((q) => q.name));
    const starters = STARTERS.map((s) => ({
      s,
      input: h("input", { type: "checkbox", checked: !!s.popular && !existing.has(sanitizeFileName(s.name)), disabled: existing.has(sanitizeFileName(s.name)) })
    }));
    const submit = h("button", { class: "pq-btn pq-primary", type: "submit" }, "Commencer l'aventure");
    const form = h(
      "form",
      {
        class: "pq-modal-body",
        onsubmit: (ev) => {
          ev.preventDefault();
          const heroClass = cards.value();
          if (!heroClass) {
            error.textContent = "Choisis une classe pour commencer.";
            error.hidden = false;
            return;
          }
          submit.disabled = true;
          void (async () => {
            try {
              await ctx.actions.scaffold();
              await ctx.actions.setHero({ name: name.value, heroClass });
              for (const { s, input } of starters) {
                if (input.checked && !input.disabled) await ctx.actions.createQuest({ name: s.name, icon: s.icon, skill: s.skill, difficulty: s.difficulty, days: s.days });
              }
              await ctx.actions.flushDashboard();
              close();
            } catch (err) {
              error.textContent = message(err);
              error.hidden = false;
              submit.disabled = false;
            }
          })();
        },
        oninput: () => error.hidden = true
      },
      h("h2", { id: "pq-modal-title" }, "Cr\xE9e ton h\xE9ros"),
      h("p", { class: "pq-dim" }, "Chaque habitude devient une qu\xEAte. Tes progr\xE8s s'\xE9crivent dans des notes de ton vault : ton second brain se remplit en jouant."),
      h("div", { class: "pq-field" }, h("label", { for: "pq-name" }, "Nom"), name),
      h("div", { class: "pq-field" }, h("span", { class: "pq-label" }, "Classe"), cards.el),
      h(
        "div",
        { class: "pq-field" },
        h("span", { class: "pq-label" }, "Qu\xEAtes de d\xE9part"),
        h(
          "div",
          { class: "pq-starters", role: "group", "aria-label": "Qu\xEAtes de d\xE9part" },
          starters.map(
            ({ s, input }) => h("label", { class: "pq-starter" }, input, h("span", { class: "pq-quest-icon", "aria-hidden": "true" }, s.icon), h("span", {}, s.name))
          )
        )
      ),
      error,
      h("div", { class: "pq-modal-actions" }, submit)
    );
    return h("div", { class: "pq-theme pq-modal" }, form);
  });
}
function openClassPicker(ctx) {
  ctx.host.modal((close) => {
    const cards = classCards(ctx.store.hero.heroClass);
    const error = h("p", { class: "pq-error", role: "alert", hidden: true });
    const save = async () => {
      const heroClass = cards.value();
      if (!heroClass) return;
      try {
        await ctx.actions.setHero({ name: ctx.store.hero.name, heroClass });
        close();
      } catch (err) {
        error.textContent = message(err);
        error.hidden = false;
      }
    };
    return h(
      "div",
      { class: "pq-theme pq-modal" },
      h(
        "div",
        { class: "pq-modal-body" },
        h("h2", { id: "pq-modal-title" }, "Changer de classe"),
        h("p", { class: "pq-dim" }, "Le bonus de classe s'applique \xE0 tout l'historique : ton XP et ton niveau sont recalcul\xE9s."),
        cards.el,
        error,
        h("div", { class: "pq-modal-actions" }, h("button", { class: "pq-btn", type: "button", onclick: close }, "Annuler"), h("button", { class: "pq-btn pq-primary", type: "button", onclick: () => void save() }, "Choisir cette classe"))
      )
    );
  });
}
function openQuestModal(ctx, existing) {
  ctx.host.modal((close) => {
    const f = existing ?? { name: "", icon: "\u2694\uFE0F", skill: "methode", difficulty: "moyen", days: [1, 2, 3, 4, 5] };
    const icons = EMOJIS.includes(f.icon) ? EMOJIS : [f.icon, ...EMOJIS];
    const error = h("p", { class: "pq-error", role: "alert", hidden: true });
    const name = h("input", { class: "pq-input", id: "pq-qname", name: "name", type: "text", maxlength: 80, required: true, autocomplete: "off", placeholder: "Ex. Bloc de travail profond", value: f.name });
    const dayBoxes = DISPLAY_ORDER.map((d) => choice("checkbox", "day", String(d), f.days.includes(d), [DAY_LABELS[d] ?? ""], "pq-day"));
    const setDays = (days) => dayBoxes.forEach((l) => l.querySelector("input").checked = days.includes(Number(l.querySelector("input").value)));
    const submit = h("button", { class: "pq-btn pq-primary", type: "submit" }, existing ? "Enregistrer" : "Ajouter la qu\xEAte");
    const form = h(
      "form",
      {
        class: "pq-modal-body",
        novalidate: true,
        oninput: () => error.hidden = true,
        onsubmit: (ev) => {
          ev.preventDefault();
          const data = new FormData(ev.currentTarget);
          const draft = {
            name: String(data.get("name") ?? ""),
            icon: String(data.get("icon") ?? "\u2694\uFE0F"),
            skill: String(data.get("skill")),
            difficulty: String(data.get("difficulty")),
            days: data.getAll("day").map(Number)
          };
          submit.disabled = true;
          void (async () => {
            try {
              if (existing) await ctx.actions.updateQuest(existing.id, draft);
              else await ctx.actions.createQuest(draft);
              close();
            } catch (err) {
              error.textContent = message(err);
              error.hidden = false;
              submit.disabled = false;
            }
          })();
        }
      },
      h("h2", { id: "pq-modal-title" }, existing ? "Modifier la qu\xEAte" : "Nouvelle qu\xEAte"),
      h("div", { class: "pq-field" }, h("label", { for: "pq-qname" }, "Nom (c'est aussi le titre de la note)"), name),
      h("fieldset", { class: "pq-field" }, h("legend", {}, "Ic\xF4ne"), h("div", { class: "pq-row" }, icons.map((e) => choice("radio", "icon", e, e === f.icon, [e], "pq-emoji")))),
      h(
        "fieldset",
        { class: "pq-field" },
        h("legend", {}, "Comp\xE9tence"),
        h("div", { class: "pq-row" }, SKILL_IDS.map((s) => choice("radio", "skill", s, s === f.skill, [`${SKILLS[s].emoji} ${SKILLS[s].label}`]))),
        h("small", { class: "pq-dim" }, "L'XP de la qu\xEAte fait progresser cette comp\xE9tence.")
      ),
      h(
        "fieldset",
        { class: "pq-field" },
        h("legend", {}, "Difficult\xE9"),
        h("div", { class: "pq-row" }, DIFFICULTY_IDS.map((d) => choice("radio", "difficulty", d, d === f.difficulty, [`${"\u2605".repeat(DIFFICULTIES[d].stars)} ${DIFFICULTIES[d].label} \xB7 ${DIFFICULTIES[d].xp} XP`])))
      ),
      h(
        "fieldset",
        { class: "pq-field" },
        h("legend", {}, "Jours pr\xE9vus"),
        h("div", { class: "pq-row" }, dayBoxes),
        h("div", { class: "pq-row" }, h("button", { class: "pq-btn pq-mini", type: "button", onclick: () => setDays([1, 2, 3, 4, 5]) }, "Lun \u2013 Ven"), h("button", { class: "pq-btn pq-mini", type: "button", onclick: () => setDays([0, 1, 2, 3, 4, 5, 6]) }, "Tous les jours")),
        existing ? h("small", { class: "pq-dim" }, "Changer les jours s'applique aussi \xE0 l'historique : les s\xE9ries sont recalcul\xE9es.") : null
      ),
      error,
      h("div", { class: "pq-modal-actions" }, h("button", { class: "pq-btn", type: "button", onclick: close }, "Annuler"), submit)
    );
    return h("div", { class: "pq-theme pq-modal" }, form);
  });
}
function openStarters(ctx) {
  ctx.host.modal((close) => {
    const existing = new Set(ctx.store.questList().map((q) => q.name));
    const rows = STARTERS.map((s) => {
      const exists = existing.has(sanitizeFileName(s.name));
      return { s, exists, input: h("input", { type: "checkbox", checked: false, disabled: exists }) };
    });
    const error = h("p", { class: "pq-error", role: "alert", hidden: true });
    const add = async () => {
      try {
        for (const { s, input } of rows) {
          if (input.checked && !input.disabled) await ctx.actions.createQuest({ name: s.name, icon: s.icon, skill: s.skill, difficulty: s.difficulty, days: s.days });
        }
        close();
      } catch (err) {
        error.textContent = message(err);
        error.hidden = false;
      }
    };
    return h(
      "div",
      { class: "pq-theme pq-modal" },
      h(
        "div",
        { class: "pq-modal-body" },
        h("h2", { id: "pq-modal-title" }, "Qu\xEAtes de d\xE9part"),
        h("p", { class: "pq-dim" }, "Coche celles que tu veux ajouter ; tu pourras toutes les modifier ensuite."),
        h("div", { class: "pq-starters", role: "group", "aria-label": "Qu\xEAtes de d\xE9part" }, rows.map(({ s, exists, input }) => h("label", { class: "pq-starter" + (exists ? " exists" : "") }, input, h("span", { class: "pq-quest-icon", "aria-hidden": "true" }, s.icon), h("span", {}, s.name, exists ? " (d\xE9j\xE0 ajout\xE9e)" : "")))),
        error,
        h("div", { class: "pq-modal-actions" }, h("button", { class: "pq-btn", type: "button", onclick: close }, "Annuler"), h("button", { class: "pq-btn pq-primary", type: "button", onclick: () => void add() }, "Ajouter la s\xE9lection"))
      )
    );
  });
}
function openNoteModal(ctx, date, questId) {
  ctx.host.modal((close) => {
    const error = h("p", { class: "pq-error", role: "alert", hidden: true });
    const text = h("textarea", { class: "pq-input pq-textarea", id: "pq-note", rows: 5, placeholder: "Ce qui s'est pass\xE9, ce que tu as appris, une id\xE9e\u2026" });
    const select = h(
      "select",
      { class: "pq-input", id: "pq-note-quest" },
      h("option", { value: "" }, "Aucune qu\xEAte en particulier"),
      ctx.store.questList().filter((q) => !isArchived(q)).map((q) => h("option", { value: q.id, selected: q.id === questId }, `${q.icon} ${q.name}`))
    );
    const save = async (open) => {
      try {
        const path = await ctx.actions.appendNote(date, text.value, select.value || void 0);
        ctx.host.notice(`Note ajout\xE9e au journal du ${date}`);
        close();
        if (open) ctx.host.openNote(path);
      } catch (err) {
        error.textContent = message(err);
        error.hidden = false;
      }
    };
    return h(
      "div",
      { class: "pq-theme pq-modal" },
      h(
        "div",
        { class: "pq-modal-body" },
        h("h2", { id: "pq-modal-title" }, `Note du journal \u2014 ${date}`),
        h("div", { class: "pq-field" }, h("label", { for: "pq-note" }, "Note"), text),
        h("div", { class: "pq-field" }, h("label", { for: "pq-note-quest" }, "Lier \xE0 une qu\xEAte"), select),
        h("p", { class: "pq-dim" }, "Elle est ajout\xE9e sous \xAB Notes du jour \xBB dans la note du journal, avec un lien vers la qu\xEAte."),
        error,
        h("div", { class: "pq-modal-actions" }, h("button", { class: "pq-btn", type: "button", onclick: close }, "Annuler"), h("button", { class: "pq-btn", type: "button", onclick: () => void save(true) }, "Ajouter et ouvrir"), h("button", { class: "pq-btn pq-primary", type: "button", onclick: () => void save(false) }, "Ajouter"))
      )
    );
  });
}
function openLevelUp(ctx, from, to) {
  const heroClass = ctx.store.hero.heroClass;
  ctx.host.modal(
    (close) => h(
      "div",
      { class: "pq-theme pq-modal" },
      h(
        "div",
        { class: "pq-modal-body pq-celebrate" },
        spriteElement(heroArt(heroClass, to.tier), "pq-big-sprite"),
        h("h2", { id: "pq-modal-title" }, `Niveau ${to.level} !`),
        h("p", {}, from.title !== to.title ? `Nouveau titre : ${to.title}` : `Tu es ${to.title}. Continue comme \xE7a !`),
        from.tier !== to.tier ? h("p", { class: "pq-dim" }, `Nouvel \xE9quipement : ${to.gear}`) : null,
        h("p", { class: "pq-dim" }, `${to.toNext} XP avant le niveau ${to.level + 1}.`),
        h("div", { class: "pq-modal-actions" }, h("button", { class: "pq-btn pq-primary", type: "button", onclick: close }, "Continuer"))
      )
    )
  );
}
function openBossVictory(ctx, boss, bonus) {
  ctx.host.modal(
    (close) => h(
      "div",
      { class: "pq-theme pq-modal" },
      h(
        "div",
        { class: "pq-modal-body pq-celebrate" },
        spriteElement(bossArt(boss.boss.id), "pq-big-sprite pq-defeated"),
        h("h2", { id: "pq-modal-title" }, "Boss vaincu !"),
        h("p", {}, `${boss.boss.name} s'effondre. +${bonus} XP de bonus.`),
        h("p", { class: "pq-dim" }, `${boss.damage} ${plural(boss.damage, "qu\xEAte valid\xE9e", "qu\xEAtes valid\xE9es")} cette semaine.`),
        h("div", { class: "pq-modal-actions" }, h("button", { class: "pq-btn pq-primary", type: "button", onclick: close }, "Victoire !"))
      )
    )
  );
}

// src/ui/app.ts
var TABS = [
  { id: "quests", icon: "\u2694\uFE0F", label: "Qu\xEAtes" },
  { id: "hero", icon: "\u{1F6E1}\uFE0F", label: "H\xE9ros" },
  { id: "boss", icon: "\u{1F409}", label: "Boss" },
  { id: "grimoire", icon: "\u{1F4D6}", label: "Grimoire" }
];
var dfLong = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
var dfShort = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
var fmt = (df, key) => df.format(keyToDate(key));
var reducedMotion = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function mountApp(root, ctx) {
  const ui = { tab: "quests", viewDate: ctx.today(), weekOf: ctx.today(), today: ctx.today(), showArchived: false, lastXpRatio: null };
  root.classList.add("pq-root", "pq-theme");
  const headerEl = h("header", { class: "pq-header" });
  const tabsEl = h("nav", { class: "pq-tabs", "aria-label": "Pixel Quest" });
  const viewEl = h("main", { class: "pq-main" });
  const toastsEl = h("div", { class: "pq-toasts" });
  const fxEl = h("div", { class: "pq-fx", "aria-hidden": "true" });
  const liveEl = h("div", { class: "pq-sr", role: "status", "aria-live": "polite" });
  root.replaceChildren(headerEl, tabsEl, viewEl, toastsEl, fxEl, liveEl);
  function syncToday() {
    const today = ctx.today();
    if (today !== ui.today) {
      const previous = ui.today;
      ui.today = today;
      if (ui.viewDate === previous) ui.viewDate = today;
      if (startOfWeek(ui.weekOf) === startOfWeek(previous)) ui.weekOf = today;
    }
    if (ui.viewDate > today) ui.viewDate = today;
    if (ui.weekOf > today) ui.weekOf = today;
    return today;
  }
  function render() {
    const today = syncToday();
    const progress = ctx.store.progress();
    const active = document.activeElement;
    const focusId = active && root.contains(active) ? active.dataset["focusId"] : void 0;
    renderHeader(progress);
    renderTabs();
    const views = { quests: viewQuests, hero: viewHero, boss: viewBoss, grimoire: viewGrimoire };
    viewEl.replaceChildren(views[ui.tab](progress, today));
    if (focusId) {
      const target = [...root.querySelectorAll("[data-focus-id]")].find((el) => el.dataset["focusId"] === focusId);
      target?.focus({ preventScroll: true });
    }
  }
  let raf = 0;
  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      render();
    });
  };
  const unsubscribe = ctx.store.subscribe(schedule);
  const interval = window.setInterval(() => {
    if (ctx.today() !== ui.today) schedule();
  }, 3e4);
  function bar(ratio, label, now, max, kind = "") {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
    return h(
      "div",
      { class: `pq-bar ${kind}`.trim(), role: "progressbar", "aria-label": label, "aria-valuemin": 0, "aria-valuemax": max, "aria-valuenow": now },
      h("div", { class: "pq-bar-fill", style: { width: `${clamped * 100}%` } })
    );
  }
  function renderHeader(p) {
    const L = p.level;
    const hero = ctx.store.hero;
    const cls = hero.heroClass;
    const ratio = L.progress;
    const fill = bar(ui.lastXpRatio ?? ratio, `Progression vers le niveau ${L.level + 1}`, L.into, L.needed);
    if (ui.lastXpRatio !== null && ui.lastXpRatio !== ratio) {
      const inner = fill.firstElementChild;
      requestAnimationFrame(() => requestAnimationFrame(() => inner.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`));
    }
    ui.lastXpRatio = ratio;
    const next = L.nextTitle ? `Prochain titre : ${L.nextTitle.title} au niveau ${L.nextTitle.level}` : "Titre maximal atteint";
    headerEl.replaceChildren(
      h(
        "div",
        { class: "pq-panel pq-hero-card" },
        h("button", { class: "pq-hero-btn", type: "button", "aria-label": "Voir mon h\xE9ros", onclick: () => go("hero") }, spriteElement(heroArt(cls, L.tier), "pq-hero-sprite")),
        h(
          "div",
          { class: "pq-hero-info" },
          h("div", { class: "pq-name" }, hero.name || "H\xE9ros sans nom"),
          h("div", { class: "pq-sub", title: next }, `${cls ? CLASSES[cls].label : "Sans classe"} \xB7 Niv. ${L.level} ${L.title}`),
          fill,
          h(
            "div",
            { class: "pq-xpmeta" },
            h("span", {}, `${nf.format(L.into)} / ${nf.format(L.needed)} XP`),
            h("span", { class: "pq-chip", title: "Meilleure s\xE9rie en cours", "aria-label": `Meilleure s\xE9rie en cours : ${p.currentStreak} ${plural(p.currentStreak, "jour", "jours")}` }, `\u{1F525} ${p.currentStreak}`),
            h("span", { class: "pq-chip", "aria-label": `${nf.format(p.totalXp)} points d'exp\xE9rience` }, `\u2B50 ${nf.format(p.totalXp)}`)
          )
        )
      )
    );
  }
  function renderTabs() {
    tabsEl.replaceChildren(
      ...TABS.map(
        (t) => h(
          "button",
          { class: "pq-tab", type: "button", "aria-current": ui.tab === t.id ? "page" : null, "data-focus-id": `tab-${t.id}`, onclick: () => go(t.id) },
          h("span", { "aria-hidden": "true" }, t.icon),
          h("span", { class: "pq-tab-label" }, t.label)
        )
      )
    );
  }
  function go(tab) {
    ui.tab = tab;
    render();
    viewEl.scrollTop = 0;
  }
  function announce(text) {
    liveEl.textContent = "";
    window.setTimeout(() => liveEl.textContent = text, 30);
  }
  function toast(icon, title, text) {
    const el = h("div", { class: "pq-toast" }, h("span", { class: "pq-toast-icon", "aria-hidden": "true" }, icon), h("div", {}, h("strong", {}, title), h("span", {}, text)));
    toastsEl.append(el);
    window.setTimeout(() => el.classList.add("leaving"), 3800);
    window.setTimeout(() => el.remove(), 4200);
  }
  function floatXp(delta, x, y) {
    if (delta === 0) return;
    const rect = root.getBoundingClientRect();
    const el = h("div", { class: "pq-float" + (delta < 0 ? " negative" : ""), style: { left: `${x - rect.left}px`, top: `${y - rect.top - 16}px` } }, `${delta > 0 ? "+" : "\u2212"}${Math.abs(delta)} XP`);
    fxEl.append(el);
    window.setTimeout(() => el.remove(), 1200);
  }
  function confetti(count) {
    if (reducedMotion()) return;
    const colors = ["#ffcd75", "#ef7d57", "#a7f070", "#41a6f6", "#73eff7", "#b13e53"];
    const pieces = Array.from(
      { length: count },
      (_, i) => h("i", {
        class: "pq-confetti",
        style: { left: `${Math.random() * 100}%`, background: colors[i % colors.length] ?? "#fff", "--dx": `${Math.round((Math.random() - 0.5) * 120)}px`, "--dur": `${(1.4 + Math.random() * 1.2).toFixed(2)}s`, "--delay": `${(Math.random() * 0.3).toFixed(2)}s` }
      })
    );
    fxEl.append(...pieces);
    window.setTimeout(() => pieces.forEach((el) => el.remove()), 3200);
  }
  async function toggle(quest, date, ev) {
    const rect = ev.currentTarget instanceof HTMLElement ? ev.currentTarget.getBoundingClientRect() : null;
    const x = ev.clientX || (rect ? rect.left + rect.width / 2 : 0);
    const y = ev.clientY || (rect ? rect.top : 0);
    try {
      const r = await ctx.actions.toggleQuest(quest.id, date);
      const delta = r.after.totalXp - r.before.totalXp;
      floatXp(delta, x, y);
      announce(`${quest.name} ${r.done ? "valid\xE9e" : "annul\xE9e"}, ${delta >= 0 ? "+" : ""}${delta} XP`);
      if (!r.done) return;
      const wasPerfect = r.before.days[date]?.perfect ?? false;
      const perfectNow = r.after.days[date]?.perfect ?? false;
      const bossBefore = r.before.bossesDefeated;
      const bossAfter = r.after.bossesDefeated;
      const leveledUp = r.after.level.level > r.before.level.level;
      let delay = 250;
      if (bossAfter > bossBefore) {
        const boss = r.after.bosses.find((b) => b.defeated && b.defeatedOn === date);
        if (boss) {
          openBossVictory(ctx, boss, BOSS_BONUS);
          confetti(60);
          delay = 700;
        }
      }
      if (leveledUp) {
        openLevelUp(ctx, r.before.level, r.after.level);
        confetti(70);
        delay = 700;
      } else if (perfectNow && !wasPerfect && delay === 250) {
        toast("\u2B50", "Journ\xE9e parfaite !", `+${PERFECT_DAY_BONUS} XP de bonus`);
        confetti(30);
        delay = 700;
      }
      r.newBadges.forEach((b, i) => window.setTimeout(() => toast(b.icon, `Succ\xE8s : ${b.name}`, b.desc), delay + i * 500));
    } catch (err) {
      ctx.host.notice(err instanceof GameError ? err.message : `Erreur : ${String(err)}`);
    }
  }
  function periodNav(o) {
    return h(
      "div",
      { class: "pq-nav" },
      h("button", { class: "pq-btn pq-square", type: "button", "aria-label": o.prev, disabled: !o.canPrev, "data-focus-id": "nav-prev", onclick: o.onPrev }, "\u2039"),
      h("div", { class: "pq-nav-title" }, h("h2", {}, o.title), o.sub),
      h("button", { class: "pq-btn pq-square", type: "button", "aria-label": o.next, disabled: !o.canNext, "data-focus-id": "nav-next", onclick: o.onNext }, "\u203A")
    );
  }
  function earliestDay(today) {
    let min = today;
    for (const q of ctx.store.questList()) for (const per of q.periods) if (per.from < min) min = per.from;
    return min;
  }
  function needsHero() {
    return !ctx.store.hero.exists || !ctx.store.hero.heroClass;
  }
  function emptyPanel() {
    const noHero = needsHero();
    return h(
      "section",
      { class: "pq-panel pq-empty" },
      h("div", { class: "pq-empty-art", "aria-hidden": "true" }, spriteElement(heroArt(ctx.store.hero.heroClass, 0), "pq-big-sprite")),
      h("h2", {}, noHero ? "Ton aventure t'attend" : "Aucune qu\xEAte pour l'instant"),
      h("p", { class: "pq-dim" }, noHero ? "Choisis ta classe et tes premi\xE8res qu\xEAtes : tout s'\xE9crira dans des notes de ton vault." : "Une qu\xEAte est une habitude \xE0 accomplir. Chacune devient une note dans ton vault."),
      h(
        "div",
        { class: "pq-row pq-center" },
        noHero ? h("button", { class: "pq-btn pq-primary", type: "button", onclick: () => openHeroCreation(ctx) }, "Cr\xE9er mon h\xE9ros") : [h("button", { class: "pq-btn pq-primary", type: "button", onclick: () => openStarters(ctx) }, "Qu\xEAtes de d\xE9part"), h("button", { class: "pq-btn", type: "button", onclick: () => openQuestModal(ctx) }, "Nouvelle qu\xEAte")]
      )
    );
  }
  function viewQuests(p, today) {
    const key = ui.viewDate;
    const isToday = key === today;
    const world = ctx.store.world();
    const offSet = new Set(world.offDays);
    const isRest = offSet.has(key);
    const cls = world.heroClass;
    const scheduled = world.quests.filter((q) => isScheduled(q, key, offSet));
    const doneIds = new Set(world.log[key] ?? []);
    const day = p.days[key] ?? { scheduled: 0, done: 0, perfect: false, off: isRest };
    const nav = periodNav({
      title: fmt(dfLong, key),
      sub: isToday ? h("span", { class: "pq-tag" }, "Aujourd'hui") : h("button", { class: "pq-btn pq-mini", type: "button", onclick: () => {
        ui.viewDate = today;
        render();
      } }, "Revenir \xE0 aujourd'hui"),
      canPrev: key > earliestDay(today),
      canNext: key < today,
      onPrev: () => {
        ui.viewDate = addDays(key, -1);
        render();
      },
      onNext: () => {
        ui.viewDate = addDays(key, 1);
        render();
      },
      prev: "Jour pr\xE9c\xE9dent",
      next: "Jour suivant"
    });
    if (!world.quests.length || needsHero()) return h("div", { class: "pq-view" }, nav, emptyPanel());
    const total = scheduled.length;
    let headline;
    let sub;
    if (isRest) {
      headline = "Jour de repos \u{1F3D6}\uFE0F";
      sub = "Aucune qu\xEAte pr\xE9vue, aucune s\xE9rie perdue.";
    } else if (!total) {
      headline = "Rien de pr\xE9vu ce jour";
      sub = "Profite-en, ou ajoute une qu\xEAte dans le Grimoire.";
    } else {
      headline = `${day.done} ${plural(day.done, "qu\xEAte accomplie", "qu\xEAtes accomplies")} sur ${total}`;
      sub = day.perfect ? "Journ\xE9e parfaite !" : `Encore ${total - day.done} pour une journ\xE9e parfaite (+${PERFECT_DAY_BONUS} XP).`;
    }
    const summary = h(
      "section",
      { class: "pq-panel" },
      h("div", { class: "pq-summary-head" }, h("strong", {}, headline), h("span", { class: "pq-dim" }, `+${nf.format(p.xpByDay[key] ?? 0)} XP ${isToday ? "aujourd'hui" : "ce jour-l\xE0"}`)),
      total ? bar(day.done / total, "Qu\xEAtes du jour", day.done, total, day.perfect ? "pq-gold" : "") : null,
      h("p", { class: "pq-dim" }, sub),
      day.perfect ? h("div", { class: "pq-banner" }, `\u{1F389} Journ\xE9e parfaite ! Bonus de +${PERFECT_DAY_BONUS} XP.`) : null,
      h(
        "div",
        { class: "pq-switch-row" },
        h("div", {}, h("div", { id: "pq-rest-label", class: "pq-strong" }, "Jour de repos / cong\xE9"), h("div", { class: "pq-dim" }, "Suspend les qu\xEAtes du jour sans casser tes s\xE9ries.")),
        h("button", { class: "pq-switch", type: "button", role: "switch", "aria-checked": isRest, "aria-labelledby": "pq-rest-label", "data-focus-id": "rest-switch", onclick: () => void ctx.actions.toggleRestDay(key).catch((e) => ctx.host.notice(String(e))) })
      )
    );
    const list = isRest || !total ? null : h(
      "ul",
      { class: "pq-quest-list" },
      scheduled.map((q) => {
        const done = doneIds.has(q.id);
        const stat = p.questStats[q.id];
        const streakNow = done ? stat?.streakAt[key] ?? 0 : isToday ? stat?.current ?? 0 : 0;
        const applied = done ? stat?.streakAt[key] ?? 0 : isToday ? (stat?.current ?? 0) + 1 : 0;
        const mult = streakMultiplier(applied) * (isFavored(cls, q.skill) ? CLASS_BONUS : 1);
        const xp = xpPreview(q, p, key, done, cls);
        const stars = DIFFICULTIES[q.difficulty].stars;
        return h(
          "li",
          { class: "pq-quest" + (done ? " done" : "") },
          h(
            "button",
            { class: "pq-quest-main", type: "button", "aria-pressed": done, "data-focus-id": `q-${q.id}`, onclick: (ev) => void toggle(q, key, ev) },
            h("span", { class: "pq-check", "aria-hidden": "true" }, "\u2713"),
            h("span", { class: "pq-quest-icon", "aria-hidden": "true" }, q.icon),
            h(
              "span",
              { class: "pq-quest-body" },
              h("span", { class: "pq-quest-name" }, q.name),
              h(
                "span",
                { class: "pq-quest-meta" },
                h("span", { class: "pq-xp" }, `+${xp} XP`, mult > 1 ? h("small", {}, ` \xD7${nf.format(Math.round(mult * 100) / 100)}`) : null),
                h("span", {}, `${SKILLS[q.skill].emoji} ${SKILLS[q.skill].label}`),
                h("span", { title: DIFFICULTIES[q.difficulty].label, "aria-label": DIFFICULTIES[q.difficulty].label }, "\u2605".repeat(stars) + "\u2606".repeat(3 - stars)),
                streakNow > 0 ? h("span", { title: "S\xE9rie en cours" }, `\u{1F525} ${streakNow}`) : null
              )
            )
          ),
          h("button", { class: "pq-btn pq-square pq-note-btn", type: "button", "aria-label": `Ajouter une note \xE0 \xAB ${q.name} \xBB`, onclick: () => openNoteModal(ctx, key, q.id) }, "\u270E")
        );
      })
    );
    const notes = h(
      "div",
      { class: "pq-row" },
      h("button", { class: "pq-btn", type: "button", onclick: () => openNoteModal(ctx, key) }, "\u{1F4DD} Note rapide"),
      h("button", { class: "pq-btn", type: "button", onclick: () => void ctx.actions.openDayNote(key).then((path) => ctx.host.openNote(path)).catch((e) => ctx.host.notice(String(e))) }, "\u{1F4C4} Ouvrir la note du jour")
    );
    return h("div", { class: "pq-view" }, nav, summary, list, notes);
  }
  function viewHero(p) {
    const L = p.level;
    const hero = ctx.store.hero;
    const cls = hero.heroClass;
    const def = cls ? CLASSES[cls] : null;
    const identity = h(
      "section",
      { class: "pq-panel pq-identity" },
      spriteElement(heroArt(cls, L.tier), "pq-big-sprite pq-bob"),
      h(
        "div",
        {},
        h("h2", {}, hero.name || "H\xE9ros sans nom"),
        h("div", { class: "pq-strong" }, `${def ? def.label : "Sans classe"} \xB7 Niv. ${L.level} ${L.title}`),
        def ? h("p", { class: "pq-dim" }, def.blurb) : null,
        h("p", { class: "pq-dim" }, `\xC9quipement : ${L.gear}. ${L.nextTitle ? `Prochain titre : ${L.nextTitle.title} (niveau ${L.nextTitle.level}).` : "Titre maximal atteint."}`),
        h("button", { class: "pq-btn pq-mini", type: "button", onclick: () => cls ? openClassPicker(ctx) : openHeroCreation(ctx) }, cls ? "Changer de classe" : "Choisir une classe")
      )
    );
    const skills = h(
      "section",
      { class: "pq-panel" },
      h("h2", {}, "Comp\xE9tences"),
      h(
        "ul",
        { class: "pq-skills" },
        SKILL_IDS.map((id) => {
          const s = p.skills[id];
          return h(
            "li",
            { class: "pq-skill" },
            h("span", { class: "pq-skill-icon", "aria-hidden": "true" }, SKILLS[id].emoji),
            h(
              "div",
              { class: "pq-skill-body" },
              h("div", { class: "pq-skill-head" }, h("strong", {}, SKILLS[id].label), s.favored ? h("span", { class: "pq-tag pq-gold-tag", title: `Comp\xE9tence favorite : +${Math.round((CLASS_BONUS - 1) * 100)} % d'XP` }, "\u2605 classe") : null, h("span", { class: "pq-dim" }, `Niv. ${s.level} \xB7 ${s.rank}`)),
              bar(s.progress, `${SKILLS[id].label} : progression vers le niveau ${s.level + 1}`, s.into, s.needed, "pq-thin"),
              h("div", { class: "pq-dim pq-small" }, `${nf.format(s.into)} / ${nf.format(s.needed)} XP \xB7 ${s.count} ${plural(s.count, "qu\xEAte", "qu\xEAtes")}`)
            )
          );
        })
      ),
      h("p", { class: "pq-dim pq-small" }, `XP : qu\xEAtes ${nf.format(p.xpBreakdown.completions)} \xB7 journ\xE9es parfaites ${nf.format(p.xpBreakdown.perfectDays)} \xB7 boss ${nf.format(p.xpBreakdown.bosses)}`)
    );
    const badges = evaluateBadges(p);
    const stored = hero.badges;
    const isUnlocked = (b) => Boolean(stored[b.id]) || b.reached;
    const unlocked = badges.filter(isUnlocked);
    const locked = badges.filter((b) => !isUnlocked(b)).sort((a, b) => b.value / b.target - a.value / a.target);
    const badgeCard = (b, ok) => h(
      "li",
      { class: "pq-badge" + (ok ? "" : " locked"), title: b.desc },
      h("span", { class: "pq-badge-icon", "aria-hidden": "true" }, b.icon),
      h("strong", {}, b.name),
      h("small", {}, b.desc),
      ok ? h("small", { class: "pq-ok" }, `\u2713 ${stored[b.id] ? fmt(dfShort, stored[b.id]) : "D\xE9bloqu\xE9"}`) : h("small", { class: "pq-dim" }, `\u{1F512} ${nf.format(Math.min(b.value, b.target))} / ${nf.format(b.target)}`)
    );
    const achievements = h(
      "section",
      { class: "pq-panel" },
      h("div", { class: "pq-row-between" }, h("h2", {}, "Succ\xE8s"), h("span", { class: "pq-dim" }, `${unlocked.length} / ${badges.length}`)),
      h("ul", { class: "pq-badges" }, unlocked.map((b) => badgeCard(b, true)), locked.map((b) => badgeCard(b, false)))
    );
    return h("div", { class: "pq-view" }, identity, skills, achievements);
  }
  function bossPanel(b) {
    if (!b) return h("section", { class: "pq-panel pq-empty" }, h("p", { class: "pq-dim" }, "Aucune qu\xEAte n'\xE9tait pr\xE9vue cette semaine-l\xE0 : pas de combat."));
    const left = Math.max(0, b.required - b.damage);
    const light = b.slots < 5;
    return h(
      "section",
      { class: "pq-panel pq-boss" + (b.defeated ? " defeated" : "") },
      h("div", { class: "pq-boss-art" }, spriteElement(bossArt(b.boss.id), "pq-big-sprite" + (b.defeated ? " pq-defeated" : " pq-bob"))),
      h(
        "div",
        { class: "pq-boss-info" },
        h("h2", {}, b.boss.name),
        h("p", { class: "pq-dim" }, b.boss.blurb),
        light ? h("p", { class: "pq-strong" }, "Semaine trop l\xE9g\xE8re : il faut au moins 5 qu\xEAtes pr\xE9vues pour qu'un boss apparaisse.") : [
          bar(b.required ? left / b.required : 0, `Points de vie de ${b.boss.name}`, left, b.required, "pq-danger"),
          h("div", { class: "pq-row-between" }, h("span", { class: "pq-strong" }, b.defeated ? "VAINCU \u2705" : `PV ${left} / ${b.required}`), h("span", { class: "pq-dim" }, `${b.damage} d\xE9g\xE2ts \xB7 ${b.slots} qu\xEAtes pr\xE9vues`)),
          h("p", { class: "pq-dim pq-small" }, b.defeated ? `+${BOSS_BONUS} XP de bonus obtenus.` : `Valide ${left} ${plural(left, "qu\xEAte", "qu\xEAtes")} de plus pour le vaincre (+${BOSS_BONUS} XP).`)
        ]
      )
    );
  }
  function viewBoss(p, today) {
    const keys = weekKeys(ui.weekOf);
    const start = keys[0] ?? ui.weekOf;
    const end = keys[6] ?? ui.weekOf;
    const thisWeek = startOfWeek(today);
    const world = ctx.store.world();
    const offSet = new Set(world.offDays);
    const nav = periodNav({
      title: `${fmt(dfShort, start)} \u2013 ${fmt(dfShort, end)}`,
      sub: start === thisWeek ? h("span", { class: "pq-tag" }, "Cette semaine") : h("button", { class: "pq-btn pq-mini", type: "button", onclick: () => {
        ui.weekOf = today;
        render();
      } }, "Revenir \xE0 cette semaine"),
      canPrev: start > startOfWeek(earliestDay(today)),
      canNext: start < thisWeek,
      onPrev: () => {
        ui.weekOf = addDays(start, -7);
        render();
      },
      onNext: () => {
        ui.weekOf = addDays(start, 7);
        render();
      },
      prev: "Semaine pr\xE9c\xE9dente",
      next: "Semaine suivante"
    });
    if (!world.quests.length || needsHero()) return h("div", { class: "pq-view" }, nav, emptyPanel());
    const boss = p.bosses.find((b) => b.weekStart === start);
    const rows = world.quests.filter((q) => keys.some((k) => q.periods.some((per) => k >= per.from && (per.to === null || k < per.to))));
    const head = h("tr", {}, h("th", { scope: "col", class: "pq-hname" }, h("span", { class: "pq-sr" }, "Qu\xEAte")), keys.map((k) => h("th", { scope: "col", class: k === today ? "today" : "" }, (DAY_LABELS[keyToDate(k).getDay()] ?? "").slice(0, 3), h("span", { class: "pq-dnum" }, String(Number(k.slice(8)))))));
    const body = rows.map(
      (q) => h(
        "tr",
        {},
        h("th", { scope: "row", class: "pq-hname" }, h("span", { title: q.name }, `${q.icon} ${q.name}`)),
        keys.map((k) => {
          const cls = k === today ? "today" : "";
          if (k > today) return h("td", { class: cls }, h("span", { class: "pq-na", "aria-label": "Pas encore possible" }, "\xB7"));
          if (!isScheduled(q, k, offSet)) return h("td", { class: cls }, h("span", { class: "pq-na", "aria-label": "Non pr\xE9vu" }, "\xB7"));
          const done = (world.log[k] ?? []).includes(q.id);
          return h("td", { class: cls }, h("button", { class: "pq-cell" + (!done && k < today ? " missed" : ""), type: "button", "aria-pressed": done, "aria-label": `${q.name}, ${fmt(dfLong, k)}`, "data-focus-id": `w-${q.id}-${k}`, onclick: (ev) => void toggle(q, k, ev) }, "\u2713"));
        })
      )
    );
    const foot = h("tr", {}, h("th", { scope: "row", class: "pq-hname" }, "Jour"), keys.map((k) => {
      const d = p.days[k];
      let text = "\u2013";
      if (k <= today && d) text = d.off ? "\u{1F3D6}\uFE0F" : d.perfect ? "\u2B50" : d.scheduled ? `${d.done}/${d.scheduled}` : "\u2013";
      return h("td", { class: k === today ? "today" : "" }, text);
    }));
    const weekXp = keys.reduce((s, k) => s + (p.xpByDay[k] ?? 0), 0);
    const history = p.bosses.slice(-12);
    return h(
      "div",
      { class: "pq-view" },
      nav,
      bossPanel(boss),
      h(
        "section",
        { class: "pq-panel" },
        h("div", { class: "pq-table-wrap" }, h("table", { class: "pq-week" }, h("thead", {}, head), h("tbody", {}, body), h("tfoot", {}, foot))),
        h("p", { class: "pq-dim pq-small" }, `+${nf.format(weekXp)} XP cette semaine \xB7 \u2B50 journ\xE9e parfaite \xB7 \u{1F3D6}\uFE0F repos. Touche une case pour valider ou corriger un jour pass\xE9.`)
      ),
      h(
        "section",
        { class: "pq-panel" },
        h("div", { class: "pq-row-between" }, h("h2", {}, "Tableau de chasse"), h("span", { class: "pq-dim" }, `${p.bossesDefeated} ${plural(p.bossesDefeated, "boss vaincu", "boss vaincus")}`)),
        history.length ? h("ul", { class: "pq-hunt" }, history.map((b) => h("li", { class: b.defeated ? "won" : b.current ? "now" : "lost", title: `${weekLabel(b.weekStart)} \u2014 ${b.boss.name}${b.defeated ? " (vaincu)" : b.current ? " (en cours)" : ""}` }, spriteElement(bossArt(b.boss.id), "pq-mini-sprite"), h("small", {}, b.defeated ? "\u2713" : b.current ? "\u2026" : "\u2717")))) : h("p", { class: "pq-dim" }, "Aucun combat pour l'instant.")
      ),
      h("div", { class: "pq-row" }, h("button", { class: "pq-btn", type: "button", onclick: () => void reviewWeek(ui.weekOf) }, "\u{1F4DC} G\xE9n\xE9rer la revue de la semaine"))
    );
  }
  async function reviewWeek(day) {
    try {
      const { path, created } = await ctx.actions.generateReview(day);
      ctx.host.notice(created ? `Revue cr\xE9\xE9e : ${path}` : `Revue mise \xE0 jour : ${path}`);
      ctx.host.openNote(path);
    } catch (err) {
      ctx.host.notice(String(err));
    }
  }
  function questRow(q, archived) {
    const d = DIFFICULTIES[q.difficulty];
    const days = q.days.length === 7 ? "Tous les jours" : [1, 2, 3, 4, 5].every((x) => q.days.includes(x)) && q.days.length === 5 ? "Lun \u2013 Ven" : [1, 2, 3, 4, 5, 6, 0].filter((x) => q.days.includes(x)).map((x) => DAY_LABELS[x]).join(", ");
    return h(
      "li",
      { class: "pq-manage" + (archived ? " archived" : "") },
      h("span", { class: "pq-quest-icon", "aria-hidden": "true" }, q.icon),
      h("div", { class: "pq-quest-body" }, h("button", { class: "pq-link", type: "button", title: "Ouvrir la note de la qu\xEAte", onclick: () => ctx.host.openNote(ctx.store.questPath(q.id) ?? "") }, q.name), h("div", { class: "pq-quest-meta" }, h("span", {}, `${SKILLS[q.skill].emoji} ${SKILLS[q.skill].label}`), h("span", {}, `${d.label} \xB7 ${d.xp} XP`), h("span", {}, days))),
      h(
        "div",
        { class: "pq-row" },
        archived ? h("button", { class: "pq-btn pq-mini", type: "button", onclick: () => void ctx.actions.restoreQuest(q.id).catch((e) => ctx.host.notice(String(e))) }, "Reprendre") : [h("button", { class: "pq-btn pq-mini", type: "button", "aria-label": `Modifier ${q.name}`, onclick: () => openQuestModal(ctx, q) }, "Modifier"), h("button", { class: "pq-btn pq-mini", type: "button", "aria-label": `Archiver ${q.name}`, onclick: () => void ctx.actions.archiveQuest(q.id).catch((e) => ctx.host.notice(String(e))) }, "Archiver")]
      )
    );
  }
  async function openGenerated(path, prepare) {
    try {
      await prepare();
      ctx.host.openNote(path);
    } catch (err) {
      ctx.host.notice(String(err));
    }
  }
  function viewGrimoire() {
    const quests = ctx.store.questList();
    const active = quests.filter((q) => !isArchived(q));
    const archived = quests.filter(isArchived);
    const paths = ctx.paths();
    const rules = h(
      "ul",
      { class: "pq-rules" },
      h("li", {}, `XP par validation : ${Object.values(DIFFICULTIES).map((d) => `${d.label} ${d.xp}`).join(" \xB7 ")}.`),
      h("li", {}, `S\xE9ries (jours pr\xE9vus valid\xE9s d'affil\xE9e) : ${[...STREAK_TIERS].reverse().map((t) => `\xD7${nf.format(t.mult)} d\xE8s ${t.min} j`).join(", ")}.`),
      h("li", {}, `Classe : +${Math.round((CLASS_BONUS - 1) * 100)} % d'XP sur ses deux comp\xE9tences favorites. Journ\xE9e parfaite : +${PERFECT_DAY_BONUS} XP.`),
      h("li", {}, `Boss de la semaine : 80 % des qu\xEAtes pr\xE9vues valid\xE9es (5 minimum) pour le vaincre, +${BOSS_BONUS} XP.`),
      h("li", {}, "Un jour non pr\xE9vu ou de repos ne casse jamais une s\xE9rie ; un jour pr\xE9vu manqu\xE9 la remet \xE0 z\xE9ro."),
      h("li", {}, `Niveau N de h\xE9ros = 50 \xD7 (N \u2212 1) \xD7 N XP cumul\xE9s. Titres : ${HERO_TITLES.map((t) => `${t.title} (${t.from})`).join(" \u2192 ")}.`)
    );
    return h(
      "div",
      { class: "pq-view" },
      h(
        "section",
        { class: "pq-panel" },
        h("div", { class: "pq-row-between" }, h("h2", {}, `Qu\xEAtes (${active.length})`), h("div", { class: "pq-row" }, h("button", { class: "pq-btn pq-mini", type: "button", onclick: () => openStarters(ctx) }, "Qu\xEAtes de d\xE9part"), h("button", { class: "pq-btn pq-primary pq-mini", type: "button", "data-focus-id": "new-quest", onclick: () => openQuestModal(ctx) }, "+ Nouvelle qu\xEAte"))),
        active.length ? h("ul", { class: "pq-manage-list" }, active.map((q) => questRow(q, false))) : h("p", { class: "pq-dim" }, "Aucune qu\xEAte active."),
        archived.length ? h(
          "details",
          { class: "pq-details", open: ui.showArchived, ontoggle: (ev) => ui.showArchived = ev.currentTarget.open },
          h("summary", {}, `Qu\xEAtes archiv\xE9es (${archived.length})`),
          h("p", { class: "pq-dim pq-small" }, "Une qu\xEAte archiv\xE9e est en pause : tu peux la reprendre sans perdre sa s\xE9rie."),
          h("ul", { class: "pq-manage-list" }, archived.map((q) => questRow(q, true)))
        ) : null
      ),
      h(
        "section",
        { class: "pq-panel" },
        h("h2", {}, "Second brain"),
        h("p", { class: "pq-dim" }, `Tout est \xE9crit dans le dossier \xAB ${paths.root} \xBB de ton vault, en notes Markdown avec propri\xE9t\xE9s.`),
        h(
          "div",
          { class: "pq-row" },
          h("button", { class: "pq-btn", type: "button", onclick: () => void openGenerated(paths.dashboard, () => ctx.actions.flushDashboard()) }, "\u{1F4CA} Tableau de bord"),
          h("button", { class: "pq-btn", type: "button", onclick: () => void openGenerated(paths.guide, () => ctx.actions.scaffold()) }, "\u{1F4D8} Guide du cadre de notes"),
          h("button", { class: "pq-btn", type: "button", onclick: () => void reviewWeek(ctx.today()) }, "\u{1F4DC} Revue de la semaine"),
          h("button", { class: "pq-btn", type: "button", onclick: () => void ctx.actions.scaffold({ forceGuide: true }).then(({ created }) => ctx.host.notice(created.length ? `${created.length} note(s) cr\xE9\xE9e(s)` : "Guide mis \xE0 jour, structure d\xE9j\xE0 compl\xE8te.")).catch((e) => ctx.host.notice(String(e))) }, "\u{1F6E0}\uFE0F R\xE9parer la structure")
        )
      ),
      h("section", { class: "pq-panel" }, h("h2", {}, "R\xE8gles du jeu"), rules)
    );
  }
  render();
  if (needsHero() && !ctx.store.questList().length) openHeroCreation(ctx);
  return {
    refresh: render,
    dispose() {
      unsubscribe();
      window.clearInterval(interval);
      if (raf) cancelAnimationFrame(raf);
      root.replaceChildren();
      root.classList.remove("pq-root", "pq-theme");
    }
  };
}

// src/obsidian/view.ts
var VIEW_TYPE = "pixel-quest-view";
var PixelQuestView = class extends import_obsidian4.ItemView {
  constructor(leaf, getCtx, whenReady) {
    super(leaf);
    this.mounted = null;
    this.getCtx = getCtx;
    this.whenReady = whenReady;
  }
  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return "Pixel Quest";
  }
  getIcon() {
    return "swords";
  }
  async onOpen() {
    this.contentEl.addClass("pq-view-content");
    await this.whenReady();
    this.mounted = mountApp(this.contentEl, this.getCtx());
  }
  async onClose() {
    this.mounted?.dispose();
    this.mounted = null;
  }
};

// src/main.ts
var QuestPicker = class extends import_obsidian5.FuzzySuggestModal {
  constructor(app, quests, onPick) {
    super(app);
    this.quests = quests;
    this.onPick = onPick;
    this.setPlaceholder("Quelle qu\xEAte as-tu accomplie ?");
  }
  getItems() {
    return this.quests;
  }
  getItemText(quest) {
    return `${quest.icon} ${quest.name}`;
  }
  onChooseItem(quest) {
    this.onPick(quest);
  }
};
var PixelQuestPlugin = class extends import_obsidian5.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULT_SETTINGS };
    this.resolveReady = () => void 0;
    this.ready = new Promise((resolve) => this.resolveReady = resolve);
  }
  async onload() {
    await this.loadSettings();
    const port = new ObsidianVaultPort(this.app);
    const paths = () => pathsFor(this.settings.root);
    this.store = new GameStore(port, paths, todayKey);
    this.actions = new Actions(port, this.store, paths, todayKey);
    this.host = new ObsidianHost(this.app);
    this.ctx = { store: this.store, actions: this.actions, host: this.host, paths, today: todayKey };
    this.registerView(VIEW_TYPE, (leaf) => new PixelQuestView(leaf, () => this.ctx, () => this.ready));
    this.addRibbonIcon("swords", "Pixel Quest", () => void this.activateView());
    this.addSettingTab(new PixelQuestSettingTab(this.app, this));
    this.registerCommands();
    this.app.workspace.onLayoutReady(() => void this.start());
  }
  onunload() {
    this.store.dispose();
    this.actions.dispose();
  }
  async start() {
    try {
      await this.store.loadAll();
      this.store.watch();
    } catch (err) {
      console.error("[Pixel Quest] chargement impossible", err);
      new import_obsidian5.Notice("Pixel Quest : impossible de lire les notes du jeu (voir la console).");
    }
    this.resolveReady();
  }
  async loadSettings() {
    this.settings = { ...DEFAULT_SETTINGS, ...await this.loadData() };
  }
  async saveSettings() {
    await this.saveData(this.settings);
    await this.store.loadAll();
  }
  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getLeaf("tab");
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    await workspace.revealLeaf(leaf);
  }
  registerCommands() {
    const today = todayKey;
    this.addCommand({ id: "open", name: "Ouvrir Pixel Quest", callback: () => void this.activateView() });
    this.addCommand({
      id: "complete-quest",
      name: "Valider une qu\xEAte du jour",
      callback: () => {
        const key = today();
        const world = this.store.world();
        const off = new Set(world.offDays);
        const done = new Set(world.log[key] ?? []);
        const todo = world.quests.filter((q) => isScheduled(q, key, off) && !done.has(q.id));
        if (!todo.length) {
          new import_obsidian5.Notice("Toutes les qu\xEAtes du jour sont accomplies, ou aucune n'est pr\xE9vue.");
          return;
        }
        new QuestPicker(this.app, todo, (quest) => {
          void this.actions.toggleQuest(quest.id, key).then((r) => new import_obsidian5.Notice(`${quest.name} : +${r.after.totalXp - r.before.totalXp} XP${r.after.level.level > r.before.level.level ? ` \u2014 niveau ${r.after.level.level} !` : ""}`)).catch((err) => new import_obsidian5.Notice(String(err)));
        }).open();
      }
    });
    this.addCommand({ id: "quick-note", name: "Ajouter une note au journal du jour", callback: () => openNoteModal(this.ctx, today()) });
    this.addCommand({
      id: "day-note",
      name: "Ouvrir la note du journal du jour",
      callback: () => void this.actions.openDayNote(today()).then((path) => this.host.openNote(path))
    });
    this.addCommand({ id: "new-quest", name: "Nouvelle qu\xEAte", callback: () => openQuestModal(this.ctx) });
    this.addCommand({
      id: "weekly-review",
      name: "G\xE9n\xE9rer la revue de la semaine",
      callback: () => void this.actions.generateReview(today()).then(({ path, created }) => {
        new import_obsidian5.Notice(created ? `Revue cr\xE9\xE9e : ${path}` : `Revue mise \xE0 jour : ${path}`);
        this.host.openNote(path);
      })
    });
    this.addCommand({
      id: "dashboard",
      name: "Ouvrir le tableau de bord",
      callback: () => void this.actions.flushDashboard().then(() => this.host.openNote(this.ctx.paths().dashboard))
    });
    this.addCommand({
      id: "scaffold",
      name: "Cr\xE9er ou r\xE9parer la structure de notes",
      callback: () => void this.actions.scaffold().then(({ created }) => new import_obsidian5.Notice(created.length ? `${created.length} note(s) cr\xE9\xE9e(s).` : "La structure est d\xE9j\xE0 compl\xE8te."))
    });
  }
};
