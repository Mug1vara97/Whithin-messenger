package com.whithin.voice.presentation.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CutCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.whithin.voice.presentation.ui.theme.IsNeoVectorheartTheme
import com.whithin.voice.presentation.ui.theme.LocalAppThemePreset
import com.whithin.voice.presentation.ui.theme.NeoVectorheartPanelBorder

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatBottomSheet(
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    val sheetBackground = LocalAppThemePreset.current.serverListBackground
    val isNeoVectorheart = IsNeoVectorheartTheme
    val sheetShape =
        if (isNeoVectorheart) {
            CutCornerShape(topStart = 22.dp, topEnd = 8.dp)
        } else {
            RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp)
        }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        modifier =
            modifier.then(
                if (isNeoVectorheart) {
                    Modifier
                        .shadow(10.dp, sheetShape)
                        .border(1.dp, NeoVectorheartPanelBorder, sheetShape)
                } else {
                    Modifier
                },
            ),
        containerColor = sheetBackground,
        dragHandle = null,
        scrimColor = Color.Black.copy(alpha = 0.28f),
        shape = sheetShape,
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .padding(top = 10.dp, bottom = 10.dp),
        ) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.CenterHorizontally)
                        .width(44.dp)
                        .height(4.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(MaterialTheme.colorScheme.onSurface.copy(alpha = 0.22f)),
            )
            Spacer(Modifier.height(10.dp))
            content()
        }
    }
}
