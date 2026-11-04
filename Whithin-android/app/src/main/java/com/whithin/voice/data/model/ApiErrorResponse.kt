package com.whithin.voice.data.model

import com.google.gson.annotations.SerializedName

data class ApiErrorResponse(
    @SerializedName("error")
    val error: String? = null,
    @SerializedName("Error")
    val errorAlt: String? = null,
    @SerializedName("requiresEmailConfirmation")
    val requiresEmailConfirmation: Boolean? = null,
    @SerializedName("RequiresEmailConfirmation")
    val requiresEmailConfirmationAlt: Boolean? = null,
    @SerializedName("email")
    val email: String? = null,
    @SerializedName("Email")
    val emailAlt: String? = null,
) {
    val message: String?
        get() = error ?: errorAlt

    val needsEmailConfirmation: Boolean
        get() = requiresEmailConfirmation == true || requiresEmailConfirmationAlt == true

    val emailValue: String?
        get() = email ?: emailAlt
}
