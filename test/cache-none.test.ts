import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { FhirSnapshotGenerator } from 'fhir-snapshot-generator';
import { versionedCacheDir } from '../src/utils/misc/getVersionedCacheDir';

describe('No caching of snapshots', async () => {

  const cachePath = './test/.test-cache';
  const context = 'fsg.test.pkg#0.1.0';

  const snapshotCachePath = path.join(cachePath, context, '.fsg.snapshots', versionedCacheDir);
  const dummySnapshot = 'StructureDefinition-ext-hearing-loss.json';

  // delete the snapshot cache directory if it exists
  if (fs.existsSync(snapshotCachePath)) {
    fs.removeSync(snapshotCachePath);
  }
  
  const fsg = await FhirSnapshotGenerator.create({
    cachePath,
    context: [context],
    cacheMode: 'none',
  });

  beforeAll(() => {
    // make sure snapshot cache directory does not exist
    expect(fs.existsSync(snapshotCachePath)).toBe(false);
  }, 240000); // 4min timeout for setup

  it('should not cache the snapshot after generation', async () => {
    // generate a snapshot for a specific StructureDefinition
    await fsg.getSnapshot('http://example.org/StructureDefinition/ext-hearing-loss');
    
    // check that the snapshot cache directory was not created
    expect(fs.existsSync(snapshotCachePath)).toBe(false);
    
  });

  it('should not read the snapshot from cache', async () => {
    // write dummy snapshot to cache path
    fs.ensureDirSync(snapshotCachePath);
    fs.writeJSONSync(path.join(snapshotCachePath, dummySnapshot), {
      resourceType: 'dummy'
    });
    // call getSnapshot again to ensure it does not read from cache
    const sd = await fsg.getSnapshot('http://example.org/StructureDefinition/ext-hearing-loss');
    // ensure the dummy file was not read
    expect(sd).toHaveProperty('resourceType', 'StructureDefinition');
  });
},480000); // 8min timeout for all tests