import { FhirPackageExplorer } from 'fhir-package-explorer';
import { findChild } from './findChild';
import { FhirTreeNode } from './types';

export const findMatchingNode = async (diffId: string, node: FhirTreeNode, fpe: FhirPackageExplorer): Promise<FhirTreeNode> => {
  const logger = fpe.getLogger();
  logger.info(`Finding matching node for diffId: ${diffId} in node: ${node.id}`);
  const segments = diffId.split('.');
  
  let currentNode = node;
    
  // Iterate over the segments and find each child recursively
  for (const segment of segments) {
    // Find the child corresponding to the current segment
    currentNode = await findChild(fpe, currentNode, segment);
  }
    
  return currentNode; // Return the final matching node after processing all segments
};
  