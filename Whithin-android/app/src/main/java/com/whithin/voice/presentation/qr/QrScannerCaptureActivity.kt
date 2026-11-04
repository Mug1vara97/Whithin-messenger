package com.whithin.voice.presentation.qr

import android.os.Bundle
import android.view.View
import android.widget.ImageButton
import com.journeyapps.barcodescanner.CaptureActivity
import com.whithin.voice.R

class QrScannerCaptureActivity : CaptureActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        findViewById<ImageButton>(R.id.qr_scanner_back)?.setOnClickListener { finish() }
        findViewById<View>(R.id.zxing_status_view)?.visibility = View.GONE
    }
}
