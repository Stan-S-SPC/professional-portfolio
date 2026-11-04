package com.stans.brain.ai

import com.stans.brain.data.Note
import com.stans.brain.data.Vault
import org.json.JSONObject

data class Answer(val text: String, val sources: List<Note>)
data class Suggestions(val tags: List<String>, val links: List<String>)
data class Captured(val title: String, val body: String)

/**
 * Les fonctions « boostées par l'IA » de Brain.
 * Principe : l'IA ne voit que les notes pertinentes (RAG), et cite toujours ses sources en [[liens]].
 */
class AiService(private val client: ClaudeClient) {

    /** Chat avec le coffre : récupère les notes proches, puis répond en les citant. */
    suspend fun ask(question: String, history: List<ChatTurn>, vault: Vault, topK: Int = 6): Answer {
        val sources = vault.search(question, topK)
        val answer = client.complete(
            system = ASK_SYSTEM + "\n\n" + contextBlock(sources),
            turns = history.takeLast(8) + ChatTurn("user", question),
            maxTokens = 1500,
        )
        return Answer(answer, sources.filter { answer.contains("[[${it.title}]]", ignoreCase = true) }.ifEmpty { sources.take(3) })
    }

    suspend fun summarize(note: Note): String = client.complete(
        system = "Tu résumes des notes personnelles. Réponds dans la langue de la note, en 3 à 6 puces concises, " +
            "puis une ligne « À retenir : ... ». N'invente rien.",
        turns = listOf(ChatTurn("user", "# ${note.title}\n\n${note.content}")),
        maxTokens = 600,
    )

    /** Propose des tags et des liens vers des notes EXISTANTES uniquement. */
    suspend fun suggest(note: Note, vault: Vault): Suggestions {
        val candidates = vault.related(note, 12).map { it.title }
        val knownTags = vault.allTags().keys.take(40)
        val raw = client.complete(
            system = "Tu aides à organiser un coffre de notes. Réponds UNIQUEMENT avec du JSON : " +
                """{"tags":["..."],"links":["..."]}. """ +
                "tags : 2 à 5, en minuscules sans '#', réutilise de préférence les tags existants. " +
                "links : uniquement des titres choisis dans la liste candidate, jamais d'autres.",
            turns = listOf(
                ChatTurn(
                    "user",
                    "Tags existants : ${knownTags.joinToString()}\n" +
                        "Notes candidates : ${candidates.joinToString(" | ")}\n\n" +
                        "# ${note.title}\n${note.content.take(4000)}",
                ),
            ),
            maxTokens = 300,
        )
        return parseSuggestions(raw, candidates.toSet())
    }

    /** Capture intelligente : transforme un texte brut (partage, dictée) en note propre. */
    suspend fun organize(raw: String, vault: Vault): Captured {
        val existing = vault.notes.take(60).joinToString(" | ") { it.title }
        val out = client.complete(
            system = "Tu transformes un texte brut en note Markdown claire. Format de sortie : " +
                "la 1re ligne est UNIQUEMENT le titre (sans #), puis une ligne vide, puis le corps en Markdown. " +
                "Corrige la forme, garde le sens, ne rajoute aucun fait. " +
                "Quand c'est pertinent, ajoute des [[liens]] vers ces notes existantes : $existing. " +
                "Termine par une ligne de tags (#tag).",
            turns = listOf(ChatTurn("user", raw.take(8000))),
            maxTokens = 1500,
        )
        return parseCaptured(out, raw)
    }

    companion object {
        private const val ASK_SYSTEM =
            "Tu es Brain, l'assistant du second cerveau de l'utilisateur. Réponds dans sa langue, de façon concise. " +
                "Appuie-toi UNIQUEMENT sur les notes fournies ci-dessous. Cite chaque note utilisée sous la forme [[Titre]]. " +
                "Si les notes ne contiennent pas la réponse, dis-le clairement au lieu d'inventer."

        fun contextBlock(notes: List<Note>): String =
            if (notes.isEmpty()) "(Aucune note pertinente trouvée.)"
            else notes.joinToString("\n\n") { "<note titre=\"${it.title}\">\n${it.content.take(3000)}\n</note>" }

        /** Dossier de contexte prêt à coller dans n'importe quelle IA (sans appel réseau). */
        fun exportContext(topic: String, vault: Vault, limit: Int = 8): String {
            val found = vault.search(topic, limit)
            return buildString {
                appendLine("# Contexte : $topic")
                appendLine("Extrait de mes notes personnelles (${found.size}). Utilise-les comme source de vérité.")
                found.forEach { appendLine("\n## [[${it.title}]]\n${it.content.trim()}") }
            }
        }

        fun parseSuggestions(raw: String, allowedLinks: Set<String>): Suggestions {
            val json = extractJson(raw) ?: return Suggestions(emptyList(), emptyList())
            val allowed = allowedLinks.associateBy { it.lowercase() }
            fun strings(key: String) = json.optJSONArray(key)?.let { a -> (0 until a.length()).map { a.optString(it) } }.orEmpty()
            return Suggestions(
                tags = strings("tags").map { it.trim().trimStart('#').lowercase() }.filter { it.isNotEmpty() }.distinct(),
                links = strings("links").mapNotNull { allowed[it.trim().lowercase()] }.distinct(),
            )
        }

        fun parseCaptured(out: String, fallbackRaw: String): Captured {
            val lines = out.trim().lines()
            val title = lines.firstOrNull()?.trim()?.trimStart('#', ' ').orEmpty()
            val body = lines.drop(1).joinToString("\n").trim()
            return if (title.isEmpty() || body.isEmpty()) Captured(fallbackRaw.lines().first().take(60), fallbackRaw)
            else Captured(title, body)
        }

        private fun extractJson(s: String): JSONObject? {
            val a = s.indexOf('{'); val b = s.lastIndexOf('}')
            return if (a in 0 until b) runCatching { JSONObject(s.substring(a, b + 1)) }.getOrNull() else null
        }
    }
}
