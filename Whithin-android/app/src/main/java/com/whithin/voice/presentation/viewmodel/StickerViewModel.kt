package com.whithin.voice.presentation.viewmodel

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.whithin.voice.data.model.STICKER_PACK_UPLOADER_USER_ID
import com.whithin.voice.data.model.STICKER_RECENT_PACK_ID
import com.whithin.voice.data.model.Sticker
import com.whithin.voice.data.model.StickerPack
import com.whithin.voice.data.local.StickerCacheManager
import com.whithin.voice.data.repository.StickerRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class StickerUiState(
    val packs: List<StickerPack> = emptyList(),
    val availablePacks: List<StickerPack> = emptyList(),
    val selectedPackId: String? = null,
    val recentStickerIds: List<String> = emptyList(),
    val isLoading: Boolean = false,
    val isCatalogLoading: Boolean = false,
    val isUploading: Boolean = false,
    val isDeleting: Boolean = false,
    val isInstalling: Boolean = false,
    val showCatalog: Boolean = false,
    val error: String? = null,
    val canUploadPacks: Boolean = false,
)

@HiltViewModel
class StickerViewModel @Inject constructor(
    private val stickerRepository: StickerRepository,
    private val stickerCacheManager: StickerCacheManager,
) : ViewModel() {
    private val _uiState = MutableStateFlow(StickerUiState())
    val uiState: StateFlow<StickerUiState> = _uiState.asStateFlow()

    fun setCurrentUserId(userId: String) {
        _uiState.update {
            it.copy(canUploadPacks = userId.equals(STICKER_PACK_UPLOADER_USER_ID, ignoreCase = true))
        }
    }

    fun loadPacks() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            stickerRepository.loadStickerPacks()
                .onSuccess { packs ->
                    val selected =
                        _uiState.value.selectedPackId?.takeIf { id ->
                            id == STICKER_RECENT_PACK_ID || packs.any { it.idValue == id }
                        } ?: STICKER_RECENT_PACK_ID
                    _uiState.update {
                        it.copy(
                            packs = packs,
                            selectedPackId = selected,
                            recentStickerIds = stickerRepository.getRecentStickerIds(),
                            isLoading = false,
                        )
                    }
                    preloadPanelContent()
                }
                .onFailure { e ->
                    _uiState.update {
                        it.copy(isLoading = false, error = e.message ?: "Ошибка загрузки стикеров")
                    }
                }
        }
    }

    fun openCatalog() {
        _uiState.update { it.copy(showCatalog = true, isCatalogLoading = true) }
        viewModelScope.launch {
            stickerRepository.loadAvailableStickerPacks()
                .onSuccess { packs ->
                    _uiState.update { it.copy(availablePacks = packs, isCatalogLoading = false) }
                }
                .onFailure { e ->
                    _uiState.update {
                        it.copy(
                            isCatalogLoading = false,
                            showCatalog = false,
                            error = e.message ?: "Не удалось загрузить каталог",
                        )
                    }
                }
        }
    }

    fun closeCatalog() {
        _uiState.update { it.copy(showCatalog = false, availablePacks = emptyList()) }
    }

    fun installPack(packId: String, onResult: (Result<Unit>) -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(isInstalling = true) }
            val result = stickerRepository.installStickerPack(packId)
            result.onSuccess {
                closeCatalog()
                loadPacks()
                _uiState.update { it.copy(selectedPackId = packId) }
            }
            _uiState.update { it.copy(isInstalling = false) }
            onResult(result)
        }
    }

    fun selectPack(packId: String) {
        _uiState.update { it.copy(selectedPackId = packId) }
        viewModelScope.launch {
            if (packId == STICKER_RECENT_PACK_ID) {
                stickerCacheManager.preloadStickers(recentStickers())
            } else {
                stickerCacheManager.preloadStickers(stickersForSelectedPack())
            }
        }
    }

    fun cacheManager(): StickerCacheManager = stickerCacheManager

    fun onPanelClosed() = Unit

    private fun preloadSelectedPack() {
        val stickers = stickersForSelectedPack()
        if (stickers.isEmpty()) return
        viewModelScope.launch {
            stickerCacheManager.preloadStickers(stickers)
        }
    }

    fun preloadPanelContent() {
        viewModelScope.launch {
            val stickers =
                when (_uiState.value.selectedPackId) {
                    STICKER_RECENT_PACK_ID -> recentStickers()
                    else -> stickersForSelectedPack()
                }
            if (stickers.isNotEmpty()) {
                stickerCacheManager.preloadStickers(stickers)
            }
        }
    }

    fun clearRecent() {
        stickerRepository.clearRecentStickers()
        _uiState.update { it.copy(recentStickerIds = emptyList()) }
    }

    fun uploadPack(title: String, archiveUri: Uri, onResult: (Result<StickerPack>) -> Unit) {
        if (!_uiState.value.canUploadPacks) {
            onResult(Result.failure(Exception("Нет прав на загрузку стикерпаков")))
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isUploading = true, error = null) }
            val result = stickerRepository.uploadStickerPack(title, archiveUri)
            result.onSuccess { pack ->
                loadPacks()
                _uiState.update { it.copy(selectedPackId = pack.idValue) }
            }
            _uiState.update { it.copy(isUploading = false) }
            onResult(result)
        }
    }

    fun stickersForSelectedPack(): List<Sticker> {
        val packId = _uiState.value.selectedPackId ?: return emptyList()
        if (packId == STICKER_RECENT_PACK_ID) return emptyList()
        return _uiState.value.packs.firstOrNull { it.idValue == packId }?.stickersValue.orEmpty()
    }

    fun recentStickers(): List<Sticker> {
        val byId =
            _uiState.value.packs
                .flatMap { it.stickersValue }
                .associateBy { it.idValue }
        return _uiState.value.recentStickerIds.mapNotNull { byId[it] }
    }

    fun deleteSelectedPack(onResult: (Result<Unit>) -> Unit) {
        if (!_uiState.value.canUploadPacks) {
            onResult(Result.failure(Exception("Нет прав на удаление стикерпаков")))
            return
        }
        val packId = _uiState.value.selectedPackId
        if (packId.isNullOrBlank() || packId == STICKER_RECENT_PACK_ID) {
            onResult(Result.failure(Exception("Выберите стикерпак для удаления")))
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isDeleting = true, error = null) }
            val result = stickerRepository.deleteStickerPack(packId)
            result.onSuccess {
                _uiState.update { it.copy(selectedPackId = STICKER_RECENT_PACK_ID) }
                loadPacks()
            }
            _uiState.update { it.copy(isDeleting = false) }
            onResult(result)
        }
    }
}
