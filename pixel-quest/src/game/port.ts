/*
 * Accès au coffre (vault) abstrait. Le jeu ne parle qu'à cette interface :
 * - en production, elle est implémentée avec l'API d'Obsidian (src/obsidian/port.ts) ;
 * - dans les tests, par un coffre en mémoire (tests/support/memory-port.ts).
 */

export interface NoteFile {
	path: string;
	/** millisecondes depuis l'epoch */
	ctime: number;
	mtime: number;
}

export type PortEvent =
	| { type: "create" | "modify" | "delete"; path: string }
	| { type: "rename"; path: string; oldPath: string };

export interface VaultPort {
	/** Notes Markdown situées sous `folder` (récursif). Liste vide si le dossier n'existe pas. */
	list(folder: string): NoteFile[];
	/** Métadonnées d'une note, ou null si elle n'existe pas. */
	stat(path: string): NoteFile | null;
	read(path: string): Promise<string>;
	/** Crée une note (et ses dossiers parents). Lève une erreur si elle existe déjà. */
	create(path: string, content: string): Promise<void>;
	/** Lecture-modification-écriture atomique du contenu complet d'une note. */
	process(path: string, fn: (content: string) => string): Promise<void>;
	/** Modifie les propriétés (frontmatter) d'une note sans toucher à son corps. */
	updateProperties(path: string, fn: (props: Record<string, unknown>) => void): Promise<void>;
	/** Renomme une note en mettant à jour les liens qui pointent vers elle. */
	rename(path: string, newPath: string): Promise<void>;
	/** Lit les propriétés d'un contenu Markdown ({} s'il n'y en a pas). */
	parseProperties(content: string): Record<string, unknown>;
	/** Sérialise des propriétés en YAML (sans les délimiteurs `---`). */
	stringifyProperties(props: Record<string, unknown>): string;
	/** Écoute les changements du coffre ; renvoie la fonction de désinscription. */
	onChange(handler: (event: PortEvent) => void): () => void;
}
