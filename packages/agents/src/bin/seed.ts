import { runScenario } from '../scenario.js';

runScenario({ finalize: true })
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
