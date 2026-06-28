const MAX_CONCURRENT = 4;
let activeCount = 0;
const waitQueue = [];

const drainQueue = () => {
  while (activeCount < MAX_CONCURRENT && waitQueue.length > 0) {
    const job = waitQueue.shift();
    activeCount += 1;
    Promise.resolve()
      .then(job.run)
      .then(job.resolve)
      .catch(job.reject)
      .finally(() => {
        activeCount -= 1;
        drainQueue();
      });
  }
};

/** Limits parallel decoration asset loads to reduce HTTP/2 burst errors in catalog grids. */
export const enqueueDecorationImageLoad = (run) => new Promise((resolve, reject) => {
  waitQueue.push({ run, resolve, reject });
  drainQueue();
});
