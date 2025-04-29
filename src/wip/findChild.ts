// Find an immediate child of a node.
// The node will be expanded if needed.

import { FhirTreeNode } from './types';
import { expandNode } from './expandNode';
import { FhirPackageExplorer } from 'fhir-package-explorer';
import { isNodeSliceable } from './isNodeSliceable';
import { rewriteElementPaths } from './rewriteElementPaths';
import { buildTreeFromSnapshot, flattenTreeToSnapshot } from './sdTransformer';

/**
 * Find an immediate child of a node.
 * The node will be expanded if needed.
 * @param fpe 
 * @param node - the containing node to look for the child in
 * @param childId - the last segment of the child element id to look for, e.g "identifier:foo" or "system"
 * @returns The child node if found, or throws an error if not found.
 */
export const findChild = async (fpe: FhirPackageExplorer, node: FhirTreeNode, childId: string): Promise<FhirTreeNode> => {
  const logger = fpe.getLogger();
  logger.info(`Finding child '${childId}' in node '${node.id}'`);
  // get the element name and possibly slice name
  const [elementName, sliceName] = childId.split(':');
  logger.info(`Element name: ${elementName}, Slice name: ${sliceName}`);
  if (isNodeSliceable(node)) {
    logger.info(`Node '${node.id}' is sliceable. Finding child in headslice.`);
    // containing node is sliceable, for example: 'Patient.identifier' (node) - 'system' (childId).
    // This means the containing path does not refer to a specific slice (e.g identifier:foo - system)
    // but to all slices (headslice) of the containing element (e.g identifier).
    // So we just step into the headslice and continue as usual.
    node = node.children[0]; // headslice is always the first child
  } 
  
  // here, the node must be non-sliceable, so we should just find the child
  // example: Patient.identifier - Patient is non-sliceable, so identifier will be a direct child

  // ensure node is expanded (has its children populated)
  await expandNode(node, fpe);
  // find the child by element name
  const child = node.children.find(element => {
    const idSegments = element.idSegments;
    const lastSegment = idSegments[idSegments.length - 1];
    return lastSegment === elementName;
  });
  if (child) { // found the child
    // if slice name is provided - find the slice
    if (sliceName) {
      // check if the child is sliceable - throw if not
      if (!isNodeSliceable(child)) {
        throw new Error(`Invalid differential element id '${childId}'. Element '${child.id}' is not sliceable.`);
      }
      // find the slice by name
      const slice = child.children.find(slice => slice.sliceName === sliceName);
      if (slice) {
        // slice exists - return it
        return slice;
      } else {
        // create the slice by copying the headslice and rewriting the path and id
        const headSlice = structuredClone(child.children[0]); // the first child is the headslice
        const newId = `${headSlice.id}:${sliceName}`;
        // flatten the tree to get the element definition array
        const flattened = flattenTreeToSnapshot(headSlice);
        // rewrite the paths to match the new id
        const rewritten = rewriteElementPaths(flattened, newId, headSlice.id);
        // build the new node from the rewritten elements
        const newSlice = buildTreeFromSnapshot(rewritten);
        // set the slice name
        newSlice.sliceName = sliceName;
        // remove slicing initiator
        delete newSlice.definition?.slicing;
        // remove mustSupport from the new slice
        delete newSlice.definition?.mustSupport;
        // append the new slice
        child.children.push(newSlice);
        // return the new slice
        return newSlice;
      }
    } else {
      // no slice name provided - return the child
      return child;
    }
  } else {
    // if not found, that's an invalid child
    throw new Error(`Element '${childId}' not found under '${node.id}'.`);
  }
  
};