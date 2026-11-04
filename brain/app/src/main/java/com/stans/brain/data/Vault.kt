package com.stans.brain.data

/** Vue calculée sur l'ensemble des notes : liens entrants, notes orphelines, recherche. */
class Vault(val notes: List<Note>) {
    private val byTitle = notes.associateBy { it.title.lowercase() }
    private val bm25 by lazy { Bm25(notes) }

    fun resolve(link: String): Note? = byTitle[link.lowercase()]

    /** Notes qui pointent vers [note] via `[[...]]`. */
    fun backlinks(note: Note): List<Note> =
        notes.filter { it.id != note.id && it.links.any { l -> l.equals(note.title, ignoreCase = true) } }

    /** Liens sortants dont la cible n'existe pas encore (notes à créer). */
    fun unresolvedLinks(note: Note): List<String> = note.links.filter { resolve(it) == null }

    fun search(query: String, limit: Int = 20): List<Note> = bm25.search(query, limit).map { it.first }

    /** Notes proches d'un texte : base du RAG et des suggestions de liens. */
    fun related(note: Note, limit: Int = 5): List<Note> =
        bm25.search(note.title + " " + note.content.take(600), limit + 1).map { it.first }
            .filter { it.id != note.id }.take(limit)

    fun allTags(): Map<String, Int> =
        notes.flatMap { it.tags }.groupingBy { it }.eachCount().toList().sortedByDescending { it.second }.toMap()
}
