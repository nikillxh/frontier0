import { runScenario } from '../scenario.js';

// Run the full solver/verifier swarm and finalize open bounties.
runScenario({ finalize: true })
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
