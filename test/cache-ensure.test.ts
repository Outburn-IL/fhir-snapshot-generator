import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { FhirSnapshotGenerator } from 'fhir-snapshot-generator';
import { FhirPackageExplorer } from 'fhir-package-explorer';
import { versionedCacheDir } from '../src/utils/misc/getVersionedCacheDir';

describe('Ensure all snapshots in context', async () => {

  const cachePath = './test/.test-cache';
  const context = 'fsg.test.pkg#0.1.0';

  const pkgCachePath = path.join(cachePath, context, 'package');
  const snapshotCachePath = path.join(cachePath, context, '.fsg.snapshots', versionedCacheDir);
  const dummySnapshot = 'StructureDefinition-ext-hearing-loss.snapshot';

  beforeAll(async () => {
    // delete the snapshot cache directory if it exists
    if (fs.existsSync(snapshotCachePath)) {
      fs.removeSync(snapshotCachePath);
    }

    // create a single dummy snapshot cache file to make sure it is not overwritten
    fs.ensureDirSync(snapshotCachePath);
    
    fs.writeJSONSync(path.join(snapshotCachePath, dummySnapshot), {
      resourceType: 'dummy'
    });
    
    const fpe = await FhirPackageExplorer.create({
      cachePath,
      context: [context],
      skipExamples: true
    });

    await FhirSnapshotGenerator.create({
      fpe,
      fhirVersion: '4.0.1',
      cacheMode: 'ensure',
    });
  }, 240000); // 4min timeout for setup

  // check that the snapshot cache contains the same filenames as the package itself
  it('should have all snapshots for the entire package cached', async () => {
    const packageFiles = fs.readdirSync(pkgCachePath).filter(file => file.startsWith('StructureDefinition-') && file.endsWith('.json'));
    const snapshotFiles = fs.readdirSync(snapshotCachePath).filter(file => file.startsWith('StructureDefinition-') && file.endsWith('.snapshot'));

    const expectedSnapshotFiles = packageFiles.map(file => `${path.parse(file).name}.snapshot`);

    expect(snapshotFiles.length).toBe(expectedSnapshotFiles.length);
    expect(snapshotFiles.sort()).toEqual(expectedSnapshotFiles.sort());
  });

  afterAll(async () => {
    // ensure the dummy file was not overwritten
    const dummy = fs.readJSONSync(path.join(snapshotCachePath, dummySnapshot));
    expect(dummy).toHaveProperty('resourceType', 'dummy');
    // delete the dummy snapshot cache file
    fs.removeSync(path.join(snapshotCachePath, dummySnapshot));
  });

},480000); // 8min timeout for all tests