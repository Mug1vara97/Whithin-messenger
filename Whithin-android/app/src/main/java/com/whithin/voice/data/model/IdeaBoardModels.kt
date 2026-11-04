package com.whithin.voice.data.model

import com.google.gson.annotations.SerializedName

object ChannelTypes {
    const val TEXT = 3
    const val VOICE = 4
    const val IDEAS_BOARD = 5
    const val NEWS = 6
    const val TEXT_GUID = "33333333-3333-3333-3333-333333333333"
    const val VOICE_GUID = "44444444-4444-4444-4444-444444444444"
    const val IDEAS_BOARD_GUID = "55555555-5555-5555-5555-555555555555"
    const val NEWS_GUID = "77777777-7777-7777-7777-777777777777"
}

data class IdeaBoardCard(
    @SerializedName("cardId")
    val cardId: Any? = null,
    @SerializedName("CardId")
    val cardIdAlt: Any? = null,
    @SerializedName("chatId")
    val chatId: Any? = null,
    @SerializedName("ChatId")
    val chatIdAlt: Any? = null,
    @SerializedName("authorUserId")
    val authorUserId: Any? = null,
    @SerializedName("AuthorUserId")
    val authorUserIdAlt: Any? = null,
    @SerializedName("authorUsername")
    val authorUsername: String? = null,
    @SerializedName("AuthorUsername")
    val authorUsernameAlt: String? = null,
    @SerializedName("title")
    val title: String? = null,
    @SerializedName("Title")
    val titleAlt: String? = null,
    @SerializedName("body")
    val body: String? = null,
    @SerializedName("Body")
    val bodyAlt: String? = null,
    @SerializedName("tag")
    val tag: String? = null,
    @SerializedName("Tag")
    val tagAlt: String? = null,
    @SerializedName("sourceUrl")
    val sourceUrl: String? = null,
    @SerializedName("SourceUrl")
    val sourceUrlAlt: String? = null,
    @SerializedName("rotation")
    val rotation: Double? = null,
    @SerializedName("Rotation")
    val rotationAlt: Double? = null,
    @SerializedName("isFiled")
    val isFiled: Boolean? = null,
    @SerializedName("IsFiled")
    val isFiledAlt: Boolean? = null,
    @SerializedName("createdAt")
    val createdAt: String? = null,
    @SerializedName("CreatedAt")
    val createdAtAlt: String? = null,
) {
    val cardIdValue: String
        get() = (cardId ?: cardIdAlt)?.toString().orEmpty()

    val chatIdValue: String
        get() = (chatId ?: chatIdAlt)?.toString().orEmpty()

    val authorUserIdValue: String
        get() = (authorUserId ?: authorUserIdAlt)?.toString().orEmpty()

    val authorUsernameValue: String
        get() = authorUsername ?: authorUsernameAlt ?: "User"

    val titleValue: String
        get() = title ?: titleAlt ?: ""

    val bodyValue: String
        get() = body ?: bodyAlt ?: ""

    val tagValue: String?
        get() = (tag ?: tagAlt)?.trim()?.takeIf { it.isNotEmpty() }

    val sourceUrlValue: String?
        get() = (sourceUrl ?: sourceUrlAlt)?.trim()?.takeIf { it.isNotEmpty() }

    val rotationValue: Float
        get() = (rotation ?: rotationAlt ?: 0.0).toFloat()

    val isFiledValue: Boolean
        get() = isFiled ?: isFiledAlt ?: false

    val createdAtValue: String?
        get() = createdAt ?: createdAtAlt
}
