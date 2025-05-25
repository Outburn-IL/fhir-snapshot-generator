/**
 * This script is for manual testing of specific snapshot generation scenarios.
 * Use this during development - just replace the profileId with the one you want to test.
 * To run this script, execute `npm run test:wip`
 */

import { FhirSnapshotGenerator } from 'fhir-snapshot-generator';
import fs from 'fs-extra';
import path from 'path';

const cachePath = './test/.test-cache';

// Replace with the actual profile ID you want to test
const profileId: string = 'SimpleMonopolyExtensionVariation1';

const applyDiffTest = async () => {
  const fsg = await FhirSnapshotGenerator.create({ cachePath, context: ['fsg.test.pkg#0.1.0', 'il.core.fhir.r4#0.17.0'] });
  const snapshot = await fsg.getSnapshot(profileId);
  const original = await fsg.getFpe().resolve({ url: snapshot.url, resourceType: 'StructureDefinition' });
  fs.writeJSONSync(path.join(fsg.getCachePath(), profileId+'-applied-snapshot.json'), snapshot, { spaces: 2 });
  fs.writeJSONSync(path.join(fsg.getCachePath(), profileId+'-compare-snapshot.json'), original, { spaces: 2 });
  console.log('Done!');
  console.log('Output written to:', fsg.getCachePath());
};

applyDiffTest().catch((error) => {
  console.error('Error during diff application:', error);
});
