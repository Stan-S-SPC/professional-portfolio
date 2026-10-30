/* Ce dont l'interface a besoin de son environnement (Obsidian en production, un faux hôte dans les tests). */
import type { Actions } from "../game/actions.ts";
import type { GameStore } from "../game/store.ts";
import type { Paths } from "../notes/schema.ts";

export interface Host {
	/** Ouvre une note dans l'éditeur. */
	openNote(path: string): void;
	/** Message bref et discret. */
	notice(message: string): void;
	confirm(message: string): Promise<boolean>;
	/** Affiche une fenêtre modale ; `build` reçoit la fonction pour la fermer. */
	modal(build: (close: () => void) => HTMLElement, opts?: { onClose?: () => void }): void;
	closeModal(): void;
}

export interface Ctx {
	store: GameStore;
	actions: Actions;
	host: Host;
	paths: () => Paths;
	today: () => string;
}
