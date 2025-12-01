/**
 * This script is for manual testing of specific snapshot generation scenarios.
 * Use this during development - just replace the profileId with the one you want to test.
 * To run this script, execute `npm run test:wip`
 */

import { FhirSnapshotGenerator } from 'fhir-snapshot-generator';
const cachePath = './test/.test-cache';

const runTest = async () => {
  // const fsg = await FhirSnapshotGenerator.create({ cachePath, context: [
  const fsg = await FhirSnapshotGenerator.create(
    {
      cachePath, context: ['il.core.fhir.r4#0.19.1'],
      cacheMode: 'none'
    }
  );
  const expansion = await fsg.expandValueSet('ILCoreJurisdiction');
  // const original = await fsg.getFpe().resolve({ url: snapshot.url, resourceType: 'StructureDefinition' });
  // fs.writeJSONSync(path.join(fsg.getCachePath(), profileId+'-applied-snapshot.json'), snapshot, { spaces: 2 });
  // fs.writeJSONSync(path.join(fsg.getCachePath(), profileId+'-compare-snapshot.json'), original, { spaces: 2 });
  console.log('Expansion contains', expansion.expansion?.contains?.length, 'codes');
  console.log('Done!');
  // console.log('Output written to:', fsg.getCachePath());
};

runTest().catch((error) => {
  console.error('Error running WIP test script:', error);
});
