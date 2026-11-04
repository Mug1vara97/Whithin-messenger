package com.whithin.voice.presentation.ui.utils

import com.whithin.voice.data.e2e.E2eConstants
import com.whithin.voice.data.e2e.E2eEnvelope
import com.whithin.voice.data.model.Message

/** Text shown in chat bubbles for E2E messages still loading or pending decrypt. */
fun formatE2eMessageDisplayText(message: Message): String {
    val content = message.contentValue.trim()
    if (message.encryptionVersionValue <= 0) return message.contentValue
    if (E2eEnvelope.isE2eEnvelope(content)) {
        return E2eConstants.ENCRYPTED_PLACEHOLDER
    }
    return message.contentValue
}
