/*
 * Coffre en mémoire qui imite le comportement d'Obsidian utile au plugin :
 * événements de changement, ajout de propriétés sur une note qui n'en a pas,
 * mise à jour des liens au renommage (désactivable).
 */
import YAML from "yaml";
import type { NoteFile, PortEvent, VaultPort } from "../../src/game/port.ts";

interface Entry {
	content: string;
	ctime: number;
	mtime: number;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export class MemoryPort implements VaultPort {
	files = new Map<string, Entry>();
	updateLinksOnRename = true;
	private handlers = new Set<(e: PortEvent) => void>();
	private clock: number;

	constructor(start = Date.UTC(2026, 9, 26, 8, 0, 0)) {
		this.clock = start;
	}

	private tick(): number {
		this.clock += 1000;
		return this.clock;
	}

	private emit(e: PortEvent): void {
		for (const h of [...this.handlers]) h(e);
	}

	/** Écrit directement (comme le ferait un autre appareil ou un agent), en émettant l'événement. */
	external(path: string, content: string): void {
		const existed = this.files.has(path);
		const now = this.tick();
		const prev = this.files.get(path);
		this.files.set(path, { content, ctime: prev?.ctime ?? now, mtime: now });
		this.emit({ type: existed ? "modify" : "create", path });
	}

	text(path: string): string {
		const f = this.files.get(path);
		if (!f) throw new Error(`absent : ${path}`);
		return f.content;
	}

	props(path: string): Record<string, unknown> {
		return this.parseProperties(this.text(path));
	}

	list(folder: string): NoteFile[] {
		const out: NoteFile[] = [];
		for (const [path, f] of this.files) if (path.startsWith(folder + "/") && path.endsWith(".md")) out.push({ path, ctime: f.ctime, mtime: f.mtime });
		return out;
	}

	stat(path: string): NoteFile | null {
		const f = this.files.get(path);
		return f ? { path, ctime: f.ctime, mtime: f.mtime } : null;
	}

	async read(path: string): Promise<string> {
		return this.text(path);
	}

	async create(path: string, content: string): Promise<void> {
		if (this.files.has(path)) throw new Error(`File already exists: ${path}`);
		const now = this.tick();
		this.files.set(path, { content, ctime: now, mtime: now });
		this.emit({ type: "create", path });
	}

	async process(path: string, fn: (content: string) => string): Promise<void> {
		const f = this.files.get(path);
		if (!f) throw new Error(`absent : ${path}`);
		f.content = fn(f.content);
		f.mtime = this.tick();
		this.emit({ type: "modify", path });
	}

	async updateProperties(path: string, fn: (props: Record<string, unknown>) => void): Promise<void> {
		await this.process(path, (content) => {
			const m = FRONTMATTER.exec(content);
			const props = (m ? (YAML.parse(m[1] ?? "") as Record<string, unknown> | null) : null) ?? {};
			fn(props);
			const body = m ? content.slice(m[0].length) : content;
			return `---\n${YAML.stringify(props)}---\n${body}`;
		});
	}

	async rename(path: string, newPath: string): Promise<void> {
		const f = this.files.get(path);
		if (!f) throw new Error(`absent : ${path}`);
		if (this.files.has(newPath)) throw new Error(`File already exists: ${newPath}`);
		this.files.delete(path);
		this.files.set(newPath, f);
		this.emit({ type: "rename", path: newPath, oldPath: path });
		if (this.updateLinksOnRename) {
			const from = path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, "");
			const to = newPath.slice(newPath.lastIndexOf("/") + 1).replace(/\.md$/, "");
			for (const [p, e] of this.files) {
				const next = e.content.split(`[[${from}]]`).join(`[[${to}]]`).split(`[[${from}|`).join(`[[${to}|`);
				if (next !== e.content) {
					e.content = next;
					e.mtime = this.tick();
					this.emit({ type: "modify", path: p });
				}
			}
		}
	}

	parseProperties(content: string): Record<string, unknown> {
		const m = FRONTMATTER.exec(content);
		if (!m) return {};
		const parsed = YAML.parse(m[1] ?? "") as unknown;
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
	}

	stringifyProperties(props: Record<string, unknown>): string {
		return YAML.stringify(props);
	}

	onChange(handler: (e: PortEvent) => void): () => void {
		this.handlers.add(handler);
		return () => this.handlers.delete(handler);
	}
}
