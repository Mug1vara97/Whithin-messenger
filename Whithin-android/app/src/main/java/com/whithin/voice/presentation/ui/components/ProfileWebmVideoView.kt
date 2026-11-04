package com.whithin.voice.presentation.ui.components

import android.graphics.Color as AndroidColor
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.whithin.voice.presentation.ui.media.ProfileMediaLogger

@UnstableApi
@Composable
internal fun ProfileWebmVideoView(
    url: String,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
) {
    val context = LocalContext.current
    var player by remember(url) { mutableStateOf<ExoPlayer?>(null) }
    val resizeMode =
        remember(contentScale) {
            when (contentScale) {
                ContentScale.Crop -> AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                ContentScale.FillBounds -> AspectRatioFrameLayout.RESIZE_MODE_FILL
                ContentScale.Inside -> AspectRatioFrameLayout.RESIZE_MODE_FIT
                else -> AspectRatioFrameLayout.RESIZE_MODE_FIT
            }
        }

    DisposableEffect(url) {
        val exoPlayer =
            ExoPlayer.Builder(context)
                .setRenderersFactory(
                    DefaultRenderersFactory(context)
                        .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_PREFER),
                )
                .build()
                .apply {
                    repeatMode = Player.REPEAT_MODE_ONE
                    volume = 0f
                    playWhenReady = true
                }

        val listener =
            object : Player.Listener {
                override fun onPlaybackStateChanged(playbackState: Int) {
                    if (playbackState == Player.STATE_READY) {
                        ProfileMediaLogger.d("webm exoplayer ready url=$url")
                    }
                }

                override fun onPlayerError(error: PlaybackException) {
                    ProfileMediaLogger.e("webm exoplayer error url=$url", error)
                }
            }
        exoPlayer.addListener(listener)
        exoPlayer.setMediaItem(MediaItem.fromUri(url))
        exoPlayer.prepare()
        player = exoPlayer
        ProfileMediaLogger.d("webm exoplayer create url=$url")

        onDispose {
            exoPlayer.removeListener(listener)
            runCatching { exoPlayer.release() }
                .onFailure { error ->
                    ProfileMediaLogger.e("webm exoplayer release failed url=$url", error)
                }
            player = null
            ProfileMediaLogger.d("webm exoplayer release url=$url")
        }
    }

    val activePlayer = player ?: return

    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            PlayerView(ctx).apply {
                useController = false
                setShutterBackgroundColor(AndroidColor.TRANSPARENT)
                setBackgroundColor(AndroidColor.TRANSPARENT)
                this.resizeMode = resizeMode
                this.player = activePlayer
            }
        },
        update = { playerView ->
            playerView.resizeMode = resizeMode
            if (playerView.player != activePlayer) {
                playerView.player = activePlayer
            }
        },
        onRelease = { playerView ->
            playerView.player = null
        },
    )
}
