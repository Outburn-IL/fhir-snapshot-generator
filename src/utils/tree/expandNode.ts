/**
 * © Copyright Outburn Ltd. 2022-2025 All Rights Reserved
 *   Project name: fhir-snapshot-generator
 */

import { isNodeSliceable, toTree, rewriteElementPaths, DefinitionFetcher } from '..';
import { FhirTreeNode, ElementDefinition, ElementDefinitionType } from '../../../types';

/**
 * Expands a node by ensuring its children are populated.
 * @param node - the node to expand
 * @returns - the expanded node
 */
export const expandNode = async (node: FhirTreeNode, fetcher: DefinitionFetcher): Promise<FhirTreeNode> => {
  if (isNodeSliceable(node)) {
    throw new Error(`Node '${node.id}' is sliceable. Expand node must be called on a specific slice, headslice or a non-sliceable node.`);
  }

  // if node has children - it is already expanded
  if (node.children.length > 0) return node;

  // if node has no definition - throw.
  if (!node.definition) {
    throw new Error(`Node '${node.id}' has no ElementDefinition. Cannot expand.`);
  }

  const definition: ElementDefinition = node.definition;

  // if node has no type nor contentReference - throw.
  if ((!definition.type || definition.type.length === 0) && (!definition.contentReference)) {
    throw new Error(`Node '${node.id}' has no type or contentReference defined. Cannot expand.`);
  }

  let snapshotElements: ElementDefinition[] = [];
  // if node has contentReference - use it to get the snapshot.
  if (definition.contentReference) {
    snapshotElements = await fetcher.getContentReference(definition.contentReference);
    if (!snapshotElements || snapshotElements.length === 0) {
      throw new Error(`Snapshot for contentReference '${definition.contentReference}' is empty or missing.`);
    }
    // See: https://hl7.org/fhir/R4/elementdefinition-definitions.html#ElementDefinition.contentReference
    // ** Rule eld-5 - cannot have type information AND contentReference at the same time.
    delete definition.contentReference; // remove contentReference from the definition.
  } else if (definition.type && definition.type.length > 1) {
    // if there are multiple types (polymorphic) - expand using the base 'Element' type.
    // This gives us the only children that are common to all types.
    snapshotElements = await fetcher.getBaseType('Element');
    if (!snapshotElements || snapshotElements.length === 0) {
      throw new Error('Snapshot for base type \'Element\' is empty or missing.');
    }
  } else if (definition.type && definition.type.length === 1) {
    // only a single type
    const elementType: ElementDefinitionType = definition.type[0];

    if (elementType.profile && elementType.profile.length > 0) {
      // if type has `profile` - use it to get the snapshot.
      // Currently only the first profile is used. It is not clear how to handle multiple profiles.
      // In the spec it says "one must apply" - but expansion can only be done using one profile...
      // TODO: Test how SUSHI handles this case.
      const url = elementType.profile[0];
      snapshotElements = await fetcher.getByUrl(url);
      if (!snapshotElements || snapshotElements.length === 0) {
        throw new Error(`Snapshot for type '${url}' is empty or missing.`);
      }
    } else {
      // if type has no profile - use the type code to get the snapshot.
      const id = elementType.code;
      snapshotElements = await fetcher.getBaseType(id);
      if (!snapshotElements || snapshotElements.length === 0) {
        throw new Error(`Snapshot for type '${id}' is empty or missing.`);
      }
    }
  }
  // if no snapshot elements were found - throw.
  if (!snapshotElements || snapshotElements.length === 0) {
    throw new Error(`Error expanding node '${node.id}' - the snapshot contains no elements.`);
  }
  // rewrite the paths of the snapshot elements to match the current node
  const oldPrefix = snapshotElements[0].id;
  const newPrefix = node.id;
  const rewrittenElements = rewriteElementPaths(snapshotElements, newPrefix, oldPrefix);
  // construct the new node from the element array
  const expandedSubtree = toTree(rewrittenElements);
  const clonedNode = { ...node, children: expandedSubtree.children };
  return clonedNode;
};