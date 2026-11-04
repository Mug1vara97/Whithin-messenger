package com.whithin.voice.data.model

import com.google.gson.annotations.SerializedName

data class ServerDetail(
    @SerializedName("ServerId")
    val serverId: Any?,
    @SerializedName("serverId")
    val serverIdAlt: Any? = null,
    @SerializedName("Name")
    val name: String?,
    @SerializedName("name")
    val nameAlt: String? = null,
    @SerializedName("Categories")
    val categories: List<Category>?,
    @SerializedName("categories")
    val categoriesAlt: List<Category>? = null,
    @SerializedName("OwnerId")
    val ownerId: Any?,
    @SerializedName("ownerId")
    val ownerIdAlt: Any? = null,
    @SerializedName("UserRoles")
    @com.google.gson.annotations.JsonAdapter(GuidListTypeAdapter::class)
    val userRoles: List<String>?,
    @SerializedName("userRoles")
    @com.google.gson.annotations.JsonAdapter(GuidListTypeAdapter::class)
    val userRolesAlt: List<String>? = null,
    @SerializedName("Banner")
    val banner: String? = null,
    @SerializedName("banner")
    val bannerAlt: String? = null,
    @SerializedName("Avatar")
    val avatar: String? = null,
    @SerializedName("avatar")
    val avatarAlt: String? = null,
    @SerializedName("BannerColor")
    val bannerColor: String? = null,
    @SerializedName("bannerColor")
    val bannerColorAlt: String? = null,
    @SerializedName("permissions")
    val permissions: Map<String, Boolean>? = null,
    @SerializedName("Permissions")
    val permissionsAlt: Map<String, Boolean>? = null,
) {
    val serverIdValue: String
        get() = (serverId ?: serverIdAlt)?.toString() ?: ""
    
    val nameValue: String
        get() = name ?: nameAlt ?: "Unknown Server"
    
    val categoriesValue: List<Category>
        get() = categories ?: categoriesAlt ?: emptyList()
    
    val ownerIdValue: String
        get() = (ownerId ?: ownerIdAlt)?.toString() ?: ""
    
    val userRolesValue: List<String>
        get() = userRoles ?: userRolesAlt ?: emptyList()

    val avatarPathValue: String?
        get() = (avatar ?: avatarAlt)?.trim()?.takeIf { it.isNotEmpty() }

    val bannerPathValue: String?
        get() = (banner ?: bannerAlt)?.trim()?.takeIf { it.isNotEmpty() }

    /** True when API provided a banner image and/or an explicit tint color (matches web ServerPanel). */
    val hasBannerSection: Boolean
        get() = !bannerPathValue.isNullOrBlank() || bannerColor != null || bannerColorAlt != null

    /** Hex color for tint behind / without image; defaults when only an image URL is set. */
    val bannerColorValue: String
        get() = (bannerColor ?: bannerColorAlt)?.trim()?.takeIf { it.isNotEmpty() } ?: "#3f3f3f"

    val permissionsValue: Map<String, Boolean>
        get() = permissions ?: permissionsAlt ?: emptyMap()
}

data class Category(
    @SerializedName("categoryId")
    val categoryId: Any?,
    @SerializedName("CategoryId")
    val categoryIdAlt: Any? = null,
    @SerializedName("categoryName")
    val categoryName: String?,
    @SerializedName("CategoryName")
    val categoryNameAlt: String? = null,
    @SerializedName("categoryOrder")
    val categoryOrder: Int?,
    @SerializedName("CategoryOrder")
    val categoryOrderAlt: Int? = null,
    @SerializedName("isPrivate")
    val isPrivate: Boolean?,
    @SerializedName("IsPrivate")
    val isPrivateAlt: Boolean? = null,
    @SerializedName("allowedRoleIds")
    val allowedRoleIds: String?,
    @SerializedName("AllowedRoleIds")
    val allowedRoleIdsAlt: String? = null,
    @SerializedName("allowedUserIds")
    val allowedUserIds: String?,
    @SerializedName("AllowedUserIds")
    val allowedUserIdsAlt: String? = null,
    @SerializedName("chats")
    val chats: List<Channel>?,
    @SerializedName("Chats")
    val chatsAlt: List<Channel>? = null
) {
    val categoryIdValue: String?
        get() = (categoryId ?: categoryIdAlt)?.toString()
    
    val categoryNameValue: String?
        get() = categoryName ?: categoryNameAlt
    
    val categoryOrderValue: Int
        get() = categoryOrder ?: categoryOrderAlt ?: 0
    
    val chatsValue: List<Channel>
        get() = chats ?: chatsAlt ?: emptyList()

    val isPrivateValue: Boolean
        get() = isPrivate ?: isPrivateAlt ?: false

    val allowedRoleIdsValue: List<String>
        get() = parseGuidListField(allowedRoleIds ?: allowedRoleIdsAlt)

    val allowedUserIdsValue: List<String>
        get() = parseGuidListField(allowedUserIds ?: allowedUserIdsAlt)

    val isUncategorizedValue: Boolean
        get() {
            val id = categoryIdValue?.trim().orEmpty()
            val name = categoryNameValue?.trim().orEmpty()
            return id.isBlank() ||
                name.isBlank() ||
                name.equals(UNCATEGORIZED_CATEGORY_LABEL, ignoreCase = true)
        }

    val headerLabelValue: String?
        get() = if (isUncategorizedValue) null else categoryNameValue?.trim()?.takeIf { it.isNotEmpty() }
}

const val UNCATEGORIZED_CATEGORY_LABEL = "Без категории"

fun List<Category>.sortedForServerDisplay(): List<Category> =
    sortedWith(
        compareBy<Category> { if (it.isUncategorizedValue) 0 else 1 }
            .thenBy { it.categoryOrderValue },
    )

private fun parseGuidListField(raw: String?): List<String> {
    val value = raw?.trim().orEmpty()
    if (value.isBlank() || value == "[]" || value == "null") return emptyList()
    return runCatching {
        val type = com.google.gson.reflect.TypeToken.getParameterized(List::class.java, String::class.java).type
        com.google.gson.Gson().fromJson<List<String>>(value, type) ?: emptyList()
    }.getOrDefault(emptyList())
}

data class Channel(
    @SerializedName("chatId")
    val chatId: Any?,
    @SerializedName("ChatId")
    val chatIdAlt: Any? = null,
    @SerializedName("name")
    val name: String?,
    @SerializedName("Name")
    val nameAlt: String? = null,
    @SerializedName("typeId")
    val typeId: Any?,
    @SerializedName("TypeId")
    val typeIdAlt: Any? = null,
    @SerializedName("chatOrder")
    val chatOrder: Int?,
    @SerializedName("ChatOrder")
    val chatOrderAlt: Int? = null,
    @SerializedName("isPrivate")
    val isPrivate: Boolean?,
    @SerializedName("IsPrivate")
    val isPrivateAlt: Boolean? = null,
    @SerializedName("allowedRoleIds")
    val allowedRoleIds: String?,
    @SerializedName("AllowedRoleIds")
    val allowedRoleIdsAlt: String? = null,
    @SerializedName("members")
    val members: List<ChannelMember>?,
    @SerializedName("Members")
    val membersAlt: List<ChannelMember>? = null
) {
    val chatIdValue: String
        get() = (chatId ?: chatIdAlt)?.toString() ?: ""
    
    val nameValue: String
        get() = name ?: nameAlt ?: "Unknown Channel"
    
    val typeIdValue: String
        get() = (typeId ?: typeIdAlt)?.toString() ?: ""
    
    val chatOrderValue: Int
        get() = chatOrder ?: chatOrderAlt ?: 0
    
    val isPrivateValue: Boolean
        get() = isPrivate ?: isPrivateAlt ?: false
    
    val isTextChannel: Boolean
        get() = typeIdValue == "0" || typeIdValue == "1" || typeIdValue == "33333333-3333-3333-3333-333333333333"
    
    val isVoiceChannel: Boolean
        get() = typeIdValue == "2" ||
            typeIdValue == "4" ||
            typeIdValue.equals(ChannelTypes.VOICE_GUID, ignoreCase = true)

    val isIdeasBoardChannel: Boolean
        get() = typeIdValue == "5" ||
            typeIdValue.equals(ChannelTypes.IDEAS_BOARD_GUID, ignoreCase = true)

    val isNewsChannel: Boolean
        get() = typeIdValue == "6" ||
            typeIdValue.equals(ChannelTypes.NEWS_GUID, ignoreCase = true)

    val allowedRoleIdsValue: List<String>
        get() = parseGuidListField(allowedRoleIds ?: allowedRoleIdsAlt)

    val membersValue: List<String>
        get() = (members ?: membersAlt ?: emptyList())
            .map { it.userIdValue }
            .filter { it.isNotBlank() }

    val channelTypeLabel: String
        get() = when {
            isVoiceChannel -> "Голосовой канал"
            isIdeasBoardChannel -> "Доска идей"
            isNewsChannel -> "Новости"
            else -> "Текстовый канал"
        }
}

data class ChannelMember(
    @SerializedName("userId")
    val userId: Any?,
    @SerializedName("UserId")
    val userIdAlt: Any? = null
) {
    val userIdValue: String
        get() = (userId ?: userIdAlt)?.toString() ?: ""
}
