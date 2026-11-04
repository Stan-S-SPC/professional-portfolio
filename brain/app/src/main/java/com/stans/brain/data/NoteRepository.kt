package com.stans.brain.data

import java.io.File

/** Stockage : un dossier de fichiers .md, directement utilisable comme coffre Obsidian. */
class NoteRepository(private val dir: File) {

    init { dir.mkdirs() }

    fun list(): List<Note> =
        dir.listFiles { f -> f.isFile && f.extension == "md" }.orEmpty()
            .map { Note(it.nameWithoutExtension, it.readText(), it.lastModified()) }
            .sortedByDescending { it.updatedAt }

    fun save(id: String, content: String): Note {
        val f = File(dir, "$id.md")
        f.writeText(content)
        return Note(id, content, f.lastModified())
    }

    /** Crée une note ; ajoute un suffixe si le titre existe déjà. */
    fun create(rawTitle: String, content: String = ""): Note {
        val base = LinkParser.safeTitle(rawTitle)
        var id = base
        var i = 2
        while (File(dir, "$id.md").exists()) id = "$base ($i)".also { i++ }
        return save(id, content)
    }

    fun delete(id: String) { File(dir, "$id.md").delete() }
}
