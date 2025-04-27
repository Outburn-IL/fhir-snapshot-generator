/**
 * © Copyright Outburn Ltd. 2022-2024 All Rights Reserved
 *   Project name: FUME-COMMUNITY
 */
import { ILogger, PackageIdentifier } from 'fhir-package-explorer';
type getStructureDefinitionFunction = (identifier: string, pkg?: string | PackageIdentifier) => Promise<unknown>;
export declare const generateSnapshot: (logger: ILogger, getRawDefinition: getStructureDefinitionFunction, getSnapshot: getStructureDefinitionFunction, profileId: string, pkg?: PackageIdentifier | string) => Promise<any>;
export {};
//# sourceMappingURL=snapshotBuilder.d.ts.map