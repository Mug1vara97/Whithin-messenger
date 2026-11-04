package com.whithin.voice.data.model

fun VoiceChannelParticipant.applyProfileUpdate(update: ProfileRealtimeUpdate): VoiceChannelParticipant {
    if (!userId.equals(update.userId, ignoreCase = true)) return this
    return copy(
        userName = update.displayName ?: update.username ?: userName,
        avatar = update.avatar ?: avatar,
        avatarColor = update.avatarColor ?: avatarColor,
        banner = update.banner ?: banner,
        nameplate = update.nameplate ?: nameplate,
        avatarDecoration = update.avatarDecoration ?: avatarDecoration,
    )
}

fun Map<String, List<VoiceChannelParticipant>>.patchProfileUpdate(
    update: ProfileRealtimeUpdate,
): Map<String, List<VoiceChannelParticipant>> {
    var changed = false
    val result = mutableMapOf<String, List<VoiceChannelParticipant>>()
    for ((channelId, participants) in this) {
        val patched = participants.map { it.applyProfileUpdate(update) }
        if (patched != participants) changed = true
        result[channelId] = patched
    }
    return if (changed) result else this
}
