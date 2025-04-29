import { buildTreeFromSnapshot, flattenTreeToSnapshot } from '../src/wip/sdTransformer';
import { FhirPackageExplorer } from 'fhir-package-explorer';
import fs from 'fs-extra';
import path from 'path';
import { applyDiffToTree } from '../src/wip/applyDiff';

const cachePath = './test/.test-cache';

const applyDiffTest = async () => {
  const profileId: string = 'il-core-patient';
  const fpe = await FhirPackageExplorer.create({ cachePath, skipExamples: true, context: ['fsg.test.pkg#0.1.0', 'il.core.fhir.r4#0.17.0'] });
  const snapshot = await fpe.resolve({ id: profileId, resourceType: 'StructureDefinition' });
  const parentSnapshot = await fpe.resolve({ url: snapshot.baseDefinition, resourceType: 'StructureDefinition' });
  const tree = buildTreeFromSnapshot(parentSnapshot.snapshot.element);
  const resTree = await applyDiffToTree(tree, snapshot.differential.element, fpe);
  fs.writeJSONSync(path.join(fpe.getCachePath(), profileId+'-applied-tree.json'), resTree, { spaces: 2 });
  const flattenedSnapshot = flattenTreeToSnapshot(resTree);
  fs.writeJSONSync(path.join(fpe.getCachePath(), profileId+'-applied-snapshot.json'), flattenedSnapshot, { spaces: 2 });
  fs.writeJSONSync(path.join(fpe.getCachePath(), profileId+'-compare-snapshot.json'), snapshot.snapshot.element, { spaces: 2 });
  console.log('Done!');
  console.log('Output written to:', fpe.getCachePath());
};

applyDiffTest().catch((error) => {
  console.error('Error during diff application:', error);
});
