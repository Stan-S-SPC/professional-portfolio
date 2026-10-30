// Remplace le paquet `obsidian` (types seuls, sans code) par une fausse API pour les tests Node.
import { register } from "node:module";
register("./obsidian-loader.mjs", import.meta.url);
