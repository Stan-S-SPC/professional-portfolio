/*
 * Dates sous forme de clés locales "AAAA-MM-JJ".
 * Toute l'arithmétique passe par des numéros de jour UTC : insensible aux changements d'heure.
 */

const DAY_MS = 86_400_000;
const pad = (n: number): string => String(n).padStart(2, "0");

export function toKey(date: Date): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey(): string {
	return toKey(new Date());
}

export function dayNumber(key: string): number {
	const [y = 0, m = 1, d = 1] = key.split("-").map(Number);
	return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function fromDayNumber(n: number): string {
	const dt = new Date(n * DAY_MS);
	return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function isKey(value: unknown): value is string {
	return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && fromDayNumber(dayNumber(value)) === value;
}

export const addDays = (key: string, n: number): string => fromDayNumber(dayNumber(key) + n);
export const diffDays = (a: string, b: string): number => dayNumber(b) - dayNumber(a);

/** 0 = dimanche … 6 = samedi (convention JS). */
export const weekday = (key: string): number => new Date(dayNumber(key) * DAY_MS).getUTCDay();

/** Lundi de la semaine contenant `key`. */
export const startOfWeek = (key: string): string => addDays(key, -((weekday(key) + 6) % 7));

/** Les 7 jours (lundi → dimanche) de la semaine contenant `key`. */
export function weekKeys(key: string): string[] {
	const start = startOfWeek(key);
	return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(start, i));
}

/** Date locale (midi, pour éviter tout effet de fuseau) correspondant à une clé. */
export function keyToDate(key: string): Date {
	const [y = 0, m = 1, d = 1] = key.split("-").map(Number);
	return new Date(y, m - 1, d, 12);
}

/** Numéro de semaine ISO 8601 et année ISO (le jeudi décide de l'année). */
export function isoWeek(key: string): { year: number; week: number } {
	const thursday = dayNumber(key) + 3 - ((weekday(key) + 6) % 7);
	const year = new Date(thursday * DAY_MS).getUTCFullYear();
	const jan1 = Math.round(Date.UTC(year, 0, 1) / DAY_MS);
	return { year, week: Math.floor((thursday - jan1) / 7) + 1 };
}

export function weekLabel(key: string): string {
	const { year, week } = isoWeek(key);
	return `${year}-S${pad(week)}`;
}
