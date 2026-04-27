{
  "targets": [
    {
      "target_name": "windows_audio_capture",
      "sources": [
        "src/windows_audio_capture.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": [
        "NAPI_CPP_EXCEPTIONS"
      ],
      "cflags_cc": [
        "/std:c++17"
      ],
      "conditions": [
        [
          "OS=='win'",
          {
            "libraries": [
              "-lole32",
              "-luuid",
              "-luser32"
            ]
          }
        ]
      ]
    }
  ]
}
