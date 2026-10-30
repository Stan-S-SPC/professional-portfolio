/* Quêtes de départ proposées à la création du héros. */
import type { DifficultyId, SkillId } from "../engine/rules.ts";

export interface Starter {
	name: string;
	icon: string;
	skill: SkillId;
	difficulty: DifficultyId;
	days: number[];
	/** cochée par défaut à la création du héros */
	popular?: boolean;
}

const WEEK = [1, 2, 3, 4, 5];
const ALL = [0, 1, 2, 3, 4, 5, 6];

export const STARTERS: readonly Starter[] = [
	{ name: "Planifier ma journée (3 priorités)", icon: "🗓️", skill: "methode", difficulty: "facile", days: WEEK, popular: true },
	{ name: "Bloc de travail profond (90 min)", icon: "🎯", skill: "concentration", difficulty: "difficile", days: WEEK, popular: true },
	{ name: "Apprendre 20 minutes", icon: "📚", skill: "savoir", difficulty: "moyen", days: ALL, popular: true },
	{ name: "Échanger avec quelqu'un de mon réseau", icon: "🤝", skill: "charisme", difficulty: "moyen", days: [2, 4], popular: true },
	{ name: "Revue de fin de journée", icon: "📝", skill: "methode", difficulty: "facile", days: WEEK, popular: true },
	{ name: "Vider ma boîte de réception", icon: "📥", skill: "methode", difficulty: "facile", days: WEEK },
	{ name: "Pause active (marche, étirements)", icon: "🚶", skill: "vitalite", difficulty: "facile", days: WEEK },
	{ name: "Veille sectorielle (15 min)", icon: "📰", skill: "savoir", difficulty: "facile", days: WEEK },
	{ name: "Demander un feedback", icon: "💬", skill: "charisme", difficulty: "difficile", days: [5] },
	{ name: "Mettre à jour mon portfolio LinkedIn", icon: "🚀", skill: "ambition", difficulty: "moyen", days: [5] },
];
