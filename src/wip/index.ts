/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * © Copyright Outburn Ltd. 2022-2025 All Rights Reserved
 *   Project name: fhir-snapshot-generator
 */

import {
  FhirPackageExplorer,
  ILogger,
  PackageIdentifier,
  FileIndexEntryWithPkg
} from 'fhir-package-explorer';
import { BaseFhirVersion, SnapshotCacheMode, SnapshotGeneratorConfig } from './types';
import { version as fsgVersion } from '../../package.json';
import { resolveFhirVersion } from './utils/misc';
import path from 'path';
import fs from 'fs-extra';

const fsgMajorVersion = `v${fsgVersion.split('.')[0]}`;

export class FhirSnapshotGenerator {
  private fpe: FhirPackageExplorer;
  private logger: ILogger;
  private cachePath: string;
  private cacheMode: SnapshotCacheMode;
  private fhirVersion: BaseFhirVersion;
  private fhirCorePackage: string;

  private constructor(fpe: FhirPackageExplorer, cahceMode: SnapshotCacheMode, fhirVersion: BaseFhirVersion) {
    this.cacheMode = cahceMode;
    this.fhirVersion = fhirVersion;
    this.fhirCorePackage = resolveFhirVersion(fhirVersion, true);
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
    const fhirCorePackage: string = resolveFhirVersion(fhirVersion, true);
    if (!packagesInContext.find(pkg => `${pkg.id}@${pkg.version}` === fhirCorePackage)) {
      fpe.getLogger().warn(`No FHIR base package found in the context for version ${fhirVersion}. Adding: ${fhirCorePackage}.`);
      fpeConfig.context = [...fpeConfig.context, fhirCorePackage];
      // replace fpe instance with a new one that includes the base package
      fpe = await FhirPackageExplorer.create(fpeConfig);
    };
    return new FhirSnapshotGenerator(fpe, cacheMode, fhirVersion);
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

  /**
   * Resolves the base FHIR package for a given package ID and version.
   * If no base package is found in the dependencies, or there are multiple FHIR versions - 
   *   it will default to the FHIR version defined for this instance in `fhirVersion`.
   * @param packageId The source package name (e.g., "hl7.fhir.us.core").
   * @param packageVersion The source package version (e.g., "6.1.0").
   * @return (string) The resolved base FHIR package (e.g., "hl7.fhir.r4.core@4.0.1").
   */
  private async resolveBasePackage(packageId: string, packageVersion: string): Promise<string> {
    const expanded = await this.fpe.expandPackageDependencies({id: packageId, version: packageVersion});
    const basePackages = expanded.filter(pkg => /^hl7\.fhir\.[^.]+\.core$/.test(pkg.id));
    if (basePackages.length === 0) {
      this.logger.warn(`No base FHIR package found for ${packageId}@${packageVersion}. Defaulting to ${this.fhirCorePackage}.`);
      return this.fhirCorePackage;
    }
    if (basePackages.length > 1) {
      this.logger.warn(`Multiple base FHIR packages found for ${packageId}@${packageVersion}. Defaulting to ${this.fhirCorePackage}.`);
      return this.fhirCorePackage;
    }
    return `${basePackages[0].id}@${basePackages[0].version}`;
  }

  /**
   * Get the definition for one of the base FHIR types.
   * The `package` parameter is required in order to resolve the type from the correct FHIR version.
   * @param type The type ID (e.g., "CodeableConcept", "Quantity", etc.).
   * @param package The source package identifier (e.g., "hl7.fhir.us.core@6.1.0").
   */
  private async getBaseType(type: string, sourcePackage: PackageIdentifier): Promise<any> {
    const baseFhirPackage = await this.resolveBasePackage(sourcePackage.id, sourcePackage.version);
    const definition = await this.fpe.resolve({ resourceType: 'StructureDefinition', id: type, package: baseFhirPackage });
    if (!definition) {
      throw new Error(`FHIR type '${type}' not found in base package '${baseFhirPackage}'`);
    }
    return definition;
  }

  /**
   * Fetch StructureDefinition metadata by URL.
   * When a profile refers to another profile it is always by URL.
   * Profile to profile resolution must happen in the correct package context, this is what the sourcePackage parameter is for.
   * @param url The URL of the StructureDefinition (e.g., "http://hl7.org/fhir/StructureDefinition/bp").
   * @param sourcePackage The source package identifier (e.g., "hl7.fhir.us.core@6.1.0").
   */
  private async getMetadataByUrl(url: string, sourcePackage?: PackageIdentifier | string): Promise<FileIndexEntryWithPkg> {
    return await this.fpe.resolveMeta({ resourceType: 'StructureDefinition', url, package: sourcePackage });
  }

  /**
   * Fetch StructureDefinition metadata by ID.
   * This is only used in the entry point of the generator, when the user provides an ID.
   * The ID is always resolved in the entire loaded package context, so no sourcePackage is used here.
   * @param id The ID of the StructureDefinition (e.g., "bp").
   */
  private async getMetadataById(id: string): Promise<FileIndexEntryWithPkg> {
    return await this.fpe.resolveMeta({ resourceType: 'StructureDefinition', id });
  }

  /**
   * Fetch StructureDefinition metadata by name.
   * This is only used in the entry point of the generator, when the user provides a name.
   * The name is always resolved in the entire loaded package context, so no sourcePackage is used here.
   * * @param name The name of the StructureDefinition (e.g., "observation-vitalsigns").
   */
  private async getMetadataByName(name: string): Promise<FileIndexEntryWithPkg> {
    return await this.fpe.resolveMeta({ resourceType: 'StructureDefinition', name });
  }

  /**
   * Fetch StructureDefinition metadata by any identifier (id, url, name) - FSH style.
   * @param identifier 
   */
  private async getMetadataByAny(identifier: string): Promise<FileIndexEntryWithPkg> {
    const errors: any[] = [];
    if (identifier.startsWith('http:') || identifier.startsWith('https:') || identifier.includes(':')) {
      // the identifier is possibly a URL/URN - try and resolve it as such
      try {
        return await this.getMetadataByUrl(identifier);
      } catch (e) {
        errors.push(e);
      }
    };
    // Not a URL, or failed to resolve as URL - try and resolve it as ID
    try {
      return await this.getMetadataById(identifier);
    } catch (e) {
      errors.push(e);
    };
    // Couldn't resolve as ID - try and resolve it as name
    try {
      return await this.getMetadataByName(identifier);
    } catch (e) {
      errors.push(e);
    }
    // Couldn't resolve at all - throw all errors
    errors.map(e => this.logger.error(e));
    throw new Error(`Failed to resolve StructureDefinition '${identifier}'`);
  }

  /**
   * Try to get an existing cached snapshot. If not found, it is not an error - will return undefined.
   * @param filename The filename of the StructureDefinition in the package.
   * @param packageId The package ID (e.g., "hl7.fhir.us.core").
   * @param packageVersion Package version (e.g., "6.1.0").
   */
  private async getSnapshotFromCache(filename: string, packageId: string, packageVersion: string): Promise<any> {
    const cacheFilePath = path.join(this.cachePath, `${packageId}#${packageVersion}`, '.fsg.snapshots', fsgMajorVersion, filename);
    if (await fs.exists(cacheFilePath)) {
      return await fs.readJSON(cacheFilePath);
    } else {
      return undefined;
    }
  }

  /**
   * Get snapshot by filename, package ID and version. 
   * This combination is the only enforced globally unique identifier for a specific StructureDefinition,
   * for this reason all other identifiers used to fetch a snapshot are eventually resolved through this function.
   * Depending on the cache mode and state, it may return a cached snapshot or a newly generated one.
   * @param filename 
   * @param packageId 
   * @param packageVersion 
   */
  private async getSnapshotByFileName(filename: string, packageId: string, packageVersion: string): Promise<any> {
    if (this.cacheMode !== 'none') {
      const cached = await this.getSnapshotFromCache(filename, packageId, packageVersion);
      return cached ?? await this.generateSnapshot(filename, packageId, packageVersion);;
    }
  }

  /**
   * Get snapshot by any FSH style identifier (id, url, name).
   */
  public async getSnapshot(identifier: string): Promise<any> {
    const metadata = await this.getMetadataByAny(identifier);
    if (!metadata) {
      throw new Error(`StructureDefinition '${identifier}' not found in context. Could not get or generate a snapshot.`);
    }
    return await this.getSnapshotByMeta(metadata);
  }


};