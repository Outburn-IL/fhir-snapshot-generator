/**
 * © Copyright Outburn Ltd. 2022-2025 All Rights Reserved
 *   Project name: fhir-snapshot-generator
 */
import { ExplorerConfig, ILogger, PackageIdentifier } from 'fhir-package-explorer';
export type SnapshotGeneratorConfig = Omit<ExplorerConfig, 'skipExamples'>;
export declare class FhirSnapshotGenerator {
    private fpe;
    private logger;
    private cachePath;
    private constructor();
    static create(config: SnapshotGeneratorConfig): Promise<FhirSnapshotGenerator>;
    getCachePath(): string;
    getLogger(): ILogger;
    private searchStructureDefinitionMeta;
    private getSdById;
    private getSdByUrl;
    private getSdByName;
    private getStructureDefinition;
    private generateSnapshot;
    getSnapshot(identifier: string, pkg?: PackageIdentifier | string): Promise<any>;
}
//# sourceMappingURL=index.d.ts.map