/* Hôte Obsidian : fenêtres modales, notifications et ouverture de notes. */
import { Modal, Notice, TFile, normalizePath, type App } from "obsidian";
import type { Host } from "../ui/context.ts";

class BuilderModal extends Modal {
	private readonly build: (close: () => void) => HTMLElement;
	private readonly onCloseCb: (() => void) | undefined;

	constructor(app: App, build: (close: () => void) => HTMLElement, onClose?: () => void) {
		super(app);
		this.build = build;
		this.onCloseCb = onClose;
	}

	override onOpen(): void {
		this.modalEl.addClass("pq-modal-shell");
		this.contentEl.empty();
		this.contentEl.appendChild(this.build(() => this.close()));
	}

	override onClose(): void {
		this.contentEl.empty();
		this.onCloseCb?.();
	}
}

class ConfirmModal extends Modal {
	private readonly text: string;
	private readonly done: (ok: boolean) => void;
	private answered = false;

	constructor(app: App, text: string, done: (ok: boolean) => void) {
		super(app);
		this.text = text;
		this.done = done;
	}

	override onOpen(): void {
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

	private answer(ok: boolean): void {
		this.answered = true;
		this.done(ok);
		this.close();
	}

	override onClose(): void {
		this.contentEl.empty();
		if (!this.answered) this.done(false);
	}
}

export class ObsidianHost implements Host {
	private readonly app: App;
	private current: Modal | null = null;

	constructor(app: App) {
		this.app = app;
	}

	openNote(path: string): void {
		const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
		if (file instanceof TFile) void this.app.workspace.getLeaf("tab").openFile(file);
		else new Notice(`Note introuvable : ${path}`);
	}

	notice(message: string): void {
		new Notice(message);
	}

	confirm(message: string): Promise<boolean> {
		return new Promise((resolve) => new ConfirmModal(this.app, message, resolve).open());
	}

	modal(build: (close: () => void) => HTMLElement, opts?: { onClose?: () => void }): void {
		this.current?.close();
		const modal = new BuilderModal(this.app, build, opts?.onClose);
		this.current = modal;
		modal.open();
	}

	closeModal(): void {
		this.current?.close();
		this.current = null;
	}
}
