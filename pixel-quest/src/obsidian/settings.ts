import { PluginSettingTab, Setting, type App } from "obsidian";
import { DEFAULT_ROOT } from "../notes/schema.ts";
import type PixelQuestPlugin from "../main.ts";

export interface PixelQuestSettings {
	/** Dossier du vault qui contient les notes du jeu. */
	root: string;
}

export const DEFAULT_SETTINGS: PixelQuestSettings = { root: DEFAULT_ROOT };

export class PixelQuestSettingTab extends PluginSettingTab {
	private readonly plugin: PixelQuestPlugin;

	constructor(app: App, plugin: PixelQuestPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	override display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Dossier des notes")
			.setDesc("Dossier du vault où Pixel Quest range ses notes (quêtes, journal, revues…). Les notes existantes ne sont pas déplacées.")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_ROOT)
					.setValue(this.plugin.settings.root)
					.onChange(async (value) => {
						this.plugin.settings.root = value.trim() || DEFAULT_ROOT;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Créer ou réparer la structure de notes")
			.setDesc("Crée le guide, les modèles et la note du héros s'ils manquent. Ne modifie jamais tes quêtes ni ton journal.")
			.addButton((button) =>
				button.setButtonText("Créer / réparer").onClick(async () => {
					const { created } = await this.plugin.actions.scaffold();
					this.plugin.host.notice(created.length ? `${created.length} note(s) créée(s).` : "La structure est déjà complète.");
				}),
			);

		new Setting(containerEl)
			.setName("Réécrire le guide")
			.setDesc("Remplace le guide du cadre de notes par la version du plugin (utile après une mise à jour).")
			.addButton((button) =>
				button.setButtonText("Réécrire").onClick(async () => {
					await this.plugin.actions.scaffold({ forceGuide: true });
					this.plugin.host.notice("Guide mis à jour.");
				}),
			);
	}
}
