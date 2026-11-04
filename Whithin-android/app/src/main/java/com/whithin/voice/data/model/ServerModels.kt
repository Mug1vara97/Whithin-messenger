package com.whithin.voice.data.model

import com.google.gson.annotations.SerializedName

data class Server(
    @SerializedName("serverId")
    val serverId: String?,
    @SerializedName("ServerId")
    val serverIdAlt: String? = null,
    @SerializedName("name")
    val name: String?,
    @SerializedName("Name")
    val nameAlt: String? = null,
    @SerializedName("description")
    val description: String?,
    @SerializedName("Description")
    val descriptionAlt: String? = null,
    @SerializedName("iconUrl")
    val iconUrl: String? = null,
    @SerializedName("IconUrl")
    val iconUrlAlt: String? = null,
    @SerializedName("avatar")
    val avatar: String? = null,
    @SerializedName("Avatar")
    val avatarAlt: String? = null,
    @SerializedName("memberCount")
    val memberCount: Int?,
    @SerializedName("MemberCount")
    val memberCountAlt: Int? = null,
    @SerializedName("banner")
    val banner: String? = null,
    @SerializedName("Banner")
    val bannerAlt: String? = null,
    @SerializedName("bannerColor")
    val bannerColor: String? = null,
    @SerializedName("BannerColor")
    val bannerColorAlt: String? = null,
    @SerializedName("isOnline")
    val isOnline: Boolean?,
    @SerializedName("IsOnline")
    val isOnlineAlt: Boolean? = null
) {
    // Helper properties to handle both naming conventions
    val serverIdValue: String
        get() = serverId ?: serverIdAlt ?: ""
    
    val nameValue: String
        get() = name ?: nameAlt ?: "Unknown Server"
    
    val descriptionValue: String?
        get() = description ?: descriptionAlt
    
    val iconUrlValue: String?
        get() = listOf(iconUrl, iconUrlAlt, avatar, avatarAlt)
            .firstOrNull { !it.isNullOrBlank() }?.trim()
    
    val memberCountValue: Int
        get() = memberCount ?: memberCountAlt ?: 0

    val bannerValue: String?
        get() = (banner ?: bannerAlt)?.trim()?.takeIf { it.isNotEmpty() }

    val bannerColorValue: String?
        get() = (bannerColor ?: bannerColorAlt)?.trim()?.takeIf { it.isNotEmpty() }
    
    val isOnlineValue: Boolean
        get() = isOnline ?: isOnlineAlt ?: false
}
