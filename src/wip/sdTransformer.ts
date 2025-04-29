import { ElementDefinition, FhirTreeNode } from './types';
import { isNodeSliceable } from './isNodeSliceable';

const getNodeType = (element: ElementDefinition): 'array' | 'poly' | 'element' | 'resliced' | 'slice' => {
  if (element.id.endsWith('[x]')) {
    return 'poly';
  }
  if (element.base?.max && (element.base.max === '*' || parseInt(element.base.max) > 1)) {
    return 'array';
  }
  if (element.sliceName) {
    if (element.slicing) return 'resliced';
    return 'slice';
  }
  return 'element';
};

export const buildTreeFromSnapshot = (snapshot: ElementDefinition[]): FhirTreeNode => {
  if (snapshot.length === 0) {
    throw new Error('Snapshot array is empty');
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
    const nodeType = forceNodeType || getNodeType(element);

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
      const masterGroup: FhirTreeNode = {
        id: element.id,
        path: element.path,
        idSegments,
        pathSegments,
        nodeType: 'headslice', // This is a special type for the master group
        definition: element,
        children: []
      };
      node.children.push(masterGroup);
    } else {
      node.definition = element; // Only element and slice nodes hold definitions
    }

    return node;
  };

  const rootElement = snapshot[0];
  const rootNode = createNode(rootElement, 'element'); // Force root as element
  idToNode.set(rootNode.id, rootNode);

  for (let i = 1; i < snapshot.length; i++) {
    const element = snapshot[i];
    const { idSegments } = makeSegments(element.id);
    const parentPath = idSegments.slice(0, -1).join('.');

    const parentNode = idToNode.get(parentPath);
    if (!parentNode) {
      throw new Error(`Parent node not found for element ${element.id}`);
    }

    const newNode = createNode(element);

    if (isNodeSliceable(parentNode)) {
      const masterGroup = parentNode.children[0];
      if (!masterGroup) {
        throw new Error(`headslice missing under ${parentNode.id}, should have been created immediately`);
      }
      masterGroup.children.push(newNode);
    } else if (parentNode.nodeType === 'slice' || parentNode.nodeType === 'element' || parentNode.nodeType === 'headslice') {
      parentNode.children.push(newNode);
    } else {
      throw new Error(`Unsupported parent node type: ${parentNode.nodeType} for parent ${parentNode.id}`);
    }

    idToNode.set(newNode.id, newNode);
  }

  return rootNode;
};


export const flattenTreeToSnapshot = (tree: FhirTreeNode): ElementDefinition[] => {
  const result: ElementDefinition[] = [];

  function visit(node: FhirTreeNode) {
    // Only output nodes that hold a definition
    if (node.nodeType === 'element' || node.nodeType === 'slice' || node.nodeType === 'headslice') {
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
