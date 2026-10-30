import { ItemView, type WorkspaceLeaf } from "obsidian";
import type { Ctx } from "../ui/context.ts";
import { mountApp, type MountedApp } from "../ui/app.ts";

export const VIEW_TYPE = "pixel-quest-view";

export class PixelQuestView extends ItemView {
	private readonly getCtx: () => Ctx;
	private readonly whenReady: () => Promise<void>;
	private mounted: MountedApp | null = null;

	constructor(leaf: WorkspaceLeaf, getCtx: () => Ctx, whenReady: () => Promise<void>) {
		super(leaf);
		this.getCtx = getCtx;
		this.whenReady = whenReady;
	}

	getViewType(): string {
		return VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Pixel Quest";
	}

	override getIcon(): string {
		return "swords";
	}

	override async onOpen(): Promise<void> {
		this.contentEl.addClass("pq-view-content");
		await this.whenReady(); // le coffre doit être lu avant d'afficher quoi que ce soit
		this.mounted = mountApp(this.contentEl, this.getCtx());
	}

	override async onClose(): Promise<void> {
		this.mounted?.dispose();
		this.mounted = null;
	}
}
