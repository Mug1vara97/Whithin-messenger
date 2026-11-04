package com.whithin.voice.data.repository

import com.whithin.voice.data.api.ProfileApi
import com.whithin.voice.data.model.ProfileUploadResponse
import com.whithin.voice.data.model.ProfileUserRequest
import com.whithin.voice.data.model.UpdateAvatarColorRequest
import com.whithin.voice.data.model.UpdateAvatarDecorationRequest
import com.whithin.voice.data.model.UpdateDisplayNameRequest
import com.whithin.voice.data.model.UpdateDisplayNameResponse
import com.whithin.voice.data.model.UpdateProfileAvatarRequest
import com.whithin.voice.data.model.UpdateProfileBannerRequest
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.ResponseBody
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ProfileRepository @Inject constructor(
    private val profileApi: ProfileApi
) {

    suspend fun uploadAndSaveAvatar(
        userId: String,
        imageBytes: ByteArray,
        mimeType: String,
        fileName: String
    ): Result<Unit> {
        return uploadAndUpdate(
            userId = userId,
            imageBytes = imageBytes,
            mimeType = mimeType,
            fileName = fileName,
            upload = { part -> profileApi.uploadAvatar(part) },
            updatePath = { uid, path -> profileApi.updateAvatar(UpdateProfileAvatarRequest(uid, path)) }
        )
    }

    suspend fun uploadAndSaveBanner(
        userId: String,
        imageBytes: ByteArray,
        mimeType: String,
        fileName: String
    ): Result<Unit> {
        return uploadAndUpdate(
            userId = userId,
            imageBytes = imageBytes,
            mimeType = mimeType,
            fileName = fileName,
            upload = { part -> profileApi.uploadBanner(part) },
            updatePath = { uid, path -> profileApi.updateBanner(UpdateProfileBannerRequest(uid, path)) }
        )
    }

    suspend fun updateAvatarColor(userId: String, color: String): Result<Unit> =
        postAction { profileApi.updateAvatarColor(UpdateAvatarColorRequest(userId, color)) }

    suspend fun updateAvatarDecoration(userId: String, decorationPath: String?): Result<Unit> =
        postAction {
            profileApi.updateAvatarDecoration(
                UpdateAvatarDecorationRequest(
                    userId = userId,
                    avatarDecoration = decorationPath?.trim()?.takeIf { it.isNotEmpty() },
                ),
            )
        }

    suspend fun updateBannerColor(userId: String, color: String): Result<Unit> =
        postAction { profileApi.updateBanner(UpdateProfileBannerRequest(userId, color)) }

    suspend fun removeAvatar(userId: String): Result<Unit> =
        postAction { profileApi.removeAvatar(ProfileUserRequest(userId)) }

    suspend fun removeAvatarDecoration(userId: String): Result<Unit> =
        postAction { profileApi.removeAvatarDecoration(ProfileUserRequest(userId)) }

    suspend fun removeBanner(userId: String): Result<Unit> =
        postAction { profileApi.removeBanner(ProfileUserRequest(userId)) }

    suspend fun updateDisplayName(userId: String, displayName: String?): Result<UpdateDisplayNameResponse> {
        if (userId.isBlank()) {
            return Result.failure(IllegalArgumentException("Пользователь не найден"))
        }
        return try {
            val response = profileApi.updateDisplayName(UpdateDisplayNameRequest(userId, displayName))
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(
                    Exception(response.errorBody()?.string() ?: "Не удалось обновить ник (${response.code()})")
                )
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private suspend fun postAction(
        call: suspend () -> Response<ResponseBody>,
    ): Result<Unit> {
        return try {
            val response = call()
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(
                    Exception(response.errorBody()?.string() ?: "Ошибка (${response.code()})")
                )
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private suspend fun uploadAndUpdate(
        userId: String,
        imageBytes: ByteArray,
        mimeType: String,
        fileName: String,
        upload: suspend (MultipartBody.Part) -> Response<ProfileUploadResponse>,
        updatePath: suspend (String, String) -> Response<ResponseBody>
    ): Result<Unit> {
        if (userId.isBlank()) return Result.failure(IllegalArgumentException("Пользователь не найден"))
        val media = mimeType.ifBlank { "application/octet-stream" }.toMediaTypeOrNull()
            ?: return Result.failure(IllegalArgumentException("Неверный тип файла"))
        val safeName = fileName.ifBlank { "image.jpg" }
        val body = imageBytes.toRequestBody(media)
        val part = MultipartBody.Part.createFormData("file", safeName, body)

        val uploadResp = try {
            upload(part)
        } catch (e: Exception) {
            return Result.failure(e)
        }
        if (!uploadResp.isSuccessful) {
            return Result.failure(
                Exception(uploadResp.errorBody()?.string() ?: "Ошибка загрузки (${uploadResp.code()})")
            )
        }
        val relativeUrl = uploadResp.body()?.url?.trim()
        if (relativeUrl.isNullOrEmpty()) {
            return Result.failure(Exception("Сервер не вернул URL файла"))
        }

        val updateResp = try {
            updatePath(userId, relativeUrl)
        } catch (e: Exception) {
            return Result.failure(e)
        }
        return if (updateResp.isSuccessful) {
            Result.success(Unit)
        } else {
            Result.failure(
                Exception(updateResp.errorBody()?.string() ?: "Не удалось сохранить профиль (${updateResp.code()})")
            )
        }
    }
}
