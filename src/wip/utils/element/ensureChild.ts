import { FhirPackageExplorer } from 'fhir-package-explorer';
import {
  rewriteNodePaths,
  toTree,
  fromTree,
  isNodeSliceable,
  expandNode,
  injectElementBlock
} from '..';

import { ElementDefinition } from '../../types';

/**
 * Takes a parent node and a child id, and ensures that the child exists in the working snapshot array.
 * If the child does not exist, it will be created by expanding the parent or creating the slice.
 * @param elements working snapshot array
 * @param parentId the full path of the parent node to look for the child in
 * @param childId the last segment of the child element id to look for, e.g "identifier:foo" or "system"
 * @returns the updated element array after child was added
 */
export const ensureChild = async (elements: ElementDefinition[], parentId: string, childId: string, fpe: FhirPackageExplorer): Promise<ElementDefinition[]> => {
  const logger = fpe.getLogger();
  const parentElementBlock = elements.filter(element => element.id === parentId || element.id.startsWith(`${parentId}.`));
  if (parentElementBlock.length === 0) {
    throw new Error(`Parent element '${parentId}' not found in the working snapshot array`);
  }
  let parentNode = toTree(parentElementBlock);
  if (isNodeSliceable(parentNode)) {
    parentNode = parentNode.children[0]; // headslice is always the first child
  }
  const isExpanded = parentNode.children.length > 0;
  if (!isExpanded) {
    logger.info(`Expanding element '${parentId}'...`);
    parentNode = await expandNode(parentNode, fpe);
    elements = injectElementBlock(elements, parentId, fromTree(parentNode));
  }
  const [ elementName, sliceName ] = childId.split(':');
  const childElement = parentNode.children.find(element => element.id.endsWith(`.${elementName}`));
  if (!childElement) throw new Error(`Element '${childId}' is illegal under '${parentId}'.`);

  if (!sliceName) return elements; // referring to child itself and it exists. nothing to do.
  
  // referring to slice
  // check if the child is sliceable - throw if not
  if (!isNodeSliceable(childElement)) {
    throw new Error(`Invalid differential element id '${childId}'. Element '${childElement.id}' is not sliceable.`);
  }
  // find the slice by name
  const slice = childElement.children.find(slice => slice.sliceName === sliceName);

  // if found - it's already in the element array. nothing to do.
  if (slice) {
    return elements;
  }
  // if not found - create the slice by copying the headslice and rewriting the path and id
  logger.info(`Creating slice '${childId}'...`);
  const headSlice = childElement.children[0]; // the first child is the headslice
  const newId = `${headSlice.id}:${sliceName}`;

  const newSlice = rewriteNodePaths(headSlice, newId, headSlice.id);
  newSlice.nodeType = 'slice'; // set the node type to slice
  // remove slicing initiator
  delete newSlice.definition?.slicing;
  // remove mustSupport from the new slice
  delete newSlice.definition?.mustSupport;
  // set the slice name
  newSlice.sliceName = sliceName;
  if (newSlice.definition) {
    newSlice.definition.sliceName = sliceName;
  }
  // add the new slice to the child element
  childElement.children.push(newSlice);
  // replace the child element (that now includes a new slice) in the elements array
  elements = injectElementBlock(elements, childElement.id, fromTree(childElement));
  return elements;
};