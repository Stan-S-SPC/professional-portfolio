package com.stans.brain.data

/** Une note = un fichier `<titre>.md`. L'id est le nom du fichier sans extension. */
data class Note(
    val id: String,
    val content: String,
    val updatedAt: Long = 0L,
) {
    val title: String get() = id
    val links: List<String> get() = LinkParser.links(content)
    val tags: List<String> get() = LinkParser.tags(content)
}
