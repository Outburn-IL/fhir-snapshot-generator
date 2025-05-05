import { FhirPackageExplorer, LookupFilter } from 'fhir-package-explorer';
import { ElementDefinition, FhirTreeNode } from './types';

// const stripDefinitions = (node: FhirTreeNode): FhirTreeNode => {
//   const { children, ...rest } = node;
//   const restClone = {...rest};
//   delete restClone.definition; // remove definition from the node
//   return {
//     ...restClone,
//     children: children.map(stripDefinitions)
//   };
// };

/**
 * Gets the node type based on the element definition properties.
 * @param element - the element definition to check
 * @returns - the node type as a string
 */
export const getNodeType = (element: ElementDefinition): 'array' | 'poly' | 'element' | 'resliced' | 'slice' => {
  if (element.id.endsWith('[x]')) {
    return 'poly';
  }
  if (element.sliceName) {
    if (element.slicing) return 'resliced';
    return 'slice';
  }
  if (element.base?.max && (element.base.max === '*' || parseInt(element.base.max) > 1)) {
    return 'array';
  }
  return 'element';
};

/**
 * Checks if a node is sliceable based on its node type.
 * @param node - the node to check
 * @returns - true if the node is sliceable, false otherwise
 */
export const isNodeSliceable = (node: FhirTreeNode): boolean => {
  return ['array', 'poly', 'resliced'].includes(node.nodeType);
};

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

/**
 * Builds a tree from an array of ElementDefinition objects.
 * @param elements - the array of elements to convert to a tree
 * @returns - the root node of the tree, including all nested children
 */
export const toTree = (elements: ElementDefinition[]): FhirTreeNode => {
  if (elements.length === 0) {
    throw new Error('Element array is empty');
  }
  // console.log('Building tree from elements:', elements.map(el => el.id).join(', '));
  // console.log('Elements:', JSON.stringify(elements, null, 2));
  
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
  console.log('Root element:', rootElement.id);
  const rootNode = createNode(rootElement, 'element'); // Force root as element
  // console.log('Root node:', JSON.stringify(stripDefinitions(rootNode), null, 2));
  idToNode.set(rootNode.id, rootNode);
  
  for (let i = 1; i < elements.length; i++) {
    console.log('Processing element:', elements[i].id);
    const element = elements[i];
    const { idSegments } = makeSegments(element.id);
    // if the current element last segment contains a slice name, then parent should be the part before the slice name
    // otherwise, parent should be the part before the last segment
    const lastSegment = idSegments[idSegments.length - 1];
    const isSlice = lastSegment.includes(':');
    const lastSegmentWithoutSlice = isSlice ? lastSegment.split(':')[0] : lastSegment;
    const parentPath = isSlice ? idSegments.slice(0, -1).join('.') + `.${lastSegmentWithoutSlice}` : idSegments.slice(0, -1).join('.');
    console.log('Parent path:', parentPath);
  
    const parentNode = idToNode.get(parentPath);
    if (!parentNode) {
      throw new Error(`Parent node not found for element ${element.id}`);
    }
  
    const newNode = createNode(element);
  
    if (isNodeSliceable(parentNode)) {
      console.log('Parent node is sliceable:', parentNode.id);
      // if current element is a slice - add it to the parent node
      // otherwise - add it to the headslice
      if (isSlice) {
        console.log(`Adding slice ${newNode.id} to parent: ${parentNode.id}`);
        parentNode.children.push(newNode);
      } else {
        console.log(`Adding child ${newNode.id} to headslice: ${parentNode.id}`);
        parentNode.children[0].children.push(newNode); // headslice is always the first child
      }
    } else {
      console.log(`Parent node is NOT sliceable: ${parentNode.id}`);
      console.log(`Adding child ${newNode.id} to parent: ${parentNode.id}`);
      parentNode.children.push(newNode);
    }
  
    idToNode.set(newNode.id, newNode);
  }
  
  return rootNode;
};

/**
 * Fetches the snapshot elements for a given structure definition id or url.
 * TODO: Replace with a recursion once snapshot generation and caching is implemented.
 * @param idOrUrl - the id or url of the structure definition to fetch
 * @param fpe - the FhirPackageExplorer instance to use for fetching
 * @param pkg? - the package name to filter by (optional) 
 * @returns - a promise that resolves to an array of ElementDefinition objects
 */
export const getSnapshotElements = async (idOrUrl: string, fpe: FhirPackageExplorer, pkg?: string): Promise<ElementDefinition[]> => {
  // Placeholder for the actual getSnapshot that will be part of this package and use cache
  // Currently all requests are passed to fhir-package-explorer and no cache is used
  // Also all snapshots returned are the ones that exist in original package and not the ones generated by us
  const logger = fpe.getLogger();
  logger.info(`Fetching snapshot elements for: ${idOrUrl}`);
  // if the string starts with 'http[s]:', it is a url, otherwise it is an id
  const isUrl = idOrUrl.startsWith('http:') || idOrUrl.startsWith('https:');
  const filter: LookupFilter = { [isUrl ? 'url' : 'id']: idOrUrl };
  if (pkg) {
    filter.package = pkg;
  }
  const snapshot = await fpe.resolve({ resourceType: 'StructureDefinition', ...filter });
  return snapshot.snapshot.element;
};

/**
 * Rewrites the paths and id's of elements in an array to match a new prefix.
 * The id's maintain slice names while the paths don't.
 * @param elements - the array of elements to rewrite
 * @param newPrefix - the new prefix to use for the element ids and paths
 * @param oldPrefix - the old prefix to replace in the element ids and paths
 * @returns - the rewritten array of elements
 */
export const rewriteElementPaths = (
  elements: ElementDefinition[],
  newPrefix: string,
  oldPrefix: string
): ElementDefinition[] => {
  const oldPrefixDot = oldPrefix.endsWith('.') ? oldPrefix : oldPrefix + '.';
  const newPrefixDot = newPrefix.endsWith('.') ? newPrefix : newPrefix + '.';

  const removeSlices = (elementIdPart: string): string => {
    const segments = elementIdPart.split('.');
    // for each segment, remove the slice name if it exists
    const cleanedSegments = segments.map(segment => {
      const sliceIndex = segment.indexOf(':');
      return sliceIndex !== -1 ? segment.slice(0, sliceIndex) : segment;
    });
    return cleanedSegments.join('.'); 
  };
  
  const replaceId = (str: string) =>
    str === oldPrefix
      ? newPrefix
      : str.startsWith(oldPrefixDot)
        ? newPrefixDot + str.slice(oldPrefixDot.length)
        : str;
  
  const replacePath = (elementPath: string) => {
    const newPathPrefix = removeSlices(newPrefixDot);
    const oldPathPrefix = removeSlices(oldPrefixDot);
    return elementPath === oldPathPrefix
      ? newPathPrefix
      : elementPath.startsWith(oldPathPrefix)
        ? newPathPrefix + elementPath.slice(oldPathPrefix.length)
        : elementPath;
  };

  return elements.map(el => ({
    ...el,
    id: replaceId(el.id),
    path: replacePath(el.path)
  }));
};

/**
 * Rewrites the paths and id's of an entire branch to match a new prefix.
 * The id's maintain slice names while the paths don't.
 * @param node - the branch in the tree to rewrite
 * @param newPrefix - the new prefix to use for the element ids and paths
 * @param oldPrefix - the old prefix to replace in the element ids and paths
 * @returns the rewritten branch of the tree
 */
export const rewriteNodePaths = (
  node: FhirTreeNode,
  newPrefix: string,
  oldPrefix: string
): FhirTreeNode => {
  const flattened = fromTree(node);
  const rewritten = rewriteElementPaths(flattened, newPrefix, oldPrefix);
  const newNode = toTree(rewritten);
  return newNode;
};

/**
 * Expands a node by ensuring its children are populated.
 * @param node - the node to expand
 * @returns - the expanded node
 */
export const expandNode = async (node: FhirTreeNode, fpe: FhirPackageExplorer): Promise<FhirTreeNode> => {
  if (isNodeSliceable(node)) {
    throw new Error(`Node '${node.id}' is sliceable. Expand node must be called on a specific slice, headslice or a non-sliceable node.`);
  }

  // if node has children - it is already expanded
  if (node.children.length > 0) return node;

  // if node has no definition - throw.
  if (!node.definition) {
    throw new Error(`Node '${node.id}' has no ElementDefinition. Cannot expand.`);
  }

  // if node has no type - throw.
  if (!node.definition.type || node.definition.type.length === 0) {
    throw new Error(`Node '${node.id}' has no ElementDefinition.type. Cannot expand.`);
  }

  // if there are multiple types (polymorphic) - throw. 
  // (We shouldn't have arrived here since polymorphic elements are sliceable...)
  if (node.definition.type.length > 1) {
    throw new Error(`Node '${node.id}' has multiple types. Node expansion must be called on a specific type.`);
  }
  
  const logger = fpe.getLogger();
  const elementType = node.definition.type[0];

  // if type has `profile` - use it to get the snapshot.
  // Currently only the first profile is used. It is not clear how to handle multiple profiles.
  // In the spec it says "one must apply" - but expansion can only be done using one profile...
  // TODO: Test how SUSHI handles this case.
  const typeIdentifier = elementType.profile?.[0] ?? elementType.code;
  const snapshotElements: ElementDefinition[] = await getSnapshotElements(typeIdentifier, fpe);
  if (!snapshotElements || snapshotElements.length === 0) {
    throw new Error(`Snapshot for type '${typeIdentifier}' is empty or missing.`);
  }
  // rewrite the paths of the snapshot elements to match the current node
  const oldPrefix = snapshotElements[0].id;
  const newPrefix = node.id;
  const rewrittenElements = rewriteElementPaths(snapshotElements, newPrefix, oldPrefix);
  // construct the new node from the element array
  const expandedSubtree = toTree(rewrittenElements);
  logger.info(`Node '${node.id}' expanded with ${expandedSubtree.children.length} children.`);
  const clonedNode = { ...node, children: expandedSubtree.children };
  return clonedNode;
};

/**
 * Check if current working snapshot array contains the target element id.
 * @param elements working snapshot array
 * @param targetElementId target element id
 * @returns true if the element exists, false otherwise
 */
export const nodeExists = (elements: ElementDefinition[], targetElementId: string): boolean => {
  return elements.some(element => element.id === targetElementId);
};

/**
 * Takes a parent node and a child id, and checks if the child exists in the working snapshot array.
 * @param elements working snapshot array
 * @param parentNode the full path of the parent node to look for the child in
 * @param childId the last segment of the child element id to look for, e.g "identifier:foo" or "system"
 * @returns true if the child exists, false otherwise
 */
export const childExists = (elements: ElementDefinition[], parentNode: string, childId: string): boolean => {
  return nodeExists(elements, `${parentNode}.${childId}`);
};

/**
 * Injects a block of elements into the working snapshot array at the specified injection point.
 * The injection point is the id of the element where the block will be injected.
 * The block will replace the existing element at the injection point, and all of it's children (slices, elements).
 * @param elements working snapshot array
 * @param injectionPoint the id of the element the block will replace
 * @param elementBlock the block of elements to inject
 * @returns the updated element array after injection
 */
export const injectElementBlock = (elements: ElementDefinition[], injectionPoint: string, elementBlock: ElementDefinition[]): ElementDefinition[] => {
  // console.log('Injecting element block:', elementBlock.map(el => el.id), 'at injection point:', injectionPoint);
  // console.log('Current elements (before):', elements.map(el => el.id));
  const index = elements.findIndex(el => el.id === injectionPoint);
  if (index === -1) throw new Error(`Element with id "${injectionPoint}" not found`);
  const before = elements.slice(0, index);
  const after = elements.slice(index + 1).filter(element => !(element.id.startsWith(`${injectionPoint}.`)) && !(element.id.startsWith(`${injectionPoint}:`))); // Skip the target
  const results = [...before, ...elementBlock, ...after];
  // console.log('Elements after injection:', results.map(el => el.id));
  return results;
};

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
  logger.info(`Ensuring child '${childId}' exists under parent '${parentId}'`);
  // logger.info(`Current working snapshot (before): ${elements.map(el => el.id).join('\n')}`);
  const parentElementBlock = elements.filter(element => element.id === parentId || element.id.startsWith(`${parentId}.`));
  if (parentElementBlock.length === 0) {
    throw new Error(`Parent element '${parentId}' not found in the working snapshot array`);
  }
  logger.info(`Parent element '${parentId}' found in the working snapshot array`);
  // logger.info(`Parent element block: ${parentElementBlock.map(el => el.id).join(', ')}`);
  logger.info('Converting parent element block to tree...');
  let parentNode = toTree(parentElementBlock);
  // logger.info(`Parent block converted to tree: ${JSON.stringify(stripDefinitions(parentNode), null, 2)}`);
  if (isNodeSliceable(parentNode)) {
    logger.info(`Parent node '${parentId}' is sliceable. Stepping into headslice.`);
    parentNode = parentNode.children[0]; // headslice is always the first child
    // logger.info(`Parent node after stepping into headslice: ${JSON.stringify(stripDefinitions(parentNode), null, 2)}`);
  }
  const isExpanded = parentNode.children.length > 0;
  if (!isExpanded) {
    logger.info(`Parent node '${parentId}' is not expanded. Expanding...`);
    parentNode = await expandNode(parentNode, fpe);
    elements = injectElementBlock(elements, parentId, fromTree(parentNode));
  }
  const [ elementName, sliceName ] = childId.split(':');
  const childElement = parentNode.children.find(element => element.id.endsWith(`.${elementName}`));
  if (!childElement) throw new Error(`Element '${childId}' is illegal under '${parentId}'.`);
  // child found
  logger.info(`Child element '${elementName}' found under parent '${parentId}'`);
  console.log(`DEBUG: '${elementName}' was found with children:`);
  for (const ch of childElement.children ?? []) {
    console.log(` - ${ch.id}${ch.sliceName ? ` (sliceName=${ch.sliceName})` : ''}`);
  }

  if (!sliceName) return elements; // referring to child itself and it exists. nothing to do.
  
  // referring to slice
  logger.info(`Child element '${childId}' is a slice under element '${elementName}'`);
  // check if the child is sliceable - throw if not
  if (!isNodeSliceable(childElement)) {
    throw new Error(`Invalid differential element id '${childId}'. Element '${childElement.id}' is not sliceable.`);
  }
  // find the slice by name
  logger.info(`Finding slice '${sliceName}' under child element '${childElement.id}'`);
  logger.info(`Child element '${childElement.id}' has ${childElement.children.length} children`);
  // logger.info(`Child element '${childElement.id}' children: ${childElement.children.map(child => child.id).join(', ')}`);
  // logger.info(`Child element: ${JSON.stringify(childElement, null, 2)}`);
  const slice = childElement.children.find(slice => slice.sliceName === sliceName);

  // if found - it's already in the element array. nothing to do.
  if (slice) {
    logger.info(`Slice '${sliceName}' found under child element '${childElement.id}'`);
    console.log(`DEBUG: ${sliceName} was found with children:`);
    for (const ch of slice.children ?? []) {
      console.log(` - ${ch.id}${ch.sliceName ? ` (sliceName=${ch.sliceName})` : ''}`);
    }
    return elements;
  }
  // if not found - create the slice by copying the headslice and rewriting the path and id
  logger.info(`Slice '${sliceName}' not found under child element '${childElement.id}'. Creating...`);
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
  logger.info(`New slice ${newSlice.id} is ready for injection (sliceName=${newSlice.sliceName})`);
  // logger.info(`Current slices (before): ${childElement.children.map(child => child.id).join(', ')}`);
  // add the new slice to the child element
  logger.info(`BEFORE push: Existing children of child element '${childElement.id}':`);
  for (const c of childElement.children) {
    logger.info(` - ${c.id} (sliceName=${c.sliceName ?? 'none'})`);
  }
  childElement.children.push(newSlice);
  logger.info(`New slice ${newSlice.id} added to child element ${childElement.id}`);
  // logger.info(`Current slices (after): ${childElement.children.map(child => `${child.id}(${child.sliceName})`).join(', ')}`);
  // replace the child element (that now includes a new slice) in the elements array
  elements = injectElementBlock(elements, childElement.id, fromTree(childElement));
  // const newBlock = fromTree(childElement);
  // logger.info(`Injecting new block for '${childElement.id}':`);
  // for (const el of newBlock) {
  //   logger.info(` - ${el.id}`);
  // }
  logger.info(`Slice '${sliceName}' created under child element '${childElement.id}'`);
  // logger.info(`Elements after ensuring child: ${elements.map(el => el.id)}`);
  return elements;
};

/**
 * Walks the path segements up to the target, expanding and creating slices as needed.
 * @param elements working snapshot array
 * @param targetElementId target element id
 * * @returns the updated element array after entire path to target element was added
 */
export const ensureNode = async (elements: ElementDefinition[], targetElementId: string, fpe: FhirPackageExplorer): Promise<ElementDefinition[]> => {
  const logger = fpe.getLogger();
  logger.info(`Ensuring node '${targetElementId}' exists in the working snapshot array`);
  // logger.info(`Current working snapshot (before): ${elements.map(el => el.id).join(', ')}`);
  const idSegments = targetElementId.split('.');
  const rootId = idSegments[0];
  let updatedElements = elements;
  // check that root matches the first element in the array
  if (elements[0].id !== rootId) {
    throw new Error(`Root element '${rootId}' not found in the working snapshot array`);
  }
  if (rootId === targetElementId) {
    // if the target is the root element, just return the elements array
    logger.info(`Target element '${targetElementId}' is the root element. Nothing to do.`);
    return updatedElements;
  }
  // loop over the remaining segments and ensure each one exists
  for (let i = 1; i < idSegments.length; i++) {
    const parentId = idSegments.slice(0, i).join('.');
    const childId = idSegments[i];
    // logger.info(`Ensuring child '${childId}' under parent '${parentId}'`);
    updatedElements = await ensureChild(updatedElements, parentId, childId, fpe);
  }
  // console.log(`Current working snapshot (after): ${updatedElements.map(el => el.id).join(', ')}`);
  return updatedElements;
};

/**
 * Merge an existing snapshot element with a diff element.
 * @param base 
 * @param diff 
 */
export const mergeElement = (base: ElementDefinition, diff: ElementDefinition): ElementDefinition => {
  console.log('Merging element:', base.id);
  // create a shallow working copy of the base element
  const mergedElement: ElementDefinition = { ...base };
  // apply the diff attributes, key by key
  for (const key of Object.keys(diff) as string[]) {
    if (key === 'constraint') {
      console.log('Merging constraints:', base.id, 'with diff:', diff.id);
      const baseConstraints = base.constraint || [];
      const diffConstraints = diff.constraint || [];
      mergedElement.constraint = [...baseConstraints, ...diffConstraints];
    } else if (key === 'condition') {
      console.log('Merging conditions:', base.id, 'with diff:', diff.id);
      const baseConditions = base.condition || [];
      const diffConditions = diff.condition || [];
      const mergedConditions = [...baseConditions, ...diffConditions];
      mergedElement.condition = Array.from(new Set(mergedConditions));
    } else if (key !== 'id' && key !== 'path') {
      if (diff[key] !== undefined) {
        // console.log('Overriding key:', `'${key}'`, 'with value:', diff[key]);
        mergedElement[key] = diff[key];
      };
    }
  }
  // console.log('Merged element:', JSON.stringify(mergedElement, null, 2));
  return mergedElement;
};

/**
 * Apply a single diff element to the working snapshot array and return the updated array.
 * The existing element will be replaced by the result of merging it with the diff element.
 * @param elements working snapshot array
 * @param diffElement the diff element to apply
 * @returns the updated element array after applying the diff element
 */
export const applyDiff = (elements: ElementDefinition[], diffElement: ElementDefinition): ElementDefinition[] => {
  // console.log('Processing diff element:', diffElement.id, 'working snapshot:', elements.map(el => el.id).join(', '));
  const index = elements.findIndex(el => el.id === diffElement.id);
  if (index === -1) {
    throw new Error(`Element with id "${diffElement.id}" not found`);
  }
  const baseElement = { ...elements[index]}; // create a shallow copy of the base element
  // console.log('Base element:', baseElement.id, 'index:', index);
  const mergedElement = mergeElement(baseElement, diffElement);
  const updatedElements = [...elements.slice(0, index), mergedElement, ...elements.slice(index + 1)];
  // console.log('Updated elements:', updatedElements.map(el => el.id).join(', '));
  return updatedElements;
};

/**
 * Apply all diffs to the working snapshot array, in order, and return the updated array.
 * Missing elements and their containing branches will be added to the working snapshot array on the fly.
 * The diff is an array of ElementDefinition objects that will be applied to the target element.
 * @param elements working snapshot array
 * @param diffElements the diff elements to apply
 * @returns the updated element array after applying the diff elements
 */
export const applyDiffs = async (elements: ElementDefinition[], diffs: ElementDefinition[], fpe: FhirPackageExplorer): Promise<ElementDefinition[]> => {
  const logger = fpe.getLogger();
  logger.info(`Applying ${diffs.length} diffs to the working snapshot array`);
  let updatedElements = [...elements];
  logger.info(`Working snapshot array length: ${elements.length}`);
  // logger.info(`Diffs array length: ${diffs.length}`);
  // logger.info(`Diffs: ${diffs.map(diff => diff.id).join(', ')}`);
  // remove extension array from root element if it exists
  if (updatedElements[0].extension) {
    logger.info(`Removing extension from root element '${updatedElements[0].id}'`);
    delete updatedElements[0].extension;
  }
  // if no diffs - return the elements array as is
  if (diffs.length === 0) return updatedElements;
  for (const diff of diffs) {
    logger.info(`Preparing to apply diff: ${diff.id}`);
    // logger.info(`Current working snapshot: ${updatedElements.map(el => el.id).join(', ')}`);

    logger.info(`Ensuring diff target ${diff.id} exists in the working snapshot array`);
    if (!nodeExists(updatedElements, diff.id)) {
      logger.info(`Diff target '${diff.id}' not found in the working snapshot array. Creating branch...`);
      // ensure the entire path to the target element exists in the working snapshot array
      updatedElements = await ensureNode(updatedElements, diff.id, fpe);
    }
    
    // apply the diff element to the working snapshot array
    updatedElements = applyDiff(updatedElements, diff);
  }
  return updatedElements;
};

