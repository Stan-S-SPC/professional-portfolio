/* Implémentation de VaultPort avec l'API d'Obsidian. Rien d'autre que du transport : la logique est ailleurs. */
import { TFile, TFolder, getFrontMatterInfo, normalizePath, parseYaml, stringifyYaml, type App, type EventRef } from "obsidian";
import type { NoteFile, PortEvent, VaultPort } from "../game/port.ts";

export class ObsidianVaultPort implements VaultPort {
	private readonly app: App;

	constructor(app: App) {
		this.app = app;
	}

	private file(path: string): TFile {
		const f = this.app.vault.getAbstractFileByPath(normalizePath(path));
		if (!(f instanceof TFile)) throw new Error(`Note introuvable : ${path}`);
		return f;
	}

	private async ensureFolder(path: string): Promise<void> {
		const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
		if (!dir) return;
		let current = "";
		for (const part of dir.split("/")) {
			current = current ? `${current}/${part}` : part;
			if (!this.app.vault.getAbstractFileByPath(normalizePath(current))) {
				try {
					await this.app.vault.createFolder(normalizePath(current));
				} catch {
					// créé entre-temps (synchronisation, autre appareil) : sans conséquence
				}
			}
		}
	}

	list(folder: string): NoteFile[] {
		const root = this.app.vault.getAbstractFileByPath(normalizePath(folder));
		if (!(root instanceof TFolder)) return [];
		const out: NoteFile[] = [];
		const walk = (dir: TFolder): void => {
			for (const child of dir.children) {
				if (child instanceof TFolder) walk(child);
				else if (child instanceof TFile && child.extension === "md") out.push({ path: child.path, ctime: child.stat.ctime, mtime: child.stat.mtime });
			}
		};
		walk(root);
		return out;
	}

	stat(path: string): NoteFile | null {
		const f = this.app.vault.getAbstractFileByPath(normalizePath(path));
		return f instanceof TFile ? { path: f.path, ctime: f.stat.ctime, mtime: f.stat.mtime } : null;
	}

	async read(path: string): Promise<string> {
		return this.app.vault.read(this.file(path));
	}

	async create(path: string, content: string): Promise<void> {
		const p = normalizePath(path);
		await this.ensureFolder(p);
		await this.app.vault.create(p, content);
	}

	async process(path: string, fn: (content: string) => string): Promise<void> {
		await this.app.vault.process(this.file(path), fn);
	}

	async updateProperties(path: string, fn: (props: Record<string, unknown>) => void): Promise<void> {
		await this.app.fileManager.processFrontMatter(this.file(path), (fm: Record<string, unknown>) => fn(fm));
	}

	async rename(path: string, newPath: string): Promise<void> {
		const target = normalizePath(newPath);
		await this.ensureFolder(target);
		await this.app.fileManager.renameFile(this.file(path), target);
	}

	parseProperties(content: string): Record<string, unknown> {
		const info = getFrontMatterInfo(content);
		if (!info.exists) return {};
		const parsed: unknown = parseYaml(info.frontmatter);
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
	}

	stringifyProperties(props: Record<string, unknown>): string {
		return stringifyYaml(props);
	}

	onChange(handler: (event: PortEvent) => void): () => void {
		const { vault } = this.app;
		const isNote = (f: unknown): f is TFile => f instanceof TFile && f.extension === "md";
		const refs: EventRef[] = [
			vault.on("create", (f) => isNote(f) && handler({ type: "create", path: f.path })),
			vault.on("modify", (f) => isNote(f) && handler({ type: "modify", path: f.path })),
			vault.on("delete", (f) => isNote(f) && handler({ type: "delete", path: f.path })),
			vault.on("rename", (f, oldPath) => isNote(f) && handler({ type: "rename", path: f.path, oldPath })),
		];
		return () => refs.forEach((ref) => vault.offref(ref));
	}
}
