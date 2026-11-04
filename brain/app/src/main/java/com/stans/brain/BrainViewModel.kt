package com.stans.brain

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.stans.brain.ai.AiException
import com.stans.brain.ai.AiService
import com.stans.brain.ai.Answer
import com.stans.brain.ai.ChatTurn
import com.stans.brain.ai.ClaudeClient
import com.stans.brain.ai.Suggestions
import com.stans.brain.data.Note
import com.stans.brain.data.NoteRepository
import com.stans.brain.data.Vault
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File

data class ChatMessage(val fromUser: Boolean, val text: String, val sources: List<Note> = emptyList())

data class UiState(
    val vault: Vault = Vault(emptyList()),
    val query: String = "",
    val current: Note? = null,
    val chat: List<ChatMessage> = emptyList(),
    val busy: Boolean = false,
    val message: String? = null,
    val summary: String? = null,
    val suggestions: Suggestions? = null,
) {
    val visibleNotes: List<Note> get() = if (query.isBlank()) vault.notes else vault.search(query, 50)
}

class BrainViewModel(app: Application) : AndroidViewModel(app) {
    private val prefs = app.getSharedPreferences("brain", Context.MODE_PRIVATE)
    private val repo = NoteRepository(File(app.filesDir, "vault"))
    private val ai = AiService(
        ClaudeClient(
            apiKey = { prefs.getString("api_key", "").orEmpty() },
            model = { prefs.getString("model", DEFAULT_MODEL).orEmpty().ifBlank { DEFAULT_MODEL } },
        ),
    )

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init { refresh() }

    private fun refresh() = _state.update { it.copy(vault = Vault(repo.list())) }

    fun setQuery(q: String) = _state.update { it.copy(query = q) }
    fun dismissMessage() = _state.update { it.copy(message = null) }

    // ----- Notes -----
    fun open(note: Note?) = _state.update { it.copy(current = note, summary = null, suggestions = null) }

    fun openByTitle(title: String) {
        val s = _state.value
        open(s.vault.resolve(title) ?: repo.create(title, "# $title\n\n").also { refresh() })
    }

    fun newNote() { open(repo.create("Nouvelle note", "# Nouvelle note\n\n")); refresh() }

    fun save(note: Note, content: String) {
        val saved = repo.save(note.id, content)
        refresh()
        _state.update { it.copy(current = saved) }
    }

    fun delete(note: Note) { repo.delete(note.id); refresh(); open(null) }

    // ----- IA -----
    private fun runAi(block: suspend () -> Unit) {
        viewModelScope.launch {
            _state.update { it.copy(busy = true) }
            try { block() } catch (e: AiException) {
                _state.update { it.copy(message = e.message) }
            } catch (e: Exception) {
                _state.update { it.copy(message = "Erreur : ${e.message ?: e::class.simpleName}") }
            } finally { _state.update { it.copy(busy = false) } }
        }
    }

    fun ask(question: String) {
        if (question.isBlank()) return
        val history = _state.value.chat.map { ChatTurn(if (it.fromUser) "user" else "assistant", it.text) }
        _state.update { it.copy(chat = it.chat + ChatMessage(true, question)) }
        runAi {
            val a: Answer = ai.ask(question, history, _state.value.vault)
            _state.update { it.copy(chat = it.chat + ChatMessage(false, a.text, a.sources)) }
        }
    }

    fun summarize(note: Note) = runAi {
        val s = ai.summarize(note)
        _state.update { it.copy(summary = s) }
    }

    fun suggest(note: Note) = runAi {
        val s = ai.suggest(note, _state.value.vault)
        _state.update { it.copy(suggestions = s) }
    }

    /** Ajoute les tags/liens suggérés en fin de note. */
    fun applySuggestions(note: Note) {
        val s = _state.value.suggestions ?: return
        val add = buildString {
            if (s.links.isNotEmpty()) append("\nVoir aussi : " + s.links.joinToString(", ") { "[[$it]]" })
            val newTags = s.tags.filter { it !in note.tags }
            if (newTags.isNotEmpty()) append("\n" + newTags.joinToString(" ") { "#$it" })
        }
        if (add.isNotBlank()) save(note, note.content.trimEnd() + "\n" + add + "\n")
        _state.update { it.copy(suggestions = null) }
    }

    /** Texte partagé depuis une autre appli → note organisée par l'IA (ou brute si pas de clé). */
    fun capture(raw: String) {
        if (raw.isBlank()) return
        runAi {
            val c = try { ai.organize(raw, _state.value.vault) } catch (e: AiException) {
                com.stans.brain.ai.Captured(raw.lines().first().take(60), raw)
            }
            val n = repo.create(c.title, "# ${c.title}\n\n${c.body}\n")
            refresh()
            open(n)
        }
    }

    fun exportContext(topic: String): String = AiService.exportContext(topic, _state.value.vault)

    // ----- Réglages -----
    var apiKey: String
        get() = prefs.getString("api_key", "").orEmpty()
        set(v) { prefs.edit().putString("api_key", v.trim()).apply() }

    var model: String
        get() = prefs.getString("model", DEFAULT_MODEL).orEmpty()
        set(v) { prefs.edit().putString("model", v.trim()).apply() }

    companion object { const val DEFAULT_MODEL = "claude-sonnet-5-5" }
}
