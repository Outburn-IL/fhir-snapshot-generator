/**
 * © Copyright Outburn Ltd. 2022-2025 All Rights Reserved
 *   Project name: fhir-snapshot-generator
 */

import { ILogger } from 'fhir-package-explorer';
import {
  rewriteNodePaths,
  toTree,
  fromTree,
  isNodeSliceable,
  expandNode,
  injectElementBlock,
  DefinitionFetcher,
  findMonopolyShortcutTarget,
  applySingleDiff,
  initCap
} from '..';

import { ElementDefinition } from '../../../types';

/**
 * Takes a parent node and a child id, and ensures that the child exists in the working snapshot array.
 * If the child does not exist, it will be created by expanding the parent or creating the slice.
 * @param elements working snapshot array
 * @param parentId the full path of the parent node to look for the child in
 * @param childId the last segment of the child element id to look for, e.g "identifier:foo" or "system"
 * @param fetcher the definition fetcher to use for expanding the node
 * @param logger the logger to use for logging messages
 * @returns the updated element array after child was added
 */
export const ensureChild = async (
  elements: ElementDefinition[],
  parentId: string,
  childId: string,
  fetcher: DefinitionFetcher,
  logger: ILogger,
  pathRewriteMap: Map<string, { id: string, path: string }>
): Promise<ElementDefinition[]> => {
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
    parentNode = await expandNode(parentNode, fetcher);
    elements = injectElementBlock(elements, parentId, fromTree(parentNode));
  }
  const [ elementName, sliceName ] = childId.split(':');
  
  // Try to find a direct child with the expected segment name
  const childElement = parentNode.children.find(element => element.id.endsWith(`.${elementName}`));
  
  if (!childElement) {
    // Check if it's a shortcut to a polymorphic element
    const match = findMonopolyShortcutTarget(parentId, elementName, parentNode.children);
    if (match) {
      const canonicalId = `${parentId}.${match.rewrittenSegment}`;
      const elementDefinition = elements.find(e => e.id === canonicalId);
      const canonicalPath = elementDefinition?.path ?? canonicalId;

      // Register the rewritten ID and path for future rewriting
      pathRewriteMap.set(`${parentId}.${elementName}`, {
        id: canonicalId,
        path: canonicalPath
      });

      // Apply a virtual diff that constrains the polymorphic type
      const virtualDiff: ElementDefinition = {
        id: canonicalId,
        path: canonicalPath,
        type: [{ code: match.type }]
      };

      elements = applySingleDiff(elements, virtualDiff);
      return elements;
    }

    // If still not found → this is truly illegal
    throw new Error(`Element '${childId}' is illegal under '${parentId}'.`);
  }

  if (!sliceName) return elements; // referring to child itself and it exists. nothing to do.
  
  // referring to a slice

  // if child is not sliceable, no slices are allowed but we must be forgiving for this since some HL7 profiles do it.
  // Ex: The 'catalog' profile on Composition has a "date:IssueDate" diff while "date" is not sliceable.
  if (!isNodeSliceable(childElement)) {
    // ignore the sliceName and return the elements as is after registering the path rewrite
    const aliasId = `${childElement.id}:${sliceName}`;
    pathRewriteMap.set(aliasId, {
      id: childElement.id,
      path: childElement.path
    });
    return elements;
  }
  // find the slice by name
  const slice = childElement.children.find(slice => slice.sliceName === sliceName);

  // if found - it's already in the element array. nothing to do.
  if (slice) {
    return elements;
  }
  if (!slice) {
  // Potentially a monopoly alias — check type
    if (elementName.endsWith('[x]') && childElement.children[0].definition?.type?.length === 1) {
      const onlyType = childElement.children[0].definition.type[0].code;
      const monopolySliceName = `${elementName.slice(0, -3)}${initCap(onlyType)}`;

      if (sliceName === monopolySliceName) {
        // Monopoly alias - treat this element id as canonical for the head slice
        const aliasId = `${childElement.id}:${sliceName}`;
        const aliasPath = childElement.path; // path never contains slice names

        pathRewriteMap.set(aliasId, {
          id: childElement.id,
          path: aliasPath
        });

        return elements;
      }
    }

    // ✅ Truly needs a new slice → proceed with slice creation
    const headSlice = childElement.children[0];
    const newId = `${headSlice.id}:${sliceName}`;

    const newSlice = rewriteNodePaths(headSlice, newId, headSlice.id);
    newSlice.nodeType = 'slice';
    delete newSlice.definition?.slicing;
    delete newSlice.definition?.mustSupport;
    newSlice.sliceName = sliceName;
    if (newSlice.definition) {
      newSlice.definition.sliceName = sliceName;
    }

    childElement.children.push(newSlice);
    elements = injectElementBlock(elements, childElement.id, fromTree(childElement));
  }
  return elements;
};