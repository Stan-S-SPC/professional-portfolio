/*
 * Habit Quest — logique métier (sans DOM).
 * Chargé tel quel dans le navigateur (window.HabitCore) et via require() sous Node pour les tests.
 *
 * Principe : l'état ne stocke que des faits (habitudes, validations, jours de repos).
 * L'XP, les séries, les niveaux et les succès sont toujours recalculés à partir de ces faits,
 * ce qui garantit qu'annuler une validation ou modifier l'historique reste cohérent.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HabitCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* Constantes de jeu                                                   */
  /* ------------------------------------------------------------------ */

  const DAY_MS = 86400000;
  const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]; // 0 = dimanche (convention JS)
  const WEEKDAYS = [1, 2, 3, 4, 5];

  const DIFFICULTIES = {
    easy: { label: "Facile", xp: 10 },
    medium: { label: "Moyen", xp: 20 },
    hard: { label: "Difficile", xp: 40 },
  };

  const CATEGORIES = {
    learning: { label: "Apprentissage", icon: "📚" },
    network: { label: "Réseau", icon: "🤝" },
    focus: { label: "Productivité", icon: "🎯" },
    wellbeing: { label: "Bien-être", icon: "🧘" },
    career: { label: "Carrière", icon: "🚀" },
    organisation: { label: "Organisation", icon: "🗂️" },
  };

  const PERFECT_DAY_BONUS = 15;
  // Du palier le plus haut au plus bas : série (en jours prévus) -> multiplicateur d'XP.
  const STREAK_TIERS = [
    { min: 30, mult: 2 },
    { min: 14, mult: 1.5 },
    { min: 7, mult: 1.25 },
  ];

  // Niveau minimal -> titre. Volontairement neutres du point de vue du genre.
  const LEVEL_TITLES = [
    { from: 1, title: "Stagiaire" },
    { from: 3, title: "Junior" },
    { from: 6, title: "Spécialiste" },
    { from: 10, title: "Senior" },
    { from: 15, title: "Stratège" },
    { from: 20, title: "Leader" },
    { from: 30, title: "Mentor" },
    { from: 40, title: "Visionnaire" },
    { from: 50, title: "Légende" },
  ];

  const THEMES = ["auto", "light", "dark"];

  const TEMPLATES = [
    { name: "Planifier ma journée (3 priorités)", icon: "🗓️", category: "organisation", difficulty: "easy", days: WEEKDAYS, popular: true },
    { name: "Bloc de travail profond (90 min)", icon: "🎯", category: "focus", difficulty: "hard", days: WEEKDAYS, popular: true },
    { name: "Apprendre 20 minutes", icon: "📚", category: "learning", difficulty: "medium", days: ALL_DAYS, popular: true },
    { name: "Échanger avec quelqu’un de mon réseau", icon: "🤝", category: "network", difficulty: "medium", days: [2, 4], popular: true },
    { name: "Revue de fin de journée", icon: "📝", category: "organisation", difficulty: "easy", days: WEEKDAYS, popular: true },
    { name: "Vider ma boîte de réception", icon: "📥", category: "organisation", difficulty: "easy", days: WEEKDAYS },
    { name: "Pause active (marche, étirements)", icon: "🚶", category: "wellbeing", difficulty: "easy", days: WEEKDAYS },
    { name: "Veille sectorielle (15 min)", icon: "📰", category: "learning", difficulty: "easy", days: WEEKDAYS },
    { name: "Demander un feedback", icon: "💬", category: "career", difficulty: "hard", days: [5] },
    { name: "Mettre à jour mon portfolio / LinkedIn", icon: "🚀", category: "career", difficulty: "medium", days: [5] },
  ];

  /* ------------------------------------------------------------------ */
  /* Dates — clés locales "AAAA-MM-JJ"                                   */
  /* Toute l'arithmétique passe par des numéros de jour UTC pour être    */
  /* insensible aux changements d'heure.                                 */
  /* ------------------------------------------------------------------ */

  const pad = (n) => String(n).padStart(2, "0");

  function toKey(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function todayKey() {
    return toKey(new Date());
  }

  function dayNumber(key) {
    const [y, m, d] = key.split("-").map(Number);
    return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
  }

  function fromDayNumber(n) {
    const dt = new Date(n * DAY_MS);
    return dt.getUTCFullYear() + "-" + pad(dt.getUTCMonth() + 1) + "-" + pad(dt.getUTCDate());
  }

  function isKey(value) {
    return (
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      fromDayNumber(dayNumber(value)) === value
    );
  }

  const addDays = (key, n) => fromDayNumber(dayNumber(key) + n);
  const diffDays = (a, b) => dayNumber(b) - dayNumber(a);
  const weekday = (key) => new Date(dayNumber(key) * DAY_MS).getUTCDay();

  /** Lundi de la semaine contenant `key`. */
  function startOfWeek(key) {
    return addDays(key, -((weekday(key) + 6) % 7));
  }

  /** Les 7 jours (lundi → dimanche) de la semaine contenant `key`. */
  function weekKeys(key) {
    const start = startOfWeek(key);
    return ALL_DAYS.map((i) => addDays(start, i));
  }

  /** Date locale (midi, pour éviter tout effet de fuseau) à partir d'une clé. */
  function keyToDate(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d, 12);
  }

  /* ------------------------------------------------------------------ */
  /* Habitudes                                                           */
  /* ------------------------------------------------------------------ */

  /** Une habitude est active sur les périodes [from, to[ ; `to: null` = période en cours. */
  function isActiveOn(habit, key) {
    return habit.periods.some((p) => key >= p.from && (p.to === null || key < p.to));
  }

  const isArchived = (habit) => !habit.periods.some((p) => p.to === null);

  function firstActiveDay(habit) {
    return habit.periods.reduce((min, p) => (p.from < min ? p.from : min), habit.periods[0].from);
  }

  /** Prévue ce jour-là : active, jour de la semaine choisi, et pas un jour de repos. */
  function isScheduled(habit, key, offDays) {
    return isActiveOn(habit, key) && habit.days.includes(weekday(key)) && !offDays.has(key);
  }

  function streakMultiplier(streak) {
    for (const tier of STREAK_TIERS) if (streak >= tier.min) return tier.mult;
    return 1;
  }

  /** XP d'une validation ; `streak` = longueur de la série en comptant cette validation. */
  function completionXp(habit, streak) {
    return Math.round(DIFFICULTIES[habit.difficulty].xp * streakMultiplier(streak || 0));
  }

  /* ------------------------------------------------------------------ */
  /* Niveaux                                                             */
  /* ------------------------------------------------------------------ */

  /** XP cumulée nécessaire pour atteindre `level` : 0, 100, 300, 600, 1000… */
  const xpForLevel = (level) => 50 * (level - 1) * level;

  function levelFromXp(xp) {
    let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + xp / 12.5)) / 2));
    while (xpForLevel(level + 1) <= xp) level++;
    while (level > 1 && xpForLevel(level) > xp) level--;
    return level;
  }

  function titleForLevel(level) {
    let title = LEVEL_TITLES[0].title;
    for (const t of LEVEL_TITLES) if (level >= t.from) title = t.title;
    return title;
  }

  function levelInfo(xp) {
    xp = Math.max(0, Math.floor(xp));
    const level = levelFromXp(xp);
    const base = xpForLevel(level);
    const needed = xpForLevel(level + 1) - base;
    const nextTitle = LEVEL_TITLES.find((t) => t.from > level) || null;
    return {
      level,
      xp,
      title: titleForLevel(level),
      into: xp - base,
      needed,
      toNext: needed - (xp - base),
      progress: (xp - base) / needed,
      nextTitle: nextTitle ? { title: nextTitle.title, level: nextTitle.from } : null,
    };
  }

  /* ------------------------------------------------------------------ */
  /* État & normalisation                                                */
  /* ------------------------------------------------------------------ */

  function createInitialState() {
    return {
      app: "habit-quest",
      version: 1,
      profile: { name: "" },
      habits: [],
      log: {}, // { "AAAA-MM-JJ": [habitId, …] }
      offDays: [], // jours de repos / congés : ne cassent aucune série
      badges: {}, // { badgeId: "AAAA-MM-JJ" } date de déblocage
      settings: { theme: "auto" },
      onboarded: false,
    };
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /** Valide et nettoie les champs éditables d'une habitude. Lève une Error si invalide. */
  function sanitizeHabitFields(data) {
    const name = typeof data.name === "string" ? data.name.trim().replace(/\s+/g, " ").slice(0, 60) : "";
    if (!name) throw new Error("Le nom de l’habitude est obligatoire.");
    const days = Array.isArray(data.days)
      ? [...new Set(data.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b)
      : [];
    if (!days.length) throw new Error("Choisis au moins un jour de la semaine.");
    const icon = typeof data.icon === "string" && data.icon.trim() ? Array.from(data.icon.trim()).slice(0, 4).join("") : "✅";
    return {
      name,
      icon,
      category: Object.prototype.hasOwnProperty.call(CATEGORIES, data.category) ? data.category : "focus",
      difficulty: Object.prototype.hasOwnProperty.call(DIFFICULTIES, data.difficulty) ? data.difficulty : "medium",
      days,
    };
  }

  function createHabit(state, data, today) {
    const habit = { id: uid(), ...sanitizeHabitFields(data), periods: [{ from: today, to: null }] };
    state.habits.push(habit);
    return habit;
  }

  function updateHabit(state, id, data) {
    const habit = state.habits.find((h) => h.id === id);
    if (!habit) throw new Error("Habitude introuvable.");
    Object.assign(habit, sanitizeHabitFields(data));
    return habit;
  }

  /** Met l'habitude en pause : les jours archivés sont neutres, la série est conservée. */
  function archiveHabit(state, id, today) {
    const habit = state.habits.find((h) => h.id === id);
    if (!habit) return;
    for (const p of habit.periods) if (p.to === null) p.to = today;
  }

  function restoreHabit(state, id, today) {
    const habit = state.habits.find((h) => h.id === id);
    if (habit && isArchived(habit)) habit.periods.push({ from: today, to: null });
  }

  function deleteHabit(state, id) {
    state.habits = state.habits.filter((h) => h.id !== id);
    for (const key of Object.keys(state.log)) {
      state.log[key] = state.log[key].filter((hid) => hid !== id);
      if (!state.log[key].length) delete state.log[key];
    }
  }

  /** Bascule la validation d'une habitude un jour donné. Renvoie le nouvel état, ou null si refusé. */
  function toggleCompletion(state, habitId, key, today) {
    if (!state.habits.some((h) => h.id === habitId)) return null;
    if (!isKey(key) || key > today) return null;
    const list = state.log[key] || [];
    const i = list.indexOf(habitId);
    if (i >= 0) {
      list.splice(i, 1);
      if (list.length) state.log[key] = list;
      else delete state.log[key];
      return false;
    }
    state.log[key] = [...list, habitId];
    return true;
  }

  /** Bascule un jour de repos. Renvoie true si le jour est désormais un jour de repos. */
  function toggleOffDay(state, key) {
    const i = state.offDays.indexOf(key);
    if (i >= 0) {
      state.offDays.splice(i, 1);
      return false;
    }
    state.offDays.push(key);
    state.offDays.sort();
    return true;
  }

  function sanitizePeriods(raw, fallbackFrom) {
    const periods = [];
    if (Array.isArray(raw)) {
      for (const p of raw) {
        if (!p || !isKey(p.from)) continue;
        const to = p.to === null || p.to === undefined ? null : p.to;
        if (to !== null && (!isKey(to) || to < p.from)) continue;
        periods.push({ from: p.from, to });
      }
    }
    periods.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
    // Au plus une période ouverte, et c'est forcément la dernière.
    const open = periods.filter((p) => p.to === null);
    if (open.length > 1) open.slice(0, -1).forEach((p) => (p.to = p.from));
    if (!periods.length) periods.push({ from: fallbackFrom, to: null });
    return periods;
  }

  /**
   * Reconstruit un état sûr à partir de données externes (localStorage, import JSON).
   * Lève une Error si le contenu n'a rien d'une sauvegarde Habit Quest.
   */
  function normalizeState(raw, today) {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.habits)) {
      throw new Error("Ce fichier n’est pas une sauvegarde Habit Quest valide.");
    }
    today = today || todayKey();
    const state = createInitialState();

    if (raw.profile && typeof raw.profile.name === "string") state.profile.name = raw.profile.name.trim().slice(0, 40);
    if (raw.settings && THEMES.includes(raw.settings.theme)) state.settings.theme = raw.settings.theme;
    state.onboarded = raw.onboarded === true || raw.habits.length > 0;

    const seen = new Set();
    for (const item of raw.habits) {
      if (!item || typeof item !== "object" || typeof item.id !== "string" || !item.id || seen.has(item.id)) continue;
      let fields;
      try {
        fields = sanitizeHabitFields(item);
      } catch {
        continue;
      }
      seen.add(item.id);
      state.habits.push({ id: item.id, ...fields, periods: sanitizePeriods(item.periods, today) });
    }

    if (raw.log && typeof raw.log === "object") {
      for (const key of Object.keys(raw.log)) {
        if (!isKey(key) || !Array.isArray(raw.log[key])) continue;
        const ids = [...new Set(raw.log[key])].filter((id) => seen.has(id));
        if (ids.length) state.log[key] = ids;
      }
    }

    if (Array.isArray(raw.offDays)) {
      state.offDays = [...new Set(raw.offDays.filter(isKey))].sort();
    }

    if (raw.badges && typeof raw.badges === "object") {
      for (const badge of BADGES) {
        if (isKey(raw.badges[badge.id])) state.badges[badge.id] = raw.badges[badge.id];
      }
    }
    return state;
  }

  /* ------------------------------------------------------------------ */
  /* Calcul de la progression                                            */
  /* ------------------------------------------------------------------ */

  /**
   * Recalcule tout à partir de l'état : XP, niveau, séries, journées parfaites.
   *
   * Règles :
   *  - une série compte les jours *prévus* validés d'affilée ; les jours non prévus,
   *    de repos ou hors période sont neutres ;
   *  - un jour prévu manqué remet la série à zéro, sauf aujourd'hui (encore faisable) ;
   *  - chaque validation rapporte l'XP de sa difficulté × le multiplicateur de série ;
   *  - une journée parfaite (toutes les habitudes prévues validées) rapporte un bonus.
   */
  function computeProgress(state, today) {
    today = today || todayKey();
    const offDays = new Set(state.offDays);
    const habitsById = new Map(state.habits.map((h) => [h.id, h]));
    const doneByDay = new Map();
    for (const [key, ids] of Object.entries(state.log)) {
      if (key <= today) doneByDay.set(key, new Set(ids));
    }
    const isDone = (id, key) => (doneByDay.get(key) ? doneByDay.get(key).has(id) : false);

    // 1. Séries par habitude
    const habitStats = {};
    let bestStreak = 0;
    let currentStreak = 0;
    for (const habit of state.habits) {
      const stat = { current: 0, best: 0, streakAt: {}, scheduled: 0, done: 0 };
      let streak = 0;
      const from = dayNumber(firstActiveDay(habit));
      const to = dayNumber(today);
      for (let n = from; n <= to; n++) {
        const key = fromDayNumber(n);
        if (!isScheduled(habit, key, offDays)) continue;
        stat.scheduled++;
        if (isDone(habit.id, key)) {
          streak++;
          stat.done++;
          stat.streakAt[key] = streak;
          if (streak > stat.best) stat.best = streak;
        } else if (key !== today) {
          streak = 0;
        }
      }
      stat.current = streak;
      habitStats[habit.id] = stat;
      if (stat.best > bestStreak) bestStreak = stat.best;
      if (stat.current > currentStreak) currentStreak = stat.current;
    }

    // 2. XP des validations
    let totalXp = 0;
    let totalCompletions = 0;
    const xpByDay = {};
    const xpByCategory = {};
    const countByCategory = {};
    const activeDays = new Set();
    for (const [key, ids] of doneByDay) {
      for (const id of ids) {
        const habit = habitsById.get(id);
        if (!habit) continue;
        const xp = completionXp(habit, habitStats[id].streakAt[key]);
        totalXp += xp;
        totalCompletions++;
        activeDays.add(key);
        xpByDay[key] = (xpByDay[key] || 0) + xp;
        xpByCategory[habit.category] = (xpByCategory[habit.category] || 0) + xp;
        countByCategory[habit.category] = (countByCategory[habit.category] || 0) + 1;
      }
    }

    // 3. Journées (parfaites ou non) + bonus
    const days = {};
    let perfectDays = 0;
    let perfectStreak = 0;
    let bestPerfectStreak = 0;
    if (state.habits.length) {
      const first = state.habits.reduce((min, h) => (firstActiveDay(h) < min ? firstActiveDay(h) : min), today);
      for (let n = dayNumber(first); n <= dayNumber(today); n++) {
        const key = fromDayNumber(n);
        let scheduled = 0;
        let done = 0;
        for (const habit of state.habits) {
          if (!isScheduled(habit, key, offDays)) continue;
          scheduled++;
          if (isDone(habit.id, key)) done++;
        }
        const perfect = scheduled > 0 && done === scheduled;
        days[key] = { scheduled, done, perfect, off: offDays.has(key) };
        if (perfect) {
          perfectDays++;
          totalXp += PERFECT_DAY_BONUS;
          xpByDay[key] = (xpByDay[key] || 0) + PERFECT_DAY_BONUS;
          perfectStreak++;
          if (perfectStreak > bestPerfectStreak) bestPerfectStreak = perfectStreak;
        } else if (scheduled > 0 && key !== today) {
          perfectStreak = 0;
        }
      }
    }

    return {
      today,
      totalXp,
      level: levelInfo(totalXp),
      totalCompletions,
      activeDays: activeDays.size,
      xpByDay,
      xpByCategory,
      countByCategory,
      habitStats,
      days,
      perfectDays,
      perfectStreak: { current: perfectStreak, best: bestPerfectStreak },
      bestStreak,
      currentStreak,
    };
  }

  /** XP que rapporterait (ou a rapporté) cette habitude ce jour-là, pour l'affichage. */
  function xpPreview(habit, progress, key, done) {
    const stat = progress.habitStats[habit.id];
    if (!stat) return completionXp(habit, 0);
    if (done) return completionXp(habit, stat.streakAt[key]);
    if (key === progress.today) return completionXp(habit, stat.current + 1);
    return completionXp(habit, 0);
  }

  /** Taux de réalisation sur une fenêtre [from, to] (bornes incluses). */
  function windowStats(state, from, to) {
    const offDays = new Set(state.offDays);
    const doneOn = (key) => new Set(state.log[key] || []);
    const perHabit = [];
    let scheduled = 0;
    let done = 0;
    for (const habit of state.habits) {
      let s = 0;
      let d = 0;
      for (let n = dayNumber(from); n <= dayNumber(to); n++) {
        const key = fromDayNumber(n);
        if (!isScheduled(habit, key, offDays)) continue;
        s++;
        if (doneOn(key).has(habit.id)) d++;
      }
      if (s) perHabit.push({ habit, scheduled: s, done: d, rate: d / s });
      scheduled += s;
      done += d;
    }
    return { perHabit, scheduled, done, rate: scheduled ? done / scheduled : null };
  }

  /** Niveau de la carte de chaleur (0 = rien de prévu), de 1 (raté) à 5 (journée parfaite). */
  function heatLevel(day) {
    if (!day || day.scheduled === 0) return 0;
    const rate = day.done / day.scheduled;
    if (rate === 0) return 1;
    if (rate < 0.5) return 2;
    if (rate < 0.75) return 3;
    if (rate < 1) return 4;
    return 5;
  }

  /* ------------------------------------------------------------------ */
  /* Succès                                                              */
  /* ------------------------------------------------------------------ */

  const BADGES = [
    { id: "first_step", icon: "🌱", name: "Premier pas", desc: "Valider une première habitude", target: 1, value: (p) => p.totalCompletions },
    { id: "completions_50", icon: "✅", name: "Régularité", desc: "Valider 50 habitudes", target: 50, value: (p) => p.totalCompletions },
    { id: "completions_250", icon: "⚙️", name: "Rouleau compresseur", desc: "Valider 250 habitudes", target: 250, value: (p) => p.totalCompletions },
    { id: "completions_1000", icon: "🏅", name: "Marathon", desc: "Valider 1 000 habitudes", target: 1000, value: (p) => p.totalCompletions },
    { id: "streak_3", icon: "✨", name: "Échauffement", desc: "Série de 3 jours sur une habitude", target: 3, value: (p) => p.bestStreak },
    { id: "streak_7", icon: "🔥", name: "Semaine de feu", desc: "Série de 7 jours sur une habitude", target: 7, value: (p) => p.bestStreak },
    { id: "streak_14", icon: "💪", name: "Double semaine", desc: "Série de 14 jours sur une habitude", target: 14, value: (p) => p.bestStreak },
    { id: "streak_30", icon: "🛡️", name: "Mois d’acier", desc: "Série de 30 jours sur une habitude", target: 30, value: (p) => p.bestStreak },
    { id: "streak_100", icon: "👑", name: "Centurion", desc: "Série de 100 jours sur une habitude", target: 100, value: (p) => p.bestStreak },
    { id: "perfect_1", icon: "⭐", name: "Journée parfaite", desc: "Valider toutes les habitudes prévues en un jour", target: 1, value: (p) => p.perfectDays },
    { id: "perfect_streak_3", icon: "🎩", name: "Triplé", desc: "3 journées parfaites d’affilée", target: 3, value: (p) => p.perfectStreak.best },
    { id: "perfect_streak_7", icon: "🌟", name: "Sans faute", desc: "7 journées parfaites d’affilée", target: 7, value: (p) => p.perfectStreak.best },
    { id: "level_5", icon: "📈", name: "Montée en puissance", desc: "Atteindre le niveau 5", target: 5, value: (p) => p.level.level },
    { id: "level_10", icon: "🏆", name: "Cap des dix", desc: "Atteindre le niveau 10", target: 10, value: (p) => p.level.level },
    { id: "level_20", icon: "💎", name: "Élite", desc: "Atteindre le niveau 20", target: 20, value: (p) => p.level.level },
    ...[
      ["learning", "🧠", "Esprit curieux"],
      ["network", "🌐", "Réseau actif"],
      ["focus", "🔭", "Mode focus"],
      ["wellbeing", "🌿", "Équilibre"],
      ["career", "🧭", "Cap sur la carrière"],
      ["organisation", "📐", "Bien organisé"],
    ].map(([cat, icon, name]) => ({
      id: "cat_" + cat,
      icon,
      name,
      desc: "Valider 25 habitudes « " + CATEGORIES[cat].label + " »",
      target: 25,
      value: (p) => p.countByCategory[cat] || 0,
    })),
  ];

  /** Liste tous les succès avec leur valeur courante et s'ils sont atteints. */
  function evaluateBadges(progress) {
    return BADGES.map((b) => {
      const value = b.value(progress);
      return { id: b.id, icon: b.icon, name: b.name, desc: b.desc, target: b.target, value, reached: value >= b.target };
    });
  }

  /** Enregistre les succès nouvellement atteints dans l'état et renvoie leur liste. */
  function unlockBadges(state, progress, today) {
    const unlocked = [];
    for (const badge of evaluateBadges(progress)) {
      if (badge.reached && !state.badges[badge.id]) {
        state.badges[badge.id] = today;
        unlocked.push(badge);
      }
    }
    return unlocked;
  }

  return {
    ALL_DAYS,
    WEEKDAYS,
    DIFFICULTIES,
    CATEGORIES,
    LEVEL_TITLES,
    STREAK_TIERS,
    PERFECT_DAY_BONUS,
    THEMES,
    TEMPLATES,
    BADGES,
    // dates
    toKey,
    todayKey,
    isKey,
    addDays,
    diffDays,
    weekday,
    startOfWeek,
    weekKeys,
    keyToDate,
    // habitudes
    isActiveOn,
    isArchived,
    isScheduled,
    firstActiveDay,
    createHabit,
    updateHabit,
    archiveHabit,
    restoreHabit,
    deleteHabit,
    toggleCompletion,
    toggleOffDay,
    // jeu
    streakMultiplier,
    completionXp,
    xpForLevel,
    levelInfo,
    computeProgress,
    xpPreview,
    windowStats,
    heatLevel,
    evaluateBadges,
    unlockBadges,
    // état
    createInitialState,
    normalizeState,
  };
});
