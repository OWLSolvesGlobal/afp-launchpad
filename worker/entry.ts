/**
 * The deployed entry point. It exports the handler and nothing else: the
 * Workers runtime (and `wrangler dev`) reject an entry module that also
 * exports constants or helpers, which ./index.ts does for the tests.
 */
import worker from "./index";

export default worker;
