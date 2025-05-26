/**
 * © Copyright Outburn Ltd. 2022-2025 All Rights Reserved
 *   Project name: fhir-snapshot-generator
 */

import { FhirTreeNode } from '../../types';

/**
 * Checks if a node is sliceable based on its node type.
 * @param node - the node to check
 * @returns - true if the node is sliceable, false otherwise
 */
export const isNodeSliceable = (node: FhirTreeNode): boolean => {
  return ['array', 'poly', 'resliced'].includes(node.nodeType);
};