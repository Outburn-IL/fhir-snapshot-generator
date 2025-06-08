/**
 * © Copyright Outburn Ltd. 2022-2025 All Rights Reserved
 *   Project name: fhir-snapshot-generator
 */

import { FhirTreeNode } from '../../../types';
import { initCap } from '..';

export const findMonopolyShortcutTarget = (
  parentId: string,
  missingSegment: string,
  elements: FhirTreeNode[]
): { rewrittenSegment: string; type: string } | null => {
  const prefix = `${parentId}.`;

  // Filter elements that are children of the parent and are polyorphic at the base (detected by [x] suffix)
  const childElements = elements.filter(el =>
    el.id.startsWith(prefix) &&
    el.id !== parentId &&
    el.id.endsWith('[x]')
  );

  // Scan through child elements to find a match
  for (const el of childElements) {
    const idSegment = el.id.slice(prefix.length); // e.g. value[x]
    const base = idSegment.slice(0, -3); // remove [x]

    // Go through each type defined in the element definition
    // We take the definition from the first child (headslice) since polymorphic elements are sliceable
    for (const type of el?.children[0]?.definition?.type ?? []) {
      const shortcut = base + initCap(type.code);
      if (shortcut === missingSegment) {
        return {
          rewrittenSegment: `${base}[x]`,
          type: type.code
        };
      }
    }
  }

  return null;
};
