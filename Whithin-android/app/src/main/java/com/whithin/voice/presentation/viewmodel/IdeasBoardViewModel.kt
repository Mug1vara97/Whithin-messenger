package com.whithin.voice.presentation.viewmodel

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.whithin.voice.data.model.IdeaBoardCard
import com.whithin.voice.data.repository.IdeaBoardRepository
import com.whithin.voice.data.signalr.ServerHub
import com.whithin.voice.domain.permissions.ServerPermissions
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class IdeaBoardSort {
    NEWEST,
    OLDEST,
    TAG,
}

data class IdeaBoardUiState(
    val channelName: String = "",
    val cards: List<IdeaBoardCard> = emptyList(),
    val isLoading: Boolean = true,
    val isSaving: Boolean = false,
    val error: String? = null,
    val sort: IdeaBoardSort = IdeaBoardSort.NEWEST,
    val unfiledOnly: Boolean = false,
    val currentPage: Int = 1,
    val canCreate: Boolean = false,
    val canModerate: Boolean = false,
    val selectedCard: IdeaBoardCard? = null,
    val showCompose: Boolean = false,
    val editingCard: IdeaBoardCard? = null,
    val composeTitle: String = "",
    val composeBody: String = "",
    val composeTag: String = "",
    val composeSourceUrl: String = "",
)

@HiltViewModel
class IdeasBoardViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val ideaBoardRepository: IdeaBoardRepository,
) : ViewModel() {
    private val serverId: String = savedStateHandle.get<String>("serverId").orEmpty().trim()
    private val chatId: String = savedStateHandle.get<String>("chatId").orEmpty().trim()
    private val channelName: String =
        savedStateHandle.get<String>("chatName").orEmpty().trim().ifBlank { "Идеи" }
    private var currentUserId: String = ""

    private val _uiState = MutableStateFlow(IdeaBoardUiState(channelName = channelName))
    val uiState: StateFlow<IdeaBoardUiState> = _uiState.asStateFlow()

    private val boardListener =
        object : ServerHub.IdeaBoardListener {
            override fun onCardsLoaded(cards: List<IdeaBoardCard>) {
                _uiState.update { it.copy(cards = cards, isLoading = false) }
            }

            override fun onCardCreated(card: IdeaBoardCard) {
                if (card.chatIdValue.isNotBlank() && card.chatIdValue != chatId) return
                _uiState.update { state ->
                    if (state.cards.any { it.cardIdValue == card.cardIdValue }) state
                    else state.copy(cards = listOf(card) + state.cards)
                }
            }

            override fun onCardUpdated(card: IdeaBoardCard) {
                if (card.chatIdValue.isNotBlank() && card.chatIdValue != chatId) return
                _uiState.update { state ->
                    state.copy(
                        cards = state.cards.map { if (it.cardIdValue == card.cardIdValue) card else it },
                        selectedCard = state.selectedCard?.takeIf { it.cardIdValue == card.cardIdValue }?.let { card }
                            ?: state.selectedCard,
                    )
                }
            }

            override fun onCardDeleted(card: IdeaBoardCard) {
                val cardId = card.cardIdValue
                if (cardId.isBlank()) return
                _uiState.update { state ->
                    state.copy(
                        cards = state.cards.filterNot { it.cardIdValue == cardId },
                        selectedCard = state.selectedCard?.takeIf { it.cardIdValue != cardId },
                    )
                }
            }
        }

    init {
        ideaBoardRepository.setIdeaBoardListener(boardListener)
    }

    fun initialize(userId: String) {
        val trimmedUserId = userId.trim()
        if (trimmedUserId.isBlank() || serverId.isBlank() || chatId.isBlank()) return
        if (currentUserId == trimmedUserId && _uiState.value.cards.isNotEmpty()) return
        currentUserId = trimmedUserId
        load()
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            ideaBoardRepository.connectHub(currentUserId, serverId)
                .onFailure { error ->
                    _uiState.update {
                        it.copy(isLoading = false, error = error.message ?: "Не удалось подключиться")
                    }
                    return@launch
                }
            ideaBoardRepository.getServerPermissions(serverId)
                .onSuccess { server ->
                    val isOwner =
                        server.ownerIdValue.isNotBlank() &&
                            server.ownerIdValue.equals(currentUserId, ignoreCase = true)
                    val permissions = server.permissionsValue
                    _uiState.update {
                        it.copy(
                            canCreate = ServerPermissions.canSendMessages(permissions, isOwner),
                            canModerate = ServerPermissions.canManageMessages(permissions, isOwner),
                        )
                    }
                }
            ideaBoardRepository.fetchCards(chatId)
                .onSuccess { cards ->
                    _uiState.update { it.copy(cards = cards, isLoading = false) }
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(isLoading = false, error = error.message ?: "Не удалось загрузить идеи")
                    }
                }
        }
    }

    fun setSort(sort: IdeaBoardSort) {
        _uiState.update { it.copy(sort = sort, currentPage = 1) }
    }

    fun toggleUnfiledOnly() {
        _uiState.update { it.copy(unfiledOnly = !it.unfiledOnly, currentPage = 1) }
    }

    fun setPage(page: Int) {
        _uiState.update { it.copy(currentPage = page.coerceAtLeast(1)) }
    }

    fun selectCard(card: IdeaBoardCard?) {
        _uiState.update { it.copy(selectedCard = card) }
    }

    fun openCreateForm() {
        _uiState.update {
            it.copy(
                showCompose = true,
                editingCard = null,
                composeTitle = "",
                composeBody = "",
                composeTag = "",
                composeSourceUrl = "",
                selectedCard = null,
            )
        }
    }

    fun openEditForm(card: IdeaBoardCard) {
        _uiState.update {
            it.copy(
                showCompose = true,
                editingCard = card,
                composeTitle = card.titleValue,
                composeBody = card.bodyValue,
                composeTag = card.tagValue.orEmpty(),
                composeSourceUrl = card.sourceUrlValue.orEmpty(),
                selectedCard = null,
            )
        }
    }

    fun closeCompose() {
        _uiState.update {
            it.copy(
                showCompose = false,
                editingCard = null,
                composeTitle = "",
                composeBody = "",
                composeTag = "",
                composeSourceUrl = "",
            )
        }
    }

    fun onComposeTitleChange(value: String) = _uiState.update { it.copy(composeTitle = value) }
    fun onComposeBodyChange(value: String) = _uiState.update { it.copy(composeBody = value) }
    fun onComposeTagChange(value: String) = _uiState.update { it.copy(composeTag = value) }
    fun onComposeSourceUrlChange(value: String) = _uiState.update { it.copy(composeSourceUrl = value) }

    fun saveCompose() {
        val title = _uiState.value.composeTitle.trim()
        if (title.isBlank()) {
            _uiState.update { it.copy(error = "Введите заголовок") }
            return
        }
        val tag = normalizeTag(_uiState.value.composeTag)
        val body = _uiState.value.composeBody.trim()
        val sourceUrl = _uiState.value.composeSourceUrl.trim().ifBlank { null }
        val editing = _uiState.value.editingCard
        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true, error = null) }
            val result =
                if (editing == null) {
                    ideaBoardRepository.createCard(chatId, title, body, tag, sourceUrl)
                } else {
                    ideaBoardRepository.updateCard(
                        editing.cardIdValue,
                        title,
                        body,
                        tag,
                        sourceUrl,
                        editing.isFiledValue,
                    )
                }
            result
                .onSuccess {
                    _uiState.update { it.copy(isSaving = false) }
                    closeCompose()
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(isSaving = false, error = error.message ?: "Не удалось сохранить")
                    }
                }
        }
    }

    fun toggleFiled(card: IdeaBoardCard) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true, error = null) }
            ideaBoardRepository.updateCard(
                cardId = card.cardIdValue,
                title = card.titleValue,
                body = card.bodyValue,
                tag = card.tagValue,
                sourceUrl = card.sourceUrlValue,
                isFiled = !card.isFiledValue,
            ).onSuccess {
                _uiState.update { it.copy(isSaving = false) }
            }.onFailure { error ->
                _uiState.update {
                    it.copy(isSaving = false, error = error.message ?: "Не удалось обновить")
                }
            }
        }
    }

    fun deleteCard(card: IdeaBoardCard) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true, error = null) }
            ideaBoardRepository.deleteCard(card.cardIdValue)
                .onSuccess {
                    _uiState.update { it.copy(isSaving = false, selectedCard = null) }
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(isSaving = false, error = error.message ?: "Не удалось удалить")
                    }
                }
        }
    }

    fun canManageCard(card: IdeaBoardCard): Boolean {
        val state = _uiState.value
        return state.canModerate ||
            card.authorUserIdValue.equals(currentUserId, ignoreCase = true)
    }

    fun consumeError() {
        _uiState.update { it.copy(error = null) }
    }

    override fun onCleared() {
        ideaBoardRepository.setIdeaBoardListener(null)
        super.onCleared()
    }

    private fun normalizeTag(raw: String): String? {
        val normalized = raw.trim().lowercase().removePrefix("#")
        return normalized.takeIf { it.isNotEmpty() }
    }
}

fun IdeasBoardViewModel.visibleCards(state: IdeaBoardUiState): List<IdeaBoardCard> {
    var list = state.cards.toList()
    list =
        when (state.sort) {
            IdeaBoardSort.NEWEST ->
                list.sortedByDescending { it.createdAtValue.orEmpty() }
            IdeaBoardSort.OLDEST ->
                list.sortedBy { it.createdAtValue.orEmpty() }
            IdeaBoardSort.TAG ->
                list.sortedBy { it.tagValue.orEmpty() }
        }
    if (state.unfiledOnly) {
        list = list.filterNot { it.isFiledValue }
    }
    return list
}
