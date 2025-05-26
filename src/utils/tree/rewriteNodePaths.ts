/**
 * © Copyright Outburn Ltd. 2022-2025 All Rights Reserved
 *   Project name: fhir-snapshot-generator
 */

import { toTree, fromTree, rewriteElementPaths } from '..';
import { FhirTreeNode } from '../../../types';

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