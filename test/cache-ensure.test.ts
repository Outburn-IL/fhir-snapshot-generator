/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { FhirSnapshotGenerator } from 'fhir-snapshot-generator';
import { versionedCacheDir } from '../src/utils/misc/getVersionedCacheDir';

describe('Ensure all snapshots in context', async () => {

  const cachePath = './test/.test-cache';
  const context = 'fsg.test.pkg#0.1.0';

  const pkgCachePath = path.join(cachePath, context, 'package');
  const snapshotCachePath = path.join(cachePath, context, '.fsg.snapshots', versionedCacheDir);
  const dummySnapshot = 'StructureDefinition-ext-hearing-loss.json';

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
    const fsg = await FhirSnapshotGenerator.create({
      cachePath,
      context: [context],
      cacheMode: 'ensure',
    });
  }, 240000); // 4min timeout for setup

  // check that the snapshot cache contains the same filenames as the package itself
  it('should have all snapshots for the entire package cached', async () => {
    const packageFiles = fs.readdirSync(pkgCachePath).filter(file => file.startsWith('StructureDefinition-') && file.endsWith('.json'));
    const snapshotFiles = fs.readdirSync(snapshotCachePath).filter(file => file.startsWith('StructureDefinition-') && file.endsWith('.json'));

    expect(snapshotFiles.length).toBe(packageFiles.length);
    expect(snapshotFiles.sort()).toEqual(packageFiles.sort());
  });

  afterAll(async () => {
    // ensure the dummy file was not overwritten
    it('should leave the dummy snapshot cache file untouched', () => {
      expect(fs.readFileSync(path.join(snapshotCachePath, dummySnapshot), 'utf8')).toHaveProperty('resourceType', 'dummy');
    });
  });

},480000); // 8min timeout for all tests