{
  "targets": [
    {
      "target_name": "game_overlay",
      "sources": [
        "src/game_overlay.cc"
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
              "-luser32",
              "-lkernel32",
              "-lpsapi"
            ]
          }
        ]
      ]
    }
  ]
}
