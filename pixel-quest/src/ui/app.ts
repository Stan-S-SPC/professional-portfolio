/*
 * Interface de Pixel Quest : en-tête du héros et quatre onglets (Quêtes, Héros, Boss, Grimoire).
 * Indépendante d'Obsidian : tout ce dont elle a besoin passe par `Ctx` (store, actions, hôte).
 */
import { addDays, keyToDate, startOfWeek, weekKeys, weekLabel } from "../engine/dates.ts";
import {
	evaluateBadges,
	isArchived,
	isFavored,
	isScheduled,
	streakMultiplier,
	xpPreview,
	type BossWeek,
	type Progress,
	type Quest,
} from "../engine/progress.ts";
import { BOSS_BONUS, CLASSES, CLASS_BONUS, DAY_LABELS, DIFFICULTIES, HERO_TITLES, PERFECT_DAY_BONUS, SKILLS, SKILL_IDS, STREAK_TIERS } from "../engine/rules.ts";
import { GameError } from "../game/actions.ts";
import type { Ctx } from "./context.ts";
import { h, nf, pct, plural } from "./dom.ts";
import { openBossVictory, openClassPicker, openHeroCreation, openLevelUp, openNoteModal, openQuestModal, openStarters } from "./modals.ts";
import { bossArt, heroArt, spriteElement } from "./sprites.ts";

type Tab = "quests" | "hero" | "boss" | "grimoire";

const TABS: readonly { id: Tab; icon: string; label: string }[] = [
	{ id: "quests", icon: "⚔️", label: "Quêtes" },
	{ id: "hero", icon: "🛡️", label: "Héros" },
	{ id: "boss", icon: "🐉", label: "Boss" },
	{ id: "grimoire", icon: "📖", label: "Grimoire" },
];

const dfLong = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const dfShort = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const fmt = (df: Intl.DateTimeFormat, key: string): string => df.format(keyToDate(key));
const reducedMotion = (): boolean => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface MountedApp {
	/** Force un rendu immédiat (utile aux tests). */
	refresh(): void;
	dispose(): void;
}

export function mountApp(root: HTMLElement, ctx: Ctx): MountedApp {
	const ui = { tab: "quests" as Tab, viewDate: ctx.today(), weekOf: ctx.today(), today: ctx.today(), showArchived: false, lastXpRatio: null as number | null };

	root.classList.add("pq-root", "pq-theme");
	const headerEl = h("header", { class: "pq-header" });
	const tabsEl = h("nav", { class: "pq-tabs", "aria-label": "Pixel Quest" });
	const viewEl = h("main", { class: "pq-main" });
	const toastsEl = h("div", { class: "pq-toasts" });
	const fxEl = h("div", { class: "pq-fx", "aria-hidden": "true" });
	const liveEl = h("div", { class: "pq-sr", role: "status", "aria-live": "polite" });
	root.replaceChildren(headerEl, tabsEl, viewEl, toastsEl, fxEl, liveEl);

	/* ---------------------------------------------------------------- */
	/* Rendu                                                             */
	/* ---------------------------------------------------------------- */

	function syncToday(): string {
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

	function render(): void {
		const today = syncToday();
		const progress = ctx.store.progress();
		const active = document.activeElement as HTMLElement | null;
		const focusId = active && root.contains(active) ? active.dataset["focusId"] : undefined;

		renderHeader(progress);
		renderTabs();
		const views: Record<Tab, (p: Progress, t: string) => HTMLElement> = { quests: viewQuests, hero: viewHero, boss: viewBoss, grimoire: viewGrimoire };
		viewEl.replaceChildren(views[ui.tab](progress, today));

		if (focusId) {
			const target = [...root.querySelectorAll<HTMLElement>("[data-focus-id]")].find((el) => el.dataset["focusId"] === focusId);
			target?.focus({ preventScroll: true });
		}
	}

	let raf = 0;
	const schedule = (): void => {
		if (raf) return;
		raf = requestAnimationFrame(() => {
			raf = 0;
			render();
		});
	};
	const unsubscribe = ctx.store.subscribe(schedule);
	const interval = window.setInterval(() => {
		if (ctx.today() !== ui.today) schedule();
	}, 30_000);

	function bar(ratio: number, label: string, now: number, max: number, kind = ""): HTMLElement {
		const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
		return h(
			"div",
			{ class: `pq-bar ${kind}`.trim(), role: "progressbar", "aria-label": label, "aria-valuemin": 0, "aria-valuemax": max, "aria-valuenow": now },
			h("div", { class: "pq-bar-fill", style: { width: `${clamped * 100}%` } }),
		);
	}

	function renderHeader(p: Progress): void {
		const L = p.level;
		const hero = ctx.store.hero;
		const cls = hero.heroClass;
		const ratio = L.progress;
		const fill = bar(ui.lastXpRatio ?? ratio, `Progression vers le niveau ${L.level + 1}`, L.into, L.needed);
		if (ui.lastXpRatio !== null && ui.lastXpRatio !== ratio) {
			const inner = fill.firstElementChild as HTMLElement;
			requestAnimationFrame(() => requestAnimationFrame(() => (inner.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`)));
		}
		ui.lastXpRatio = ratio;
		const next = L.nextTitle ? `Prochain titre : ${L.nextTitle.title} au niveau ${L.nextTitle.level}` : "Titre maximal atteint";
		headerEl.replaceChildren(
			h(
				"div",
				{ class: "pq-panel pq-hero-card" },
				h("button", { class: "pq-hero-btn", type: "button", "aria-label": "Voir mon héros", onclick: () => go("hero") }, spriteElement(heroArt(cls, L.tier), "pq-hero-sprite")),
				h(
					"div",
					{ class: "pq-hero-info" },
					h("div", { class: "pq-name" }, hero.name || "Héros sans nom"),
					h("div", { class: "pq-sub", title: next }, `${cls ? CLASSES[cls].label : "Sans classe"} · Niv. ${L.level} ${L.title}`),
					fill,
					h(
						"div",
						{ class: "pq-xpmeta" },
						h("span", {}, `${nf.format(L.into)} / ${nf.format(L.needed)} XP`),
						h("span", { class: "pq-chip", title: "Meilleure série en cours", "aria-label": `Meilleure série en cours : ${p.currentStreak} ${plural(p.currentStreak, "jour", "jours")}` }, `🔥 ${p.currentStreak}`),
						h("span", { class: "pq-chip", "aria-label": `${nf.format(p.totalXp)} points d'expérience` }, `⭐ ${nf.format(p.totalXp)}`),
					),
				),
			),
		);
	}

	function renderTabs(): void {
		tabsEl.replaceChildren(
			...TABS.map((t) =>
				h(
					"button",
					{ class: "pq-tab", type: "button", "aria-current": ui.tab === t.id ? "page" : null, "data-focus-id": `tab-${t.id}`, onclick: () => go(t.id) },
					h("span", { "aria-hidden": "true" }, t.icon),
					h("span", { class: "pq-tab-label" }, t.label),
				),
			),
		);
	}

	function go(tab: Tab): void {
		ui.tab = tab;
		render();
		viewEl.scrollTop = 0;
	}

	/* ---------------------------------------------------------------- */
	/* Récompenses                                                       */
	/* ---------------------------------------------------------------- */

	function announce(text: string): void {
		liveEl.textContent = "";
		window.setTimeout(() => (liveEl.textContent = text), 30);
	}

	function toast(icon: string, title: string, text: string): void {
		const el = h("div", { class: "pq-toast" }, h("span", { class: "pq-toast-icon", "aria-hidden": "true" }, icon), h("div", {}, h("strong", {}, title), h("span", {}, text)));
		toastsEl.append(el);
		window.setTimeout(() => el.classList.add("leaving"), 3800);
		window.setTimeout(() => el.remove(), 4200);
	}

	function floatXp(delta: number, x: number, y: number): void {
		if (delta === 0) return;
		const rect = root.getBoundingClientRect();
		const el = h("div", { class: "pq-float" + (delta < 0 ? " negative" : ""), style: { left: `${x - rect.left}px`, top: `${y - rect.top - 16}px` } }, `${delta > 0 ? "+" : "−"}${Math.abs(delta)} XP`);
		fxEl.append(el);
		window.setTimeout(() => el.remove(), 1200);
	}

	function confetti(count: number): void {
		if (reducedMotion()) return;
		const colors = ["#ffcd75", "#ef7d57", "#a7f070", "#41a6f6", "#73eff7", "#b13e53"];
		const pieces = Array.from({ length: count }, (_, i) =>
			h("i", {
				class: "pq-confetti",
				style: { left: `${Math.random() * 100}%`, background: colors[i % colors.length] ?? "#fff", "--dx": `${Math.round((Math.random() - 0.5) * 120)}px`, "--dur": `${(1.4 + Math.random() * 1.2).toFixed(2)}s`, "--delay": `${(Math.random() * 0.3).toFixed(2)}s` },
			}),
		);
		fxEl.append(...pieces);
		window.setTimeout(() => pieces.forEach((el) => el.remove()), 3200);
	}

	async function toggle(quest: Quest, date: string, ev: MouseEvent): Promise<void> {
		// lu avant tout `await` : `currentTarget` n'est plus disponible une fois l'événement traité
		const rect = ev.currentTarget instanceof HTMLElement ? ev.currentTarget.getBoundingClientRect() : null;
		const x = ev.clientX || (rect ? rect.left + rect.width / 2 : 0);
		const y = ev.clientY || (rect ? rect.top : 0);
		try {
			const r = await ctx.actions.toggleQuest(quest.id, date);
			const delta = r.after.totalXp - r.before.totalXp;
			floatXp(delta, x, y);
			announce(`${quest.name} ${r.done ? "validée" : "annulée"}, ${delta >= 0 ? "+" : ""}${delta} XP`);
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
				toast("⭐", "Journée parfaite !", `+${PERFECT_DAY_BONUS} XP de bonus`);
				confetti(30);
				delay = 700;
			}
			r.newBadges.forEach((b, i) => window.setTimeout(() => toast(b.icon, `Succès : ${b.name}`, b.desc), delay + i * 500));
		} catch (err) {
			ctx.host.notice(err instanceof GameError ? err.message : `Erreur : ${String(err)}`);
		}
	}

	/* ---------------------------------------------------------------- */
	/* Vue : Quêtes                                                      */
	/* ---------------------------------------------------------------- */

	function periodNav(o: { title: string; sub: HTMLElement | null; canPrev: boolean; canNext: boolean; onPrev: () => void; onNext: () => void; prev: string; next: string }): HTMLElement {
		return h(
			"div",
			{ class: "pq-nav" },
			h("button", { class: "pq-btn pq-square", type: "button", "aria-label": o.prev, disabled: !o.canPrev, "data-focus-id": "nav-prev", onclick: o.onPrev }, "‹"),
			h("div", { class: "pq-nav-title" }, h("h2", {}, o.title), o.sub),
			h("button", { class: "pq-btn pq-square", type: "button", "aria-label": o.next, disabled: !o.canNext, "data-focus-id": "nav-next", onclick: o.onNext }, "›"),
		);
	}

	function earliestDay(today: string): string {
		let min = today;
		for (const q of ctx.store.questList()) for (const per of q.periods) if (per.from < min) min = per.from;
		return min;
	}

	function needsHero(): boolean {
		return !ctx.store.hero.exists || !ctx.store.hero.heroClass;
	}

	function emptyPanel(): HTMLElement {
		const noHero = needsHero();
		return h(
			"section",
			{ class: "pq-panel pq-empty" },
			h("div", { class: "pq-empty-art", "aria-hidden": "true" }, spriteElement(heroArt(ctx.store.hero.heroClass, 0), "pq-big-sprite")),
			h("h2", {}, noHero ? "Ton aventure t'attend" : "Aucune quête pour l'instant"),
			h("p", { class: "pq-dim" }, noHero ? "Choisis ta classe et tes premières quêtes : tout s'écrira dans des notes de ton vault." : "Une quête est une habitude à accomplir. Chacune devient une note dans ton vault."),
			h(
				"div",
				{ class: "pq-row pq-center" },
				noHero
					? h("button", { class: "pq-btn pq-primary", type: "button", onclick: () => openHeroCreation(ctx) }, "Créer mon héros")
					: [h("button", { class: "pq-btn pq-primary", type: "button", onclick: () => openStarters(ctx) }, "Quêtes de départ"), h("button", { class: "pq-btn", type: "button", onclick: () => openQuestModal(ctx) }, "Nouvelle quête")],
			),
		);
	}

	function viewQuests(p: Progress, today: string): HTMLElement {
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
			sub: isToday ? h("span", { class: "pq-tag" }, "Aujourd'hui") : h("button", { class: "pq-btn pq-mini", type: "button", onclick: () => { ui.viewDate = today; render(); } }, "Revenir à aujourd'hui"),
			canPrev: key > earliestDay(today),
			canNext: key < today,
			onPrev: () => { ui.viewDate = addDays(key, -1); render(); },
			onNext: () => { ui.viewDate = addDays(key, 1); render(); },
			prev: "Jour précédent",
			next: "Jour suivant",
		});

		if (!world.quests.length || needsHero()) return h("div", { class: "pq-view" }, nav, emptyPanel());

		const total = scheduled.length;
		let headline: string;
		let sub: string;
		if (isRest) {
			headline = "Jour de repos 🏖️";
			sub = "Aucune quête prévue, aucune série perdue.";
		} else if (!total) {
			headline = "Rien de prévu ce jour";
			sub = "Profite-en, ou ajoute une quête dans le Grimoire.";
		} else {
			headline = `${day.done} ${plural(day.done, "quête accomplie", "quêtes accomplies")} sur ${total}`;
			sub = day.perfect ? "Journée parfaite !" : `Encore ${total - day.done} pour une journée parfaite (+${PERFECT_DAY_BONUS} XP).`;
		}

		const summary = h(
			"section",
			{ class: "pq-panel" },
			h("div", { class: "pq-summary-head" }, h("strong", {}, headline), h("span", { class: "pq-dim" }, `+${nf.format(p.xpByDay[key] ?? 0)} XP ${isToday ? "aujourd'hui" : "ce jour-là"}`)),
			total ? bar(day.done / total, "Quêtes du jour", day.done, total, day.perfect ? "pq-gold" : "") : null,
			h("p", { class: "pq-dim" }, sub),
			day.perfect ? h("div", { class: "pq-banner" }, `🎉 Journée parfaite ! Bonus de +${PERFECT_DAY_BONUS} XP.`) : null,
			h(
				"div",
				{ class: "pq-switch-row" },
				h("div", {}, h("div", { id: "pq-rest-label", class: "pq-strong" }, "Jour de repos / congé"), h("div", { class: "pq-dim" }, "Suspend les quêtes du jour sans casser tes séries.")),
				h("button", { class: "pq-switch", type: "button", role: "switch", "aria-checked": isRest, "aria-labelledby": "pq-rest-label", "data-focus-id": "rest-switch", onclick: () => void ctx.actions.toggleRestDay(key).catch((e) => ctx.host.notice(String(e))) }),
			),
		);

		const list =
			isRest || !total
				? null
				: h(
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
									{ class: "pq-quest-main", type: "button", "aria-pressed": done, "data-focus-id": `q-${q.id}`, onclick: (ev: MouseEvent) => void toggle(q, key, ev) },
									h("span", { class: "pq-check", "aria-hidden": "true" }, "✓"),
									h("span", { class: "pq-quest-icon", "aria-hidden": "true" }, q.icon),
									h(
										"span",
										{ class: "pq-quest-body" },
										h("span", { class: "pq-quest-name" }, q.name),
										h(
											"span",
											{ class: "pq-quest-meta" },
											h("span", { class: "pq-xp" }, `+${xp} XP`, mult > 1 ? h("small", {}, ` ×${nf.format(Math.round(mult * 100) / 100)}`) : null),
											h("span", {}, `${SKILLS[q.skill].emoji} ${SKILLS[q.skill].label}`),
											h("span", { title: DIFFICULTIES[q.difficulty].label, "aria-label": DIFFICULTIES[q.difficulty].label }, "★".repeat(stars) + "☆".repeat(3 - stars)),
											streakNow > 0 ? h("span", { title: "Série en cours" }, `🔥 ${streakNow}`) : null,
										),
									),
								),
								h("button", { class: "pq-btn pq-square pq-note-btn", type: "button", "aria-label": `Ajouter une note à « ${q.name} »`, onclick: () => openNoteModal(ctx, key, q.id) }, "✎"),
							);
						}),
					);

		const notes = h(
			"div",
			{ class: "pq-row" },
			h("button", { class: "pq-btn", type: "button", onclick: () => openNoteModal(ctx, key) }, "📝 Note rapide"),
			h("button", { class: "pq-btn", type: "button", onclick: () => void ctx.actions.openDayNote(key).then((path) => ctx.host.openNote(path)).catch((e) => ctx.host.notice(String(e))) }, "📄 Ouvrir la note du jour"),
		);
		return h("div", { class: "pq-view" }, nav, summary, list, notes);
	}

	/* ---------------------------------------------------------------- */
	/* Vue : Héros                                                       */
	/* ---------------------------------------------------------------- */

	function viewHero(p: Progress): HTMLElement {
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
				h("h2", {}, hero.name || "Héros sans nom"),
				h("div", { class: "pq-strong" }, `${def ? def.label : "Sans classe"} · Niv. ${L.level} ${L.title}`),
				def ? h("p", { class: "pq-dim" }, def.blurb) : null,
				h("p", { class: "pq-dim" }, `Équipement : ${L.gear}. ${L.nextTitle ? `Prochain titre : ${L.nextTitle.title} (niveau ${L.nextTitle.level}).` : "Titre maximal atteint."}`),
				h("button", { class: "pq-btn pq-mini", type: "button", onclick: () => (cls ? openClassPicker(ctx) : openHeroCreation(ctx)) }, cls ? "Changer de classe" : "Choisir une classe"),
			),
		);

		const skills = h(
			"section",
			{ class: "pq-panel" },
			h("h2", {}, "Compétences"),
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
							h("div", { class: "pq-skill-head" }, h("strong", {}, SKILLS[id].label), s.favored ? h("span", { class: "pq-tag pq-gold-tag", title: `Compétence favorite : +${Math.round((CLASS_BONUS - 1) * 100)} % d'XP` }, "★ classe") : null, h("span", { class: "pq-dim" }, `Niv. ${s.level} · ${s.rank}`)),
							bar(s.progress, `${SKILLS[id].label} : progression vers le niveau ${s.level + 1}`, s.into, s.needed, "pq-thin"),
							h("div", { class: "pq-dim pq-small" }, `${nf.format(s.into)} / ${nf.format(s.needed)} XP · ${s.count} ${plural(s.count, "quête", "quêtes")}`),
						),
					);
				}),
			),
			h("p", { class: "pq-dim pq-small" }, `XP : quêtes ${nf.format(p.xpBreakdown.completions)} · journées parfaites ${nf.format(p.xpBreakdown.perfectDays)} · boss ${nf.format(p.xpBreakdown.bosses)}`),
		);

		const badges = evaluateBadges(p);
		const stored = hero.badges;
		const isUnlocked = (b: (typeof badges)[number]): boolean => Boolean(stored[b.id]) || b.reached;
		const unlocked = badges.filter(isUnlocked);
		const locked = badges.filter((b) => !isUnlocked(b)).sort((a, b) => b.value / b.target - a.value / a.target);
		const badgeCard = (b: (typeof badges)[number], ok: boolean): HTMLElement =>
			h(
				"li",
				{ class: "pq-badge" + (ok ? "" : " locked"), title: b.desc },
				h("span", { class: "pq-badge-icon", "aria-hidden": "true" }, b.icon),
				h("strong", {}, b.name),
				h("small", {}, b.desc),
				ok ? h("small", { class: "pq-ok" }, `✓ ${stored[b.id] ? fmt(dfShort, stored[b.id] as string) : "Débloqué"}`) : h("small", { class: "pq-dim" }, `🔒 ${nf.format(Math.min(b.value, b.target))} / ${nf.format(b.target)}`),
			);
		const achievements = h(
			"section",
			{ class: "pq-panel" },
			h("div", { class: "pq-row-between" }, h("h2", {}, "Succès"), h("span", { class: "pq-dim" }, `${unlocked.length} / ${badges.length}`)),
			h("ul", { class: "pq-badges" }, unlocked.map((b) => badgeCard(b, true)), locked.map((b) => badgeCard(b, false))),
		);
		return h("div", { class: "pq-view" }, identity, skills, achievements);
	}

	/* ---------------------------------------------------------------- */
	/* Vue : Boss & semaine                                              */
	/* ---------------------------------------------------------------- */

	function bossPanel(b: BossWeek | undefined): HTMLElement {
		if (!b) return h("section", { class: "pq-panel pq-empty" }, h("p", { class: "pq-dim" }, "Aucune quête n'était prévue cette semaine-là : pas de combat."));
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
				light
					? h("p", { class: "pq-strong" }, "Semaine trop légère : il faut au moins 5 quêtes prévues pour qu'un boss apparaisse.")
					: [
							bar(b.required ? left / b.required : 0, `Points de vie de ${b.boss.name}`, left, b.required, "pq-danger"),
							h("div", { class: "pq-row-between" }, h("span", { class: "pq-strong" }, b.defeated ? "VAINCU ✅" : `PV ${left} / ${b.required}`), h("span", { class: "pq-dim" }, `${b.damage} dégâts · ${b.slots} quêtes prévues`)),
							h("p", { class: "pq-dim pq-small" }, b.defeated ? `+${BOSS_BONUS} XP de bonus obtenus.` : `Valide ${left} ${plural(left, "quête", "quêtes")} de plus pour le vaincre (+${BOSS_BONUS} XP).`),
						],
			),
		);
	}

	function viewBoss(p: Progress, today: string): HTMLElement {
		const keys = weekKeys(ui.weekOf);
		const start = keys[0] ?? ui.weekOf;
		const end = keys[6] ?? ui.weekOf;
		const thisWeek = startOfWeek(today);
		const world = ctx.store.world();
		const offSet = new Set(world.offDays);
		const nav = periodNav({
			title: `${fmt(dfShort, start)} – ${fmt(dfShort, end)}`,
			sub: start === thisWeek ? h("span", { class: "pq-tag" }, "Cette semaine") : h("button", { class: "pq-btn pq-mini", type: "button", onclick: () => { ui.weekOf = today; render(); } }, "Revenir à cette semaine"),
			canPrev: start > startOfWeek(earliestDay(today)),
			canNext: start < thisWeek,
			onPrev: () => { ui.weekOf = addDays(start, -7); render(); },
			onNext: () => { ui.weekOf = addDays(start, 7); render(); },
			prev: "Semaine précédente",
			next: "Semaine suivante",
		});
		if (!world.quests.length || needsHero()) return h("div", { class: "pq-view" }, nav, emptyPanel());

		const boss = p.bosses.find((b) => b.weekStart === start);
		const rows = world.quests.filter((q) => keys.some((k) => q.periods.some((per) => k >= per.from && (per.to === null || k < per.to))));
		const head = h("tr", {}, h("th", { scope: "col", class: "pq-hname" }, h("span", { class: "pq-sr" }, "Quête")), keys.map((k) => h("th", { scope: "col", class: k === today ? "today" : "" }, (DAY_LABELS[keyToDate(k).getDay()] ?? "").slice(0, 3), h("span", { class: "pq-dnum" }, String(Number(k.slice(8)))))));
		const body = rows.map((q) =>
			h(
				"tr",
				{},
				h("th", { scope: "row", class: "pq-hname" }, h("span", { title: q.name }, `${q.icon} ${q.name}`)),
				keys.map((k) => {
					const cls = k === today ? "today" : "";
					if (k > today) return h("td", { class: cls }, h("span", { class: "pq-na", "aria-label": "Pas encore possible" }, "·"));
					if (!isScheduled(q, k, offSet)) return h("td", { class: cls }, h("span", { class: "pq-na", "aria-label": "Non prévu" }, "·"));
					const done = (world.log[k] ?? []).includes(q.id);
					return h("td", { class: cls }, h("button", { class: "pq-cell" + (!done && k < today ? " missed" : ""), type: "button", "aria-pressed": done, "aria-label": `${q.name}, ${fmt(dfLong, k)}`, "data-focus-id": `w-${q.id}-${k}`, onclick: (ev: MouseEvent) => void toggle(q, k, ev) }, "✓"));
				}),
			),
		);
		const foot = h("tr", {}, h("th", { scope: "row", class: "pq-hname" }, "Jour"), keys.map((k) => {
			const d = p.days[k];
			let text = "–";
			if (k <= today && d) text = d.off ? "🏖️" : d.perfect ? "⭐" : d.scheduled ? `${d.done}/${d.scheduled}` : "–";
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
				h("p", { class: "pq-dim pq-small" }, `+${nf.format(weekXp)} XP cette semaine · ⭐ journée parfaite · 🏖️ repos. Touche une case pour valider ou corriger un jour passé.`),
			),
			h(
				"section",
				{ class: "pq-panel" },
				h("div", { class: "pq-row-between" }, h("h2", {}, "Tableau de chasse"), h("span", { class: "pq-dim" }, `${p.bossesDefeated} ${plural(p.bossesDefeated, "boss vaincu", "boss vaincus")}`)),
				history.length
					? h("ul", { class: "pq-hunt" }, history.map((b) => h("li", { class: b.defeated ? "won" : b.current ? "now" : "lost", title: `${weekLabel(b.weekStart)} — ${b.boss.name}${b.defeated ? " (vaincu)" : b.current ? " (en cours)" : ""}` }, spriteElement(bossArt(b.boss.id), "pq-mini-sprite"), h("small", {}, b.defeated ? "✓" : b.current ? "…" : "✗"))))
					: h("p", { class: "pq-dim" }, "Aucun combat pour l'instant."),
			),
			h("div", { class: "pq-row" }, h("button", { class: "pq-btn", type: "button", onclick: () => void reviewWeek(ui.weekOf) }, "📜 Générer la revue de la semaine")),
		);
	}

	async function reviewWeek(day: string): Promise<void> {
		try {
			const { path, created } = await ctx.actions.generateReview(day);
			ctx.host.notice(created ? `Revue créée : ${path}` : `Revue mise à jour : ${path}`);
			ctx.host.openNote(path);
		} catch (err) {
			ctx.host.notice(String(err));
		}
	}

	/* ---------------------------------------------------------------- */
	/* Vue : Grimoire (gestion des quêtes et du second brain)            */
	/* ---------------------------------------------------------------- */

	function questRow(q: Quest, archived: boolean): HTMLElement {
		const d = DIFFICULTIES[q.difficulty];
		const days = q.days.length === 7 ? "Tous les jours" : [1, 2, 3, 4, 5].every((x) => q.days.includes(x)) && q.days.length === 5 ? "Lun – Ven" : [1, 2, 3, 4, 5, 6, 0].filter((x) => q.days.includes(x)).map((x) => DAY_LABELS[x]).join(", ");
		return h(
			"li",
			{ class: "pq-manage" + (archived ? " archived" : "") },
			h("span", { class: "pq-quest-icon", "aria-hidden": "true" }, q.icon),
			h("div", { class: "pq-quest-body" }, h("button", { class: "pq-link", type: "button", title: "Ouvrir la note de la quête", onclick: () => ctx.host.openNote(ctx.store.questPath(q.id) ?? "") }, q.name), h("div", { class: "pq-quest-meta" }, h("span", {}, `${SKILLS[q.skill].emoji} ${SKILLS[q.skill].label}`), h("span", {}, `${d.label} · ${d.xp} XP`), h("span", {}, days))),
			h(
				"div",
				{ class: "pq-row" },
				archived
					? h("button", { class: "pq-btn pq-mini", type: "button", onclick: () => void ctx.actions.restoreQuest(q.id).catch((e) => ctx.host.notice(String(e))) }, "Reprendre")
					: [h("button", { class: "pq-btn pq-mini", type: "button", "aria-label": `Modifier ${q.name}`, onclick: () => openQuestModal(ctx, q) }, "Modifier"), h("button", { class: "pq-btn pq-mini", type: "button", "aria-label": `Archiver ${q.name}`, onclick: () => void ctx.actions.archiveQuest(q.id).catch((e) => ctx.host.notice(String(e))) }, "Archiver")],
			),
		);
	}

	async function openGenerated(path: string, prepare: () => Promise<unknown>): Promise<void> {
		try {
			await prepare();
			ctx.host.openNote(path);
		} catch (err) {
			ctx.host.notice(String(err));
		}
	}

	function viewGrimoire(): HTMLElement {
		const quests = ctx.store.questList();
		const active = quests.filter((q) => !isArchived(q));
		const archived = quests.filter(isArchived);
		const paths = ctx.paths();

		const rules = h(
			"ul",
			{ class: "pq-rules" },
			h("li", {}, `XP par validation : ${Object.values(DIFFICULTIES).map((d) => `${d.label} ${d.xp}`).join(" · ")}.`),
			h("li", {}, `Séries (jours prévus validés d'affilée) : ${[...STREAK_TIERS].reverse().map((t) => `×${nf.format(t.mult)} dès ${t.min} j`).join(", ")}.`),
			h("li", {}, `Classe : +${Math.round((CLASS_BONUS - 1) * 100)} % d'XP sur ses deux compétences favorites. Journée parfaite : +${PERFECT_DAY_BONUS} XP.`),
			h("li", {}, `Boss de la semaine : 80 % des quêtes prévues validées (5 minimum) pour le vaincre, +${BOSS_BONUS} XP.`),
			h("li", {}, "Un jour non prévu ou de repos ne casse jamais une série ; un jour prévu manqué la remet à zéro."),
			h("li", {}, `Niveau N de héros = 50 × (N − 1) × N XP cumulés. Titres : ${HERO_TITLES.map((t) => `${t.title} (${t.from})`).join(" → ")}.`),
		);

		return h(
			"div",
			{ class: "pq-view" },
			h(
				"section",
				{ class: "pq-panel" },
				h("div", { class: "pq-row-between" }, h("h2", {}, `Quêtes (${active.length})`), h("div", { class: "pq-row" }, h("button", { class: "pq-btn pq-mini", type: "button", onclick: () => openStarters(ctx) }, "Quêtes de départ"), h("button", { class: "pq-btn pq-primary pq-mini", type: "button", "data-focus-id": "new-quest", onclick: () => openQuestModal(ctx) }, "+ Nouvelle quête"))),
				active.length ? h("ul", { class: "pq-manage-list" }, active.map((q) => questRow(q, false))) : h("p", { class: "pq-dim" }, "Aucune quête active."),
				archived.length
					? h(
							"details",
							{ class: "pq-details", open: ui.showArchived, ontoggle: (ev: Event) => (ui.showArchived = (ev.currentTarget as HTMLDetailsElement).open) },
							h("summary", {}, `Quêtes archivées (${archived.length})`),
							h("p", { class: "pq-dim pq-small" }, "Une quête archivée est en pause : tu peux la reprendre sans perdre sa série."),
							h("ul", { class: "pq-manage-list" }, archived.map((q) => questRow(q, true))),
						)
					: null,
			),
			h(
				"section",
				{ class: "pq-panel" },
				h("h2", {}, "Second brain"),
				h("p", { class: "pq-dim" }, `Tout est écrit dans le dossier « ${paths.root} » de ton vault, en notes Markdown avec propriétés.`),
				h(
					"div",
					{ class: "pq-row" },
					h("button", { class: "pq-btn", type: "button", onclick: () => void openGenerated(paths.dashboard, () => ctx.actions.flushDashboard()) }, "📊 Tableau de bord"),
					h("button", { class: "pq-btn", type: "button", onclick: () => void openGenerated(paths.guide, () => ctx.actions.scaffold()) }, "📘 Guide du cadre de notes"),
					h("button", { class: "pq-btn", type: "button", onclick: () => void reviewWeek(ctx.today()) }, "📜 Revue de la semaine"),
					h("button", { class: "pq-btn", type: "button", onclick: () => void ctx.actions.scaffold({ forceGuide: true }).then(({ created }) => ctx.host.notice(created.length ? `${created.length} note(s) créée(s)` : "Guide mis à jour, structure déjà complète.")).catch((e) => ctx.host.notice(String(e))) }, "🛠️ Réparer la structure"),
				),
			),
			h("section", { class: "pq-panel" }, h("h2", {}, "Règles du jeu"), rules),
		);
	}

	/* ---------------------------------------------------------------- */
	/* Démarrage                                                         */
	/* ---------------------------------------------------------------- */

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
		},
	};
}
