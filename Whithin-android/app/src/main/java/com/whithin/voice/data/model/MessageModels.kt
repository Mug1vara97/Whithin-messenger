package com.whithin.voice.data.model

import com.google.gson.annotations.SerializedName
import com.whithin.voice.util.parseCallLogPayload

data class Message(
    @SerializedName("messageId")
    val messageId: String?,
    @SerializedName("MessageId")
    val messageIdAlt: String? = null,
    @SerializedName("chatId")
    val chatId: String?,
    @SerializedName("ChatId")
    val chatIdAlt: String? = null,
    @SerializedName("senderId")
    val senderId: String?,
    @SerializedName("SenderId")
    val senderIdAlt: String? = null,
    @SerializedName("senderUsername")
    val senderUsername: String?,
    @SerializedName("SenderUsername")
    val senderUsernameAlt: String? = null,
    @SerializedName("username")
    val username: String? = null,
    @SerializedName("Username")
    val usernameAlt: String? = null,
    @SerializedName("content")
    val content: String?,
    @SerializedName("Content")
    val contentAlt: String? = null,
    @SerializedName("createdAt")
    val createdAt: String?,
    @SerializedName("CreatedAt")
    val createdAtAlt: String? = null,
    @SerializedName("updatedAt")
    val updatedAt: String?,
    @SerializedName("UpdatedAt")
    val updatedAtAlt: String? = null,
    @SerializedName("isEdited")
    val isEdited: Boolean?,
    @SerializedName("IsEdited")
    val isEditedAlt: Boolean? = null,
    @SerializedName("avatarUrl")
    val avatarUrl: String?,
    @SerializedName("AvatarUrl")
    val avatarUrlAlt: String? = null,
    @SerializedName("avatarColor")
    val avatarColor: String?,
    @SerializedName("AvatarColor")
    val avatarColorAlt: String? = null,
    @SerializedName("repliedMessage")
    val repliedMessage: RepliedMessage?,
    @SerializedName("RepliedMessage")
    val repliedMessageAlt: RepliedMessage? = null,
    @SerializedName("forwardedMessage")
    val forwardedMessage: ForwardedMessage?,
    @SerializedName("ForwardedMessage")
    val forwardedMessageAlt: ForwardedMessage? = null,
    @SerializedName("mediaFiles")
    val mediaFiles: List<MediaFile>?,
    @SerializedName("MediaFiles")
    val mediaFilesAlt: List<MediaFile>? = null,
    @SerializedName("contentType")
    val contentType: String? = null,
    @SerializedName("ContentType")
    val contentTypeAlt: String? = null,
    @SerializedName("sticker")
    val sticker: MessageSticker? = null,
    @SerializedName("Sticker")
    val stickerAlt: MessageSticker? = null,
    @SerializedName("status")
    val status: String? = null,
    @SerializedName("Status")
    val statusAlt: String? = null,
    @SerializedName("isPinned")
    val isPinned: Boolean? = null,
    @SerializedName("IsPinned")
    val isPinnedAlt: Boolean? = null,
    @SerializedName("pinnedAt")
    val pinnedAt: String? = null,
    @SerializedName("PinnedAt")
    val pinnedAtAlt: String? = null,
    @SerializedName("poll")
    val poll: MessagePoll? = null,
    @SerializedName("Poll")
    val pollAlt: MessagePoll? = null,
    @SerializedName("avatarDecoration")
    val avatarDecoration: String? = null,
    @SerializedName("AvatarDecoration")
    val avatarDecorationAlt: String? = null,
    @SerializedName("encryptionVersion")
    val encryptionVersion: Int? = null,
    @SerializedName("EncryptionVersion")
    val encryptionVersionAlt: Int? = null,
) {
    val messageIdValue: String
        get() = messageId ?: messageIdAlt ?: ""
    
    val chatIdValue: String
        get() = chatId ?: chatIdAlt ?: ""
    
    val senderIdValue: String
        get() = senderId ?: senderIdAlt ?: ""
    
    val senderUsernameValue: String
        get() = senderUsername ?: senderUsernameAlt ?: username ?: usernameAlt ?: ""
    
    val contentValue: String
        get() = content ?: contentAlt ?: ""
    
    val createdAtValue: String
        get() = createdAt ?: createdAtAlt ?: ""
    
    val updatedAtValue: String
        get() = updatedAt ?: updatedAtAlt ?: ""
    
    val isEditedValue: Boolean
        get() = isEdited ?: isEditedAlt ?: false
    
    val avatarUrlValue: String?
        get() = avatarUrl ?: avatarUrlAlt
    
    val avatarColorValue: String?
        get() = avatarColor ?: avatarColorAlt

    val avatarDecorationValue: String?
        get() = avatarDecoration ?: avatarDecorationAlt
    
    val repliedMessageValue: RepliedMessage?
        get() = repliedMessage ?: repliedMessageAlt
    
    val forwardedMessageValue: ForwardedMessage?
        get() = forwardedMessage ?: forwardedMessageAlt
    
    val mediaFilesValue: List<MediaFile>
        get() = mediaFiles ?: mediaFilesAlt ?: emptyList()

    val contentTypeValue: String
        get() = contentType ?: contentTypeAlt ?: ""

    val stickerValue: MessageSticker?
        get() = sticker ?: stickerAlt

    val isStickerMessage: Boolean
        get() = contentTypeValue.equals("sticker", ignoreCase = true) || stickerValue != null

    val statusValue: String
        get() = MessageStatus.normalize(status ?: statusAlt)

    val isPinnedValue: Boolean
        get() = isPinned ?: isPinnedAlt ?: false

    val pinnedAtValue: String?
        get() = pinnedAt ?: pinnedAtAlt

    val pollValue: MessagePoll?
        get() = poll ?: pollAlt

    val encryptionVersionValue: Int
        get() = encryptionVersion ?: encryptionVersionAlt ?: 0

    val isPollMessage: Boolean
        get() = contentTypeValue.equals("poll", ignoreCase = true) || pollValue != null

    val isCallLogMessage: Boolean
        get() = contentTypeValue.equals("call_log", ignoreCase = true) ||
            parseCallLogPayload(contentValue) != null
}

data class MessageSticker(
    @SerializedName("id") val id: String? = null,
    @SerializedName("Id") val idAlt: String? = null,
    @SerializedName("stickerPackId") val stickerPackId: String? = null,
    @SerializedName("StickerPackId") val stickerPackIdAlt: String? = null,
    @SerializedName("filePath") val filePath: String? = null,
    @SerializedName("FilePath") val filePathAlt: String? = null,
    @SerializedName("contentType") val contentType: String? = null,
    @SerializedName("ContentType") val contentTypeAlt: String? = null,
) {
    val idValue: String get() = id ?: idAlt ?: ""
    val stickerPackIdValue: String get() = stickerPackId ?: stickerPackIdAlt ?: ""
    val filePathValue: String get() = filePath ?: filePathAlt ?: ""
    val contentTypeValue: String get() = contentType ?: contentTypeAlt ?: "image/webp"

    val isVideoSticker: Boolean
        get() =
            contentTypeValue.startsWith("video/", ignoreCase = true) ||
                filePathValue.endsWith(".webm", ignoreCase = true)
}

data class RepliedMessage(
    @SerializedName("messageId")
    val messageId: String?,
    @SerializedName("senderUsername")
    val senderUsername: String?,
    @SerializedName("content")
    val content: String?
)

data class ForwardedMessage(
    @SerializedName("messageId")
    val messageId: String? = null,
    @SerializedName("MessageId")
    val messageIdAlt: String? = null,
    @SerializedName("senderUsername")
    val senderUsername: String? = null,
    @SerializedName("SenderUsername")
    val senderUsernameAlt: String? = null,
    @SerializedName("originalChatName")
    val originalChatName: String? = null,
    @SerializedName("OriginalChatName")
    val originalChatNameAlt: String? = null,
    @SerializedName("content")
    val content: String? = null,
    @SerializedName("Content")
    val contentAlt: String? = null,
    @SerializedName("forwardedMessageContent")
    val forwardedMessageContent: String? = null,
    @SerializedName("ForwardedMessageContent")
    val forwardedMessageContentAlt: String? = null,
    @SerializedName("contentType")
    val contentType: String? = null,
    @SerializedName("ContentType")
    val contentTypeAlt: String? = null,
    @SerializedName("sticker")
    val sticker: MessageSticker? = null,
    @SerializedName("Sticker")
    val stickerAlt: MessageSticker? = null,
    @SerializedName("mediaFiles")
    val mediaFiles: List<MediaFile>? = null,
    @SerializedName("MediaFiles")
    val mediaFilesAlt: List<MediaFile>? = null,
) {
    val senderUsernameValue: String
        get() = senderUsername ?: senderUsernameAlt ?: "Unknown"

    val originalChatNameValue: String
        get() = originalChatName ?: originalChatNameAlt ?: ""

    val contentTypeValue: String
        get() = contentType ?: contentTypeAlt ?: ""

    val stickerValue: MessageSticker?
        get() = sticker ?: stickerAlt

    val mediaFilesValue: List<MediaFile>
        get() = mediaFiles ?: mediaFilesAlt ?: emptyList()

    val isStickerMessage: Boolean
        get() = contentTypeValue.equals("sticker", ignoreCase = true) || stickerValue != null

    val bodyValue: String
        get() = content ?: contentAlt ?: forwardedMessageContent ?: forwardedMessageContentAlt ?: ""
}

data class MediaFile(
    @SerializedName("id")
    val id: String?,
    @SerializedName("Id")
    val idAlt: String? = null,
    @SerializedName("fileName")
    val fileName: String?,
    @SerializedName("FileName")
    val fileNameAlt: String? = null,
    @SerializedName("originalFileName")
    val originalFileName: String? = null,
    @SerializedName("OriginalFileName")
    val originalFileNameAlt: String? = null,
    @SerializedName("filePath")
    val filePath: String?,
    @SerializedName("FilePath")
    val filePathAlt: String? = null,
    @SerializedName("contentType")
    val contentType: String?,
    @SerializedName("ContentType")
    val contentTypeAlt: String? = null,
    @SerializedName("fileSize")
    val fileSize: Long?,
    @SerializedName("FileSize")
    val fileSizeAlt: Long? = null,
    @SerializedName("thumbnailPath")
    val thumbnailPath: String?,
    @SerializedName("ThumbnailPath")
    val thumbnailPathAlt: String? = null,
    @SerializedName("isVideoNote")
    val isVideoNote: Boolean? = null,
    @SerializedName("IsVideoNote")
    val isVideoNoteAlt: Boolean? = null,
    @SerializedName("senderUsername")
    val senderUsername: String? = null,
    @SerializedName("SenderUsername")
    val senderUsernameAlt: String? = null,
    @SerializedName("createdAt")
    val createdAt: String? = null,
    @SerializedName("CreatedAt")
    val createdAtAlt: String? = null,
    @SerializedName("caption")
    val caption: String? = null,
    @SerializedName("Caption")
    val captionAlt: String? = null,
    @SerializedName("durationSeconds")
    val durationSeconds: Double? = null,
    @SerializedName("DurationSeconds")
    val durationSecondsAlt: Double? = null,
    @SerializedName("width")
    val width: Int? = null,
    @SerializedName("Width")
    val widthAlt: Int? = null,
    @SerializedName("height")
    val height: Int? = null,
    @SerializedName("Height")
    val heightAlt: Int? = null,
) {
    val idValue: String get() = id ?: idAlt ?: ""
    val durationSecondsValue: Double? get() = (durationSeconds ?: durationSecondsAlt)?.takeIf { it > 0 }
    val widthValue: Int get() = (width ?: widthAlt ?: 0).coerceAtLeast(0)
    val heightValue: Int get() = (height ?: heightAlt ?: 0).coerceAtLeast(0)
    val fileNameValue: String get() = fileName ?: fileNameAlt ?: ""
    val originalFileNameValue: String get() = originalFileName ?: originalFileNameAlt ?: ""
    val filePathValue: String get() = filePath ?: filePathAlt ?: ""
    val contentTypeValue: String get() = contentType ?: contentTypeAlt ?: ""
    val thumbnailPathValue: String? get() = thumbnailPath ?: thumbnailPathAlt
    val isVideoNoteValue: Boolean get() = isVideoNote == true || isVideoNoteAlt == true
    val senderUsernameValue: String get() = senderUsername ?: senderUsernameAlt ?: ""
    val createdAtValue: String get() = createdAt ?: createdAtAlt ?: ""
    val captionValue: String get() = caption ?: captionAlt ?: ""

    val displayNameValue: String
        get() =
            originalFileNameValue
                .ifBlank { fileNameValue }
                .ifBlank { filePathValue.substringAfterLast('/') }
                .ifBlank { "Файл" }
}

data class SendMessageRequest(
    val content: String,
    val repliedToMessageId: String? = null,
    val forwardedFromMessageId: String? = null,
    val encryptionVersion: Int = 0,
)

data class MessagePoll(
    @SerializedName("id") val id: String? = null,
    @SerializedName("Id") val idAlt: String? = null,
    @SerializedName("question") val question: String? = null,
    @SerializedName("Question") val questionAlt: String? = null,
    @SerializedName("allowMultiple") val allowMultiple: Boolean? = null,
    @SerializedName("AllowMultiple") val allowMultipleAlt: Boolean? = null,
    @SerializedName("isAnonymous") val isAnonymous: Boolean? = null,
    @SerializedName("IsAnonymous") val isAnonymousAlt: Boolean? = null,
    @SerializedName("totalVotes") val totalVotes: Int? = null,
    @SerializedName("TotalVotes") val totalVotesAlt: Int? = null,
    @SerializedName("votedOptionIds") val votedOptionIds: List<String>? = null,
    @SerializedName("VotedOptionIds") val votedOptionIdsAlt: List<String>? = null,
    @SerializedName("options") val options: List<PollOption>? = null,
    @SerializedName("Options") val optionsAlt: List<PollOption>? = null,
) {
    val idValue: String get() = id ?: idAlt ?: ""
    val questionValue: String get() = question ?: questionAlt ?: ""
    val allowMultipleValue: Boolean get() = allowMultiple ?: allowMultipleAlt ?: false
    val isAnonymousValue: Boolean get() = isAnonymous ?: isAnonymousAlt ?: true
    val totalVotesValue: Int get() = totalVotes ?: totalVotesAlt ?: 0
    val votedOptionIdsValue: List<String>
        get() = (votedOptionIds ?: votedOptionIdsAlt).orEmpty().map { it.trim().lowercase() }
    val optionsValue: List<PollOption>
        get() = (options ?: optionsAlt).orEmpty().sortedBy { it.sortOrderValue }
}

data class PollOption(
    @SerializedName("id") val id: String? = null,
    @SerializedName("Id") val idAlt: String? = null,
    @SerializedName("text") val text: String? = null,
    @SerializedName("Text") val textAlt: String? = null,
    @SerializedName("sortOrder") val sortOrder: Int? = null,
    @SerializedName("SortOrder") val sortOrderAlt: Int? = null,
    @SerializedName("voteCount") val voteCount: Int? = null,
    @SerializedName("VoteCount") val voteCountAlt: Int? = null,
    @SerializedName("voters") val voters: List<PollVoter>? = null,
    @SerializedName("Voters") val votersAlt: List<PollVoter>? = null,
) {
    val idValue: String get() = id ?: idAlt ?: ""
    val textValue: String get() = text ?: textAlt ?: ""
    val sortOrderValue: Int get() = sortOrder ?: sortOrderAlt ?: 0
    val voteCountValue: Int get() = voteCount ?: voteCountAlt ?: 0
    val votersValue: List<PollVoter> get() = voters ?: votersAlt ?: emptyList()
}

data class PollVoter(
    @SerializedName("userId") val userId: String? = null,
    @SerializedName("UserId") val userIdAlt: String? = null,
    @SerializedName("username") val username: String? = null,
    @SerializedName("Username") val usernameAlt: String? = null,
    @SerializedName("avatarUrl") val avatarUrl: String? = null,
    @SerializedName("AvatarUrl") val avatarUrlAlt: String? = null,
    @SerializedName("avatarColor") val avatarColor: String? = null,
    @SerializedName("AvatarColor") val avatarColorAlt: String? = null,
) {
    val userIdValue: String get() = userId ?: userIdAlt ?: ""
    val usernameValue: String get() = username ?: usernameAlt ?: ""
    val avatarUrlValue: String? get() = avatarUrl ?: avatarUrlAlt
    val avatarColorValue: String? get() = avatarColor ?: avatarColorAlt
}
