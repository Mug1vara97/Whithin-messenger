package com.whithin.voice.di

import android.content.Context
import android.os.Build
import coil.ImageLoader
import coil.decode.GifDecoder
import coil.decode.ImageDecoderDecoder
import coil.disk.DiskCache
import coil.memory.MemoryCache
import com.whithin.voice.presentation.ui.media.AnimatedWebpCoilDecoder
import com.whithin.voice.presentation.ui.media.ApngCoilDecoder
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.whithin.voice.data.api.E2eApi
import com.whithin.voice.data.api.AuthApi
import com.whithin.voice.data.api.ChatApi
import com.whithin.voice.data.api.FeedApi
import com.whithin.voice.data.api.FriendApi
import com.whithin.voice.data.api.MediaApi
import com.whithin.voice.data.api.ProfileApi
import com.whithin.voice.data.api.NotificationApi
import com.whithin.voice.data.api.ServerApi
import com.whithin.voice.data.api.StickerApi
import com.whithin.voice.data.api.UserApi
import com.whithin.voice.data.api.VoiceApi
import com.whithin.voice.BuildConfig
import com.whithin.voice.data.e2e.E2eCryptoService
import com.whithin.voice.data.local.AuthInterceptor
import com.whithin.voice.data.local.E2eKeyStore
import com.whithin.voice.data.local.NetworkRetryInterceptor
import com.whithin.voice.data.local.ServerListLocalStore
import com.whithin.voice.data.local.TokenManager
import com.whithin.voice.data.local.UserProfileQuickStore
import com.whithin.voice.data.repository.AuthRepository
import com.whithin.voice.data.repository.ProfileRepository
import com.whithin.voice.data.repository.FriendRepository
import com.whithin.voice.data.repository.PresenceRepository
import com.whithin.voice.data.repository.ServerDetailRepository
import com.whithin.voice.data.repository.ServerRepository
import com.whithin.voice.data.repository.VoiceRepository
import com.whithin.voice.data.signalr.ChatHub
import com.whithin.voice.data.signalr.ChatListHub
import com.whithin.voice.presentation.notifications.ChatNotificationManager
import com.whithin.voice.data.signalr.FriendHub
import com.whithin.voice.data.signalr.NotificationHub
import com.whithin.voice.data.signalr.ServerListHub
import com.whithin.voice.data.socketio.VoiceSocketService
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    
    @Provides
    @Singleton
    fun provideContext(@ApplicationContext context: Context): Context = context

    @Provides
    @Singleton
    fun provideImageLoader(
        @ApplicationContext context: Context,
        authInterceptor: AuthInterceptor,
    ): ImageLoader {
        // Отдельный OkHttp: Bearer для /uploads, без BODY-логирования (иначе debug
        // «висит» на больших фото) + retry. Disk до 512 МБ — чат-фото не вытесняются.
        val imageHttp =
            OkHttpClient.Builder()
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(45, TimeUnit.SECONDS)
                .writeTimeout(45, TimeUnit.SECONDS)
                .callTimeout(60, TimeUnit.SECONDS)
                .retryOnConnectionFailure(true)
                .addInterceptor(authInterceptor)
                .addInterceptor(NetworkRetryInterceptor())
                .build()
        return ImageLoader.Builder(context)
            .okHttpClient(imageHttp)
            .memoryCache {
                MemoryCache.Builder(context)
                    .maxSizePercent(0.28)
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(context.cacheDir.resolve("coil_image_cache"))
                    .maxSizeBytes(512L * 1024L * 1024L)
                    .build()
            }
            .components {
                add(ApngCoilDecoder.Factory())
                add(AnimatedWebpCoilDecoder.Factory())
                if (Build.VERSION.SDK_INT >= 28) {
                    add(ImageDecoderDecoder.Factory())
                } else {
                    add(GifDecoder.Factory())
                }
            }
            .crossfade(false)
            .respectCacheHeaders(false)
            .build()
    }
    
    private const val BASE_URL = "https://whithin.ru"
    
    @Provides
    @Singleton
    fun provideTokenManager(@ApplicationContext context: Context): TokenManager {
        return TokenManager(context)
    }
    
    @Provides
    @Singleton
    fun provideAuthInterceptor(tokenManager: TokenManager): AuthInterceptor {
        return AuthInterceptor(tokenManager)
    }
    
    @Provides
    @Singleton
    fun provideOkHttpClient(
        authInterceptor: AuthInterceptor
    ): OkHttpClient {
        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level =
                if (BuildConfig.DEBUG) {
                    HttpLoggingInterceptor.Level.BODY
                } else {
                    HttpLoggingInterceptor.Level.NONE
                }
        }
        
        return OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(NetworkRetryInterceptor())
            .addInterceptor(loggingInterceptor)
            .connectTimeout(45, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .callTimeout(90, TimeUnit.SECONDS)
            .build()
    }
    
    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient, gson: Gson): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()
    }
    
    @Provides
    @Singleton
    fun provideAuthApi(retrofit: Retrofit): AuthApi {
        return retrofit.create(AuthApi::class.java)
    }
    
    @Provides
    @Singleton
    fun provideE2eApi(retrofit: Retrofit): E2eApi {
        return retrofit.create(E2eApi::class.java)
    }

    @Provides
    @Singleton
    fun provideE2eKeyStore(
        @ApplicationContext context: Context,
        gson: Gson,
    ): E2eKeyStore {
        return E2eKeyStore(context, gson)
    }

    @Provides
    @Singleton
    fun provideE2eCryptoService(
        e2eApi: E2eApi,
        keyStore: E2eKeyStore,
        gson: Gson,
    ): E2eCryptoService {
        return E2eCryptoService(e2eApi, keyStore, gson)
    }

    @Provides
    @Singleton
    fun provideChatApi(retrofit: Retrofit): ChatApi {
        return retrofit.create(ChatApi::class.java)
    }

    @Provides
    @Singleton
    fun provideFriendApi(retrofit: Retrofit): FriendApi {
        return retrofit.create(FriendApi::class.java)
    }

    @Provides
    @Singleton
    fun provideFeedApi(retrofit: Retrofit): FeedApi {
        return retrofit.create(FeedApi::class.java)
    }
    
    @Provides
    @Singleton
    fun provideVoiceApi(retrofit: Retrofit): VoiceApi {
        return retrofit.create(VoiceApi::class.java)
    }
    
    @Provides
    @Singleton
    fun provideServerApi(retrofit: Retrofit): ServerApi {
        return retrofit.create(ServerApi::class.java)
    }
    
    @Provides
    @Singleton
    fun provideMediaApi(retrofit: Retrofit): MediaApi {
        return retrofit.create(MediaApi::class.java)
    }

    @Provides
    @Singleton
    @StickerUploadClient
    fun provideStickerUploadOkHttpClient(authInterceptor: AuthInterceptor): OkHttpClient {
        return OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .connectTimeout(2, TimeUnit.MINUTES)
            .readTimeout(30, TimeUnit.MINUTES)
            .writeTimeout(30, TimeUnit.MINUTES)
            .build()
    }

    @Provides
    @Singleton
    @StickerUploadClient
    fun provideStickerUploadRetrofit(
        @StickerUploadClient okHttpClient: OkHttpClient,
        gson: Gson,
    ): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()
    }

    @Provides
    @Singleton
    fun provideStickerApi(@StickerUploadClient retrofit: Retrofit): StickerApi {
        return retrofit.create(StickerApi::class.java)
    }

    @Provides
    @Singleton
    fun provideProfileApi(retrofit: Retrofit): ProfileApi {
        return retrofit.create(ProfileApi::class.java)
    }

    @Provides
    @Singleton
    fun provideProfileRepository(profileApi: ProfileApi): ProfileRepository {
        return ProfileRepository(profileApi)
    }

    @Provides
    @Singleton
    fun provideNotificationApi(retrofit: Retrofit): NotificationApi {
        return retrofit.create(NotificationApi::class.java)
    }

    @Provides
    @Singleton
    fun provideUserApi(retrofit: Retrofit): UserApi {
        return retrofit.create(UserApi::class.java)
    }
    
    @Provides
    @Singleton
    fun provideAuthRepository(
        authApi: AuthApi,
        userApi: UserApi,
        tokenManager: TokenManager,
        userProfileQuickStore: UserProfileQuickStore,
        gson: Gson,
    ): AuthRepository {
        return AuthRepository(authApi, userApi, tokenManager, userProfileQuickStore, gson)
    }
    
    @Provides
    @Singleton
    fun provideGson(): Gson {
        return GsonBuilder()
            .setLenient()
            .serializeNulls()
            .registerTypeAdapter(
                object : com.google.gson.reflect.TypeToken<List<String>>() {}.type,
                com.whithin.voice.data.model.GuidListTypeAdapter()
            )
            .create()
    }
    
    @Provides
    @Singleton
    fun provideChatListHub(
        tokenManager: TokenManager,
        gson: Gson,
    ): ChatListHub {
        return ChatListHub(tokenManager, gson)
    }
    
    @Provides
    @Singleton
    fun provideChatHub(
        tokenManager: TokenManager,
        gson: Gson
    ): ChatHub {
        return ChatHub(tokenManager, gson)
    }
    
    @Provides
    @Singleton
    fun provideServerListHub(
        tokenManager: TokenManager,
        gson: Gson
    ): ServerListHub {
        return ServerListHub(tokenManager, gson)
    }

    @Provides
    @Singleton
    fun provideFriendHub(
        tokenManager: TokenManager
    ): FriendHub {
        return FriendHub(tokenManager)
    }

    @Provides
    @Singleton
    fun provideNotificationHub(
        tokenManager: TokenManager,
        gson: Gson
    ): NotificationHub {
        return NotificationHub(tokenManager, gson)
    }
    
    
    @Provides
    @Singleton
    fun provideServerRepository(
        serverListHub: ServerListHub,
        serverApi: ServerApi,
        serverListLocalStore: ServerListLocalStore,
        tokenManager: TokenManager,
    ): ServerRepository {
        return ServerRepository(serverListHub, serverApi, serverListLocalStore, tokenManager)
    }

    @Provides
    @Singleton
    fun provideFriendRepository(
        friendApi: FriendApi,
        friendHub: FriendHub,
        presenceRepository: PresenceRepository
    ): FriendRepository {
        return FriendRepository(friendApi, friendHub, presenceRepository)
    }

    @Provides
    @Singleton
    fun providePresenceRepository(
        userApi: UserApi,
        notificationHub: NotificationHub
    ): PresenceRepository {
        return PresenceRepository(userApi, notificationHub)
    }
    
    @Provides
    @Singleton
    fun provideVoiceSocketService(
        tokenManager: TokenManager
    ): VoiceSocketService {
        return VoiceSocketService(tokenManager)
    }
    
    @Provides
    @Singleton
    fun provideVoiceRepository(
        api: VoiceApi,
        voiceSocketService: VoiceSocketService
    ): VoiceRepository {
        return VoiceRepository(api, voiceSocketService)
    }
    
    @Provides
    @Singleton
    fun provideServerDetailRepository(
        serverApi: ServerApi,
        gson: Gson
    ): ServerDetailRepository {
        return ServerDetailRepository(serverApi, gson)
    }
}
