import { ElementDefinition, FhirTreeNode } from './types';
export declare const applyDiffToTree: (tree: FhirTreeNode, diffElements: ElementDefinition[], getSnapshot: (typeCode: string) => Promise<ElementDefinition[]>, logger?: (message: string) => void) => Promise<FhirTreeNode>;
//# sourceMappingURL=applyDiff.d.ts.map