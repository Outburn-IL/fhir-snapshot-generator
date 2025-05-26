/**
 * © Copyright Outburn Ltd. 2022-2025 All Rights Reserved
 *   Project name: fhir-snapshot-generator
 */

import { FhirTreeNode, ElementDefinition } from '../../types';

/**
 * Flattens a FhirTreeNode into a flat array of ElementDefinition objects.
 * @param tree - the tree to flatten
 * @returns - the flattened array of elements
 */
export const fromTree = (tree: FhirTreeNode): ElementDefinition[] => {
  const result: ElementDefinition[] = [];
  
  function visit(node: FhirTreeNode) {
    // Only output nodes that hold a definition
    if (['element', 'slice', 'headslice'].includes(node.nodeType)) {
      if (!node.definition) {
        throw new Error(`Node ${node.id} of type ${node.nodeType} is missing its definition`);
      }
      result.push(node.definition);
    }
  
    for (const child of node.children) {
      visit(child);
    }
  }
  
  visit(tree);
  return result;
};