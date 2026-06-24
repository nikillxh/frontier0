import { runScenario } from '../scenario.js';

console.log('=== FRONTIER0 end-to-end scenario ===');
runScenario({ finalize: true, assert: true })
  .then(() => {
    console.log('=== E2E PASSED ===');
    process.exit(0);
  })
  .catch((e) => {
    console.error('=== E2E FAILED ===');
    console.error(e);
    process.exit(1);
  });
