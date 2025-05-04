import { FhirPackageExplorer } from 'fhir-package-explorer';
import fs from 'fs-extra';
import path from 'path';
import { applyDiffs } from '../src/wip';

const cachePath = './test/.test-cache';

const applyDiffTest = async () => {
  const profileId: string = 'PatientIdentifierDeepDiff';
  const fpe = await FhirPackageExplorer.create({ cachePath, skipExamples: true, context: ['fsg.test.pkg#0.1.0', 'il.core.fhir.r4#0.17.0'] });
  const sd = await fpe.resolve({ id: profileId, resourceType: 'StructureDefinition' });
  const parentSnapshot = await fpe.resolve({ url: sd.baseDefinition, resourceType: 'StructureDefinition' });
  const result = await applyDiffs(parentSnapshot.snapshot.element, sd.differential.element, fpe);
  fs.writeJSONSync(path.join(fpe.getCachePath(), profileId+'-applied-snapshot.json'), result, { spaces: 2 });
  fs.writeJSONSync(path.join(fpe.getCachePath(), profileId+'-compare-snapshot.json'), sd.snapshot.element, { spaces: 2 });
  console.log('Done!');
  console.log('Output written to:', fpe.getCachePath());
};

applyDiffTest().catch((error) => {
  console.error('Error during diff application:', error);
});
