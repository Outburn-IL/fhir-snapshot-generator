import { FhirPackageExplorer, PackageIdentifier } from 'fhir-package-explorer';
import { getSnapshotElements, isNodeSliceable, toTree, rewriteElementPaths } from '..';
import { FhirTreeNode, ElementDefinition } from '../../types';

/**
 * Expands a node by ensuring its children are populated.
 * @param node - the node to expand
 * @returns - the expanded node
 */
export const expandNode = async (node: FhirTreeNode, fpe: FhirPackageExplorer, sourcePackage: PackageIdentifier): Promise<FhirTreeNode> => {
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
  // TODO: Is that true? It might be a headslice of a polymorphic element?
  //    in which case we need to expand just the common children of Element (id and extension).
  if (node.definition.type.length > 1) {
    throw new Error(`Node '${node.id}' has multiple types. Node expansion must be called on a specific type.`);
  }
  
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
  const clonedNode = { ...node, children: expandedSubtree.children };
  return clonedNode;
};