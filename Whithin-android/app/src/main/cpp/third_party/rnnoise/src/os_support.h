#ifndef OS_SUPPORT_H
#define OS_SUPPORT_H

#include <string.h>

#define OPUS_INLINE static inline
#define OPUS_CLEAR(dst, n) (memset((dst), 0, (n) * sizeof(*(dst))))

#endif
