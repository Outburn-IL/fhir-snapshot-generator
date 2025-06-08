/**
 * © Copyright Outburn Ltd. 2022-2025 All Rights Reserved
 *   Project name: fhir-snapshot-generator
 */

import { ElementDefinition } from '../../../types';

/**
 * Merge an existing snapshot element with a diff element.
 * Most diff keys just override the snapshot ones if they exist.
 * The 'constraint', 'mapping' and 'condition' arrays are accumulated.
 * @param base ElementDefinition - the base snapshot element to apply the merge to
 * @param diff ElementDefinition - the diff element to merge with the base element
 * @returns ElementDefinition - the merged element
 * @throws Error if the diff element ID does not match the base element ID
 */
export const mergeElement = (base: ElementDefinition, diff: ElementDefinition): ElementDefinition => {
  // ensure diff.id === base.id
  if (diff.id !== base.id) {
    throw new Error(`Element ID mismatch. Tried to apply "${diff.id}" onto "${base.id}".`);
  }
  // create a shallow working copy of the base element
  const mergedElement: ElementDefinition = { ...base };
  // apply the diff attributes, key by key
  for (const key of Object.keys(diff) as string[]) {
    if (['constraint', 'condition', 'mapping'].includes(key)) {
      const baseArr = base[key] || [], diffArr = diff[key] || [];
    
      if (key === 'constraint') {
        mergedElement.constraint = [...baseArr, ...diffArr];
    
      } else if (key === 'condition') {
        const ids = Array.from(new Set([...baseArr, ...diffArr]));
        mergedElement.condition = ids;
    
      } else {
        const seen = new Set<string>();
        const serialize = (obj: Record<string, string>) => JSON.stringify(Object.entries(obj).sort());
        const combined = [...baseArr, ...diffArr];
        mergedElement.mapping = combined.filter(m => {
          const s = serialize(m);
          return seen.has(s) ? false : seen.add(s);
        });
      }
    }
    else if (key !== 'id' && key !== 'path') {
      if (diff[key] !== undefined) {
        mergedElement[key] = diff[key];
      };
    }
  }

  return mergedElement;
};