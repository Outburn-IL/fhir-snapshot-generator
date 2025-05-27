 
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
  FhirPackageExplorer,
  ILogger,
  PackageIdentifier,
  FileIndexEntryWithPkg
} from 'fhir-package-explorer';

import {
  BaseFhirVersion,
  ElementDefinition,
  SnapshotCacheMode,
  SnapshotFetcher,
  SnapshotGeneratorConfig
} from '../types';

export class FhirSnapshotGenerator {
  private fpe: FhirPackageExplorer;
  private logger: ILogger;
  private cachePath: string;
  private cacheMode: SnapshotCacheMode;
  private fhirVersion: BaseFhirVersion;
  private fhirCorePackage: PackageIdentifier;
  private resolvedBasePackages: Map<string, string> = new Map<string, string>(); // cache for resolved base packages

  private constructor(fpe: FhirPackageExplorer, cahceMode: SnapshotCacheMode, fhirVersion: BaseFhirVersion) {
    this.cacheMode = cahceMode;
    this.fhirVersion = fhirVersion;
    this.fhirCorePackage = resolveFhirVersion(fhirVersion, true) as PackageIdentifier;
    this.fpe = fpe;
    this.logger = fpe.getLogger();
    this.cachePath = fpe.getCachePath();
  };

  /**
   * Creates a new instance of the FhirSnapshotGenerator class.
   * @param config - the configuration object for the FhirPackageExplorer
   * @returns - a promise that resolves to a new instance of the FhirSnapshotGenerator class
   */
  static async create(config: SnapshotGeneratorConfig): Promise<FhirSnapshotGenerator> {
    const cacheMode = config.cacheMode || 'lazy'; // default cache mode
    const fhirVersion = resolveFhirVersion(config.fhirVersion || '4.0.1') as BaseFhirVersion; // default FHIR version
    const fpeConfig = { ...config, skipExamples: true }; // force skipExamples=true
    delete fpeConfig.cacheMode; // remove cacheMode (fsg-only feature)
    delete fpeConfig.fhirVersion; // remove fhirVersion (fsg-only feature)
    let fpe = await FhirPackageExplorer.create(fpeConfig);
    // check if a base FHIR package is in the fpe context
    const packagesInContext = fpe.getContextPackages();
    const fhirCorePackage = resolveFhirVersion(fhirVersion, true) as PackageIdentifier;
    if (!packagesInContext.find(pkg => pkg.id === fhirCorePackage.id && pkg.version === fhirCorePackage.version)) {
      fpe.getLogger().warn(`No FHIR base package found in the context for version ${fhirVersion}. Adding: ${fhirCorePackage}.`);
      fpeConfig.context = [...fpeConfig.context, fhirCorePackage];
      // replace fpe instance with a new one that includes the base package
      fpe = await FhirPackageExplorer.create(fpeConfig);
    };
    const fsg = new FhirSnapshotGenerator(fpe, cacheMode, fhirVersion);

    // 'ensure' and 'rebuild' both trigger a walkthrough of all structure definitions.
    // The difference is that 'ensure' will not overwrite existing snapshots.
    const preCachingFn = (
      cacheMode === 'ensure' 
        ? fsg.ensureSnapshotCached // will generate only if not cached
        : (
          cacheMode === 'rebuild' 
            ? fsg.rebuildSnapshot // will always generate a new snapshot and overwrite the cache
            : undefined
        )
    );

    if (preCachingFn) {
      fpe.getLogger().info(`Pre-caching snapshots in '${cacheMode}' mode...`);
      // lookup all *profiles* in the FPE context and ensure/rebuild their snapshots.
      const allSds = await fpe.lookupMeta({ resourceType: 'StructureDefinition', derivation: 'constraint' });
      const errors: string[] = [];
      for (const sd of allSds) {
        const { filename, __packageId: packageId, __packageVersion: packageVersion, url } = sd;
        try {
          await preCachingFn.bind(fsg)(filename, packageId, packageVersion);
        } catch (e) {
          errors.push(`Failed to ${cacheMode} snapshot for '${url}' in package '${packageId}@${packageVersion}': ${
            e instanceof Error ? e.message : String(e)
          }`
          );
        }
      }
      if (errors.length > 0) {
        fpe.getLogger().error(`Errors during pre-caching snapshots (${errors.length} total):\n${errors.join('\n')}`);
      } else {
        fpe.getLogger().info(`Pre-caching snapshots in '${cacheMode}' mode completed successfully.`);
      }
    }
    return fsg;
  };

  public getLogger(): ILogger {
    return this.logger;
  }

  public getCachePath(): string {
    return this.cachePath;
  }

  public getCacheMode(): SnapshotCacheMode {
    return this.cacheMode;
  };

  public getFhirVersion(): BaseFhirVersion {
    return this.fhirVersion;
  };

  public getFpe(): FhirPackageExplorer {
    return this.fpe;
  }

  /**
   * Get the core FHIR package for a specific FHIR package.
   * Defaults to the FHIR package of this instance's fhirVersion if no base package is found in the dependencies.
   * @param sourcePackage The source package identifier (e.g., "hl7.fhir.us.core@6.1.0").
   */
  private async getCorePackage(sourcePackage: PackageIdentifier): Promise<PackageIdentifier> {
    let baseFhirPackage: string | undefined = this.resolvedBasePackages.get(`${sourcePackage.id}@${sourcePackage.version}`);
    if (!baseFhirPackage) { // try to resolve by dependency context
      baseFhirPackage = await resolveBasePackage(sourcePackage.id, sourcePackage.version, this.fpe, this.logger);
    }
    if (!baseFhirPackage) { // fallback to the default FHIR package
      this.logger.warn(`Defaulting to core package ${this.fhirCorePackage.id}@${this.fhirCorePackage.version} for resolving FHIR types within '${sourcePackage.id}@${sourcePackage.version}'.`);
      baseFhirPackage = `${this.fhirCorePackage.id}@${this.fhirCorePackage.version}`;
    }
    if (!baseFhirPackage) {
      throw new Error(`No base FHIR package found for '${sourcePackage.id}@${sourcePackage.version}'.`);
    }
    this.resolvedBasePackages.set(`${sourcePackage.id}@${sourcePackage.version}`, baseFhirPackage);
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
   * Try to get an existing cached snapshot. If not found, it is not an error - will return undefined.
   * @param filename The filename of the StructureDefinition in the package.
   * @param packageId The package ID (e.g., "hl7.fhir.us.core").
   * @param packageVersion Package version (e.g., "6.1.0").
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
   * @param identifier 
   */
  private async getMetadata(identifier: string): Promise<FileIndexEntryWithPkg> {
    const errors: any[] = [];
    if (identifier.startsWith('http:') || identifier.startsWith('https:') || identifier.includes(':')) {
      // the identifier is possibly a URL/URN - try and resolve it as such
      try {
        return await this.fpe.resolveMeta({ resourceType: 'StructureDefinition', url: identifier });
      } catch (e) {
        errors.push(e);
      }
    };
    // Not a URL, or failed to resolve as URL - try and resolve it as ID
    try {
      return await this.fpe.resolveMeta({ resourceType: 'StructureDefinition', id: identifier });;
    } catch (e) {
      errors.push(e);
    };
    // Couldn't resolve as ID - try and resolve it as name
    try {
      return await this.fpe.resolveMeta({ resourceType: 'StructureDefinition', name: identifier });
    } catch (e) {
      errors.push(e);
    }
    // Couldn't resolve at all - throw all errors
    errors.map(e => this.logger.error(e));
    throw new Error(`Failed to resolve StructureDefinition '${identifier}'`);
  }

  /**
   * Generate a snapshot for a StructureDefinition.
   * @param filename The filename of the StructureDefinition in the package.
   * @param packageId The package ID (e.g., "hl7.fhir.us.core").
   * @param packageVersion Package version (e.g., "6.1.0").
   * @returns The StructureDefinition with the generated snapshot.
   * */
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
    const snapshotFetcher: SnapshotFetcher = async (url: string) => {
      const metadata = await this.fpe.resolveMeta({ resourceType: 'StructureDefinition', url, package: {
        id: packageId,
        version: packageVersion
      }});
      return (await this.getSnapshotByMeta(metadata)).snapshot?.element as ElementDefinition[];
    };
    const fetcher = new DefinitionFetcher(
      {
        id: packageId,
        version: packageVersion
      },
      baseFhirPackage,
      this.fpe,
      snapshotFetcher.bind(this)
    );
    const diffs = sd.differential?.element;
    if (!diffs || diffs.length === 0) {
      throw new Error(`StructureDefinition '${filename}' does not have a differential`);
    }
    let baseSnapshot: ElementDefinition[] | undefined;
    try {
      baseSnapshot = await snapshotFetcher(sd.baseDefinition);
    } catch (e) {
      throw new Error(`Failed to fetch snapshot for base definition '${sd.baseDefinition}': ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!baseSnapshot || baseSnapshot.length === 0) {
      throw new Error(`Base definition '${sd.baseDefinition}' does not have a snapshot`);
    }
    const migratedBaseSnapshot = migrateElements(baseSnapshot, sd.baseDefinition);
    const generated = await applyDiffs(migratedBaseSnapshot, diffs, fetcher, this.logger);
    return { ...sd, snapshot: { element: generated } };
    
  }

  /**
   * Get snapshot by metadata. This is the entrypoint for general snapshot fetching.
   * It returns the original snapshot if it's a base type (derivation=specialization).
   * Otherwise it will return a generated one while respecting the cache mode.
   * `metadata` must include: `derivation`, `filename`, `__packageId` and `__packageVersion`.
   * @param metadata 
   */
  private async getSnapshotByMeta(metadata: FileIndexEntryWithPkg): Promise<any> {
    const { derivation, filename, __packageId: packageId, __packageVersion: packageVersion } = metadata;
    if (derivation === 'specialization') {
      // It's a base type, return the snapshot from the original StructureDefinition
      const sd = await this.getStructureDefinitionByFileName(filename, packageId, packageVersion);
      const elements = sd?.snapshot?.element as ElementDefinition[];
      if (!elements || elements.length === 0) {
        throw new Error(`StructureDefinition '${metadata.url}' does not have a snapshot`);
      }
      return sd;
    }
    // It's a profile, return a snapshot from cache or generate a new one
    const cached = this.cacheMode !== 'none' ? await this.getSnapshotFromCache(
      filename,
      packageId,
      packageVersion
    ) : undefined;
    if (cached) return cached;
    const generated = await this.generate(filename, packageId, packageVersion);
    if (this.cacheMode !== 'none') {
      await this.saveSnapshotToCache(filename, packageId, packageVersion, generated);
    }
    return generated;
  }

  private async rebuildSnapshot(filename: string, packageId: string, packageVersion: string): Promise<void> {
    // Rebuild the snapshot by generating it and overwriting the cache
    const generated = await this.generate(filename, packageId, packageVersion);
    await this.saveSnapshotToCache(filename, packageId, packageVersion, generated);
  }

  private async ensureSnapshotCached(filename: string, packageId: string, packageVersion: string): Promise<void> {
    // Check if file exists in the cache
    const cacheFilePath = this.getCacheFilePath(filename, packageId, packageVersion);
    if (await fs.exists(cacheFilePath)) return; // Snapshot is already cached
    // Generate the snapshot and save it to the cache
    await this.rebuildSnapshot(filename, packageId, packageVersion);
  }

  /**
   * Get snapshot by any FSH style identifier (id, url, name).
   */
  public async getSnapshot(identifier: string): Promise<any> {
    const metadata = await this.getMetadata(identifier);
    if (!metadata) {
      throw new Error(`StructureDefinition '${identifier}' not found in context. Could not get or generate a snapshot.`);
    }
    return await this.getSnapshotByMeta(metadata);
  }
};