/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * © Copyright Outburn Ltd. 2022-2025 All Rights Reserved
 *   Project name: fhir-snapshot-generator
 */

import {
  FhirPackageExplorer,
  ExplorerConfig,
  ILogger,
  PackageIdentifier
} from 'fhir-package-explorer';

import { generateSnapshot as generate } from './newGenerator';
import path from 'path';
import fs from 'fs-extra';
import { version as fsgVersion } from '../package.json';

export type SnapshotGeneratorConfig = Omit<ExplorerConfig, 'skipExamples'>;

const fsgMajorVersion = `v${fsgVersion.split('.')[0]}`;

export class FhirSnapshotGenerator {
  private fpe: FhirPackageExplorer;
  private logger: ILogger;
  private cachePath: string;

  private constructor(fpe: FhirPackageExplorer) {
    this.fpe = fpe;
    this.logger = fpe.getLogger();
    this.cachePath = fpe.getCachePath();
  }

  static async create(config: SnapshotGeneratorConfig): Promise<FhirSnapshotGenerator> {
    const fpe = await FhirPackageExplorer.create({
      ...config,
      skipExamples: true // force skipExamples=true
    });
    return new FhirSnapshotGenerator(fpe);
  }

  public getCachePath(): string {
    return this.cachePath;
  }

  public getLogger(): ILogger {
    return this.logger;
  }

  private async searchStructureDefinitionMeta(filter: { id?: string; url?: string; name?: string; package?: PackageIdentifier | string }): Promise<any | undefined> {
    try {
      const resolved = await this.fpe.resolveMeta({ ...filter, resourceType: 'StructureDefinition' });
      return resolved;
    } catch {
      return undefined;
    }
  }

  private async getSdById(id: string, pkg?: PackageIdentifier | string): Promise<any | undefined> {
    return await this.searchStructureDefinitionMeta({ id, package: pkg });
  }

  private async getSdByUrl(url: string, pkg?: PackageIdentifier | string): Promise<any | undefined> {
    return await this.searchStructureDefinitionMeta({ url, package: pkg });
  }

  private async getSdByName(name: string, pkg?: PackageIdentifier | string): Promise<any | undefined> {
    return await this.searchStructureDefinitionMeta({ name, package: pkg });
  }

  private async getStructureDefinition(identifier: string, pkg?: PackageIdentifier | string): Promise<any> {
    if (identifier.startsWith('#')) {
      const elementId: string = identifier.substring(1);
      const baseType: string = elementId.split('.')[0];
      const baseSnapshot = await this.getStructureDefinition(baseType, pkg);
      const allElements: any[] = baseSnapshot?.snapshot?.element;
      const backboneElements: any[] = allElements.filter((e) => e?.id === elementId || String(e?.id).startsWith(elementId + '.'));
      return {
        derivation: 'specialization',
        differential: { element: backboneElements },
        snapshot: { element: backboneElements }
      };
    }
    let resolved: any | undefined;
    if (identifier.includes(':')) {
      resolved = await this.getSdByUrl(identifier, pkg);
    } else {
      resolved = await this.getSdById(identifier, pkg);
    }
    if (!resolved) {
      resolved = await this.getSdByName(identifier, pkg);
    }
    if (resolved) {
      const { filename, __packageId, __packageVersion } = resolved;
      try {
        console.log(`Resolving StructureDefinition (filename: '${filename}', package: '${__packageId}@${__packageVersion}')`);
        const resource = await this.fpe.resolve({ filename, package: { id: __packageId, version: __packageVersion } });
        return { __filename: filename, ...resource };
      } catch (e) {
        this.logger.error(`Failed to resolve StructureDefinition (filename: '${filename}', package: '${__packageId}@${__packageVersion}'), error: ${e}`);
        throw e;
      }
    } else {
      throw new Error(`Failed to resolve StructureDefinition '${identifier}'`);
    }
  }

  private async generateSnapshot(identifier: string, pkg?: PackageIdentifier | string): Promise<any> {
    return await generate(
      this.getLogger(),
      this.getStructureDefinition.bind(this),
      this.getSnapshot.bind(this),
      identifier,
      pkg as string
    );
  }

  async getSnapshot(identifier: string, pkg?: PackageIdentifier | string): Promise<any> {
    if (identifier.startsWith('#')) {
      return await this.getStructureDefinition(identifier, pkg);
    }
  
    // Always use the same logic as getStructureDefinition to resolve metadata
    const meta = await this.getSdById(identifier, pkg)
      || await this.getSdByUrl(identifier, pkg)
      || await this.getSdByName(identifier, pkg);
  
    if (meta) {
      const { filename, __packageId, __packageVersion } = meta;
      const snapshotDir = path.join(this.cachePath, `${__packageId}#${__packageVersion}`, '.fsg.snapshots', fsgMajorVersion);
      const snapshotPath = path.join(snapshotDir, filename);
  
      // Cache HIT
      if (await fs.pathExists(snapshotPath)) {
        return await fs.readJSON(snapshotPath);
      }
  
      // Cache MISS: generate snapshot and save to cache
      const generated = await this.generateSnapshot(identifier, pkg);
      await fs.ensureDir(snapshotDir);
      await fs.writeJSON(snapshotPath, generated, { spaces: 2 });
      return generated;
    } else {
      throw new Error(`Failed to resolve StructureDefinition '${identifier}'`);
    }
  }
  
}
