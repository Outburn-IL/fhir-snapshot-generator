export interface ElementDefinition {
    id: string;
    path: string;
    min?: number;
    max?: string;
    type?: ElementDefinitionType[];
    slicing?: ElementDefinitionSlicing;
    sliceName?: string;
    fixedUri?: string;
    binding?: ElementDefinitionBinding;
    short?: string;
    definition?: string;
    comment?: string;
    [key: string]: any;
}
export interface ElementDefinitionType {
    code: string;
    profile?: string[];
    targetProfile?: string[];
    extension?: any;
}
export interface ElementDefinitionSlicing {
    discriminator: SlicingDiscriminator[];
    rules: 'closed' | 'open' | 'openAtEnd';
    description?: string;
    ordered?: boolean;
}
export interface SlicingDiscriminator {
    type: 'value' | 'exists' | 'pattern' | 'type' | 'profile';
    path: string;
}
export interface ElementDefinitionBinding {
    strength: 'required' | 'extensible' | 'preferred' | 'example';
    valueSet?: string;
}
export interface FhirTreeNode {
    id: string;
    path: string;
    definition?: ElementDefinition;
    children: FhirTreeNode[];
    idSegments: string[];
    pathSegments: string[];
    nodeType: 'element' | 'array' | 'poly' | 'slice' | 'resliced';
    sliceName?: string;
}
//# sourceMappingURL=types.d.ts.map