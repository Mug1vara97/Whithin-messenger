package com.whithin.voice.data.model

import com.google.gson.annotations.SerializedName

data class ChatInfo(
    @SerializedName("chatId")
    val chatId: String?,
    @SerializedName("ChatId")
    val chatIdAlt: String? = null,
    @SerializedName("username")
    val username: String?,
    @SerializedName("Username")
    val usernameAlt: String? = null,
    @SerializedName("userId")
    val userId: String?,
    @SerializedName("UserId")
    val userIdAlt: String? = null,
    @SerializedName("avatarUrl")
    val avatarUrl: String?,
    @SerializedName("AvatarUrl")
    val avatarUrlAlt: String? = null,
    @SerializedName("avatarColor")
    val avatarColor: String?,
    @SerializedName("AvatarColor")
    val avatarColorAlt: String? = null,
    @SerializedName("userStatus")
    val userStatus: String?,
    @SerializedName("UserStatus")
    val userStatusAlt: String? = null,
    @SerializedName("lastSeen")
    val lastSeen: String?,
    @SerializedName("LastSeen")
    val lastSeenAlt: String? = null,
    @SerializedName("isGroupChat")
    val isGroupChat: Boolean?,
    @SerializedName("IsGroupChat")
    val isGroupChatAlt: Boolean? = null,
    @SerializedName("lastMessage")
    val lastMessage: String?,
    @SerializedName("LastMessage")
    val lastMessageAlt: String? = null,
    @SerializedName("lastMessageTime")
    val lastMessageTime: String?,
    @SerializedName("LastMessageTime")
    val lastMessageTimeAlt: String? = null,
    @SerializedName("lastMessageEncryptionVersion")
    val lastMessageEncryptionVersion: Int? = null,
    @SerializedName("LastMessageEncryptionVersion")
    val lastMessageEncryptionVersionAlt: Int? = null,
    @SerializedName("lastMessageEncryptedPayload")
    val lastMessageEncryptedPayload: String? = null,
    @SerializedName("LastMessageEncryptedPayload")
    val lastMessageEncryptedPayloadAlt: String? = null,
    @SerializedName("lastMessageSenderId")
    val lastMessageSenderId: String? = null,
    @SerializedName("LastMessageSenderId")
    val lastMessageSenderIdAlt: String? = null,
  /** Client-only: last preview was decrypted for display. */
    val e2eLastMessageDecrypted: Boolean? = null,
    val e2eLastMessageDecryptedAlt: Boolean? = null,
    @SerializedName("unreadCount")
    val unreadCount: Int? = null,
    @SerializedName("UnreadCount")
    val unreadCountAlt: Int? = null,
    @SerializedName("isSavedMessages")
    val isSavedMessages: Boolean? = null,
    @SerializedName("IsSavedMessages")
    val isSavedMessagesAlt: Boolean? = null,
    @SerializedName("isPinned")
    val isPinned: Boolean? = null,
    @SerializedName("IsPinned")
    val isPinnedAlt: Boolean? = null,
    @SerializedName("pinnedAt")
    val pinnedAt: String? = null,
    @SerializedName("PinnedAt")
    val pinnedAtAlt: String? = null,
    @SerializedName("pinOrder")
    val pinOrder: Int? = null,
    @SerializedName("PinOrder")
    val pinOrderAlt: Int? = null,
    @SerializedName("nameplate")
    val nameplate: String? = null,
    @SerializedName("Nameplate")
    val nameplateAlt: String? = null,
    @SerializedName("avatarDecoration")
    val avatarDecoration: String? = null,
    @SerializedName("AvatarDecoration")
    val avatarDecorationAlt: String? = null,
) {
    // Helper properties to handle both naming conventions
    val chatIdValue: String
        get() = chatId ?: chatIdAlt ?: ""
    
    val usernameValue: String
        get() = username ?: usernameAlt ?: ""
    
    val userIdValue: String
        get() = userId ?: userIdAlt ?: ""
    
    val avatarUrlValue: String?
        get() = avatarUrl ?: avatarUrlAlt
    
    val avatarColorValue: String?
        get() = avatarColor ?: avatarColorAlt

    val nameplateValue: String?
        get() = nameplate ?: nameplateAlt

    val avatarDecorationValue: String?
        get() = avatarDecoration ?: avatarDecorationAlt
    
    val userStatusValue: String
        get() = normalizePresenceWireValue(userStatus ?: userStatusAlt)
    
    val lastSeenValue: String?
        get() = lastSeen ?: lastSeenAlt
    
    val isGroupChatValue: Boolean
        get() = isGroupChat ?: isGroupChatAlt ?: false
    
    val lastMessageValue: String?
        get() = lastMessage ?: lastMessageAlt
    
    val lastMessageTimeValue: String
        get() = lastMessageTime ?: lastMessageTimeAlt ?: ""

    val lastMessageEncryptionVersionValue: Int
        get() = lastMessageEncryptionVersion ?: lastMessageEncryptionVersionAlt ?: 0

    val lastMessageEncryptedPayloadValue: String?
        get() = lastMessageEncryptedPayload ?: lastMessageEncryptedPayloadAlt

    val lastMessageSenderIdValue: String?
        get() = lastMessageSenderId ?: lastMessageSenderIdAlt

    val e2eLastMessageDecryptedValue: Boolean
        get() = e2eLastMessageDecrypted == true || e2eLastMessageDecryptedAlt == true

    val unreadCountValue: Int
        get() = unreadCount ?: unreadCountAlt ?: 0

    val isSavedMessagesValue: Boolean
        get() = isSavedMessages == true || isSavedMessagesAlt == true

    val isPinnedValue: Boolean
        get() = isPinned == true || isPinnedAlt == true

    val pinnedAtValue: String?
        get() = pinnedAt ?: pinnedAtAlt

    val pinOrderValue: Int?
        get() = pinOrder ?: pinOrderAlt
}
