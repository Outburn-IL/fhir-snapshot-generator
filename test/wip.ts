/**
 * This script is for manual testing of specific snapshot generation scenarios.
 * Use this during development - just replace the profileId with the one you want to test.
 * To run this script, execute `npm run test:wip`
 */

import { FhirSnapshotGenerator } from 'fhir-snapshot-generator';
// import fs from 'fs-extra';
// import path from 'path';

const cachePath = './test/.test-cache';

// Replace with the actual profile ID you want to test
// const profileId: string = 'SimpleMonopolyExtensionVariation2';

const applyDiffTest = async () => {
  // const fsg = await FhirSnapshotGenerator.create({ cachePath, context: [
  await FhirSnapshotGenerator.create({ cachePath, context: [
    'hl7.fhir.us.core#6.1.0',
    'hl7.fhir.us.davinci-pdex',
    'hl7.fhir.us.davinci-pas#2.0.1',
    'de.gematik.epa.medication@1.0.2-rc1'
  ], cacheMode: 'rebuild' });
  // const snapshot = await fsg.getSnapshot(profileId);
  // const original = await fsg.getFpe().resolve({ url: snapshot.url, resourceType: 'StructureDefinition' });
  // fs.writeJSONSync(path.join(fsg.getCachePath(), profileId+'-applied-snapshot.json'), snapshot, { spaces: 2 });
  // fs.writeJSONSync(path.join(fsg.getCachePath(), profileId+'-compare-snapshot.json'), original, { spaces: 2 });
  console.log('Done!');
  // console.log('Output written to:', fsg.getCachePath());
};

applyDiffTest().catch((error) => {
  console.error('Error running WIP test script:', error);
});
