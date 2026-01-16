/**
 * © Copyright Outburn Ltd. 2022-2025 All Rights Reserved
 *   Project name: fhir-snapshot-generator
 */

import {
  DefinitionFetcher,
  resolveBasePackage,
  resolveFhirVersion,
  applyDiffs,
  migrateElements,
  versionedCacheDir
} from './utils';
import path from 'path';
import fs from 'fs-extra';

import {
  FhirPackageExplorer
} from 'fhir-package-explorer';

import {
  FileIndexEntryWithPkg
} from '@outburn/types';

import {
  SnapshotCacheMode,
  SnapshotFetcher,
  SnapshotGeneratorConfig
} from '../types';

import {
  Logger,
  FhirPackageIdentifier,
  FhirVersion,
  ElementDefinition
} from '@outburn/types';

export class FhirSnapshotGenerator {
  private fpe: FhirPackageExplorer;
  private logger: Logger;
  private cachePath: string;
  private cacheMode: SnapshotCacheMode;
  private fhirVersion: FhirVersion;
  private fhirCorePackage: FhirPackageIdentifier;
  private resolvedBasePackages: Map<string, string> = new Map<string, string>(); // cache for resolved base packages

  private constructor(fpe: FhirPackageExplorer, cacheMode: SnapshotCacheMode, fhirVersion: FhirVersion, logger: Logger) {
    this.logger = logger;
    this.cacheMode = cacheMode;
    this.fhirVersion = fhirVersion;
    this.fhirCorePackage = resolveFhirVersion(fhirVersion, true) as FhirPackageIdentifier;
    this.fpe = fpe;
    this.cachePath = fpe.getCachePath();
  };

  /**
   * Creates a new instance of the FhirSnapshotGenerator class.
   * @param config - the configuration object including the FhirPackageExplorer instance
   * @returns - a promise that resolves to a new instance of the FhirSnapshotGenerator class
   */
  static async create(config: SnapshotGeneratorConfig): Promise<FhirSnapshotGenerator> {
    const logger = config.logger || {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined
    };

    const { fpe } = config;
    if (!fpe) {
      throw new Error('FhirPackageExplorer instance is required in config.fpe');
    }

    const cacheMode = config.cacheMode || 'lazy'; // default cache mode
    const fhirVersion = resolveFhirVersion(config.fhirVersion) as FhirVersion;

    // Create a new FhirSnapshotGenerator instance
    const fsg = new FhirSnapshotGenerator(fpe, cacheMode, fhirVersion, logger);

    let precache: boolean = false;

    // 'ensure' and 'rebuild' cache modes both trigger a walkthrough of all structure definitions.
    // The difference is that 'rebuild' will first delete all existing snapshots in the cache.
    if (cacheMode === 'rebuild') {
      precache = true;
      // delete all existing snapshots in the cache for the packages in the context
      const packageList = fpe.getContextPackages().map(pkg => path.join(fpe.getCachePath(), `${pkg.id}#${pkg.version}`, '.fsg.snapshots', versionedCacheDir));
      // for each path, delete the directory if it exists
      for (const snapshotCacheDir of packageList) {
        if (await fs.exists(snapshotCacheDir)) {
          fs.removeSync(snapshotCacheDir);
        }
      }
    }

    if (cacheMode === 'ensure') precache = true;

    if (precache) {
      logger.info(`Pre-caching snapshots in '${cacheMode}' mode...`);
      // lookup all *profiles* in the FPE context and ensure their snapshots are cached.
      const allSds = await fpe.lookupMeta({ resourceType: 'StructureDefinition', derivation: 'constraint' });
      const errors: string[] = [];
      for (const sd of allSds) {
        const { filename, __packageId: packageId, __packageVersion: packageVersion, url } = sd;
        try {
          await fsg.ensureSnapshotCached(filename, packageId, packageVersion!);
        } catch (e) {
          errors.push(`Failed to ${cacheMode} snapshot for '${url}' in package '${packageId}@${packageVersion}': ${
            e instanceof Error ? e.message : String(e)
          }`
          );
        }
      }
      if (errors.length > 0) {
        logger.error(`Errors during pre-caching snapshots (${errors.length} total):\n${errors.join('\n')}`);
      } else {
        logger.info(`Pre-caching snapshots in '${cacheMode}' mode completed successfully.`);
      }

    }
    return fsg;
  };

  public getLogger(): Logger {
    return this.logger;
  }

  public getCachePath(): string {
    return this.cachePath;
  }

  public getCacheMode(): SnapshotCacheMode {
    return this.cacheMode;
  };

  public getFhirVersion(): FhirVersion {
    return this.fhirVersion;
  };

  public getFpe(): FhirPackageExplorer {
    return this.fpe;
  }

  /**
   * Get the core FHIR package for a specific FHIR package.
   * Will try to resolve the core package based on the direct dependencies of the source package or its fhirVersions array.
   * Defaults to the FHIR package of this instance's fhirVersion if no base package can be determined.
   * @param sourcePackage The source package identifier (e.g., { id: 'hl7.fhir.us.core', version: '6.1.0' }).
   * @returns The core FHIR package identifier (e.g., { id: 'hl7.fhir.r4.core', version: '4.0.1' }).
   */
  private async getCorePackage(sourcePackage: FhirPackageIdentifier): Promise<FhirPackageIdentifier> {
    let baseFhirPackage: string | undefined = this.resolvedBasePackages.get(`${sourcePackage.id}@${sourcePackage.version!}`);
    if (!baseFhirPackage) { // try to resolve by dependency context
      try {
        baseFhirPackage = await resolveBasePackage(sourcePackage.id, sourcePackage.version!, this.fpe, this.logger);
      } catch (e) {
        this.logger.warn(`Failed to resolve base FHIR package for '${sourcePackage.id}@${sourcePackage.version!}': ${e instanceof Error ? e.message : String(e)}`);
      }      
    }
    if (!baseFhirPackage) { // fallback to the default FHIR package
      this.logger.warn(`Defaulting to core package ${this.fhirCorePackage.id}@${this.fhirCorePackage.version!} for resolving FHIR types within '${sourcePackage.id}@${sourcePackage.version!}'.`);
      baseFhirPackage = `${this.fhirCorePackage.id}@${this.fhirCorePackage.version!}`;
    }
    if (!baseFhirPackage) {
      throw new Error(`No base FHIR package found for '${sourcePackage.id}@${sourcePackage.version!}'.`);
    }
    this.resolvedBasePackages.set(`${sourcePackage.id}@${sourcePackage.version!}`, baseFhirPackage);
    const [id, version] = baseFhirPackage.split('@');
    return { id, version };
  }

  /**
   * Get an original StructureDefinition from a specific package by filename.
   * After resolving the metadata using any other identifier (id, url, name), filename (combind with the package id and version)
   * is the most reliable way to get to a specific StructureDefinition, and is also used as the basis for the cache.
   */
  private async getStructureDefinitionByFileName(filename: string, packageId: string, packageVersion: string): Promise<any> {
    return await this.fpe.resolve({
      filename,
      package: {
        id: packageId,
        version: packageVersion
      }
    });
  }

  private getCacheFilePath(filename: string, packageId: string, packageVersion: string): string {
    return path.join(this.cachePath, `${packageId}#${packageVersion}`, '.fsg.snapshots', versionedCacheDir, filename);
  }

  /**
   * Try to get an existing cached StructureDefinition snapshot. If not found, return undefined.
   */
  private async getSnapshotFromCache(filename: string, packageId: string, packageVersion: string): Promise<any> {
    const cacheFilePath = this.getCacheFilePath(filename, packageId, packageVersion);
    if (await fs.exists(cacheFilePath)) {
      return await fs.readJSON(cacheFilePath);
    } else {
      return undefined;
    }
  }

  private async saveSnapshotToCache(filename: string, packageId: string, packageVersion: string, snapshot: any): Promise<void> {
    const cacheFilePath = this.getCacheFilePath(filename, packageId, packageVersion);
    await fs.ensureDir(path.dirname(cacheFilePath));
    await fs.writeJSON(cacheFilePath, snapshot);
  }

  /**
   * Fetch StructureDefinition metadata by any identifier (id, url, name) - FSH style.
   */
  public async getMetadata(identifier: string, packageFilter?: FhirPackageIdentifier): Promise<FileIndexEntryWithPkg> {
    const errors: any[] = [];
    if (identifier.startsWith('http:') || identifier.startsWith('https:') || identifier.includes(':')) {
      // the identifier is possibly a URL/URN - try and resolve it as such
      try {
        const match = await this.fpe.resolveMeta({ resourceType: 'StructureDefinition', url: identifier, package: packageFilter });
        return match; // return the resolved match (with core-bias applied)
      } catch (e) {
        errors.push(e);
      }
    }
    // Not a URL, or failed to resolve as URL - try and resolve it as ID
    try {
      const match = await this.fpe.resolveMeta({ resourceType: 'StructureDefinition', id: identifier, package: packageFilter });
      return match; // return the resolved match (with core-bias applied)
    } catch (e) {
      errors.push(e);
    }
    // Couldn't resolve as ID - try and resolve it as name
    try {
      const match = await this.fpe.resolveMeta({ resourceType: 'StructureDefinition', name: identifier, package: packageFilter });
      return match; // return the resolved match (with core-bias applied)
    } catch (e) {
      errors.push(e);
    }
    // Couldn't resolve at all - throw all errors
    errors.map(e => this.logger.error(e));
    throw new Error(`Failed to resolve StructureDefinition '${identifier}'`);
  }

  /**
   * Generate a snapshot for a StructureDefinition.
   */
  private async generate(filename: string, packageId: string, packageVersion: string): Promise<any> {
    this.logger.info(`Generating snapshot for '${filename}' in package '${packageId}@${packageVersion}'...`);
    const sd = await this.getStructureDefinitionByFileName(filename, packageId, packageVersion);
    if (!sd) {
      throw new Error(`File '${filename}' not found in package '${packageId}@${packageVersion}'`);
    }
    if (!sd.baseDefinition) {
      throw new Error(`StructureDefinition '${sd?.url}' does not have a baseDefinition`);
    }
    const baseFhirPackage = await this.getCorePackage({ id: packageId, version: packageVersion });
    const snapshotFetcher: SnapshotFetcher = (async (url: string) => {
      let metadata: FileIndexEntryWithPkg;
      try {
        metadata = await this.fpe.resolveMeta({ resourceType: 'StructureDefinition', url, package: {
          id: packageId,
          version: packageVersion
        }});
      } catch (e) {
        this.logger.warn(`Failed to resolve metadata for '${url}' in package '${packageId}@${packageVersion}': ${e instanceof Error ? e.message : String(e)}`);
        // try to resolve outside package context
        metadata = await this.fpe.resolveMeta({ resourceType: 'StructureDefinition', url });
      }
      return (await this.getSnapshotByMeta(metadata)).snapshot?.element as ElementDefinition[];
    }).bind(this);
    const fetcher = new DefinitionFetcher(
      {
        id: packageId,
        version: packageVersion
      },
      baseFhirPackage,
      this.fpe,
      snapshotFetcher
    );
    const diffs = sd.differential?.element;
    if (!diffs || diffs.length === 0) {
      throw new Error(`StructureDefinition '${filename}' does not have a differential`);
    }
    let baseSnapshot: ElementDefinition[] | undefined;
    try {
      baseSnapshot = await snapshotFetcher(sd.baseDefinition);
      if (!baseSnapshot || baseSnapshot.length === 0) {
        throw new Error(`Base definition '${sd.baseDefinition}' does not have a snapshot`);
      }
      const migratedBaseSnapshot = migrateElements(baseSnapshot, sd.baseDefinition);
      const generated = await applyDiffs(migratedBaseSnapshot, diffs, fetcher, this.logger);
      return { __corePackage: baseFhirPackage, ...sd, snapshot: { element: generated } };
    } catch (e) {
      this.logger.warn(`Failed to generate snapshot for '${sd.url}': ${e instanceof Error ? e.message : String(e)}\nUsing the original StructureDefinition from source package.`);
      // if sd doesn't have a snapshot, throw an error
      if (!sd.snapshot || !sd.snapshot.element || sd.snapshot.element.length === 0) {
        throw new Error(`The original StructureDefinition '${sd.url}' does not have a snapshot`);
      }
      return { __corePackage: baseFhirPackage, ...sd };
    }
  }

  /**
   * Get snapshot by metadata.
   */
  private async getSnapshotByMeta(metadata: FileIndexEntryWithPkg): Promise<any> {
    const { derivation, filename, __packageId: packageId, __packageVersion: packageVersion } = metadata;
    if (!derivation || derivation === 'specialization') {
      // It's a base type, return the snapshot from the original StructureDefinition
      const sd = await this.getStructureDefinitionByFileName(filename, packageId, packageVersion!);
      const elements = sd?.snapshot?.element as ElementDefinition[];
      if (!elements || elements.length === 0) {
        throw new Error(`StructureDefinition '${metadata.url}' does not have a snapshot`);
      }
      return { __corePackage: { id: packageId, version: packageVersion! }, ...sd };
    }
    // It's a profile, return a snapshot from cache or generate a new one
    const cached = this.cacheMode !== 'none' ? await this.getSnapshotFromCache(
      filename,
      packageId,
      packageVersion!
    ) : undefined;
    if (cached) return cached;
    const generated = await this.generate(filename, packageId, packageVersion!);
    if (this.cacheMode !== 'none') {
      await this.saveSnapshotToCache(filename, packageId, packageVersion!, generated);
    }
    return generated;
  }





  private async ensureSnapshotCached(filename: string, packageId: string, packageVersion: string): Promise<void> {
    // Check if file exists in the cache
    const cacheFilePath = this.getCacheFilePath(filename, packageId, packageVersion);
    try {
      await fs.access(cacheFilePath);
      return; // Snapshot is already cached
    } catch {
      // File does not exist, continue to build and cache
      const generated = await this.generate(filename, packageId, packageVersion);
      await this.saveSnapshotToCache(filename, packageId, packageVersion, generated); 
    }
  }

  /**
   * Get snapshot by any FSH style identifier (id, url or name), or by a metadata object.
   */
  public async getSnapshot(identifier: string | FileIndexEntryWithPkg, packageFilter?: FhirPackageIdentifier): Promise<any> {
    let metadata: FileIndexEntryWithPkg | undefined;
    if (typeof identifier === 'string') {
      // If identifier is a string, resolve it to metadata
      metadata = await this.getMetadata(identifier, packageFilter);
      if (!metadata) {
        throw new Error(`StructureDefinition '${identifier}' not found in context. Could not get or generate a snapshot.`);
      }
    } else {
      metadata = identifier as FileIndexEntryWithPkg;
      if (!metadata) {
        // create a human readable string from the metadata object
        throw new Error(`StructureDefinition with metadata: \n${JSON.stringify(identifier, null, 2)}\nnot found in context. Could not get or generate a snapshot.`);
      }
    }
    return await this.getSnapshotByMeta(metadata);
  }


};

export type {
  SnapshotCacheMode,
  SnapshotGeneratorConfig,
  SnapshotFetcher,
  FhirTreeNode
} from '../types';

