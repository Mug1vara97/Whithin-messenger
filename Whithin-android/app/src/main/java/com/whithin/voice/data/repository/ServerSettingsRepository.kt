package com.whithin.voice.data.repository

import com.whithin.voice.data.api.ServerApi
import com.whithin.voice.data.model.AddMemberToChannelRequest
import com.whithin.voice.data.model.AddServerMemberRequest
import com.whithin.voice.data.model.AuditLogResponse
import com.whithin.voice.data.model.MemberNicknameUpdatedEvent
import com.whithin.voice.data.model.ServerDetail
import com.whithin.voice.data.model.ServerMemberInfo
import com.whithin.voice.data.model.ServerRoleInfo
import com.whithin.voice.data.model.UpdateServerBannerRequest
import com.whithin.voice.data.signalr.ServerHub
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ServerSettingsRepository @Inject constructor(
    private val serverApi: ServerApi,
    private val serverDetailRepository: ServerDetailRepository,
    private val serverHub: ServerHub,
) {
    suspend fun connectHub(userId: String, serverId: String): Result<Unit> {
        return serverHub.connect(userId, serverId)
    }

    suspend fun getServer(serverId: String): Result<ServerDetail> {
        return serverDetailRepository.getServer(serverId)
    }

    suspend fun updateServerName(serverId: String, newName: String): Result<Unit> {
        if (newName.isBlank()) {
            return Result.failure(IllegalArgumentException("Название сервера не может быть пустым"))
        }
        return serverHub.updateServerName(serverId, newName)
    }

    suspend fun leaveServer(serverId: String): Result<Unit> {
        return serverHub.leaveServer(serverId)
    }

    suspend fun deleteServer(serverId: String): Result<Unit> {
        return serverHub.deleteServer(serverId)
    }

    suspend fun addMember(serverId: String, memberUserId: String): Result<Unit> {
        return try {
            val response = serverApi.addServerMember(serverId, AddServerMemberRequest(memberUserId))
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Не удалось добавить участника"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun uploadBanner(
        serverId: String,
        imageBytes: ByteArray,
        mimeType: String,
        fileName: String,
    ): Result<Unit> {
        val media = mimeType.ifBlank { "image/jpeg" }.toMediaTypeOrNull()
            ?: return Result.failure(IllegalArgumentException("Неверный тип файла"))
        val safeName = fileName.ifBlank { "banner.jpg" }
        val body = imageBytes.toRequestBody(media)
        val part = MultipartBody.Part.createFormData("file", safeName, body)
        return try {
            val response = serverApi.uploadServerBanner(serverId, part)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Ошибка загрузки баннера"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteBanner(serverId: String): Result<Unit> {
        return try {
            val response = serverApi.deleteServerBanner(serverId)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Ошибка удаления баннера"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateBannerColor(serverId: String, bannerColor: String?, useDefault: Boolean): Result<Unit> {
        return try {
            val response = serverApi.updateServerBanner(
                serverId,
                UpdateServerBannerRequest(
                    bannerColor = if (useDefault) null else bannerColor,
                    resetBannerColor = useDefault,
                ),
            )
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Ошибка обновления цвета баннера"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun uploadAvatar(
        serverId: String,
        imageBytes: ByteArray,
        mimeType: String,
        fileName: String,
    ): Result<Unit> {
        val media = mimeType.ifBlank { "image/jpeg" }.toMediaTypeOrNull()
            ?: return Result.failure(IllegalArgumentException("Неверный тип файла"))
        val safeName = fileName.ifBlank { "avatar.jpg" }
        val body = imageBytes.toRequestBody(media)
        val part = MultipartBody.Part.createFormData("file", safeName, body)
        return try {
            val response = serverApi.uploadServerAvatar(serverId, part)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Ошибка загрузки значка"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteAvatar(serverId: String): Result<Unit> {
        return try {
            val response = serverApi.deleteServerAvatar(serverId)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Ошибка удаления значка"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getMembers(serverId: String): Result<List<ServerMemberInfo>> {
        return try {
            val response = serverApi.getServerMembers(serverId)
            if (response.isSuccessful) {
                Result.success(response.body().orEmpty())
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Не удалось загрузить участников"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun fetchRoles(serverId: String): Result<List<ServerRoleInfo>> {
        return serverHub.fetchRoles(serverId)
    }

    suspend fun kickMember(serverId: String, memberUserId: String): Result<Unit> {
        return serverHub.kickMember(serverId, memberUserId)
    }

    suspend fun updateMemberNickname(
        serverId: String,
        memberUserId: String,
        nickname: String?,
    ): Result<Unit> {
        return serverHub.updateMemberNickname(serverId, memberUserId, nickname)
    }

    suspend fun createRole(
        serverId: String,
        roleName: String,
        color: String,
        permissions: String = "{}",
    ): Result<Unit> {
        return serverHub.createRole(serverId, roleName, color, permissions)
    }

    suspend fun updateRole(
        roleId: String,
        roleName: String,
        color: String,
        permissions: String,
    ): Result<Unit> {
        return serverHub.updateRole(roleId, roleName, color, permissions)
    }

    suspend fun deleteRole(roleId: String): Result<Unit> {
        return serverHub.deleteRole(roleId)
    }

    suspend fun assignRole(targetUserId: String, roleId: String): Result<Unit> {
        return serverHub.assignRole(targetUserId, roleId)
    }

    suspend fun removeRole(targetUserId: String, roleId: String): Result<Unit> {
        return serverHub.removeRole(targetUserId, roleId)
    }

    suspend fun updateChatName(serverId: String, chatId: String, newName: String): Result<Unit> {
        return serverHub.updateChatName(serverId, chatId, newName)
    }

    suspend fun updateChatPrivacy(
        serverId: String,
        chatId: String,
        isPrivate: Boolean,
        allowedRoleIds: List<String> = emptyList(),
        memberIds: List<String> = emptyList(),
    ): Result<Unit> {
        val roleGuids = allowedRoleIds.mapNotNull { runCatching { java.util.UUID.fromString(it.trim()) }.getOrNull() }
        val memberGuids = memberIds.mapNotNull { runCatching { java.util.UUID.fromString(it.trim()) }.getOrNull() }
        return serverHub.updateChatPrivacy(
            serverId = serverId,
            chatId = chatId,
            isPrivate = isPrivate,
            memberIds = memberGuids,
            allowedRoleIds = roleGuids,
        )
    }

    suspend fun addMemberToChannel(serverId: String, channelId: String, memberUserId: String): Result<Unit> {
        return try {
            val response = serverApi.addMemberToChannel(
                serverId,
                channelId,
                AddMemberToChannelRequest(memberUserId),
            )
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Не удалось добавить участника в канал"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun removeMemberFromChannel(serverId: String, channelId: String, memberUserId: String): Result<Unit> {
        return try {
            val response = serverApi.removeMemberFromChannel(serverId, channelId, memberUserId)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Не удалось удалить участника из канала"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteChat(serverId: String, chatId: String): Result<Unit> {
        return serverHub.deleteChat(serverId, chatId)
    }

    suspend fun createCategory(serverId: String, categoryName: String): Result<Unit> {
        return serverHub.createCategory(serverId, categoryName)
    }

    suspend fun createPrivateCategory(
        serverId: String,
        categoryName: String,
        allowedRoleIds: List<String> = emptyList(),
        allowedUserIds: List<String> = emptyList(),
    ): Result<Unit> {
        val roleGuids = allowedRoleIds.mapNotNull { runCatching { java.util.UUID.fromString(it.trim()) }.getOrNull() }
        val userGuids = allowedUserIds.mapNotNull { runCatching { java.util.UUID.fromString(it.trim()) }.getOrNull() }
        return serverHub.createPrivateCategory(serverId, categoryName, roleGuids, userGuids)
    }

    suspend fun updateCategory(
        serverId: String,
        categoryId: String,
        categoryName: String,
        isPrivate: Boolean,
        allowedRoleIds: List<String> = emptyList(),
        allowedUserIds: List<String> = emptyList(),
    ): Result<Unit> {
        val roleGuids = allowedRoleIds.mapNotNull { runCatching { java.util.UUID.fromString(it.trim()) }.getOrNull() }
        val userGuids = allowedUserIds.mapNotNull { runCatching { java.util.UUID.fromString(it.trim()) }.getOrNull() }
        return serverHub.updateCategory(serverId, categoryId, categoryName, isPrivate, roleGuids, userGuids)
    }

    suspend fun deleteCategory(serverId: String, categoryId: String): Result<Unit> {
        return serverHub.deleteCategory(serverId, categoryId)
    }

    suspend fun createChat(
        serverId: String,
        categoryId: String?,
        chatName: String,
        chatType: Int,
        isPrivate: Boolean = false,
        memberIds: List<String> = emptyList(),
    ): Result<Unit> {
        val memberGuids = memberIds.mapNotNull { runCatching { java.util.UUID.fromString(it.trim()) }.getOrNull() }
        return serverHub.createChat(serverId, categoryId, chatName, chatType, isPrivate, memberGuids)
    }

    suspend fun fetchAuditLog(
        serverId: String,
        page: Int = 1,
        pageSize: Int = 50,
    ): Result<AuditLogResponse> {
        return serverHub.fetchAuditLog(serverId, page, pageSize)
    }

    fun setOnRolesChanged(callback: (() -> Unit)?) {
        serverHub.setOnRolesChanged(callback)
    }

    fun setOnUserPermissionsUpdated(callback: ((String) -> Unit)?) {
        serverHub.setOnUserPermissionsUpdated(callback)
    }

    fun setOnMemberNicknameUpdated(callback: ((MemberNicknameUpdatedEvent) -> Unit)?) {
        serverHub.setOnMemberNicknameUpdated(callback)
    }

    fun setOnServerStructureChanged(callback: (() -> Unit)?) {
        serverHub.setOnServerStructureChanged(callback)
    }

    fun disconnectHub() {
        serverHub.disconnect()
    }
}
