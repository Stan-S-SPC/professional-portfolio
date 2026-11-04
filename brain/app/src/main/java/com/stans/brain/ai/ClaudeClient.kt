package com.stans.brain.ai

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class AiException(message: String) : Exception(message)

data class ChatTurn(val role: String, val text: String) // role = "user" | "assistant"

/** Client minimal de l'API Messages d'Anthropic, sans dépendance externe. */
class ClaudeClient(
    private val apiKey: () -> String,
    private val model: () -> String,
    private val endpoint: String = "https://api.anthropic.com/v1/messages",
) {
    suspend fun complete(system: String, turns: List<ChatTurn>, maxTokens: Int = 1024): String =
        withContext(Dispatchers.IO) {
            val key = apiKey().trim()
            if (key.isEmpty()) throw AiException("Ajoutez votre clé API Anthropic dans les réglages.")

            val body = JSONObject()
                .put("model", model())
                .put("max_tokens", maxTokens)
                .put("system", system)
                .put("messages", JSONArray().also { arr ->
                    turns.forEach { arr.put(JSONObject().put("role", it.role).put("content", it.text)) }
                })

            val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 15_000
                readTimeout = 90_000
                doOutput = true
                setRequestProperty("content-type", "application/json")
                setRequestProperty("x-api-key", key)
                setRequestProperty("anthropic-version", "2023-06-01")
            }
            try {
                conn.outputStream.use { it.write(body.toString().toByteArray()) }
                val ok = conn.responseCode in 200..299
                val text = (if (ok) conn.inputStream else conn.errorStream)?.bufferedReader()?.readText().orEmpty()
                if (!ok) throw AiException(parseError(text, conn.responseCode))
                parseText(text)
            } finally {
                conn.disconnect()
            }
        }

    companion object {
        /** Concatène les blocs `text` de la réponse. */
        fun parseText(json: String): String {
            val content = JSONObject(json).optJSONArray("content") ?: return ""
            return buildString {
                for (i in 0 until content.length()) {
                    val block = content.getJSONObject(i)
                    if (block.optString("type") == "text") append(block.optString("text"))
                }
            }.trim()
        }

        fun parseError(json: String, code: Int): String {
            val msg = runCatching { JSONObject(json).getJSONObject("error").getString("message") }.getOrNull()
            return when (code) {
                401 -> "Clé API invalide (401)."
                429 -> "Trop de requêtes ou quota atteint (429). Réessayez plus tard."
                else -> "Erreur API $code${msg?.let { " : $it" }.orEmpty()}"
            }
        }
    }
}
