package com.whithin.voice.data.model

import com.google.gson.annotations.SerializedName

const val STICKER_PACK_UPLOADER_USER_ID = "019bae86-9f75-7704-bb3c-37f53da0aa1b"
const val STICKER_RECENT_PACK_ID = "__recent__"

data class StickerPack(
    @SerializedName("id") val id: String? = null,
    @SerializedName("Id") val idAlt: String? = null,
    @SerializedName("title") val title: String? = null,
    @SerializedName("Title") val titleAlt: String? = null,
    @SerializedName("coverImagePath") val coverImagePath: String? = null,
    @SerializedName("CoverImagePath") val coverImagePathAlt: String? = null,
    @SerializedName("stickers") val stickers: List<Sticker>? = null,
    @SerializedName("Stickers") val stickersAlt: List<Sticker>? = null,
) {
    val idValue: String get() = id ?: idAlt ?: ""
    val titleValue: String get() = title ?: titleAlt ?: "Стикеры"
    val coverImagePathValue: String? get() = coverImagePath ?: coverImagePathAlt
    val stickersValue: List<Sticker> get() = stickers ?: stickersAlt ?: emptyList()
}

data class Sticker(
    @SerializedName("id") val id: String? = null,
    @SerializedName("Id") val idAlt: String? = null,
    @SerializedName("stickerPackId") val stickerPackId: String? = null,
    @SerializedName("StickerPackId") val stickerPackIdAlt: String? = null,
    @SerializedName("filePath") val filePath: String? = null,
    @SerializedName("FilePath") val filePathAlt: String? = null,
    @SerializedName("contentType") val contentType: String? = null,
    @SerializedName("ContentType") val contentTypeAlt: String? = null,
    @SerializedName("sortOrder") val sortOrder: Int? = null,
    @SerializedName("SortOrder") val sortOrderAlt: Int? = null,
) {
    val idValue: String get() = id ?: idAlt ?: ""
    val stickerPackIdValue: String get() = stickerPackId ?: stickerPackIdAlt ?: ""
    val filePathValue: String get() = filePath ?: filePathAlt ?: ""
    val contentTypeValue: String get() = contentType ?: contentTypeAlt ?: "image/webp"
    val sortOrderValue: Int get() = sortOrder ?: sortOrderAlt ?: 0

    val isVideoSticker: Boolean
        get() =
            contentTypeValue.startsWith("video/", ignoreCase = true) ||
                filePathValue.endsWith(".webm", ignoreCase = true)
}

fun stickerIsVideo(contentType: String?, filePath: String): Boolean =
    (contentType?.startsWith("video/", ignoreCase = true) == true) ||
        filePath.endsWith(".webm", ignoreCase = true)

fun stickerImageUrl(filePath: String): String =
    when {
        filePath.startsWith("http://") || filePath.startsWith("https://") -> filePath
        filePath.startsWith("/uploads/") -> "https://whithin.ru$filePath"
        filePath.startsWith("uploads/") -> "https://whithin.ru/$filePath"
        else -> "https://whithin.ru/uploads/$filePath"
    }
