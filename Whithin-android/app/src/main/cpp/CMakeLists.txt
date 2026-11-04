cmake_minimum_required(VERSION 3.22.1)
project("whithin_rnnoise")

set(RNNOISE_DIR ${CMAKE_SOURCE_DIR}/third_party/rnnoise)

add_library(
    rnnoise
    STATIC
    ${RNNOISE_DIR}/src/celt_lpc.c
    ${RNNOISE_DIR}/src/denoise.c
    ${RNNOISE_DIR}/src/kiss_fft.c
    ${RNNOISE_DIR}/src/nnet.c
    ${RNNOISE_DIR}/src/nnet_default.c
    ${RNNOISE_DIR}/src/parse_lpcnet_weights.c
    ${RNNOISE_DIR}/src/pitch.c
    ${RNNOISE_DIR}/src/rnn.c
    ${RNNOISE_DIR}/src/rnnoise_data.c
    ${RNNOISE_DIR}/src/rnnoise_tables.c
)

target_include_directories(
    rnnoise
    PUBLIC
    ${RNNOISE_DIR}/include
    ${RNNOISE_DIR}/src
)

target_compile_options(rnnoise PRIVATE -O3)
target_compile_definitions(rnnoise PRIVATE FLOAT_APPROX=1)

add_library(whithin_rnnoise_jni SHARED rnnoise_jni.cpp)

target_include_directories(
    whithin_rnnoise_jni
    PRIVATE
    ${RNNOISE_DIR}/include
)

target_link_libraries(
    whithin_rnnoise_jni
    rnnoise
    log
)
