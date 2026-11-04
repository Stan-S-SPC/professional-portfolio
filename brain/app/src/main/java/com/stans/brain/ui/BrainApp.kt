package com.stans.brain.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.stans.brain.BrainViewModel
import com.stans.brain.ChatMessage
import com.stans.brain.UiState
import com.stans.brain.data.Note

private enum class Screen { Notes, Chat, Settings }

@Composable
fun BrainApp(vm: BrainViewModel) {
    val s by vm.state.collectAsStateWithLifecycle()
    var screen by remember { mutableStateOf(Screen.Notes) }
    val snack = remember { SnackbarHostState() }
    LaunchedEffect(s.message) { s.message?.let { snack.showSnackbar(it); vm.dismissMessage() } }

    MaterialTheme {
        Scaffold(
            snackbarHost = { SnackbarHost(snack) },
            bottomBar = {
                if (s.current == null) NavigationBar {
                    NavigationBarItem(screen == Screen.Notes, { screen = Screen.Notes }, { Icon(Icons.Default.Description, null) }, label = { Text("Notes") })
                    NavigationBarItem(screen == Screen.Chat, { screen = Screen.Chat }, { Icon(Icons.Default.AutoAwesome, null) }, label = { Text("Demander") })
                    NavigationBarItem(screen == Screen.Settings, { screen = Screen.Settings }, { Icon(Icons.Default.Settings, null) }, label = { Text("Réglages") })
                }
            },
        ) { pad ->
            Box(Modifier.padding(pad).fillMaxSize()) {
                when {
                    s.current != null -> EditorScreen(s, vm)
                    screen == Screen.Notes -> NotesScreen(s, vm)
                    screen == Screen.Chat -> ChatScreen(s, vm) { vm.open(it) }
                    else -> SettingsScreen(vm)
                }
                if (s.busy) LinearProgressIndicator(Modifier.fillMaxWidth().align(Alignment.TopCenter))
            }
        }
    }
}

@Composable
private fun NotesScreen(s: UiState, vm: BrainViewModel) {
    Box(Modifier.fillMaxSize()) {
        Column(Modifier.padding(horizontal = 16.dp)) {
            OutlinedTextField(
                s.query, vm::setQuery, Modifier.fillMaxWidth().padding(top = 12.dp),
                placeholder = { Text("Rechercher dans ${s.vault.notes.size} notes") },
                leadingIcon = { Icon(Icons.Default.Search, null) }, singleLine = true,
            )
            LazyColumn(Modifier.weight(1f)) {
                items(s.visibleNotes, key = { it.id }) { n ->
                    ListItem(
                        headlineContent = { Text(n.title) },
                        supportingContent = { Text(n.content.lineSequence().firstOrNull { it.isNotBlank() && !it.startsWith("#") }.orEmpty(), maxLines = 1) },
                        modifier = Modifier.clickable { vm.open(n) },
                    )
                    HorizontalDivider()
                }
            }
        }
        FloatingActionButton({ vm.newNote() }, Modifier.align(Alignment.BottomEnd).padding(16.dp)) {
            Icon(Icons.Default.Add, "Nouvelle note")
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun EditorScreen(s: UiState, vm: BrainViewModel) {
    val note = s.current ?: return
    var text by remember(note.id) { mutableStateOf(note.content) }
    val live = note.copy(content = text)
    val clipboard = LocalClipboardManager.current
    // Sauvegarde différée à chaque pause de frappe, et à la sortie.
    LaunchedEffect(text) { if (text != note.content) { kotlinx.coroutines.delay(600); vm.save(note, text) } }

    Column(Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text(note.title, maxLines = 1) },
            navigationIcon = { IconButton({ if (text != note.content) vm.save(note, text); vm.open(null) }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Retour") } },
            actions = {
                IconButton({ vm.summarize(live) }, enabled = !s.busy) { Icon(Icons.Default.Summarize, "Résumer") }
                IconButton({ vm.suggest(live) }, enabled = !s.busy) { Icon(Icons.Default.AutoAwesome, "Suggérer tags et liens") }
                IconButton({ clipboard.setText(AnnotatedString(vm.exportContext(note.title + " " + note.content.take(300)))) }) { Icon(Icons.Default.ContentCopy, "Copier le contexte pour une IA") }
                IconButton({ vm.delete(note) }) { Icon(Icons.Default.Delete, "Supprimer") }
            },
        )
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
            s.summary?.let { Card(Modifier.fillMaxWidth().padding(vertical = 8.dp)) { Text(it, Modifier.padding(12.dp)) } }
            s.suggestions?.let { sg ->
                Card(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                    Column(Modifier.padding(12.dp)) {
                        Text("Suggestions", style = MaterialTheme.typography.titleSmall)
                        Text("Tags : " + sg.tags.joinToString(" ") { "#$it" }.ifEmpty { "—" })
                        Text("Liens : " + sg.links.joinToString { "[[$it]]" }.ifEmpty { "—" })
                        Button({ vm.applySuggestions(live) }, Modifier.padding(top = 8.dp)) { Text("Appliquer") }
                    }
                }
            }
            OutlinedTextField(text, { text = it }, Modifier.fillMaxWidth().heightIn(min = 280.dp))

            val outgoing = note.links
            if (outgoing.isNotEmpty()) {
                Text("Liens sortants", Modifier.padding(top = 16.dp), style = MaterialTheme.typography.titleSmall)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    outgoing.forEach { l ->
                        val exists = s.vault.resolve(l) != null
                        AssistChip({ vm.openByTitle(l) }, { Text(if (exists) l else "$l (à créer)") })
                    }
                }
            }
            val back = s.vault.backlinks(note)
            if (back.isNotEmpty()) {
                Text("Rétroliens", Modifier.padding(top = 16.dp), style = MaterialTheme.typography.titleSmall)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    back.forEach { b -> AssistChip({ vm.open(b) }, { Text(b.title) }) }
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun ChatScreen(s: UiState, vm: BrainViewModel, openNote: (Note) -> Unit) {
    var input by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        LazyColumn(Modifier.weight(1f), reverseLayout = false) {
            if (s.chat.isEmpty()) item {
                Text("Posez une question : Brain répond à partir de vos notes et cite ses sources.", Modifier.padding(vertical = 24.dp))
            }
            items(s.chat) { m -> Bubble(m, openNote) }
        }
        Row(Modifier.padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(input, { input = it }, Modifier.weight(1f), placeholder = { Text("Votre question…") }, maxLines = 4)
            IconButton({ vm.ask(input); input = "" }, enabled = !s.busy && input.isNotBlank()) { Icon(Icons.AutoMirrored.Filled.Send, "Envoyer") }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Bubble(m: ChatMessage, openNote: (Note) -> Unit) {
    Card(
        Modifier.fillMaxWidth().padding(vertical = 4.dp),
        colors = CardDefaults.cardColors(if (m.fromUser) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Column(Modifier.padding(12.dp)) {
            Text(m.text)
            if (m.sources.isNotEmpty()) {
                FlowRow(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    m.sources.forEach { n -> AssistChip({ openNote(n) }, { Text(n.title) }) }
                }
            }
        }
    }
}

@Composable
private fun SettingsScreen(vm: BrainViewModel) {
    var key by remember { mutableStateOf(vm.apiKey) }
    var model by remember { mutableStateOf(vm.model) }
    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("IA (Anthropic)", style = MaterialTheme.typography.titleMedium)
        OutlinedTextField(key, { key = it; vm.apiKey = it }, Modifier.fillMaxWidth(), label = { Text("Clé API") }, singleLine = true)
        OutlinedTextField(model, { model = it; vm.model = it }, Modifier.fillMaxWidth(), label = { Text("Modèle") }, singleLine = true)
        Text(
            "Votre clé reste sur l'appareil. Seules les notes pertinentes pour une question sont envoyées à l'API. " +
                "Vos notes sont des fichiers .md dans le stockage privé de l'appli.",
            style = MaterialTheme.typography.bodySmall,
        )
    }
}
