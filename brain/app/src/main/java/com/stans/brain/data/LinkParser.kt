package com.stans.brain.data

/** Extraction des `[[liens]]` et des `#tags`, compatible avec la syntaxe Obsidian. */
object LinkParser {
    // [[Cible]], [[Cible|alias]], [[Cible#section]]
    private val WIKI = Regex("""\[\[([^\[\]|#]+)(?:[#|][^\]]*)?]]""")

    // #tag, #projet/sous-tag ; ignore "# Titre" et "## Titre" (espace après le #)
    private val TAG = Regex("""(?<![\p{L}\p{N}_/#])#([\p{L}][\p{L}\p{N}_/-]*)""")

    fun links(text: String): List<String> =
        WIKI.findAll(text).map { it.groupValues[1].trim() }.filter { it.isNotEmpty() }.distinct().toList()

    fun tags(text: String): List<String> =
        TAG.findAll(text).map { it.groupValues[1] }.distinct().toList()

    /** Nom de fichier sûr à partir d'un titre libre. */
    fun safeTitle(raw: String): String =
        raw.trim().replace(Regex("""[\\/:*?"<>|\n\r]+"""), "-").trim('-', ' ', '.').take(80)
            .ifEmpty { "Sans titre" }
}
