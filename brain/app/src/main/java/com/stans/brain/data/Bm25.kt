package com.stans.brain.data

import kotlin.math.ln

/**
 * Classement BM25 en mémoire. Suffisant pour des milliers de notes et sans dépendance :
 * c'est le « R » de RAG, qui choisit les notes envoyées à l'IA.
 */
class Bm25(private val notes: List<Note>, private val k1: Double = 1.5, private val b: Double = 0.75) {

    private val docs: List<List<String>> = notes.map { n ->
        // Le titre et les tags pèsent plus lourd : on les répète.
        val boost = tokenize(n.title) + tokenize(n.title) + tokenize(n.tags.joinToString(" "))
        tokenize(n.content) + boost
    }
    private val avgLen = if (docs.isEmpty()) 1.0 else docs.sumOf { it.size }.toDouble().coerceAtLeast(1.0) / docs.size
    private val docFreq: Map<String, Int> = buildMap {
        for (d in docs) for (t in d.toSet()) merge(t, 1, Int::plus)
    }

    fun search(query: String, limit: Int = 5): List<Pair<Note, Double>> {
        val terms = tokenize(query).distinct()
        if (terms.isEmpty()) return emptyList()
        val n = docs.size
        return notes.indices.mapNotNull { i ->
            val d = docs[i]
            val tf = d.groupingBy { it }.eachCount()
            var score = 0.0
            for (t in terms) {
                val f = tf[t] ?: continue
                val df = docFreq[t] ?: continue
                val idf = ln(1.0 + (n - df + 0.5) / (df + 0.5))
                score += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.size / avgLen))
            }
            if (score > 0) notes[i] to score else null
        }.sortedByDescending { it.second }.take(limit)
    }

    companion object {
        private val STOP = setOf(
            "le", "la", "les", "un", "une", "des", "de", "du", "et", "en", "à", "au", "aux", "que", "qui",
            "est", "pour", "dans", "sur", "the", "a", "an", "of", "and", "to", "in", "is", "it", "ce", "se",
        )

        fun tokenize(text: String): List<String> =
            text.lowercase().split(Regex("""[^\p{L}\p{N}]+""")).filter { it.length > 1 && it !in STOP }
    }
}
