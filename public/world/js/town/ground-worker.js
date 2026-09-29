// Builds some of the town's ground chunks off the main thread (see ground.js): the arrays go back by transfer.
import { chunkArrays, transfers } from './ground.js';

onmessage = (e) => {
  try {
    const out = chunkArrays({ plots: e.data.plots, list: e.data.list });
    postMessage(out, out.chunks.flatMap(transfers));
  } catch (err) { postMessage({ error: err.message }); }
};
