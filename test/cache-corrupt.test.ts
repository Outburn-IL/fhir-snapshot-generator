import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { FhirSnapshotGenerator } from 'fhir-snapshot-generator';
import { FhirPackageExplorer } from 'fhir-package-explorer';
import { versionedCacheDir } from '../src/utils/misc/getVersionedCacheDir';

describe('Corrupt snapshot cache recovery', async () => {
  const cachePath = './test/.test-cache';
  const context = 'fsg.test.pkg#0.1.0';
  const snapshotCachePath = path.join(cachePath, context, '.fsg.snapshots', versionedCacheDir);
  const snapshotFilename = 'StructureDefinition-ext-hearing-loss.json';
  const snapshotFilePath = path.join(snapshotCachePath, snapshotFilename);

  const fpe = await FhirPackageExplorer.create({
    cachePath,
    context: [context],
    skipExamples: true
  });

  beforeAll(async () => {
    await fs.remove(snapshotCachePath);
  }, 240000);

  it('lazy mode should ignore corrupt cache and regenerate', async () => {
    const fsg = await FhirSnapshotGenerator.create({
      fpe,
      fhirVersion: '4.0.1',
      cacheMode: 'lazy'
    });

    // First call populates the cache.
    await fsg.getSnapshot('http://example.org/StructureDefinition/ext-hearing-loss');
    expect(await fs.exists(snapshotFilePath)).toBe(true);

    // Corrupt the cached JSON (simulate partial write / truncation)
    await fs.writeFile(snapshotFilePath, '{"resourceType":"StructureDefinition"');

    // Second call should not throw; it should regenerate and rewrite the cache.
    const regenerated = await fsg.getSnapshot('http://example.org/StructureDefinition/ext-hearing-loss');
    expect(regenerated?.resourceType).toBe('StructureDefinition');

    // Cache file should be valid JSON again.
    const cached = await fs.readJSON(snapshotFilePath);
    expect(cached?.resourceType).toBe('StructureDefinition');
  }, 240000);

  it('ensure mode should fix corrupt cached files during precache', async () => {
    await fs.ensureDir(snapshotCachePath);
    await fs.writeFile(snapshotFilePath, '{"resourceType":"StructureDefinition"');

    await FhirSnapshotGenerator.create({
      fpe,
      fhirVersion: '4.0.1',
      cacheMode: 'ensure'
    });

    const cached = await fs.readJSON(snapshotFilePath);
    expect(cached?.resourceType).toBe('StructureDefinition');
  }, 240000);
}, 480000);
