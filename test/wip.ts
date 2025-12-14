/**
 * This script is for manual testing of specific snapshot generation scenarios.
 * Use this during development - just replace the profileId with the one you want to test.
 * To run this script, execute `npm run test:wip`
 */

import { FhirSnapshotGenerator } from 'fhir-snapshot-generator';
const cachePath = './test/.test-cache';

const runTest = async () => {
  const fsg = await FhirSnapshotGenerator.create(
    {
      cachePath, 
      context: ['hl7.fhir.us.core@6.1.0'],
      fhirVersion: '4.0.1',
      cacheMode: 'lazy'
    }
  );
  const snapshot = await fsg.getSnapshot('http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient');
  console.log('Generated snapshot for:', snapshot.url);
  console.log('Snapshot has', snapshot.snapshot?.element?.length, 'elements');
  console.log('Done!');
};

runTest().catch((error) => {
  console.error('Error running WIP test script:', error);
});
