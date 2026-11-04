package com.whithin.voice.di

import android.content.Context
import androidx.room.Room
import com.whithin.voice.data.local.room.ChatMessageDao
import com.whithin.voice.data.local.room.MessengerListCacheDao
import com.whithin.voice.data.local.room.WhithinDatabase
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {
    @Provides
    @Singleton
    fun provideWhithinDatabase(@ApplicationContext context: Context): WhithinDatabase {
        return Room.databaseBuilder(
            context.applicationContext,
            WhithinDatabase::class.java,
            "whithin_messages.db",
        )
            .fallbackToDestructiveMigration()
            .build()
    }

    @Provides
    @Singleton
    fun provideMessengerListCacheDao(database: WhithinDatabase): MessengerListCacheDao {
        return database.messengerListCacheDao()
    }

    @Provides
    @Singleton
    fun provideChatMessageDao(database: WhithinDatabase): ChatMessageDao {
        return database.chatMessageDao()
    }
}
