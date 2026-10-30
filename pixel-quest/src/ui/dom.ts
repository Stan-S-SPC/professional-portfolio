/* Petit constructeur DOM sans dépendance. Le texte est toujours inséré comme nœud texte (jamais en HTML). */

export type Child = Node | string | number | null | undefined | false | readonly Child[];
type Props = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): HTMLElementTagNameMap[K] {
	const el = document.createElement(tag);
	if (props) {
		for (const [k, v] of Object.entries(props)) {
			if (v === null || v === undefined) continue;
			if (k === "class") el.className = String(v);
			else if (k === "style") for (const [p, val] of Object.entries(v as Record<string, string>)) el.style.setProperty(p, val);
			else if (k.startsWith("on")) el.addEventListener(k.slice(2), v as EventListener);
			else if (k.startsWith("aria-")) el.setAttribute(k, String(v));
			else if (k === "value" || k === "checked" || k === "selected" || k === "disabled" || k === "hidden") (el as unknown as Record<string, unknown>)[k] = v;
			else if (v === true) el.setAttribute(k, "");
			else if (v !== false) el.setAttribute(k, String(v));
		}
	}
	append(el, children);
	return el;
}

function append(el: Node, children: readonly Child[]): void {
	for (const child of children) {
		if (child === null || child === undefined || child === false) continue;
		if (Array.isArray(child)) append(el, child as readonly Child[]);
		else el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
	}
}

export const plural = (n: number, one: string, many: string): string => (n > 1 ? many : one);
export const nf = new Intl.NumberFormat("fr-FR");
export const pct = (ratio: number): string => `${Math.round(ratio * 100)} %`;
