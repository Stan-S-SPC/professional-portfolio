/*
 * Habit Quest — interface.
 * Toute la logique de jeu vit dans core.js ; ici : rendu, événements, persistance, effets.
 * Le contenu saisi par l'utilisateur n'est jamais injecté via innerHTML (textContent uniquement).
 */
(function () {
  "use strict";

  const C = window.HabitCore;
  const STORAGE_KEY = "habit-quest:v1";

  const TABS = [
    { id: "today", icon: "✅", label: "Aujourd’hui" },
    { id: "week", icon: "🗓️", label: "Semaine" },
    { id: "stats", icon: "📊", label: "Stats" },
    { id: "badges", icon: "🏆", label: "Succès" },
    { id: "habits", icon: "📋", label: "Habitudes" },
  ];
  const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // lundi → dimanche
  const DAY_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const EMOJIS = ["💼", "🎯", "📚", "🤝", "🧘", "🚀", "🗂️", "📝", "💬", "📈", "🧠", "⚡", "🗓️", "📥", "🚶", "☕", "🎤", "🛠️", "🔍", "🏃", "💡", "📞", "✍️", "🌱"];
  const HEAT_WEEKS = 17;

  /* ---------------------------------------------------------------- */
  /* Utilitaires                                                       */
  /* ---------------------------------------------------------------- */

  const $ = (selector) => document.querySelector(selector);
  const nf = new Intl.NumberFormat("fr-FR");
  const dfLong = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const dfFull = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const dfShort = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
  const dfMonth = new Intl.DateTimeFormat("fr-FR", { month: "short" });
  const fmt = (df, key) => df.format(C.keyToDate(key));
  const pct = (ratio) => Math.round(ratio * 100) + " %";
  const plural = (n, one, many) => (n > 1 ? many : one);
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Crée un élément DOM. `aria-*` accepte les booléens ; null/undefined sont ignorés. */
  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v === null || v === undefined) continue;
        if (k === "class") el.className = v;
        else if (k === "style") for (const [p, val] of Object.entries(v)) el.style.setProperty(p, val);
        else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
        else if (k.startsWith("aria-")) el.setAttribute(k, String(v));
        else if (k === "value" || k === "checked" || k === "selected") el[k] = v;
        else if (v === true) el.setAttribute(k, "");
        else if (v !== false) el.setAttribute(k, v);
      }
    }
    appendAll(el, children);
    return el;
  }

  function appendAll(el, children) {
    for (const child of children) {
      if (child === null || child === undefined || child === false) continue;
      if (Array.isArray(child)) appendAll(el, child);
      else el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
  }

  function svg(tag, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  function daysLabel(days) {
    const set = new Set(days);
    if (set.size === 7) return "Tous les jours";
    if (set.size === 5 && C.WEEKDAYS.every((d) => set.has(d))) return "Lun – Ven";
    return DISPLAY_ORDER.filter((d) => set.has(d)).map((d) => DAY_SHORT[d]).join(", ");
  }

  /* ---------------------------------------------------------------- */
  /* État & persistance                                                */
  /* ---------------------------------------------------------------- */

  let state = loadState();
  let storageWarned = false;

  const ui = {
    tab: tabFromHash(),
    today: C.todayKey(),
    viewDate: C.todayKey(),
    weekOf: C.todayKey(),
    chartMode: {},
    lastXpRatio: null,
  };

  function loadState() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return C.normalizeState(JSON.parse(raw), C.todayKey());
    } catch (err) {
      console.warn("Sauvegarde illisible, démarrage à vide.", err);
      try {
        // On garde une copie de la sauvegarde abîmée plutôt que de l'écraser silencieusement.
        if (raw) localStorage.setItem(STORAGE_KEY + ":corrupt", raw);
      } catch {
        /* stockage indisponible : rien à faire */
      }
    }
    return C.createInitialState();
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      if (!storageWarned) {
        storageWarned = true;
        toast("⚠️", "Sauvegarde impossible", "Le stockage du navigateur est indisponible : exporte tes données pour ne rien perdre.");
      }
    }
  }

  function applyTheme() {
    const root = document.documentElement;
    if (state.settings.theme === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", state.settings.theme);
  }

  /** Garde `ui` cohérent quand le jour change (appli laissée ouverte la nuit). */
  function syncToday() {
    const today = C.todayKey();
    if (today !== ui.today) {
      const previous = ui.today;
      ui.today = today;
      if (ui.viewDate === previous) ui.viewDate = today;
      if (C.startOfWeek(ui.weekOf) === C.startOfWeek(previous)) ui.weekOf = today;
    }
    if (ui.viewDate > today) ui.viewDate = today;
    if (ui.weekOf > today) ui.weekOf = today;
    return today;
  }

  function earliestDay(today) {
    if (!state.habits.length) return today;
    return state.habits.reduce((min, hb) => (C.firstActiveDay(hb) < min ? C.firstActiveDay(hb) : min), today);
  }

  /* ---------------------------------------------------------------- */
  /* Rendu global                                                      */
  /* ---------------------------------------------------------------- */

  const heroEl = $("#hero");
  const tabsEl = $("#tabs");
  const viewEl = $("#view");

  function tabFromHash() {
    const id = location.hash.slice(1);
    return TABS.some((t) => t.id === id) ? id : "today";
  }

  function go(tabId) {
    if (location.hash.slice(1) === tabId) {
      ui.tab = tabId;
      render();
    } else {
      location.hash = tabId; // déclenche hashchange
    }
  }

  function render() {
    const today = syncToday();
    const progress = C.computeProgress(state, today);
    const focusId = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.focusId : null;

    renderHero(progress);
    renderTabs();
    const views = { today: viewToday, week: viewWeek, stats: viewStats, badges: viewBadges, habits: viewHabits };
    viewEl.replaceChildren(views[ui.tab](progress, today));

    if (focusId) {
      const target = [...viewEl.querySelectorAll("[data-focus-id]")].find((el) => el.dataset.focusId === focusId);
      if (target) target.focus({ preventScroll: true });
    }
  }

  function renderHero(p) {
    const L = p.level;
    const ratio = Math.max(0, Math.min(1, L.progress));
    const fill = h("div", { class: "xpbar-fill", style: { width: (ui.lastXpRatio === null ? ratio : ui.lastXpRatio) * 100 + "%" } });
    if (ui.lastXpRatio !== null && ui.lastXpRatio !== ratio) {
      requestAnimationFrame(() => requestAnimationFrame(() => (fill.style.width = ratio * 100 + "%")));
    }
    ui.lastXpRatio = ratio;

    const next = L.nextTitle ? "Prochain titre : " + L.nextTitle.title + " au niveau " + L.nextTitle.level : "Titre maximal atteint";
    heroEl.replaceChildren(
      h(
        "div",
        { class: "hero-top" },
        h("div", { class: "avatar", "aria-hidden": "true" }, String(L.level)),
        h("div", { class: "who" }, h("div", { class: "name" }, state.profile.name || "Mon parcours pro"), h("div", { class: "rank", title: next }, "Niveau " + L.level + " · " + L.title)),
        h(
          "div",
          { class: "hero-chips" },
          h("span", { class: "chip-hero", title: "Meilleure série en cours", "aria-label": "Meilleure série en cours : " + p.currentStreak + " " + plural(p.currentStreak, "jour", "jours") }, "🔥 " + p.currentStreak + " " + plural(p.currentStreak, "jour", "jours")),
          h("span", { class: "chip-hero", "aria-label": nf.format(p.totalXp) + " points d’expérience au total" }, "⭐ " + nf.format(p.totalXp) + " XP")
        ),
        h("button", { class: "icon-btn", type: "button", "aria-label": "Réglages", "data-focus-id": "open-settings", onclick: openSettings }, "⚙️")
      ),
      h(
        "div",
        { class: "xpbar", role: "progressbar", "aria-label": "Progression vers le niveau " + (L.level + 1), "aria-valuemin": 0, "aria-valuemax": L.needed, "aria-valuenow": L.into },
        fill
      ),
      h("div", { class: "xpmeta" }, h("span", {}, nf.format(L.into) + " / " + nf.format(L.needed) + " XP"), h("span", { title: next }, nf.format(L.toNext) + " XP avant le niveau " + (L.level + 1)))
    );
  }

  function renderTabs() {
    tabsEl.replaceChildren(
      ...TABS.map((t) =>
        h(
          "button",
          { class: "tab", type: "button", "aria-current": ui.tab === t.id ? "page" : null, onclick: () => go(t.id) },
          h("span", { class: "tab-icon", "aria-hidden": "true" }, t.icon),
          t.label
        )
      )
    );
  }

  /* ---------------------------------------------------------------- */
  /* Actions                                                           */
  /* ---------------------------------------------------------------- */

  /** Bascule une habitude et déclenche les récompenses (XP, niveau, journée parfaite, succès). */
  function toggleHabit(habitId, key, ev) {
    const today = C.todayKey();
    const habit = state.habits.find((x) => x.id === habitId);
    const rect = ev.currentTarget.getBoundingClientRect();
    const x = ev.clientX || rect.left + rect.width / 2;
    const y = ev.clientY || rect.top + rect.height / 2;

    const before = C.computeProgress(state, today);
    const nowDone = C.toggleCompletion(state, habitId, key, today);
    if (nowDone === null) return;
    const after = C.computeProgress(state, today);
    const newBadges = nowDone ? C.unlockBadges(state, after, today) : [];
    save();
    render();

    const delta = after.totalXp - before.totalXp;
    if (delta !== 0) floatXp(delta, x, y);
    announce(habit.name + (nowDone ? " validée" : " annulée") + ", " + (delta >= 0 ? "+" : "") + delta + " XP");
    if (!nowDone) return;

    const day = after.days[key];
    const wasPerfect = before.days[key] && before.days[key].perfect;
    const becamePerfect = day && day.perfect && !wasPerfect;
    const leveledUp = after.level.level > before.level.level;

    if (leveledUp) {
      showLevelUp(before.level, after.level);
      confetti(70);
    } else if (becamePerfect) {
      toast("⭐", "Journée parfaite !", "+" + C.PERFECT_DAY_BONUS + " XP de bonus");
      confetti(32);
    }
    newBadges.forEach((b, i) => setTimeout(() => toast(b.icon, "Succès débloqué : " + b.name, b.desc), (leveledUp || becamePerfect ? 700 : 250) + i * 500));
  }

  function toggleOff(key) {
    const nowOff = C.toggleOffDay(state, key);
    save();
    render();
    announce(nowOff ? "Jour de repos activé" : "Jour de repos retiré");
  }

  /** Mutation sans récompense (création, édition, archivage…). */
  function mutate(fn) {
    const result = fn();
    save();
    render();
    return result;
  }

  /* ---------------------------------------------------------------- */
  /* Vue : Aujourd'hui                                                 */
  /* ---------------------------------------------------------------- */

  function periodNav({ title, sub, canPrev, canNext, onPrev, onNext, prevLabel, nextLabel }) {
    return h(
      "div",
      { class: "period-nav" },
      h("button", { class: "btn", type: "button", "aria-label": prevLabel, disabled: !canPrev, "data-focus-id": "nav-prev", onclick: onPrev }, "‹"),
      h("div", { class: "period-title" }, h("h2", {}, title), sub),
      h("button", { class: "btn", type: "button", "aria-label": nextLabel, disabled: !canNext, "data-focus-id": "nav-next", onclick: onNext }, "›")
    );
  }

  function emptyHabits() {
    return h(
      "section",
      { class: "card empty" },
      h("div", { class: "big", "aria-hidden": "true" }, "🚀"),
      h("h2", {}, "Prêt à lancer ta progression ?"),
      h("p", { class: "subtle" }, "Ajoute tes premières habitudes professionnelles : chaque validation te rapporte de l’XP, fait monter ta série et te fait gagner des niveaux."),
      h(
        "div",
        { class: "empty-actions" },
        h("button", { class: "btn btn-primary", type: "button", onclick: () => openTemplates(false) }, "Voir les suggestions"),
        h("button", { class: "btn", type: "button", onclick: () => openHabitForm() }, "Créer une habitude")
      )
    );
  }

  function viewToday(p, today) {
    const key = ui.viewDate;
    const isToday = key === today;
    const offDays = new Set(state.offDays);
    const isOff = offDays.has(key);
    const earliest = earliestDay(today);
    const scheduled = state.habits.filter((hb) => C.isScheduled(hb, key, offDays));
    const doneIds = new Set(state.log[key] || []);
    const day = p.days[key] || { scheduled: 0, done: 0, perfect: false };

    const nav = periodNav({
      title: fmt(dfLong, key),
      sub: isToday ? h("span", { class: "tag" }, "Aujourd’hui") : h("button", { class: "btn btn-small", type: "button", onclick: () => { ui.viewDate = today; render(); } }, "Revenir à aujourd’hui"),
      canPrev: key > earliest,
      canNext: key < today,
      onPrev: () => { ui.viewDate = C.addDays(key, -1); render(); },
      onNext: () => { ui.viewDate = C.addDays(key, 1); render(); },
      prevLabel: "Jour précédent",
      nextLabel: "Jour suivant",
    });

    if (!state.habits.length) return h("div", { class: "view" }, nav, emptyHabits());

    // Anneau de progression
    const total = scheduled.length;
    const ratio = total ? day.done / total : 0;
    const R = 36;
    const circ = 2 * Math.PI * R;
    const ring = h(
      "div",
      { class: "ring" + (day.perfect ? " perfect" : ""), role: "img", "aria-label": total ? day.done + " habitudes sur " + total + " validées" : "Aucune habitude prévue" },
      (() => {
        const s = svg("svg", { viewBox: "0 0 84 84", "aria-hidden": "true" });
        s.append(svg("circle", { class: "track", cx: 42, cy: 42, r: R, fill: "none", "stroke-width": 9 }));
        s.append(svg("circle", { class: "fill", cx: 42, cy: 42, r: R, fill: "none", "stroke-width": 9, "stroke-dasharray": circ, "stroke-dashoffset": circ * (1 - ratio) }));
        return s;
      })(),
      h("div", { class: "ring-label", "aria-hidden": "true" }, total ? day.done + "/" + total : "—")
    );

    let headline;
    let sub;
    if (isOff) {
      headline = "Jour de repos 🏖️";
      sub = "Aucune habitude prévue et aucune série perdue.";
    } else if (!total) {
      headline = "Rien de prévu ce jour";
      sub = "Profite-en, ou ajoute une habitude depuis l’onglet Habitudes.";
    } else {
      headline = day.done + " " + plural(day.done, "habitude validée", "habitudes validées") + " sur " + total;
      sub = day.perfect ? "Toutes les habitudes sont validées." : "Encore " + (total - day.done) + " pour une journée parfaite (+" + C.PERFECT_DAY_BONUS + " XP).";
    }

    const summary = h(
      "section",
      { class: "card" },
      h(
        "div",
        { class: "summary" },
        ring,
        h("div", { class: "summary-text" }, h("strong", {}, headline), h("span", { class: "subtle" }, sub), h("span", { class: "xp-today" }, "+" + nf.format(p.xpByDay[key] || 0) + " XP " + (isToday ? "aujourd’hui" : "ce jour-là")))
      ),
      day.perfect ? h("div", { class: "perfect-banner" }, "🎉 Journée parfaite ! Bonus de +" + C.PERFECT_DAY_BONUS + " XP obtenu.") : null,
      h(
        "div",
        { class: "switch-row" },
        h("div", { class: "grow" }, h("div", { id: "off-label", style: { "font-weight": "600" } }, "Jour de repos / congé"), h("div", { class: "subtle" }, "Suspend les habitudes du jour sans casser tes séries.")),
        h("button", { class: "switch", type: "button", role: "switch", "aria-checked": isOff, "aria-labelledby": "off-label", "data-focus-id": "off-switch", onclick: () => toggleOff(key) })
      )
    );

    let list;
    if (isOff || !total) {
      list = null;
    } else {
      list = h(
        "ul",
        { class: "habit-list" },
        scheduled.map((hb) => {
          const done = doneIds.has(hb.id);
          const stat = p.habitStats[hb.id];
          const streakNow = done ? stat.streakAt[key] || 0 : isToday ? stat.current : 0;
          const applied = done ? stat.streakAt[key] || 0 : isToday ? stat.current + 1 : 0;
          const mult = C.streakMultiplier(applied);
          const xp = C.xpPreview(hb, p, key, done);
          const cat = C.CATEGORIES[hb.category];
          return h(
            "li",
            {},
            h(
              "button",
              { class: "habit-card cat-" + hb.category, type: "button", "aria-pressed": done, "data-focus-id": "h-" + hb.id, onclick: (ev) => toggleHabit(hb.id, key, ev) },
              h("span", { class: "check", "aria-hidden": "true" }, "✓"),
              h("span", { class: "habit-icon", "aria-hidden": "true" }, hb.icon),
              h(
                "span",
                { class: "habit-body" },
                h("span", { class: "habit-name" }, hb.name),
                h(
                  "span",
                  { class: "habit-meta" },
                  h("span", {}, h("i", { class: "cat-dot" }), cat.label),
                  h("span", {}, C.DIFFICULTIES[hb.difficulty].label),
                  streakNow > 0 ? h("span", { title: "Série en cours" }, "🔥 " + streakNow + " " + plural(streakNow, "jour", "jours")) : null
                )
              ),
              h("span", { class: "xp-badge" }, "+" + xp + " XP" + (mult > 1 ? " ×" + nf.format(mult) : ""))
            )
          );
        })
      );
    }

    return h("div", { class: "view" }, nav, summary, list);
  }

  /* ---------------------------------------------------------------- */
  /* Vue : Semaine                                                     */
  /* ---------------------------------------------------------------- */

  function viewWeek(p, today) {
    const keys = C.weekKeys(ui.weekOf);
    const start = keys[0];
    const end = keys[6];
    const thisWeek = C.startOfWeek(today);
    const earliestWeek = C.startOfWeek(earliestDay(today));
    const offDays = new Set(state.offDays);

    const nav = periodNav({
      title: fmt(dfShort, start) + " – " + fmt(dfShort, end),
      sub: start === thisWeek ? h("span", { class: "tag" }, "Cette semaine") : h("button", { class: "btn btn-small", type: "button", onclick: () => { ui.weekOf = today; render(); } }, "Revenir à cette semaine"),
      canPrev: start > earliestWeek,
      canNext: start < thisWeek,
      onPrev: () => { ui.weekOf = C.addDays(start, -7); render(); },
      onNext: () => { ui.weekOf = C.addDays(start, 7); render(); },
      prevLabel: "Semaine précédente",
      nextLabel: "Semaine suivante",
    });

    if (!state.habits.length) return h("div", { class: "view" }, nav, emptyHabits());

    const rows = state.habits.filter((hb) => keys.some((k) => C.isActiveOn(hb, k)));
    if (!rows.length) {
      return h("div", { class: "view" }, nav, h("section", { class: "card empty" }, h("p", { class: "subtle" }, "Aucune habitude n’était active cette semaine-là.")));
    }

    const head = h(
      "tr",
      {},
      h("th", { scope: "col", class: "hname" }, h("span", { class: "sr-only" }, "Habitude")),
      keys.map((k) => h("th", { scope: "col", class: k === today ? "is-today" : null }, DAY_SHORT[C.weekday(k)], h("span", { class: "dnum" }, String(Number(k.slice(8))))))
    );

    const body = rows.map((hb) =>
      h(
        "tr",
        {},
        h("th", { scope: "row", class: "hname cat-" + hb.category }, h("span", { title: hb.name }, hb.icon + " " + hb.name)),
        keys.map((k) => {
          const tdClass = k === today ? "is-today" : null;
          if (k > today) return h("td", { class: tdClass }, h("span", { class: "cell-na", "aria-label": "Pas encore possible" }, "·"));
          if (!C.isScheduled(hb, k, offDays)) return h("td", { class: tdClass }, h("span", { class: "cell-na", "aria-label": "Non prévu" }, "·"));
          const done = (state.log[k] || []).includes(hb.id);
          return h(
            "td",
            { class: tdClass },
            h("button", { class: "cell" + (!done && k < today ? " missed" : ""), type: "button", "aria-pressed": done, "aria-label": hb.name + ", " + fmt(dfLong, k), "data-focus-id": "w-" + hb.id + "-" + k, onclick: (ev) => toggleHabit(hb.id, k, ev) }, "✓")
          );
        })
      )
    );

    const foot = h(
      "tr",
      {},
      h("th", { scope: "row" }, "Journée"),
      keys.map((k) => {
        const d = p.days[k];
        let text = "–";
        if (k <= today && d) text = d.off ? "🏖️" : d.perfect ? "⭐" : d.scheduled ? d.done + "/" + d.scheduled : "–";
        return h("td", { class: k === today ? "is-today" : null }, text);
      })
    );

    const weekXp = keys.reduce((sum, k) => sum + (p.xpByDay[k] || 0), 0);
    return h(
      "div",
      { class: "view" },
      nav,
      h(
        "section",
        { class: "card" },
        h("div", { class: "table-wrap" }, h("table", { class: "week-table" }, h("thead", {}, head), h("tbody", {}, body), h("tfoot", {}, foot))),
        h("p", { class: "subtle", style: { "margin-top": "12px" } }, "+" + nf.format(weekXp) + " XP cette semaine · ⭐ = journée parfaite · 🏖️ = jour de repos. Touche une case pour valider ou corriger un jour passé.")
      )
    );
  }

  /* ---------------------------------------------------------------- */
  /* Vue : Stats                                                       */
  /* ---------------------------------------------------------------- */

  const tipEl = $("#tooltip");

  function hideTip() {
    tipEl.hidden = true;
  }

  function showTip(target, x, y) {
    tipEl.replaceChildren(h("strong", {}, target.dataset.tipValue), h("span", {}, target.dataset.tipLabel));
    tipEl.hidden = false;
    const r = tipEl.getBoundingClientRect();
    let left = x + 12;
    if (left + r.width > window.innerWidth - 8) left = x - r.width - 12;
    let top = y - r.height - 12;
    if (top < 8) top = y + 18;
    tipEl.style.left = Math.max(8, left) + "px";
    tipEl.style.top = top + "px";
  }

  /** Info-bulle au survol, au toucher et au focus clavier ; les valeurs restent aussi dans la vue Tableau. */
  function bindTooltip(container, selector) {
    const onPointer = (ev) => {
      const target = ev.target.closest(selector);
      if (target && container.contains(target)) showTip(target, ev.clientX, ev.clientY);
      else hideTip();
    };
    container.addEventListener("pointermove", onPointer);
    container.addEventListener("pointerdown", onPointer);
    container.addEventListener("pointerleave", hideTip);
    container.addEventListener("focusin", (ev) => {
      const target = ev.target.closest(selector);
      if (!target) return;
      const r = target.getBoundingClientRect();
      showTip(target, r.left + r.width / 2, r.top);
    });
    container.addEventListener("focusout", hideTip);
  }
  window.addEventListener("scroll", hideTip, { passive: true });

  function dataTable(headers, rows) {
    return h(
      "div",
      { class: "table-wrap" },
      h(
        "table",
        { class: "data-table" },
        h("thead", {}, h("tr", {}, headers.map((t) => h("th", { scope: "col" }, t)))),
        h("tbody", {}, rows.map((r) => h("tr", {}, r.map((cell, i) => (i === 0 ? h("th", { scope: "row", style: { "font-weight": "500" } }, cell) : h("td", {}, cell))))))
      )
    );
  }

  function chartCard(id, title, subtitle, buildChart, buildTable) {
    const mode = ui.chartMode[id] || "chart";
    const segBtn = (label, m) =>
      h("button", { type: "button", "aria-pressed": mode === m, "data-focus-id": "seg-" + id + "-" + m, onclick: () => { ui.chartMode[id] = m; render(); } }, label);
    return h(
      "section",
      { class: "card", "aria-labelledby": "ch-" + id },
      h(
        "div",
        { class: "chart-head" },
        h("div", {}, h("h2", { id: "ch-" + id }, title), h("p", { class: "subtle" }, subtitle)),
        h("div", { class: "seg", role: "group", "aria-label": "Mode d’affichage de « " + title + " »" }, segBtn("Graphique", "chart"), segBtn("Tableau", "table"))
      ),
      mode === "chart" ? buildChart() : buildTable()
    );
  }

  function describeDay(day, key, today) {
    if (!day || key > today) return "Rien de prévu";
    if (day.off) return "Jour de repos";
    if (!day.scheduled) return "Rien de prévu";
    if (day.perfect) return "Journée parfaite · " + day.done + "/" + day.scheduled;
    return day.done + "/" + day.scheduled + " validées (" + pct(day.done / day.scheduled) + ")";
  }

  function heatChart(p, today) {
    const first = C.addDays(C.startOfWeek(today), -7 * (HEAT_WEEKS - 1));
    const labels = [];
    let prevMonth = -1;
    const cells = [];
    for (let c = 0; c < HEAT_WEEKS; c++) {
      const monday = C.addDays(first, c * 7);
      const month = C.keyToDate(monday).getMonth();
      if (month !== prevMonth) {
        labels.push({ col: c, text: fmt(dfMonth, monday) });
        prevMonth = month;
      }
      for (let r = 0; r < 7; r++) {
        const key = C.addDays(monday, r);
        const future = key > today;
        const day = p.days[key];
        const value = describeDay(day, key, today);
        const label = fmt(dfFull, key);
        cells.push(
          h("div", {
            class: "heat-cell",
            role: "img",
            "data-level": future ? 0 : C.heatLevel(day),
            "data-future": future ? "" : null,
            "data-tip-value": value,
            "data-tip-label": label,
            "aria-label": label + " : " + value,
          })
        );
      }
    }
    // Un libellé de mois trop proche du suivant serait tronqué : on l'écarte.
    const shown = labels.filter((l, i) => !labels[i + 1] || labels[i + 1].col - l.col >= 3);

    const grid = h("div", { class: "heat-grid" }, cells);
    bindTooltip(grid, ".heat-cell");

    return h(
      "div",
      {},
      h(
        "div",
        { class: "heat-wrap" },
        h(
          "div",
          { class: "heat" },
          h("div", {}),
          h("div", { class: "heat-months" }, shown.map((l) => h("span", { style: { "grid-column": l.col + 1 + " / span 3", "grid-row": "1" } }, l.text))),
          h("div", { class: "heat-days", "aria-hidden": "true" }, [0, 1, 2, 3, 4, 5, 6].map((i) => h("span", {}, i === 0 ? "Lun" : i === 2 ? "Mer" : i === 4 ? "Ven" : ""))),
          grid
        )
      ),
      h(
        "div",
        { class: "heat-legend", "aria-hidden": "true" },
        h("span", {}, "Moins"),
        [1, 2, 3, 4, 5].map((lvl) => h("span", { class: "heat-cell", "data-level": lvl })),
        h("span", {}, "Plus"),
        h("span", { style: { "margin-left": "12px" } }, "Case vide : rien de prévu")
      )
    );
  }

  function heatTable(p, today) {
    const first = C.addDays(C.startOfWeek(today), -7 * (HEAT_WEEKS - 1));
    const rows = [];
    for (let c = HEAT_WEEKS - 1; c >= 0; c--) {
      const keys = C.weekKeys(C.addDays(first, c * 7)).filter((k) => k <= today);
      const sched = keys.reduce((s, k) => s + (p.days[k] ? p.days[k].scheduled : 0), 0);
      const done = keys.reduce((s, k) => s + (p.days[k] ? p.days[k].done : 0), 0);
      const perfect = keys.filter((k) => p.days[k] && p.days[k].perfect).length;
      rows.push(["Sem. du " + fmt(dfShort, C.addDays(first, c * 7)), String(sched), String(done), sched ? pct(done / sched) : "–", String(perfect)]);
    }
    return dataTable(["Semaine", "Prévues", "Validées", "Taux", "Jours parfaits"], rows);
  }

  /** Barres horizontales classées : une seule teinte, valeur au bout, info-bulle au survol / focus. */
  function barsChart(rows, max) {
    const list = h(
      "ul",
      { class: "bars" },
      rows.map((r) =>
        h(
          "li",
          { class: "bar-row", tabindex: 0, "data-tip-value": r.tipValue, "data-tip-label": r.tipLabel },
          h("span", { class: "bar-label", title: r.label }, r.icon + " " + r.label),
          h("span", { class: "bar-track" }, h("span", { class: "bar", style: { width: "calc((100% - 4.5rem) * " + r.value / max + ")" } }), h("span", { class: "bar-value" }, r.valueText))
        )
      )
    );
    bindTooltip(list, ".bar-row");
    return list;
  }

  const noData = (text) => h("p", { class: "subtle" }, text);

  function viewStats(p, today) {
    if (!state.habits.length) return h("div", { class: "view" }, emptyHabits());

    const win = C.windowStats(state, C.addDays(today, -29), today);
    const catRows = Object.entries(p.xpByCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, xp]) => ({
        label: C.CATEGORIES[cat].label,
        icon: C.CATEGORIES[cat].icon,
        value: xp,
        valueText: nf.format(xp) + " XP",
        tipValue: nf.format(xp) + " XP",
        tipLabel: C.CATEGORIES[cat].label + " · " + (p.countByCategory[cat] || 0) + " " + plural(p.countByCategory[cat] || 0, "validation", "validations"),
        count: p.countByCategory[cat] || 0,
      }));
    const rateRows = win.perHabit
      .slice()
      .sort((a, b) => b.rate - a.rate || b.scheduled - a.scheduled)
      .map((r) => ({
        label: r.habit.name,
        icon: r.habit.icon,
        value: r.rate,
        valueText: pct(r.rate),
        tipValue: r.done + " / " + r.scheduled + " validées",
        tipLabel: r.habit.name + " · série en cours : " + p.habitStats[r.habit.id].current,
        row: r,
      }));

    const kpi = (label, value, sub) => h("div", { class: "kpi" }, h("div", { class: "kpi-label" }, label), h("div", { class: "kpi-value" }, value), h("div", { class: "kpi-sub" }, sub));

    return h(
      "div",
      { class: "view" },
      h(
        "div",
        { class: "kpis" },
        kpi("Validations", nf.format(p.totalCompletions), p.activeDays + " " + plural(p.activeDays, "jour actif", "jours actifs")),
        kpi("Meilleure série", p.bestStreak + " " + plural(p.bestStreak, "jour", "jours"), "En cours : " + p.currentStreak),
        kpi("Jours parfaits", String(p.perfectDays), "Record d’affilée : " + p.perfectStreak.best),
        kpi("Réussite 30 jours", win.rate === null ? "–" : pct(win.rate), win.scheduled ? win.done + " / " + win.scheduled + " validées" : "Aucune donnée")
      ),
      chartCard("heat", "Régularité", "Part des habitudes prévues validées, jour par jour — " + HEAT_WEEKS + " dernières semaines", () => heatChart(p, today), () => heatTable(p, today)),
      chartCard(
        "rates",
        "Réussite par habitude",
        "30 derniers jours",
        () => (rateRows.length ? barsChart(rateRows, 1) : noData("Aucune habitude prévue sur cette période.")),
        () => dataTable(["Habitude", "Prévues", "Validées", "Taux", "Série", "Record"], rateRows.map((r) => [r.icon + " " + r.label, String(r.row.scheduled), String(r.row.done), pct(r.row.rate), String(p.habitStats[r.row.habit.id].current), String(p.habitStats[r.row.habit.id].best)]))
      ),
      chartCard(
        "xp",
        "XP par catégorie",
        "Depuis le début, hors bonus de journée parfaite",
        () => (catRows.length ? barsChart(catRows, catRows[0].value) : noData("Valide une première habitude pour voir apparaître ce graphique.")),
        () => dataTable(["Catégorie", "XP", "Validations"], catRows.map((r) => [r.icon + " " + r.label, nf.format(r.value), String(r.count)]))
      )
    );
  }

  /* ---------------------------------------------------------------- */
  /* Vue : Succès                                                      */
  /* ---------------------------------------------------------------- */

  function viewBadges(p) {
    const all = C.evaluateBadges(p);
    const isUnlocked = (b) => Boolean(state.badges[b.id]) || b.reached;
    const unlockedCount = all.filter(isUnlocked).length;
    const unlocked = all.filter(isUnlocked).sort((a, b) => (state.badges[b.id] || "9999") < (state.badges[a.id] || "9999") ? -1 : 1);
    const locked = all.filter((b) => !isUnlocked(b)).sort((a, b) => b.value / b.target - a.value / a.target);

    const badgeCard = (b, ok) =>
      h(
        "li",
        { class: "badge" + (ok ? "" : " locked") },
        h("div", { class: "b-icon", "aria-hidden": "true" }, b.icon),
        h("div", { class: "b-name" }, b.name),
        h("div", { class: "b-desc" }, b.desc),
        ok
          ? h("div", { class: "b-state" }, "✓ Débloqué" + (state.badges[b.id] ? " le " + fmt(dfShort, state.badges[b.id]) : ""))
          : h(
              "div",
              { style: { width: "100%" } },
              h("div", { class: "meter", role: "progressbar", "aria-label": "Progression : " + b.name, "aria-valuemin": 0, "aria-valuemax": b.target, "aria-valuenow": Math.min(b.value, b.target) }, h("i", { style: { width: Math.min(100, (b.value / b.target) * 100) + "%" } })),
              h("div", { class: "b-state" }, "🔒 " + nf.format(Math.min(b.value, b.target)) + " / " + nf.format(b.target))
            )
      );

    const tiers = C.STREAK_TIERS.slice().reverse();
    const rules = h(
      "ul",
      { class: "rules" },
      h("li", {}, "Chaque validation rapporte de l’XP selon sa difficulté : ", Object.values(C.DIFFICULTIES).map((d) => d.label + " " + d.xp).join(" · "), "."),
      h("li", {}, "Une série compte les jours prévus validés d’affilée : ", tiers.map((t) => "×" + nf.format(t.mult) + " dès " + t.min + " jours").join(", "), "."),
      h("li", {}, "Valider toutes les habitudes prévues d’un jour = journée parfaite, +" + C.PERFECT_DAY_BONUS + " XP."),
      h("li", {}, "Un jour non prévu ou de repos ne casse jamais une série ; un jour prévu manqué la remet à zéro (le jour en cours reste jouable)."),
      h("li", {}, "Niveau N = 50 × (N − 1) × N XP cumulés : 100 XP pour le niveau 2, 300 pour le 3, 600 pour le 4…"),
      h("li", {}, "Titres : ", C.LEVEL_TITLES.map((t) => t.title + " (niv. " + t.from + ")").join(" → "), ".")
    );

    return h(
      "div",
      { class: "view" },
      h(
        "section",
        { class: "card" },
        h("div", { class: "row-between" }, h("h2", {}, "Succès"), h("span", { class: "subtle" }, unlockedCount + " / " + all.length + " débloqués")),
        h("div", { class: "meter", style: { height: "8px", "margin-top": "10px" }, role: "progressbar", "aria-label": "Succès débloqués", "aria-valuemin": 0, "aria-valuemax": all.length, "aria-valuenow": unlockedCount }, h("i", { style: { width: (unlockedCount / all.length) * 100 + "%" } }))
      ),
      unlocked.length ? h("ul", { class: "badge-grid", "aria-label": "Succès débloqués" }, unlocked.map((b) => badgeCard(b, true))) : null,
      locked.length ? h("h2", { class: "section-title" }, "À débloquer") : null,
      locked.length ? h("ul", { class: "badge-grid", "aria-label": "Succès à débloquer" }, locked.map((b) => badgeCard(b, false))) : null,
      h("section", { class: "card" }, h("h2", {}, "Règles du jeu"), rules)
    );
  }

  /* ---------------------------------------------------------------- */
  /* Vue : Habitudes                                                   */
  /* ---------------------------------------------------------------- */

  function manageRow(hb, archived) {
    const cat = C.CATEGORIES[hb.category];
    const diff = C.DIFFICULTIES[hb.difficulty];
    return h(
      "li",
      { class: "manage-row cat-" + hb.category + (archived ? " archived" : "") },
      h("span", { class: "habit-icon", "aria-hidden": "true" }, hb.icon),
      h(
        "div",
        { class: "habit-body" },
        h("div", { class: "habit-name" }, hb.name),
        h("div", { class: "habit-meta" }, h("span", {}, h("i", { class: "cat-dot" }), cat.label), h("span", {}, diff.label + " · " + diff.xp + " XP"), h("span", {}, daysLabel(hb.days)))
      ),
      h(
        "div",
        { class: "manage-actions" },
        archived
          ? [
              h("button", { class: "btn btn-small", type: "button", onclick: () => mutate(() => C.restoreHabit(state, hb.id, C.todayKey())) }, "Reprendre"),
              h("button", { class: "btn btn-small btn-danger", type: "button", onclick: () => confirmDelete(hb) }, "Supprimer"),
            ]
          : [
              h("button", { class: "btn btn-small", type: "button", "aria-label": "Modifier " + hb.name, onclick: () => openHabitForm(hb) }, "Modifier"),
              h("button", { class: "btn btn-small", type: "button", "aria-label": "Archiver " + hb.name, onclick: () => mutate(() => C.archiveHabit(state, hb.id, C.todayKey())) }, "Archiver"),
            ]
      )
    );
  }

  function confirmDelete(hb) {
    if (window.confirm("Supprimer définitivement « " + hb.name + " » et tout son historique ? L’XP gagnée avec cette habitude sera perdue.")) {
      mutate(() => C.deleteHabit(state, hb.id));
    }
  }

  function viewHabits() {
    const active = state.habits.filter((hb) => !C.isArchived(hb));
    const archived = state.habits.filter((hb) => C.isArchived(hb));
    return h(
      "div",
      { class: "view" },
      h(
        "div",
        { class: "row-between" },
        h("h2", { class: "section-title" }, "Mes habitudes (" + active.length + ")"),
        h(
          "div",
          { class: "manage-actions" },
          h("button", { class: "btn", type: "button", onclick: () => openTemplates(false) }, "Suggestions"),
          h("button", { class: "btn btn-primary", type: "button", "data-focus-id": "new-habit", onclick: () => openHabitForm() }, "+ Nouvelle habitude")
        )
      ),
      active.length ? h("ul", { class: "habit-list" }, active.map((hb) => manageRow(hb, false))) : emptyHabits(),
      archived.length
        ? h(
            "details",
            { class: "archived-box" },
            h("summary", {}, "Habitudes archivées (" + archived.length + ")"),
            h("p", { class: "subtle", style: { "margin-bottom": "10px" } }, "Une habitude archivée est mise en pause : tu peux la reprendre plus tard sans perdre ta série."),
            h("ul", { class: "habit-list" }, archived.map((hb) => manageRow(hb, true)))
          )
        : null
    );
  }

  /* ---------------------------------------------------------------- */
  /* Fenêtres modales                                                  */
  /* ---------------------------------------------------------------- */

  const dlg = $("#modal");
  let modalOnClose = null;

  // L'événement `close` d'un <dialog> arrive en différé : on exécute donc le rappel de fermeture
  // de façon synchrone dans closeModal(), et l'événement ne sert qu'à la fermeture par Échap.
  function runOnClose() {
    const cb = modalOnClose;
    modalOnClose = null;
    if (cb) cb();
  }

  function openModal(content, opts) {
    if (dlg.open) runOnClose(); // contenu remplacé sans fermeture
    dlg.replaceChildren(content);
    modalOnClose = (opts && opts.onClose) || null;
    if (!dlg.open) dlg.showModal();
  }

  function closeModal() {
    if (dlg.open) dlg.close();
    runOnClose();
  }

  dlg.addEventListener("close", () => {
    if (dlg.open) return; // événement tardif d'une modale déjà remplacée par une autre
    runOnClose();
    dlg.replaceChildren();
  });
  dlg.addEventListener("click", (ev) => {
    if (ev.target === dlg) closeModal();
  });

  const field = (label, control, id) => h("div", { class: "field" }, h("label", { for: id }, label), control);

  function choice(type, name, value, checked, text, extraClass) {
    return h("label", { class: "choice" + (extraClass ? " " + extraClass : "") }, h("input", { type, name, value, checked }), h("span", {}, text));
  }

  function openHabitForm(existing) {
    const f = existing || { name: "", icon: "💼", category: "focus", difficulty: "medium", days: C.WEEKDAYS };
    const emojis = EMOJIS.includes(f.icon) ? EMOJIS : [f.icon, ...EMOJIS];
    const error = h("p", { class: "error", role: "alert", hidden: true });

    const nameInput = h("input", { class: "input", id: "f-name", name: "name", type: "text", maxlength: 60, required: true, autocomplete: "off", placeholder: "Ex. Bloc de travail profond", value: f.name, autofocus: true });
    const select = h("select", { class: "input", id: "f-cat", name: "category" }, Object.entries(C.CATEGORIES).map(([k, c]) => h("option", { value: k, selected: k === f.category }, c.icon + " " + c.label)));

    const dayBoxes = DISPLAY_ORDER.map((d) => choice("checkbox", "day", String(d), f.days.includes(d), DAY_SHORT[d]));
    const setDays = (days) => dayBoxes.forEach((lbl) => (lbl.querySelector("input").checked = days.includes(Number(lbl.querySelector("input").value))));

    const form = h(
      "form",
      {
        class: "modal-body",
        novalidate: true,
        oninput: () => (error.hidden = true),
        onsubmit: (ev) => {
          ev.preventDefault();
          const data = new FormData(ev.currentTarget);
          const payload = { name: data.get("name"), icon: data.get("icon"), category: data.get("category"), difficulty: data.get("difficulty"), days: data.getAll("day").map(Number) };
          try {
            mutate(() => (existing ? C.updateHabit(state, existing.id, payload) : C.createHabit(state, payload, C.todayKey())));
            closeModal();
          } catch (err) {
            error.textContent = err.message;
            error.hidden = false;
          }
        },
      },
      h("h2", { id: "modal-title" }, existing ? "Modifier l’habitude" : "Nouvelle habitude"),
      field("Nom", nameInput, "f-name"),
      h("fieldset", { class: "field" }, h("legend", {}, "Icône"), h("div", { class: "choice-row" }, emojis.map((e) => choice("radio", "icon", e, e === f.icon, e, "emoji")))),
      field("Catégorie", select, "f-cat"),
      h("fieldset", { class: "field" }, h("legend", {}, "Difficulté (XP par validation)"), h("div", { class: "choice-row" }, Object.entries(C.DIFFICULTIES).map(([k, d]) => choice("radio", "difficulty", k, k === f.difficulty, d.label + " · " + d.xp + " XP")))),
      h(
        "fieldset",
        { class: "field" },
        h("legend", {}, "Jours prévus"),
        h("div", { class: "choice-row" }, dayBoxes),
        h("div", { class: "choice-row" }, h("button", { class: "btn btn-small", type: "button", onclick: () => setDays(C.WEEKDAYS) }, "Lun – Ven"), h("button", { class: "btn btn-small", type: "button", onclick: () => setDays(C.ALL_DAYS) }, "Tous les jours")),
        existing ? h("p", { class: "subtle" }, "Changer les jours s’applique aussi à l’historique : les séries sont recalculées.") : null
      ),
      error,
      h("div", { class: "modal-actions" }, h("button", { class: "btn", type: "button", onclick: closeModal }, "Annuler"), h("button", { class: "btn btn-primary", type: "submit" }, existing ? "Enregistrer" : "Ajouter"))
    );
    openModal(form);
  }

  /** Suggestions d'habitudes pros ; `welcome` = premier lancement (présentation + prénom). */
  function openTemplates(welcome) {
    const existingNames = new Set(state.habits.map((x) => x.name));
    const checks = C.TEMPLATES.map((t) => {
      const exists = existingNames.has(t.name);
      const input = h("input", { type: "checkbox", checked: welcome && t.popular && !exists, disabled: exists });
      return {
        t,
        input,
        node: h(
          "label",
          { class: "template" + (exists ? " exists" : "") },
          input,
          h("span", { class: "habit-icon", "aria-hidden": "true" }, t.icon),
          h("span", { class: "habit-body" }, h("span", { class: "habit-name" }, t.name), h("span", { class: "habit-meta" }, h("span", {}, C.CATEGORIES[t.category].label), h("span", {}, daysLabel(t.days)), h("span", {}, C.DIFFICULTIES[t.difficulty].xp + " XP"), exists ? h("span", {}, "déjà ajoutée") : null))
        ),
      };
    });
    const nameInput = h("input", { class: "input", id: "w-name", type: "text", maxlength: 40, autocomplete: "given-name", placeholder: "Ton prénom (facultatif)", value: state.profile.name });

    const finish = (addSelected) => {
      mutate(() => {
        if (welcome) {
          state.profile.name = nameInput.value.trim().slice(0, 40);
          state.onboarded = true;
        }
        if (addSelected) checks.filter((c) => c.input.checked && !c.input.disabled).forEach((c) => C.createHabit(state, c.t, C.todayKey()));
      });
      closeModal();
    };

    const body = h(
      "div",
      { class: "modal-body" },
      h("h2", { id: "modal-title" }, welcome ? "Bienvenue dans Habit Quest ⚔️" : "Habitudes suggérées"),
      welcome
        ? h("ul", { class: "intro-list" }, h("li", {}, "Valide tes habitudes pro chaque jour pour gagner de l’XP."), h("li", {}, "Enchaîne les jours pour déclencher des multiplicateurs de série."), h("li", {}, "Monte de niveau, de Stagiaire à Légende, et débloque des succès."))
        : h("p", { class: "subtle" }, "Coche celles que tu veux ajouter ; tu pourras toutes les modifier ensuite."),
      welcome ? field("Comment t’appelles-tu ?", nameInput, "w-name") : null,
      h("div", { class: "template-list", role: "group", "aria-label": "Habitudes suggérées" }, checks.map((c) => c.node)),
      h(
        "div",
        { class: "modal-actions" },
        h("button", { class: "btn", type: "button", onclick: () => (welcome ? finish(false) : closeModal()) }, welcome ? "Je configure moi-même" : "Annuler"),
        h("button", { class: "btn btn-primary", type: "button", autofocus: true, onclick: () => finish(true) }, welcome ? "Commencer" : "Ajouter la sélection")
      )
    );
    openModal(body, {
      onClose: () => {
        if (welcome && !state.onboarded) {
          state.onboarded = true; // fermé avec Échap : on ne redemande pas à chaque chargement
          save();
        }
      },
    });
  }

  function openSettings() {
    const error = h("p", { class: "error", role: "alert", hidden: true });
    const showError = (msg) => {
      error.textContent = msg;
      error.hidden = false;
    };
    const nameInput = h("input", { class: "input", id: "s-name", type: "text", maxlength: 40, value: state.profile.name, placeholder: "Ton prénom ou pseudo" });
    const themeLabels = { auto: "Auto", light: "Clair", dark: "Sombre" };

    const form = h(
      "form",
      {
        class: "modal-body",
        onsubmit: (ev) => {
          ev.preventDefault();
          const data = new FormData(ev.currentTarget);
          state.profile.name = String(data.get("name") || "").trim().slice(0, 40);
          if (C.THEMES.includes(data.get("theme"))) state.settings.theme = data.get("theme");
          applyTheme();
          save();
          render();
          closeModal();
        },
      },
      h("h2", { id: "modal-title" }, "Réglages"),
      field("Nom affiché", Object.assign(nameInput, { name: "name" }), "s-name"),
      h("fieldset", { class: "field" }, h("legend", {}, "Thème"), h("div", { class: "choice-row" }, C.THEMES.map((t) => choice("radio", "theme", t, t === state.settings.theme, themeLabels[t])))),
      h(
        "fieldset",
        { class: "field" },
        h("legend", {}, "Données"),
        h("p", { class: "subtle" }, "Tout est stocké dans ce navigateur, sur cet appareil. Exporte régulièrement une sauvegarde."),
        h(
          "div",
          { class: "choice-row" },
          h("button", { class: "btn btn-small", type: "button", onclick: exportData }, "Exporter (JSON)"),
          h("label", { class: "btn btn-small", style: { cursor: "pointer" } }, "Importer…", h("input", { type: "file", accept: "application/json,.json", class: "sr-only", onchange: (ev) => importData(ev.target.files[0], showError) })),
          h("button", { class: "btn btn-small btn-danger", type: "button", onclick: resetData }, "Tout réinitialiser")
        )
      ),
      error,
      h("div", { class: "modal-actions" }, h("button", { class: "btn", type: "button", onclick: closeModal }, "Annuler"), h("button", { class: "btn btn-primary", type: "submit" }, "Enregistrer"))
    );
    openModal(form);
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = h("a", { href: url, download: "habit-quest-" + C.todayKey() + ".json" });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("💾", "Sauvegarde exportée", "Garde ce fichier pour restaurer tes données.");
  }

  async function importData(file, showError) {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("Fichier trop volumineux.");
      let parsed;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        throw new Error("Fichier illisible : ce n’est pas du JSON valide.");
      }
      const next = C.normalizeState(parsed, C.todayKey());
      const ok = window.confirm("Remplacer tes données actuelles (" + state.habits.length + " " + plural(state.habits.length, "habitude", "habitudes") + ") par celles du fichier (" + next.habits.length + " " + plural(next.habits.length, "habitude", "habitudes") + ") ?");
      if (!ok) return;
      state = next;
      const today = C.todayKey();
      C.unlockBadges(state, C.computeProgress(state, today), today); // silencieux : pas de rafale de notifications
      save();
      applyTheme();
      render();
      closeModal();
      toast("📥", "Données importées", state.habits.length + " " + plural(state.habits.length, "habitude chargée", "habitudes chargées") + ".");
    } catch (err) {
      showError(err.message);
    }
  }

  function resetData() {
    if (!window.confirm("Effacer toutes tes habitudes, ton XP et tes succès ? Cette action est irréversible (pense à exporter avant).")) return;
    state = C.createInitialState();
    ui.lastXpRatio = null;
    save();
    applyTheme();
    render();
    closeModal();
    openTemplates(true);
  }

  function showLevelUp(from, to) {
    const titleChanged = from.title !== to.title;
    openModal(
      h(
        "div",
        { class: "modal-body celebrate" },
        h("div", { class: "big", "aria-hidden": "true" }, "🎉"),
        h("h2", { id: "modal-title" }, "Niveau " + to.level + " atteint !"),
        h("p", {}, titleChanged ? "Nouveau titre : " + to.title + ". Belle progression !" : "Tu es " + to.title + ". Continue comme ça !"),
        h("p", { class: "subtle" }, nf.format(to.toNext) + " XP pour le niveau " + (to.level + 1) + "."),
        h("div", { class: "modal-actions" }, h("button", { class: "btn btn-primary", type: "button", autofocus: true, onclick: closeModal }, "Continuer"))
      )
    );
  }

  /* ---------------------------------------------------------------- */
  /* Notifications & effets                                            */
  /* ---------------------------------------------------------------- */

  const toastsEl = $("#toasts");
  const fxEl = $("#fx");
  const liveEl = $("#live");

  // Les conteneurs sont des popovers (couche supérieure) pour rester visibles au-dessus des modales.
  function showLayer(el) {
    try {
      if (el.showPopover && !el.matches(":popover-open")) el.showPopover();
    } catch {
      /* navigateur sans Popover API : le z-index suffit hors modale */
    }
  }
  function hideLayerIfEmpty(el) {
    if (el.children.length) return;
    try {
      if (el.hidePopover && el.matches(":popover-open")) el.hidePopover();
    } catch {
      /* ignoré */
    }
  }

  function announce(message) {
    liveEl.textContent = "";
    setTimeout(() => (liveEl.textContent = message), 30);
  }

  function toast(icon, title, text) {
    const el = h("div", { class: "toast" }, h("span", { class: "t-icon", "aria-hidden": "true" }, icon), h("div", {}, h("strong", {}, title), text ? h("span", {}, text) : null));
    toastsEl.append(el);
    showLayer(toastsEl);
    setTimeout(() => el.classList.add("leaving"), 3800);
    setTimeout(() => {
      el.remove();
      hideLayerIfEmpty(toastsEl);
    }, 4200);
  }

  function floatXp(delta, x, y) {
    const el = h("div", { class: "float-xp" + (delta < 0 ? " negative" : ""), style: { left: x + "px", top: y - 20 + "px" } }, (delta > 0 ? "+" : "−") + Math.abs(delta) + " XP");
    fxEl.append(el);
    showLayer(fxEl);
    setTimeout(() => {
      el.remove();
      hideLayerIfEmpty(fxEl);
    }, 1200);
  }

  function confetti(count) {
    if (reducedMotion()) return;
    const colors = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#6250d6"];
    const pieces = [];
    for (let i = 0; i < count; i++) {
      pieces.push(
        h("i", {
          class: "confetti",
          style: {
            left: Math.random() * 100 + "%",
            background: colors[i % colors.length],
            "--dx": Math.round((Math.random() - 0.5) * 220) + "px",
            "--rot": Math.round(Math.random() * 720 - 360) + "deg",
            "--dur": (1.6 + Math.random() * 1.4).toFixed(2) + "s",
            "--delay": (Math.random() * 0.3).toFixed(2) + "s",
          },
        })
      );
    }
    fxEl.append(...pieces);
    showLayer(fxEl);
    setTimeout(() => {
      pieces.forEach((el) => el.remove());
      hideLayerIfEmpty(fxEl);
    }, 3400);
  }

  /* ---------------------------------------------------------------- */
  /* Démarrage                                                         */
  /* ---------------------------------------------------------------- */

  window.addEventListener("hashchange", () => {
    ui.tab = tabFromHash();
    render();
    window.scrollTo(0, 0);
    viewEl.focus({ preventScroll: true });
  });

  function checkRollover() {
    if (C.todayKey() !== ui.today) render();
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkRollover();
  });
  setInterval(checkRollover, 30000);

  applyTheme();
  render();
  if (!state.onboarded && !state.habits.length) openTemplates(true);
})();
