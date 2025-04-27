/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ElementDefinition {
    id: string;                     // e.g., 'Extension.value[x]'
    path: string;                    // e.g., 'Extension.value[x]'
  
    min?: number;                    // Cardinality minimum
    max?: string;                    // Cardinality maximum (e.g., '1', '*')
  
    type?: ElementDefinitionType[];  // Possible types for this element (for polymorphics)
  
    slicing?: ElementDefinitionSlicing;  // Slicing definition if applicable
    sliceName?: string;              // If this element is a slice
  
    fixedUri?: string;               // Fixed value (if constrained)
    binding?: ElementDefinitionBinding;  // Value set binding for coded types
  
    // Other common constraint-related fields:
    short?: string;
    definition?: string;
    comment?: string;
  
    // Placeholder for additional optional fields we may not be using yet:
    [key: string]: any;
  }
  
export interface ElementDefinitionType {
    code: string;                     // e.g., 'string', 'CodeableConcept', 'Quantity', etc.
    profile?: string[];               // URLs of constrained profiles
    targetProfile?: string[];         // For references, allowed target profiles
    extension?: any;               // Extensions for the type (e.g., FHIRPath type)
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
    valueSet?: string;                // Canonical URL of the ValueSet
  }
  
export interface FhirTreeNode {
    id: string;
    path: string;
    definition?: ElementDefinition;
    children: FhirTreeNode[];
    idSegments: string[];
    pathSegments: string[];
    nodeType: 'element' | 'array' | 'poly' | 'slice' | 'resliced'; // 'group' is used for slices
    sliceName?: string; // Only for group nodes
  }