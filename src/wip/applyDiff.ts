import { ElementDefinition, FhirTreeNode } from './types';
import { buildTreeFromSnapshot } from './sdTransformer';

export const applyDiffToTree = async (
  tree: FhirTreeNode,
  diffElements: ElementDefinition[],
  getSnapshot: (typeCode: string) => Promise<ElementDefinition[]>,
  logger?: (message: string) => void
): Promise<FhirTreeNode> => {
  const clonedTree = structuredClone(tree);
  const diffById = new Map(diffElements.map(e => [e.id, e]));
  const appliedIds = new Set<string>();

  if (clonedTree.definition && clonedTree.definition.extension) {
    delete clonedTree.definition.extension;
  }

  function isNodeSliceable(node: FhirTreeNode): boolean {
    return node.nodeType === 'array' || node.nodeType === 'poly' || node.nodeType === 'resliced';
  }

  function findMatchingNode(diffId: string, node: FhirTreeNode): FhirTreeNode | undefined {
    logger?.(`Searching for matching node for diffId: ${diffId} in node: ${node.id}`);
    if (node.id === diffId) {
      logger?.(`Found matching node: ${node.id}`);
      return node;
    }
    logger?.(`Node ${node.id} does not match diffId ${diffId}`);
    if (isNodeSliceable(node)) {
      logger?.(`Node ${node.id} is sliceable, checking master group...`);
      const masterGroup = node.children[0];
      if (masterGroup && masterGroup.id === diffId) {
        return masterGroup;
      }
    }
    for (const child of node.children) {
      const match = findMatchingNode(diffId, child);
      if (match) {
        return match;
      }
    }
    return undefined;
  }

  function getDefinitionTarget(node: FhirTreeNode): FhirTreeNode | undefined {
    if (node.definition) {
      return node;
    }
    if (isNodeSliceable(node)) {
      const masterGroup = node.children[0];
      if (masterGroup?.definition) {
        return masterGroup;
      }
    }
    return undefined;
  }

  async function expandNode(node: FhirTreeNode, diffById: Map<string, ElementDefinition>): Promise<void> {
    const defTarget = isNodeSliceable(node) ? node.children[0] : node;
    
    // if node has children - it is already expanded
    if (defTarget.children.length > 0) return;
  
    if (!defTarget?.definition?.type || defTarget.definition.type.length === 0) {
      if (logger) logger(`Node '${node.id}' has no type to expand.`);
      return;
    }
  
    const typeCode = defTarget.definition.type[0].code;
    const typeSnapshot = await getSnapshot(typeCode);
    if (!typeSnapshot || typeSnapshot.length === 0) {
      throw new Error(`Snapshot for type '${typeCode}' is empty or missing.`);
    }
  
    const oldPrefix = typeSnapshot[0].id;
    const newPrefix = node.id;
  
    const rewrittenSnapshot = rewriteSnapshotElements(typeSnapshot, newPrefix, oldPrefix);
    const expandedSubtree = buildTreeFromSnapshot(rewrittenSnapshot);
  
    const insertionTarget =
      isNodeSliceable(node)
        ? node.children[0] // Insert into the master group of the sliceable node
        : node;
  
    if (!insertionTarget) {
      throw new Error(`Cannot find insertion point for expanded children under node '${node.id}'.`);
    }
  
    insertionTarget.children.push(...expandedSubtree.children);
  
    if (logger) {
      logger(`Expanded node '${node.id}' with children: ${expandedSubtree.children.map(c => c.id).join(', ')}`);
    }
  
    // 🟢 Only expand children if the diff contains their descendants:
    for (const child of insertionTarget.children) {
      if (shouldExpandNode(child, diffById)) {
        const childDefTarget = child.definition ? child : child.children[0];
        if (childDefTarget?.definition?.type?.length) {
          await expandNode(child, diffById);
        }
      }
    }
  }
  
  
  function shouldExpandNode(child: FhirTreeNode, diffById: Map<string, ElementDefinition>): boolean {
    const prefix = child.id + '.';
    for (const diffId of diffById.keys()) {
      if (diffId.startsWith(prefix)) {
        return true;
      }
    }
    return false;
  }
  

  function rewriteSnapshotElements(
    snapshot: ElementDefinition[],
    newPrefix: string,
    oldPrefix: string
  ): ElementDefinition[] {
    const oldPrefixDot = oldPrefix.endsWith('.') ? oldPrefix : oldPrefix + '.';
    const newPrefixDot = newPrefix.endsWith('.') ? newPrefix : newPrefix + '.';
  
    const replace = (str: string) =>
      str === oldPrefix
        ? newPrefix
        : str.startsWith(oldPrefixDot)
          ? newPrefixDot + str.slice(oldPrefixDot.length)
          : str;
  
    return snapshot.map(el => ({
      ...el,
      id: replace(el.id),
      path: replace(el.path)
    }));
  }

  for (const [diffId, diffElement] of diffById.entries()) {
    let matchingNode = findMatchingNode(diffId, clonedTree);
    let targetNode = matchingNode ? getDefinitionTarget(matchingNode) : undefined;

    if (!matchingNode) {
      // 🚩 Recursive expansion logic: retry by walking up the path
      const retryPathSegments = diffId.split('.');
      while (retryPathSegments.length > 0 && !matchingNode) {
        const parentPath = retryPathSegments.join('.');
        const parentNode = findMatchingNode(parentPath, clonedTree);

        if (parentNode) {
          await expandNode(parentNode, diffById);

          matchingNode = findMatchingNode(diffId, clonedTree);
          targetNode = matchingNode ? getDefinitionTarget(matchingNode) : undefined;
          if (matchingNode) break; // stop if matching worked after expansion
        }

        retryPathSegments.pop(); // walk up the chain
      }
    }

    if (matchingNode && targetNode) {
      appliedIds.add(diffId);

      for (const key of Object.keys(diffElement) as Array<keyof ElementDefinition>) {
        if (key === 'constraint') {
          const baseConstraints = targetNode.definition!.constraint || [];
          const diffConstraints = diffElement.constraint || [];
          targetNode.definition!.constraint = [...baseConstraints, ...diffConstraints];
        } else if (key === 'condition') {
          const baseConditions = targetNode.definition!.condition || [];
          const diffConditions = diffElement.condition || [];
          const mergedConditions = [...baseConditions, ...diffConditions];
          targetNode.definition!.condition = Array.from(new Set(mergedConditions));
        } else {
          if (diffElement[key] !== undefined) {
            targetNode.definition![key] = diffElement[key];
          }
        }
      }
    } else {
      const message = `Warning: Diff element with id '${diffId}' did not match any node in the tree.`;
      if (logger) {
        logger(message);
      } else {
        console.warn(message);
      }
    }
  }

  return clonedTree;
};

