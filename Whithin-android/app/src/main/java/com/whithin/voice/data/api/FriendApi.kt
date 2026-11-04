package com.whithin.voice.data.api

import com.whithin.voice.data.model.FriendInfo
import com.whithin.voice.data.model.FriendRequestsResponse
import com.whithin.voice.data.model.UserSearchInfo
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Query

interface FriendApi {
    @GET("/api/Friends")
    suspend fun getFriends(): Response<List<FriendInfo>>

    @GET("/api/Friends/requests")
    suspend fun getFriendRequests(): Response<FriendRequestsResponse>

    @GET("/api/User/search")
    suspend fun searchUsers(@Query("name") name: String): Response<List<UserSearchInfo>>
}
