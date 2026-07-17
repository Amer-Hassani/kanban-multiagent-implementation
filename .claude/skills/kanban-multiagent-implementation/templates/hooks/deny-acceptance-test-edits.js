#!/usr/bin/env node
// Builder may write anything EXCEPT the Planner's acceptance tests. See _path-guard.js.
require('./_path-guard.js').guard('builder-no-acceptance');
