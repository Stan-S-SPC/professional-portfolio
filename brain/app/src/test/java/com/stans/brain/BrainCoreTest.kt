package com.stans.brain

import com.stans.brain.ai.AiService
import com.stans.brain.ai.ClaudeClient
import com.stans.brain.data.LinkParser
import com.stans.brain.data.Note
import com.stans.brain.data.Vault
import org.junit.Assert.*
import org.junit.Test

class BrainCoreTest {
    private val notes = listOf(
        Note("Kotlin", "# Kotlin\nLangage pour Android, voir [[Compose]] #dev/android"),
        Note("Compose", "# Compose\nUI déclarative. Utilise [[Kotlin]] et les coroutines. #dev/android"),
        Note("Recette crêpes", "Farine, oeufs, lait. #cuisine"),
    )
    private val vault = Vault(notes)

    @Test fun parsesWikiLinksWithAliasAndSection() {
        assertEquals(listOf("A", "B", "C"), LinkParser.links("[[A]] [[B|alias]] [[C#sec]] [[A]]"))
    }

    @Test fun parsesTagsButNotHeadings() {
        assertEquals(listOf("idee", "dev/android"), LinkParser.tags("# Titre\n## Sous\ntexte #idee et #dev/android"))
    }

    @Test fun safeTitleRemovesIllegalChars() {
        assertEquals("a-b", LinkParser.safeTitle(" a/b "))
        assertEquals("Sans titre", LinkParser.safeTitle("///"))
    }

    @Test fun backlinksAndUnresolved() {
        assertEquals(listOf("Compose"), vault.backlinks(notes[0]).map { it.id })
        assertTrue(vault.unresolvedLinks(Note("X", "[[Inconnue]] [[Kotlin]]")).contains("Inconnue"))
    }

    @Test fun searchRanksRelevantNoteFirst() {
        assertEquals("Recette crêpes", vault.search("farine lait").first().id)
        assertEquals("Compose", vault.search("coroutines").first().id)
        assertTrue(vault.search("zzzz").isEmpty())
    }

    @Test fun exportContextContainsMatchingNotes() {
        val ctx = AiService.exportContext("Android Kotlin", vault)
        assertTrue(ctx.contains("[[Kotlin]]"))
        assertFalse(ctx.contains("crêpes"))
    }

    @Test fun suggestionsOnlyKeepExistingLinks() {
        val s = AiService.parseSuggestions(
            "Voici : {\"tags\":[\"#Dev\",\"dev\"],\"links\":[\"compose\",\"Inventée\"]}", setOf("Compose", "Kotlin"),
        )
        assertEquals(listOf("dev"), s.tags)
        assertEquals(listOf("Compose"), s.links)
    }

    @Test fun capturedFallsBackOnBadOutput() {
        val c = AiService.parseCaptured("", "idée rapide\nsuite")
        assertEquals("idée rapide", c.title)
        val ok = AiService.parseCaptured("Mon titre\n\nCorps", "x")
        assertEquals("Mon titre", ok.title); assertEquals("Corps", ok.body)
    }

    @Test fun parsesApiResponseAndErrors() {
        val json = """{"content":[{"type":"text","text":"Bonjour "},{"type":"text","text":"monde"}]}"""
        assertEquals("Bonjour monde", ClaudeClient.parseText(json))
        assertTrue(ClaudeClient.parseError("{}", 401).contains("401"))
        assertTrue(ClaudeClient.parseError("""{"error":{"message":"boom"}}""", 500).contains("boom"))
    }
}
