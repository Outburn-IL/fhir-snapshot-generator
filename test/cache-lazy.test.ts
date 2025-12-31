import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { FhirSnapshotGenerator } from 'fhir-snapshot-generator';
import { FhirPackageExplorer } from 'fhir-package-explorer';
import { versionedCacheDir } from '../src/utils/misc/getVersionedCacheDir';

describe('Lazy caching of snapshots', async () => {

  const cachePath = './test/.test-cache';
  const context = 'fsg.test.pkg#0.1.0';

  const snapshotCachePath = path.join(cachePath, context, '.fsg.snapshots', versionedCacheDir);
  const dummySnapshot = 'StructureDefinition-ext-hearing-loss.json';

  // delete the snapshot cache directory if it exists
  if (fs.existsSync(snapshotCachePath)) {
    fs.removeSync(snapshotCachePath);
  }
  
  const fpe = await FhirPackageExplorer.create({
    cachePath,
    context: [context],
    skipExamples: true
  });

  const fsg = await FhirSnapshotGenerator.create({
    fpe,
    fhirVersion: '4.0.1',
    cacheMode: 'lazy',
  });

  beforeAll(() => {
    // make sure snapshot cache directory does not exist
    expect(fs.existsSync(snapshotCachePath)).toBe(false);
  }, 240000); // 4min timeout for setup

  it('should cache the snapshot after generation', async () => {
    // generate a snapshot for a specific StructureDefinition
    await fsg.getSnapshot('http://example.org/StructureDefinition/ext-hearing-loss');
    
    // check that the snapshot cache directory was created
    expect(fs.existsSync(snapshotCachePath)).toBe(true);
    
    // check that the snapshot file exists
    const snapshotFile = path.join(snapshotCachePath, dummySnapshot);
    expect(fs.existsSync(snapshotFile)).toBe(true);
  });

  afterAll(async () => {
    // override with a dummy snapshot cache file to ensure it is not overwritten
    fs.writeJSONSync(path.join(snapshotCachePath, dummySnapshot), {
      resourceType: 'dummy'
    });
    // re-generate the snapshot
    await fsg.getSnapshot('http://example.org/StructureDefinition/ext-hearing-loss');
    // ensure the dummy file was not overwritten
    it('should leave the dummy snapshot cache file untouched', () => {
      expect(fs.readFileSync(path.join(snapshotCachePath, dummySnapshot), 'utf8')).toHaveProperty('resourceType', 'dummy');
    });
    // delete the dummy snapshot cache file
    fs.removeSync(path.join(snapshotCachePath, dummySnapshot));
  });

},480000); // 8min timeout for all tests