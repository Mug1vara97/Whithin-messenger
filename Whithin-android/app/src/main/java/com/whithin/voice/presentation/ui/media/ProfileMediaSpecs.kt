package com.whithin.voice.presentation.ui.media

import androidx.compose.ui.unit.dp

/**
 * Recommended asset specs — aligned with web [nameplateHelpers.js] and [avatarDecorationHelpers.js].
 */
object ProfileMediaSpecs {
  const val NAMEPLATE_UI_ENABLED = true

  // Nameplate (Discord-style banner behind username)
  const val NAMEPLATE_WIDTH_PX = 448
  const val NAMEPLATE_HEIGHT_PX = 84
  const val NAMEPLATE_DIMENSION_TOLERANCE_PX = 16
  const val NAMEPLATE_MAX_BYTES = 3 * 1024 * 1024
  /** Static: PNG/JPEG. Animation: WebP only (matches web nameplateHelpers.js). */
  const val NAMEPLATE_ANDROID_PREFERRED_EXT = "webp"

  /** APNG larger than this uses a static first frame to avoid OOM on low-RAM devices. */
  const val MAX_APNG_ANIMATION_BYTES = 1536 * 1024

  /** Animated WebP larger than this uses a static first frame (chat stickers often ~3MB). */
  const val MAX_WEBP_ANIMATION_BYTES = 1536 * 1024

  // Avatar decoration (frame around circular avatar)
  const val AVATAR_DECORATION_ASSET_PX = 256
  const val AVATAR_DECORATION_INNER_HOLE_PX = 160

  // Android UI scales (decoration drawn as avatarSize * scale)
  const val AVATAR_DECORATION_SCALE_DEFAULT = 1.28f

  val MEMBER_LIST_AVATAR_DP = 40.dp
  /** Decorated slot width for member-list action indent (MEMBER_LIST_AVATAR_DP × scale). */
  val MEMBER_LIST_AVATAR_SLOT_DP = 52.dp
  val MEMBER_LIST_NAMEPLATE_MIN_HEIGHT_DP = 48.dp
}
