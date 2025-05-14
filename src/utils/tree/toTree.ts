import { toNodeType, isNodeSliceable } from '..';
import { ElementDefinition, FhirTreeNode } from '../../types';

/**
 * Builds a tree from an array of ElementDefinition objects.
 * @param elements - the array of elements to convert to a tree
 * @returns - the root node of the tree, including all nested children
 */
export const toTree = (elements: ElementDefinition[]): FhirTreeNode => {
  if (elements.length === 0) {
    throw new Error('Element array is empty');
  }
  
  const idToNode = new Map<string, FhirTreeNode>();
  
  const makeSegments = (fullId: string): { idSegments: string[], pathSegments: string[] } => {
    const idSegments = fullId.split('.');
    const pathSegments = idSegments.map(segment => segment.split(':')[0]); // Remove slice names
    return { idSegments, pathSegments };
  };
  
  const createNode = (
    element: ElementDefinition,
    forceNodeType?: 'element'
  ): FhirTreeNode => {
    const { idSegments, pathSegments } = makeSegments(element.id);
    const nodeType = forceNodeType || toNodeType(element);
  
    const node: FhirTreeNode = {
      id: element.id,
      path: element.path,
      idSegments,
      pathSegments,
      nodeType,
      children: []
    };
  
    if (isNodeSliceable(node)) {
      // Always create the headslice immediately for arrays/polys/resliceables:
      const headSlice: FhirTreeNode = {
        id: element.id,
        path: element.path,
        idSegments,
        pathSegments,
        nodeType: 'headslice',
        definition: element,
        children: []
      };
      node.children.push(headSlice);
    } else {
      node.definition = element; // Only element and slice nodes hold definitions
      if (element.sliceName) {
        node.sliceName = element.sliceName; // Add slice name to the node
      }
    }
  
    return node;
  };
  
  const rootElement = elements[0];
  const rootNode = createNode(rootElement, 'element'); // Force root as element
  idToNode.set(rootNode.id, rootNode);
  
  for (let i = 1; i < elements.length; i++) {
    const element = elements[i];
    const { idSegments } = makeSegments(element.id);
    // if the current element last segment contains a slice name, then parent should be the part before the slice name
    // otherwise, parent should be the part before the last segment
    const lastSegment = idSegments[idSegments.length - 1];
    const isSlice = lastSegment.includes(':');
    const lastSegmentWithoutSlice = isSlice ? lastSegment.split(':')[0] : lastSegment;
    const parentPath = isSlice ? idSegments.slice(0, -1).join('.') + `.${lastSegmentWithoutSlice}` : idSegments.slice(0, -1).join('.');
  
    const parentNode = idToNode.get(parentPath);
    if (!parentNode) {
      throw new Error(`Parent node not found for element ${element.id}`);
    }
  
    const newNode = createNode(element);
  
    if (isNodeSliceable(parentNode)) {
      // if current element is a slice - add it to the parent node
      // otherwise - add it to the headslice
      if (isSlice) {
        parentNode.children.push(newNode);
      } else {
        parentNode.children[0].children.push(newNode); // headslice is always the first child
      }
    } else {
      // if parent element is not sliceable - add child directly to it
      parentNode.children.push(newNode);
    }
  
    idToNode.set(newNode.id, newNode);
  }
  
  return rootNode;
};
