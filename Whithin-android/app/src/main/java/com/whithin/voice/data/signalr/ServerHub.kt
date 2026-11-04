package com.whithin.voice.data.signalr

import android.util.Log
import com.google.gson.Gson
import com.microsoft.signalr.HubConnection
import com.microsoft.signalr.HubConnectionBuilder
import com.microsoft.signalr.HubConnectionState
import com.whithin.voice.data.local.TokenManager
import com.whithin.voice.data.model.AuditLogResponse
import com.whithin.voice.data.model.IdeaBoardCard
import com.whithin.voice.data.model.MemberNicknameUpdatedEvent
import com.whithin.voice.data.model.ProfileRealtimeUpdate
import com.whithin.voice.data.model.ServerRoleInfo
import com.whithin.voice.data.util.ProfileRealtimeUpdateParser
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeout
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

@Singleton
class ServerHub @Inject constructor(
    private val tokenManager: TokenManager,
    private val gson: Gson,
) {
    private var connection: HubConnection? = null
    private var connectedUserId: String? = null
    private var connectedServerId: String? = null
    private val reconnectController = SignalRReconnectController("ServerHub")
    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()

    private val _memberProfileUpdatedEvents =
        MutableSharedFlow<ProfileRealtimeUpdate>(extraBufferCapacity = 32)
    val memberProfileUpdatedEvents: SharedFlow<ProfileRealtimeUpdate> =
        _memberProfileUpdatedEvents.asSharedFlow()

    private var rolesLoadedDeferred: CompletableDeferred<List<ServerRoleInfo>>? = null
    private var auditLogLoadedDeferred: CompletableDeferred<AuditLogResponse>? = null
    private var ideaBoardCardsLoadedDeferred: CompletableDeferred<List<IdeaBoardCard>>? = null

    private var onServerLeft: ((String) -> Unit)? = null
    private var onServerDeleted: ((String) -> Unit)? = null
    private var onServerNameUpdated: ((String, String) -> Unit)? = null
    private var onError: ((String) -> Unit)? = null
    private var onRolesChanged: (() -> Unit)? = null
    private var onUserPermissionsUpdated: ((String) -> Unit)? = null
    private var onServerStructureChanged: (() -> Unit)? = null
    private var onMemberNicknameUpdated: ((MemberNicknameUpdatedEvent) -> Unit)? = null
    private var ideaBoardListener: IdeaBoardListener? = null

    interface IdeaBoardListener {
        fun onCardsLoaded(cards: List<IdeaBoardCard>)
        fun onCardCreated(card: IdeaBoardCard)
        fun onCardUpdated(card: IdeaBoardCard)
        fun onCardDeleted(card: IdeaBoardCard)
    }

    suspend fun connect(userId: String, serverId: String): Result<Unit> {
        return try {
            val trimmedUserId = userId.trim()
            val trimmedServerId = serverId.trim()
            if (trimmedUserId.isBlank() || trimmedServerId.isBlank()) {
                return Result.failure(IllegalArgumentException("userId и serverId обязательны"))
            }

            if (
                connection?.connectionState == HubConnectionState.CONNECTED &&
                connectedUserId == trimmedUserId &&
                connectedServerId == trimmedServerId
            ) {
                return Result.success(Unit)
            }

            connectedUserId = trimmedUserId
            connectedServerId = trimmedServerId
            reconnectController.enable()

            if (connection != null && connectedServerId != trimmedServerId) {
                stopConnection(clearConnection = true)
            }

            if (connection == null) {
                connection = buildConnection(trimmedUserId)
            }

            startConnection(joinServerId = trimmedServerId)
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("ServerHub", "Error connecting", e)
            _isConnected.value = false
            Result.failure(e)
        }
    }

    private fun buildConnection(userId: String): HubConnection {
        val hubUrl = "https://whithin.ru/serverhub?userId=$userId"
        val conn =
            HubConnectionBuilder.create(hubUrl)
                .withFreshAccessToken(tokenManager)
                .build()
        registerEventHandlers(conn)
        reconnectController.bindOnClosed(conn) { restartConnection() }
        return conn
    }

    private suspend fun startConnection(joinServerId: String) {
        suspendCancellableCoroutine { continuation ->
            try {
                if (connection?.connectionState != HubConnectionState.CONNECTED) {
                    connection?.start()?.blockingAwait()
                }
                connection?.invoke("JoinServerGroup", joinServerId)?.blockingAwait()
                _isConnected.value = true
                continuation.resume(Unit)
            } catch (error: Exception) {
                _isConnected.value = false
                continuation.resumeWithException(error)
            }
        }
    }

    private suspend fun restartConnection(): Result<Unit> {
        val userId = connectedUserId?.trim().orEmpty()
        val serverId = connectedServerId?.trim().orEmpty()
        if (userId.isBlank() || serverId.isBlank() || !reconnectController.isEnabled) {
            return Result.failure(IllegalStateException("ServerHub reconnect skipped"))
        }
        return reconnectController.withReconnectPaused {
            try {
                stopConnection(clearConnection = false)
                connection = buildConnection(userId)
                startConnection(joinServerId = serverId)
                Result.success(Unit)
            } catch (e: Exception) {
                _isConnected.value = false
                Result.failure(e)
            }
        }
    }

    private fun registerEventHandlers(conn: HubConnection) {
        conn.on("ServerLeft", { serverId: String ->
            onServerLeft?.invoke(serverId)
        }, String::class.java)

        conn.on("ServerDeleted", { serverId: String ->
            onServerDeleted?.invoke(serverId)
        }, String::class.java)

        conn.on("ServerNameUpdated", { serverId: String, newName: String ->
            onServerNameUpdated?.invoke(serverId, newName)
        }, String::class.java, String::class.java)

        conn.on("RolesLoaded", { roles: Array<ServerRoleInfo> ->
            rolesLoadedDeferred?.complete(roles.toList())
        }, Array<ServerRoleInfo>::class.java)

        conn.on("RoleCreated", { _: Any? ->
            onRolesChanged?.invoke()
        }, Any::class.java)

        conn.on("RoleUpdated", { _: Any? ->
            onRolesChanged?.invoke()
        }, Any::class.java)

        conn.on("RoleDeleted", {
            onRolesChanged?.invoke()
        })

        conn.on("RoleAssigned", { _: String, _: ServerRoleInfo ->
            onRolesChanged?.invoke()
        }, String::class.java, ServerRoleInfo::class.java)

        conn.on("RoleRemoved", { _: String, _: String ->
            onRolesChanged?.invoke()
        }, String::class.java, String::class.java)

        conn.on("MemberKicked", {
            onRolesChanged?.invoke()
        })

        conn.on("MemberNicknameUpdated", { payload: MemberNicknameUpdatedEvent ->
            onMemberNicknameUpdated?.invoke(payload)
        }, MemberNicknameUpdatedEvent::class.java)

        // Единый AppHub: события каналов сервера переименованы (Channel*), чтобы не пересекаться
        // с событиями списка чатов chatcreated/chatupdated/chatdeleted.
        conn.on("ChannelUpdated", { _: Any? ->
            onServerStructureChanged?.invoke()
        }, Any::class.java)

        conn.on("ChannelCreated", { _: Any?, _: Any? ->
            onServerStructureChanged?.invoke()
        }, Any::class.java, Any::class.java)

        conn.on("ChannelDeleted", { _: Any?, _: Any? ->
            onServerStructureChanged?.invoke()
        }, Any::class.java, Any::class.java)

        conn.on("CategoryUpdated", { _: Any? ->
            onServerStructureChanged?.invoke()
        }, Any::class.java)

        conn.on("CategoryCreated", { _: Any? ->
            onServerStructureChanged?.invoke()
        }, Any::class.java)

        conn.on("CategoryDeleted", { _: Any? ->
            onServerStructureChanged?.invoke()
        }, Any::class.java)

        conn.on("CategoriesReordered", { _: Any? ->
            onServerStructureChanged?.invoke()
        }, Any::class.java)

        conn.on("ChatsReordered", { _: Any? ->
            onServerStructureChanged?.invoke()
        }, Any::class.java)

        conn.on("IdeaBoardCardsLoaded", { cards: Array<IdeaBoardCard> ->
            val list = cards.toList()
            ideaBoardCardsLoadedDeferred?.complete(list)
            ideaBoardListener?.onCardsLoaded(list)
        }, Array<IdeaBoardCard>::class.java)

        conn.on("IdeaBoardCardCreated", { card: IdeaBoardCard ->
            ideaBoardListener?.onCardCreated(card)
        }, IdeaBoardCard::class.java)

        conn.on("IdeaBoardCardUpdated", { card: IdeaBoardCard ->
            ideaBoardListener?.onCardUpdated(card)
        }, IdeaBoardCard::class.java)

        conn.on("IdeaBoardCardPositionUpdated", { card: IdeaBoardCard ->
            ideaBoardListener?.onCardUpdated(card)
        }, IdeaBoardCard::class.java)

        conn.on("IdeaBoardCardDeleted", { card: IdeaBoardCard ->
            ideaBoardListener?.onCardDeleted(card)
        }, IdeaBoardCard::class.java)

        conn.on("UserPermissionsUpdated", { userId: UUID, _: Any? ->
            onUserPermissionsUpdated?.invoke(userId.toString())
        }, UUID::class.java, Any::class.java)

        conn.on("MemberProfileUpdated", { payload: Any ->
            try {
                ProfileRealtimeUpdateParser.parse(payload, gson)?.let {
                    _memberProfileUpdatedEvents.tryEmit(it)
                }
            } catch (e: Exception) {
                Log.e("ServerHub", "Error parsing MemberProfileUpdated event", e)
            }
        }, Any::class.java)

        conn.on("AuditLogLoaded", { payload: AuditLogResponse ->
            auditLogLoadedDeferred?.complete(payload)
        }, AuditLogResponse::class.java)

        conn.on("Error", { error: String ->
            Log.e("ServerHub", "SignalR error: $error")
            rolesLoadedDeferred?.completeExceptionally(Exception(error))
            onError?.invoke(error)
        }, String::class.java)

        conn.on("error", { error: String ->
            Log.e("ServerHub", "SignalR error: $error")
            rolesLoadedDeferred?.completeExceptionally(Exception(error))
            onError?.invoke(error)
        }, String::class.java)
    }

    private fun stopConnection(clearConnection: Boolean) {
        try {
            connection?.stop()
        } catch (e: Exception) {
            Log.w("ServerHub", "Error stopping connection", e)
        }
        _isConnected.value = false
        if (clearConnection) {
            connection = null
        }
    }

    suspend fun updateServerName(serverId: String, newName: String): Result<Unit> {
        return invokeVoid("UpdateServerName", parseGuid(serverId), newName.trim())
    }

    suspend fun leaveServer(serverId: String): Result<Unit> {
        return invokeVoid("LeaveServer", parseGuid(serverId))
    }

    suspend fun deleteServer(serverId: String): Result<Unit> {
        return invokeVoid("DeleteServer", parseGuid(serverId))
    }

    suspend fun kickMember(serverId: String, memberUserId: String): Result<Unit> {
        return invokeVoid("KickMember", parseGuid(serverId), parseGuid(memberUserId))
    }

    suspend fun updateMemberNickname(
        serverId: String,
        memberUserId: String,
        nickname: String?,
    ): Result<Unit> {
        return invokeVoid(
            "UpdateMemberNickname",
            parseGuid(serverId),
            parseGuid(memberUserId),
            nickname,
        )
    }

    suspend fun fetchRoles(serverId: String): Result<List<ServerRoleInfo>> {
        return try {
            ensureConnected()
            val deferred = CompletableDeferred<List<ServerRoleInfo>>()
            rolesLoadedDeferred = deferred
            connection?.invoke("GetRoles", parseGuid(serverId))?.blockingAwait()
            val roles = withTimeout(12_000) { deferred.await() }
            Result.success(roles)
        } catch (e: Exception) {
            Log.e("ServerHub", "fetchRoles failed", e)
            Result.failure(e)
        } finally {
            rolesLoadedDeferred = null
        }
    }

    suspend fun createRole(
        serverId: String,
        roleName: String,
        color: String,
        permissions: String = "{}",
    ): Result<Unit> {
        return invokeVoid("CreateRole", parseGuid(serverId), roleName.trim(), color, permissions)
    }

    suspend fun updateRole(
        roleId: String,
        roleName: String,
        color: String,
        permissions: String,
    ): Result<Unit> {
        return invokeVoid("UpdateRole", parseGuid(roleId), roleName.trim(), color, permissions)
    }

    suspend fun deleteRole(roleId: String): Result<Unit> {
        return invokeVoid("DeleteRole", parseGuid(roleId))
    }

    suspend fun assignRole(targetUserId: String, roleId: String): Result<Unit> {
        return invokeVoid("AssignRole", parseGuid(targetUserId), parseGuid(roleId))
    }

    suspend fun removeRole(targetUserId: String, roleId: String): Result<Unit> {
        return invokeVoid("RemoveRole", parseGuid(targetUserId), parseGuid(roleId))
    }

    suspend fun updateChatName(serverId: String, chatId: String, newName: String): Result<Unit> {
        return invokeVoid("UpdateChatName", parseGuid(serverId), parseGuid(chatId), newName.trim())
    }

    suspend fun updateChatPrivacy(
        serverId: String,
        chatId: String,
        isPrivate: Boolean,
        memberIds: List<UUID> = emptyList(),
        allowedRoleIds: List<UUID> = emptyList(),
    ): Result<Unit> {
        val members = java.util.ArrayList(memberIds)
        val roles = java.util.ArrayList(allowedRoleIds)
        return invokeVoid(
            "UpdateChatPrivacy",
            parseGuid(serverId),
            parseGuid(chatId),
            isPrivate,
            members,
            roles,
        )
    }

    suspend fun deleteChat(serverId: String, chatId: String): Result<Unit> {
        return invokeVoid("DeleteChannel", parseGuid(serverId), parseGuid(chatId))
    }

    suspend fun createCategory(serverId: String, categoryName: String): Result<Unit> {
        return invokeVoid("CreateCategory", parseGuid(serverId), categoryName.trim())
    }

    suspend fun createPrivateCategory(
        serverId: String,
        categoryName: String,
        allowedRoleIds: List<UUID> = emptyList(),
        allowedUserIds: List<UUID> = emptyList(),
    ): Result<Unit> {
        return invokeVoid(
            "CreatePrivateCategory",
            parseGuid(serverId),
            categoryName.trim(),
            java.util.ArrayList(allowedRoleIds),
            java.util.ArrayList(allowedUserIds),
        )
    }

    suspend fun updateCategory(
        serverId: String,
        categoryId: String,
        categoryName: String,
        isPrivate: Boolean,
        allowedRoleIds: List<UUID> = emptyList(),
        allowedUserIds: List<UUID> = emptyList(),
    ): Result<Unit> {
        return invokeVoid(
            "UpdateCategory",
            parseGuid(serverId),
            parseGuid(categoryId),
            categoryName.trim(),
            isPrivate,
            java.util.ArrayList(allowedRoleIds),
            java.util.ArrayList(allowedUserIds),
        )
    }

    suspend fun deleteCategory(serverId: String, categoryId: String): Result<Unit> {
        return invokeVoid("DeleteCategory", parseGuid(serverId), parseGuid(categoryId))
    }

    suspend fun createChat(
        serverId: String,
        categoryId: String?,
        chatName: String,
        chatType: Int,
        isPrivate: Boolean = false,
        memberIds: List<UUID> = emptyList(),
    ): Result<Unit> {
        val parsedCategoryId =
            categoryId?.trim()?.takeIf { it.isNotEmpty() }?.let { parseGuid(it) }
        val members =
            if (memberIds.isEmpty()) null else java.util.ArrayList(memberIds)
        return invokeVoid(
            "CreateChat",
            parseGuid(serverId),
            parsedCategoryId,
            chatName.trim(),
            chatType,
            isPrivate,
            members,
        )
    }

    suspend fun fetchIdeaBoardCards(chatId: String): Result<List<IdeaBoardCard>> {
        return try {
            ensureConnected()
            val deferred = CompletableDeferred<List<IdeaBoardCard>>()
            ideaBoardCardsLoadedDeferred = deferred
            connection?.invoke("GetIdeaBoardCards", parseGuid(chatId))?.blockingAwait()
            val cards = withTimeout(12_000) { deferred.await() }
            Result.success(cards)
        } catch (e: Exception) {
            Log.e("ServerHub", "fetchIdeaBoardCards failed", e)
            Result.failure(e)
        } finally {
            ideaBoardCardsLoadedDeferred = null
        }
    }

    suspend fun createIdeaBoardCard(
        chatId: String,
        title: String,
        body: String,
        tag: String?,
        sourceUrl: String?,
    ): Result<Unit> = invokeVoid(
        "CreateIdeaBoardCard",
        parseGuid(chatId),
        title.trim(),
        body.trim(),
        tag?.trim()?.takeIf { it.isNotEmpty() },
        sourceUrl?.trim()?.takeIf { it.isNotEmpty() },
    )

    suspend fun updateIdeaBoardCard(
        cardId: String,
        title: String,
        body: String,
        tag: String?,
        sourceUrl: String?,
        isFiled: Boolean?,
    ): Result<Unit> = invokeVoid(
        "UpdateIdeaBoardCard",
        parseGuid(cardId),
        title.trim(),
        body.trim(),
        tag?.trim()?.takeIf { it.isNotEmpty() },
        sourceUrl?.trim()?.takeIf { it.isNotEmpty() },
        isFiled,
    )

    suspend fun deleteIdeaBoardCard(cardId: String): Result<Unit> =
        invokeVoid("DeleteIdeaBoardCard", parseGuid(cardId))

    suspend fun fetchAuditLog(
        serverId: String,
        page: Int = 1,
        pageSize: Int = 50,
    ): Result<AuditLogResponse> {
        return try {
            ensureConnected()
            val deferred = CompletableDeferred<AuditLogResponse>()
            auditLogLoadedDeferred = deferred
            connection?.invoke("GetAuditLog", parseGuid(serverId), page, pageSize)?.blockingAwait()
            val payload = withTimeout(12_000) { deferred.await() }
            Result.success(payload)
        } catch (e: Exception) {
            Log.e("ServerHub", "fetchAuditLog failed", e)
            Result.failure(e)
        } finally {
            auditLogLoadedDeferred = null
        }
    }

    private suspend fun invokeVoid(method: String, vararg args: Any?): Result<Unit> {
        return try {
            ensureConnected()
            suspendCancellableCoroutine { continuation ->
                try {
                    connection?.invoke(method, *args)?.blockingAwait()
                    continuation.resume(Unit)
                } catch (error: Exception) {
                    continuation.resumeWithException(error)
                }
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("ServerHub", "$method failed", e)
            Result.failure(e)
        }
    }

    private suspend fun ensureConnected() {
        val userId = connectedUserId?.trim().orEmpty()
        val serverId = connectedServerId?.trim().orEmpty()
        if (userId.isBlank() || serverId.isBlank()) {
            throw IllegalStateException("ServerHub не подключён")
        }
        if (connection?.connectionState != HubConnectionState.CONNECTED) {
            connect(userId, serverId).getOrThrow()
        }
    }

    private fun parseGuid(value: String): UUID = UUID.fromString(value.trim())

    fun disconnect() {
        try {
            reconnectController.disable()
            connectedUserId = null
            connectedServerId = null
            reconnectController.pauseScheduledReconnect = true
            stopConnection(clearConnection = true)
            reconnectController.pauseScheduledReconnect = false
        } catch (e: Exception) {
            Log.e("ServerHub", "Error disconnecting", e)
        }
    }

    fun setOnServerLeft(callback: ((String) -> Unit)?) {
        onServerLeft = callback
    }

    fun setOnServerDeleted(callback: ((String) -> Unit)?) {
        onServerDeleted = callback
    }

    fun setOnServerNameUpdated(callback: ((String, String) -> Unit)?) {
        onServerNameUpdated = callback
    }

    fun setOnError(callback: ((String) -> Unit)?) {
        onError = callback
    }

    fun setOnRolesChanged(callback: (() -> Unit)?) {
        onRolesChanged = callback
    }

    fun setOnUserPermissionsUpdated(callback: ((String) -> Unit)?) {
        onUserPermissionsUpdated = callback
    }

    fun setOnServerStructureChanged(callback: (() -> Unit)?) {
        onServerStructureChanged = callback
    }

    fun setOnMemberNicknameUpdated(callback: ((MemberNicknameUpdatedEvent) -> Unit)?) {
        onMemberNicknameUpdated = callback
    }

    fun setIdeaBoardListener(listener: IdeaBoardListener?) {
        ideaBoardListener = listener
    }
}
