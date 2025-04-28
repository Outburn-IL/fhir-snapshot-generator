import { buildTreeFromSnapshot, flattenTreeToSnapshot } from '../src/wip/sdTransformer';
import { FhirPackageExplorer } from 'fhir-package-explorer';
import fs from 'fs-extra';
import path from 'path';
import { applyDiffToTree } from '../src/wip/applyDiff';
import { ElementDefinition } from '../src/wip/types';

const cachePath = './test/.test-cache';

const getSnapshot = async (fpe: FhirPackageExplorer, idOrUrl: string): Promise<ElementDefinition[]> => {
  // if the string starts with 'http:', it is a url, otherwise it is an id
  console.log('getSnapshot', idOrUrl);
  const isUrl = idOrUrl.startsWith('http:') || idOrUrl.startsWith('https:');
  const snapshot = isUrl
    ? await fpe.resolve({ url: idOrUrl, resourceType: 'StructureDefinition' })
    : await fpe.resolve({ id: idOrUrl, resourceType: 'StructureDefinition' });
  return snapshot.snapshot.element;
};

const applyDiffTest = async () => {
  const profileId: string = 'ComplexLiberalExtension';
  const fpe = await FhirPackageExplorer.create({ cachePath, skipExamples: true, context: ['fsg.test.pkg#0.1.0'] });
  const snapshot = await fpe.resolve({ id: profileId, resourceType: 'StructureDefinition' });
  const parentSnapshot = await fpe.resolve({ url: snapshot.baseDefinition, resourceType: 'StructureDefinition' });
  const tree = buildTreeFromSnapshot(parentSnapshot.snapshot.element);
  const resTree = await applyDiffToTree(tree, snapshot.differential.element, async (idOrUrl) => await getSnapshot(fpe, idOrUrl), (msg: string) => console.log(msg));
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
