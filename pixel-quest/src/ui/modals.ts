/* Fenêtres modales : création du héros, quêtes, notes, récompenses. */
import {
	CLASSES,
	CLASS_BONUS,
	CLASS_IDS,
	DIFFICULTIES,
	DIFFICULTY_IDS,
	DISPLAY_ORDER,
	DAY_LABELS,
	SKILLS,
	SKILL_IDS,
	type ClassId,
	type DifficultyId,
	type SkillId,
} from "../engine/rules.ts";
import { isArchived, type BossWeek, type LevelInfo, type Quest } from "../engine/progress.ts";
import { GameError } from "../game/actions.ts";
import { STARTERS } from "../game/starters.ts";
import { sanitizeFileName } from "../notes/schema.ts";
import type { Ctx } from "./context.ts";
import { h, plural } from "./dom.ts";
import { bossArt, heroArt, spriteElement } from "./sprites.ts";

const EMOJIS = ["⚔️", "🎯", "📚", "🤝", "🧘", "🚀", "🗂️", "📝", "💬", "📈", "🧠", "⚡", "🗓️", "📥", "🚶", "☕", "🎤", "🛠️", "🔍", "🏃", "💡", "📞", "✍️", "🌱"];

const message = (err: unknown): string => (err instanceof GameError || err instanceof Error ? err.message : String(err));

function choice(type: "radio" | "checkbox", name: string, value: string, checked: boolean, content: Array<string | HTMLElement>, className = ""): HTMLLabelElement {
	return h("label", { class: `pq-choice ${className}`.trim() }, h("input", { type, name, value, checked }), h("span", {}, ...content));
}

/* ------------------------------------------------------------------ */
/* Classes                                                             */
/* ------------------------------------------------------------------ */

function classCards(selected: ClassId | null): { el: HTMLElement; value: () => ClassId | null } {
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
					h("small", { class: "pq-class-fav" }, `★ +${Math.round((CLASS_BONUS - 1) * 100)} % XP : ${def.favored.map((s) => SKILLS[s].label).join(", ")}`),
				),
			);
		}),
	);
	return { el, value: () => (el.querySelector<HTMLInputElement>("input:checked")?.value as ClassId | undefined) ?? null };
}

/** Première ouverture : nom, classe et quêtes de départ. */
export function openHeroCreation(ctx: Ctx): void {
	ctx.host.modal((close) => {
		const error = h("p", { class: "pq-error", role: "alert", hidden: true });
		const name = h("input", { class: "pq-input", id: "pq-name", type: "text", maxlength: 40, value: ctx.store.hero.name, placeholder: "Ton nom de héros", autocomplete: "off" });
		const cards = classCards(ctx.store.hero.heroClass);
		const existing = new Set(ctx.store.questList().map((q) => q.name));
		const starters = STARTERS.map((s) => ({
			s,
			input: h("input", { type: "checkbox", checked: !!s.popular && !existing.has(sanitizeFileName(s.name)), disabled: existing.has(sanitizeFileName(s.name)) }),
		}));
		const submit = h("button", { class: "pq-btn pq-primary", type: "submit" }, "Commencer l'aventure");

		const form = h(
			"form",
			{
				class: "pq-modal-body",
				onsubmit: (ev: Event) => {
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
				oninput: () => (error.hidden = true),
			},
			h("h2", { id: "pq-modal-title" }, "Crée ton héros"),
			h("p", { class: "pq-dim" }, "Chaque habitude devient une quête. Tes progrès s'écrivent dans des notes de ton vault : ton second brain se remplit en jouant."),
			h("div", { class: "pq-field" }, h("label", { for: "pq-name" }, "Nom"), name),
			h("div", { class: "pq-field" }, h("span", { class: "pq-label" }, "Classe"), cards.el),
			h(
				"div",
				{ class: "pq-field" },
				h("span", { class: "pq-label" }, "Quêtes de départ"),
				h(
					"div",
					{ class: "pq-starters", role: "group", "aria-label": "Quêtes de départ" },
					starters.map(({ s, input }) =>
						h("label", { class: "pq-starter" }, input, h("span", { class: "pq-quest-icon", "aria-hidden": "true" }, s.icon), h("span", {}, s.name)),
					),
				),
			),
			error,
			h("div", { class: "pq-modal-actions" }, submit),
		);
		return h("div", { class: "pq-theme pq-modal" }, form);
	});
}

export function openClassPicker(ctx: Ctx): void {
	ctx.host.modal((close) => {
		const cards = classCards(ctx.store.hero.heroClass);
		const error = h("p", { class: "pq-error", role: "alert", hidden: true });
		const save = async (): Promise<void> => {
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
				h("p", { class: "pq-dim" }, "Le bonus de classe s'applique à tout l'historique : ton XP et ton niveau sont recalculés."),
				cards.el,
				error,
				h("div", { class: "pq-modal-actions" }, h("button", { class: "pq-btn", type: "button", onclick: close }, "Annuler"), h("button", { class: "pq-btn pq-primary", type: "button", onclick: () => void save() }, "Choisir cette classe")),
			),
		);
	});
}

/* ------------------------------------------------------------------ */
/* Quêtes                                                              */
/* ------------------------------------------------------------------ */

export function openQuestModal(ctx: Ctx, existing?: Quest): void {
	ctx.host.modal((close) => {
		const f = existing ?? { name: "", icon: "⚔️", skill: "methode" as SkillId, difficulty: "moyen" as DifficultyId, days: [1, 2, 3, 4, 5] };
		const icons = EMOJIS.includes(f.icon) ? EMOJIS : [f.icon, ...EMOJIS];
		const error = h("p", { class: "pq-error", role: "alert", hidden: true });
		const name = h("input", { class: "pq-input", id: "pq-qname", name: "name", type: "text", maxlength: 80, required: true, autocomplete: "off", placeholder: "Ex. Bloc de travail profond", value: f.name });
		const dayBoxes = DISPLAY_ORDER.map((d) => choice("checkbox", "day", String(d), f.days.includes(d), [DAY_LABELS[d] ?? ""], "pq-day"));
		const setDays = (days: number[]): void => dayBoxes.forEach((l) => (l.querySelector("input")!.checked = days.includes(Number(l.querySelector("input")!.value))));
		const submit = h("button", { class: "pq-btn pq-primary", type: "submit" }, existing ? "Enregistrer" : "Ajouter la quête");

		const form = h(
			"form",
			{
				class: "pq-modal-body",
				novalidate: true,
				oninput: () => (error.hidden = true),
				onsubmit: (ev: Event) => {
					ev.preventDefault();
					const data = new FormData(ev.currentTarget as HTMLFormElement);
					const draft = {
						name: String(data.get("name") ?? ""),
						icon: String(data.get("icon") ?? "⚔️"),
						skill: String(data.get("skill")) as SkillId,
						difficulty: String(data.get("difficulty")) as DifficultyId,
						days: data.getAll("day").map(Number),
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
				},
			},
			h("h2", { id: "pq-modal-title" }, existing ? "Modifier la quête" : "Nouvelle quête"),
			h("div", { class: "pq-field" }, h("label", { for: "pq-qname" }, "Nom (c'est aussi le titre de la note)"), name),
			h("fieldset", { class: "pq-field" }, h("legend", {}, "Icône"), h("div", { class: "pq-row" }, icons.map((e) => choice("radio", "icon", e, e === f.icon, [e], "pq-emoji")))),
			h(
				"fieldset",
				{ class: "pq-field" },
				h("legend", {}, "Compétence"),
				h("div", { class: "pq-row" }, SKILL_IDS.map((s) => choice("radio", "skill", s, s === f.skill, [`${SKILLS[s].emoji} ${SKILLS[s].label}`]))),
				h("small", { class: "pq-dim" }, "L'XP de la quête fait progresser cette compétence."),
			),
			h(
				"fieldset",
				{ class: "pq-field" },
				h("legend", {}, "Difficulté"),
				h("div", { class: "pq-row" }, DIFFICULTY_IDS.map((d) => choice("radio", "difficulty", d, d === f.difficulty, [`${"★".repeat(DIFFICULTIES[d].stars)} ${DIFFICULTIES[d].label} · ${DIFFICULTIES[d].xp} XP`]))),
			),
			h(
				"fieldset",
				{ class: "pq-field" },
				h("legend", {}, "Jours prévus"),
				h("div", { class: "pq-row" }, dayBoxes),
				h("div", { class: "pq-row" }, h("button", { class: "pq-btn pq-mini", type: "button", onclick: () => setDays([1, 2, 3, 4, 5]) }, "Lun – Ven"), h("button", { class: "pq-btn pq-mini", type: "button", onclick: () => setDays([0, 1, 2, 3, 4, 5, 6]) }, "Tous les jours")),
				existing ? h("small", { class: "pq-dim" }, "Changer les jours s'applique aussi à l'historique : les séries sont recalculées.") : null,
			),
			error,
			h("div", { class: "pq-modal-actions" }, h("button", { class: "pq-btn", type: "button", onclick: close }, "Annuler"), submit),
		);
		return h("div", { class: "pq-theme pq-modal" }, form);
	});
}

export function openStarters(ctx: Ctx): void {
	ctx.host.modal((close) => {
		const existing = new Set(ctx.store.questList().map((q) => q.name));
		const rows = STARTERS.map((s) => {
			const exists = existing.has(sanitizeFileName(s.name));
			return { s, exists, input: h("input", { type: "checkbox", checked: false, disabled: exists }) };
		});
		const error = h("p", { class: "pq-error", role: "alert", hidden: true });
		const add = async (): Promise<void> => {
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
				h("h2", { id: "pq-modal-title" }, "Quêtes de départ"),
				h("p", { class: "pq-dim" }, "Coche celles que tu veux ajouter ; tu pourras toutes les modifier ensuite."),
				h("div", { class: "pq-starters", role: "group", "aria-label": "Quêtes de départ" }, rows.map(({ s, exists, input }) => h("label", { class: "pq-starter" + (exists ? " exists" : "") }, input, h("span", { class: "pq-quest-icon", "aria-hidden": "true" }, s.icon), h("span", {}, s.name, exists ? " (déjà ajoutée)" : "")))),
				error,
				h("div", { class: "pq-modal-actions" }, h("button", { class: "pq-btn", type: "button", onclick: close }, "Annuler"), h("button", { class: "pq-btn pq-primary", type: "button", onclick: () => void add() }, "Ajouter la sélection")),
			),
		);
	});
}

/* ------------------------------------------------------------------ */
/* Notes                                                               */
/* ------------------------------------------------------------------ */

export function openNoteModal(ctx: Ctx, date: string, questId?: string): void {
	ctx.host.modal((close) => {
		const error = h("p", { class: "pq-error", role: "alert", hidden: true });
		const text = h("textarea", { class: "pq-input pq-textarea", id: "pq-note", rows: 5, placeholder: "Ce qui s'est passé, ce que tu as appris, une idée…" });
		const select = h(
			"select",
			{ class: "pq-input", id: "pq-note-quest" },
			h("option", { value: "" }, "Aucune quête en particulier"),
			ctx.store.questList().filter((q) => !isArchived(q)).map((q) => h("option", { value: q.id, selected: q.id === questId }, `${q.icon} ${q.name}`)),
		);
		const save = async (open: boolean): Promise<void> => {
			try {
				const path = await ctx.actions.appendNote(date, text.value, select.value || undefined);
				ctx.host.notice(`Note ajoutée au journal du ${date}`);
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
				h("h2", { id: "pq-modal-title" }, `Note du journal — ${date}`),
				h("div", { class: "pq-field" }, h("label", { for: "pq-note" }, "Note"), text),
				h("div", { class: "pq-field" }, h("label", { for: "pq-note-quest" }, "Lier à une quête"), select),
				h("p", { class: "pq-dim" }, "Elle est ajoutée sous « Notes du jour » dans la note du journal, avec un lien vers la quête."),
				error,
				h("div", { class: "pq-modal-actions" }, h("button", { class: "pq-btn", type: "button", onclick: close }, "Annuler"), h("button", { class: "pq-btn", type: "button", onclick: () => void save(true) }, "Ajouter et ouvrir"), h("button", { class: "pq-btn pq-primary", type: "button", onclick: () => void save(false) }, "Ajouter")),
			),
		);
	});
}

/* ------------------------------------------------------------------ */
/* Récompenses                                                         */
/* ------------------------------------------------------------------ */

export function openLevelUp(ctx: Ctx, from: LevelInfo, to: LevelInfo): void {
	const heroClass = ctx.store.hero.heroClass;
	ctx.host.modal((close) =>
		h(
			"div",
			{ class: "pq-theme pq-modal" },
			h(
				"div",
				{ class: "pq-modal-body pq-celebrate" },
				spriteElement(heroArt(heroClass, to.tier), "pq-big-sprite"),
				h("h2", { id: "pq-modal-title" }, `Niveau ${to.level} !`),
				h("p", {}, from.title !== to.title ? `Nouveau titre : ${to.title}` : `Tu es ${to.title}. Continue comme ça !`),
				from.tier !== to.tier ? h("p", { class: "pq-dim" }, `Nouvel équipement : ${to.gear}`) : null,
				h("p", { class: "pq-dim" }, `${to.toNext} XP avant le niveau ${to.level + 1}.`),
				h("div", { class: "pq-modal-actions" }, h("button", { class: "pq-btn pq-primary", type: "button", onclick: close }, "Continuer")),
			),
		),
	);
}

export function openBossVictory(ctx: Ctx, boss: BossWeek, bonus: number): void {
	ctx.host.modal((close) =>
		h(
			"div",
			{ class: "pq-theme pq-modal" },
			h(
				"div",
				{ class: "pq-modal-body pq-celebrate" },
				spriteElement(bossArt(boss.boss.id), "pq-big-sprite pq-defeated"),
				h("h2", { id: "pq-modal-title" }, "Boss vaincu !"),
				h("p", {}, `${boss.boss.name} s'effondre. +${bonus} XP de bonus.`),
				h("p", { class: "pq-dim" }, `${boss.damage} ${plural(boss.damage, "quête validée", "quêtes validées")} cette semaine.`),
				h("div", { class: "pq-modal-actions" }, h("button", { class: "pq-btn pq-primary", type: "button", onclick: close }, "Victoire !")),
			),
		),
	);
}
