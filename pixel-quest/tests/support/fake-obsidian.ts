/*
 * Fausse API Obsidian, suffisante pour exercer la couche de liaison (src/obsidian/*, src/main.ts) sous Node.
 * Elle reflète le comportement documenté de l'API ; elle ne remplace pas un test dans le vrai Obsidian.
 */
import YAML from "yaml";

export class TAbstractFile {
	path = "";
	name = "";
	parent: TFolder | null = null;
}
export class TFile extends TAbstractFile {
	extension = "md";
	basename = "";
	stat = { ctime: 0, mtime: 0, size: 0 };
}
export class TFolder extends TAbstractFile {
	children: TAbstractFile[] = [];
}

export const normalizePath = (p: string): string => p.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
export const parseYaml = (s: string): unknown => YAML.parse(s);
export const stringifyYaml = (o: unknown): string => YAML.stringify(o);
export function getFrontMatterInfo(content: string) {
	const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(content);
	return m ? { exists: true, frontmatter: m[1] ?? "", from: 4, to: 4 + (m[1] ?? "").length, contentStart: m[0].length } : { exists: false, frontmatter: "", from: 0, to: 0, contentStart: 0 };
}

export class Notice {
	static messages: string[] = [];
	constructor(message: string) {
		Notice.messages.push(message);
	}
}

export type EventRef = { name: string; cb: (...args: never[]) => unknown };

class Events {
	private refs: EventRef[] = [];
	on(name: string, cb: (...args: never[]) => unknown): EventRef {
		const ref = { name, cb };
		this.refs.push(ref);
		return ref;
	}
	offref(ref: EventRef): void {
		this.refs = this.refs.filter((r) => r !== ref);
	}
	trigger(name: string, ...args: unknown[]): void {
		for (const r of [...this.refs]) if (r.name === name) (r.cb as (...a: unknown[]) => unknown)(...args);
	}
	listeners(name: string): number {
		return this.refs.filter((r) => r.name === name).length;
	}
}

export class FakeVault extends Events {
	files = new Map<string, { file: TFile; content: string }>();
	folders = new Map<string, TFolder>();
	clock = 1_000;

	getAbstractFileByPath(path: string): TAbstractFile | null {
		return this.files.get(path)?.file ?? this.folders.get(path) ?? null;
	}
	async createFolder(path: string): Promise<TFolder> {
		if (this.folders.has(path)) throw new Error("Folder already exists.");
		const parentPath = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
		if (parentPath && !this.folders.has(parentPath)) throw new Error(`Parent folder missing: ${parentPath}`);
		const folder = new TFolder();
		folder.path = path;
		folder.name = path.slice(path.lastIndexOf("/") + 1);
		this.folders.set(path, folder);
		const parent = this.folders.get(parentPath);
		if (parent) parent.children.push(folder);
		return folder;
	}
	async create(path: string, content: string): Promise<TFile> {
		if (this.files.has(path)) throw new Error("File already exists.");
		const parentPath = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
		const parent = this.folders.get(parentPath);
		if (parentPath && !parent) throw new Error(`Parent folder missing: ${parentPath}`);
		const file = new TFile();
		file.path = path;
		file.name = path.slice(path.lastIndexOf("/") + 1);
		file.basename = file.name.replace(/\.md$/, "");
		file.stat = { ctime: ++this.clock, mtime: this.clock, size: content.length };
		this.files.set(path, { file, content });
		parent?.children.push(file);
		this.trigger("create", file);
		return file;
	}
	async read(file: TFile): Promise<string> {
		const e = this.files.get(file.path);
		if (!e) throw new Error("File does not exist.");
		return e.content;
	}
	async process(file: TFile, fn: (data: string) => string): Promise<string> {
		const e = this.files.get(file.path);
		if (!e) throw new Error("File does not exist.");
		e.content = fn(e.content);
		file.stat.mtime = ++this.clock;
		this.trigger("modify", file);
		return e.content;
	}
}

export class FakeFileManager {
	vault: FakeVault;
	constructor(vault: FakeVault) {
		this.vault = vault;
	}
	async processFrontMatter(file: TFile, fn: (fm: Record<string, unknown>) => void): Promise<void> {
		await this.vault.process(file, (content) => {
			const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(content);
			const fm = (m ? (YAML.parse(m[1] ?? "") as Record<string, unknown> | null) : null) ?? {};
			fn(fm);
			return `---\n${YAML.stringify(fm)}---\n${m ? content.slice(m[0].length) : content}`;
		});
	}
	async renameFile(file: TAbstractFile, newPath: string): Promise<void> {
		const v = this.vault;
		const entry = v.files.get(file.path);
		if (!entry) throw new Error("not a file");
		const oldPath = file.path;
		const from = entry.file.basename;
		v.files.delete(oldPath);
		const parent = v.folders.get(oldPath.slice(0, oldPath.lastIndexOf("/")));
		if (parent) parent.children = parent.children.filter((c) => c !== entry.file);
		entry.file.path = newPath;
		entry.file.name = newPath.slice(newPath.lastIndexOf("/") + 1);
		entry.file.basename = entry.file.name.replace(/\.md$/, "");
		v.files.set(newPath, entry);
		v.folders.get(newPath.slice(0, newPath.lastIndexOf("/")))?.children.push(entry.file);
		v.trigger("rename", entry.file, oldPath);
		// comme Obsidian avec « mettre à jour les liens » activé
		for (const [p, e] of v.files) {
			const next = e.content.split(`[[${from}]]`).join(`[[${entry.file.basename}]]`);
			if (next !== e.content) {
				e.content = next;
				v.trigger("modify", e.file);
				void p;
			}
		}
	}
}

export class Leaf {
	opened: TFile[] = [];
	async openFile(file: TFile): Promise<void> {
		this.opened.push(file);
	}
	async setViewState(): Promise<void> {}
}

export class FakeWorkspace {
	leaves: Leaf[] = [];
	onLayoutReady(cb: () => unknown): void {
		void cb();
	}
	getLeaf(): Leaf {
		const leaf = new Leaf();
		this.leaves.push(leaf);
		return leaf;
	}
	getLeavesOfType(): Leaf[] {
		return [];
	}
	async revealLeaf(): Promise<void> {}
}

export class App {
	vault = new FakeVault();
	fileManager = new FakeFileManager(this.vault);
	workspace = new FakeWorkspace();
}

export class Modal {
	app: App;
	contentEl = {} as HTMLElement;
	modalEl = {} as HTMLElement;
	static opened: Modal[] = [];
	constructor(app: App) {
		this.app = app;
	}
	open(): void {
		Modal.opened.push(this);
	}
	close(): void {}
	onOpen(): void {}
	onClose(): void {}
}
export class FuzzySuggestModal<T> extends Modal {
	static last: FuzzySuggestModal<unknown> | null = null;
	setPlaceholder(): void {}
	override open(): void {
		FuzzySuggestModal.last = this as FuzzySuggestModal<unknown>;
		super.open();
	}
	getItems(): T[] {
		return [];
	}
	getItemText(_item: T): string {
		return "";
	}
	onChooseItem(_item: T): void {}
}
export class ItemView {
	constructor(_leaf: unknown) {}
}
export class PluginSettingTab {
	constructor(_app: App, _plugin: unknown) {}
}
export class Setting {
	constructor(_el: unknown) {}
}
export class Plugin {
	app: App;
	manifest = { id: "pixel-quest" };
	commands = new Map<string, { id: string; name: string; callback: () => void }>();
	views = new Map<string, unknown>();
	ribbons: string[] = [];
	tabs: unknown[] = [];
	stored: unknown = null;
	constructor(app: App, _manifest: unknown) {
		this.app = app;
	}
	onload(): void | Promise<void> {}
	onunload(): void {}
	addCommand(cmd: { id: string; name: string; callback: () => void }): void {
		this.commands.set(cmd.id, cmd);
	}
	registerView(type: string, creator: unknown): void {
		this.views.set(type, creator);
	}
	addRibbonIcon(icon: string): void {
		this.ribbons.push(icon);
	}
	addSettingTab(tab: unknown): void {
		this.tabs.push(tab);
	}
	async loadData(): Promise<unknown> {
		return this.stored;
	}
	async saveData(data: unknown): Promise<void> {
		this.stored = data;
	}
}
