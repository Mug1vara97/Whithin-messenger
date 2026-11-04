package com.whithin.voice.data.api

import com.whithin.voice.data.model.AddFeedCommentRequest
import com.whithin.voice.data.model.FeedCommentDto
import com.whithin.voice.data.model.FeedPostDto
import com.whithin.voice.data.model.SetFeedReactionRequest
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

interface FeedApi {
    @GET("/api/feed")
    suspend fun getFeed(@Query("take") take: Int = 50): Response<List<FeedPostDto>>

    @GET("/api/feed/{postId}")
    suspend fun getPost(@Path("postId") postId: String): Response<FeedPostDto>

    @GET("/api/feed/servers/{serverId}")
    suspend fun getServerPosts(
        @Path("serverId") serverId: String,
        @Query("take") take: Int = 50,
    ): Response<List<FeedPostDto>>

    @Multipart
    @POST("/api/feed")
    suspend fun createPost(
        @Part("title") title: RequestBody?,
        @Part("text") text: RequestBody,
        @Part("scope") scope: RequestBody,
        @Part("serverId") serverId: RequestBody? = null,
        @Part files: List<MultipartBody.Part>,
    ): Response<FeedPostDto>

    @PUT("/api/feed/{postId}/reaction")
    suspend fun setReaction(
        @Path("postId") postId: String,
        @Body request: SetFeedReactionRequest,
    ): Response<FeedPostDto>

    @GET("/api/feed/{postId}/comments")
    suspend fun getComments(
        @Path("postId") postId: String,
        @Query("take") take: Int = 500,
    ): Response<List<FeedCommentDto>>

    @POST("/api/feed/{postId}/comments")
    suspend fun addComment(
        @Path("postId") postId: String,
        @Body request: AddFeedCommentRequest,
    ): Response<FeedCommentDto>

    @PUT("/api/feed/comments/{commentId}/reaction")
    suspend fun setCommentReaction(
        @Path("commentId") commentId: String,
        @Body request: SetFeedReactionRequest,
    ): Response<FeedCommentDto>

    @DELETE("/api/feed/{postId}")
    suspend fun deletePost(@Path("postId") postId: String): Response<ResponseBody>

    @DELETE("/api/feed/comments/{commentId}")
    suspend fun deleteComment(@Path("commentId") commentId: String): Response<ResponseBody>
}
