/* eslint-disable @typescript-eslint/no-explicit-any */
import { ILogger } from 'fhir-package-explorer';

export async function generateSnapshot(
  logger: ILogger,
  getStructureDefinition: (identifier: string) => Promise<any>,
  getSnapshot: (identifier: string) => Promise<any>,
  profileId: string,
  pkg?: string  
): Promise<any> {
  console.log(pkg);
  const profileDef = await getStructureDefinition(profileId);
  if (profileDef.derivation !== 'constraint') {
    return profileDef;
  }

  const parentUrl = profileDef.baseDefinition;
  const parentSnap = await getSnapshot(parentUrl);
  const profileSnapshot = profileDef.url.startsWith('[http://hl7.org/fhir/](http://hl7.org/fhir/)') ? profileDef.snapshot?.element : undefined;

  logger.info(`Generating snapshot for '${profileId}'`);

  const snapshotElements = await applyDifferential(
    parentSnap.snapshot.element,
    profileDef.differential.element,
    profileSnapshot,
    getStructureDefinition,
    getSnapshot,
    logger
  );

  logger.info({ snapshotElements });

  const result = {
    ...profileDef,
    snapshot: {
      element: deduplicate(snapshotElements)
    }
  };

  return removeInternalTags(await fixMonoPolySlicesSnap(result));
}

async function fixMonoPolySlicesSnap(def: any): Promise<any> {
  if (def.derivation !== 'constraint' || !def.snapshot?.element) {
    return def;
  }

  const reorderedElements = repositionSlices(
    def.snapshot.element,
    def.snapshot.element,
    1 // Apply repositioning from top level downward
  );

  return {
    ...def,
    snapshot: { element: reorderedElements }
  };
}

// Helper Types

interface ElementDefinition {
  id: string;
  path?: string;
  type?: { code?: string; profile?: string[] }[];
  constraint?: any[];
  condition?: string[];
  sliceName?: string;
  slicing?: any;
  contentReference?: string;
  [key: string]: any;
}

interface ApplyDiffResult {
  snapshot: ElementDefinition[];
  remainingDiff: ElementDefinition[];
}

async function applyDifferential(
  baseElements: ElementDefinition[],
  diffElements: ElementDefinition[],
  profileSnap: ElementDefinition[] | undefined,
  getStructureDefinition: (identifier: string) => Promise<any>,
  getSnapshot: (identifier: string) => Promise<any>,
  logger: ILogger
): Promise<ElementDefinition[]> {
  const baseMaxDepth = Math.max(...baseElements.map(el => getLevel(el.id)));
  const diffMaxDepth = diffElements.length > 0 ? Math.max(...diffElements.map(el => getLevel(el.id))) : 1;
  const maxDepth = Math.max(baseMaxDepth, diffMaxDepth); // 🟢 Use BOTH base and diff depths

  let workingSnapshot = [...baseElements];
  let remainingDiff = [...diffElements];

  for (let level = 1; level <= maxDepth; level++) {
    const result = await applyDiffLevel(
      workingSnapshot,
      remainingDiff,
      profileSnap,
      level,
      getStructureDefinition,
      getSnapshot,
      logger
    );
    workingSnapshot = result.snapshot;
    remainingDiff = result.remainingDiff;
    if (remainingDiff.length === 0) break;
  }

  if (remainingDiff.length > 0) {
    logger.warn(`Snapshot generation incomplete, remaining diff IDs: ${remainingDiff.map(d => d.id).join(', ')}`);
  }

  return workingSnapshot;
}

async function applyDiffLevel(
  snapshot: ElementDefinition[],
  diff: ElementDefinition[],
  profileSnap: ElementDefinition[] | undefined,
  level: number,
  getStructureDefinition: (identifier: string) => Promise<any>,
  getSnapshot: (identifier: string) => Promise<any>,
  logger: ILogger
): Promise<ApplyDiffResult> {
  const updatedSnapshot: ElementDefinition[] = [];
  const appliedDiffIds = new Set<string>();

  for (const snapEl of snapshot) {
    const snapElLevel = getLevel(snapEl.id);

    if (snapElLevel < level) {
      updatedSnapshot.push(snapEl);
      continue;
    }

    if (snapElLevel > level) {
      updatedSnapshot.push(snapEl); // Keep children in snapshot for reintegration
      continue;
    }

    const diffEl = fetchMatchingDiffElement(snapEl, diff);
    const mergedEl = diffEl
      ? mergeElementDefinition(snapEl, diffEl, profileSnap?.find(p => p.id === snapEl.id))
      : snapEl;

    updatedSnapshot.push(mergedEl);

    if (diffEl) {
      appliedDiffIds.add(diffEl.id);
    }

    const sliceEntries = fetchSliceEntries(mergedEl, diff);
    for (const slice of sliceEntries) {
      updatedSnapshot.push(slice);
      appliedDiffIds.add(slice._diffId || slice.id);
    }
  }

  const remainingDiff = diff.filter(d => !appliedDiffIds.has(d.id));
  const reintegratedSnapshot = await reintegrateChildren(
    updatedSnapshot,
    remainingDiff,
    level,
    getStructureDefinition,
    getSnapshot,
    logger
  );

  const finalSnapshot = repositionSlices(reintegratedSnapshot, snapshot, level);

  if (remainingDiff.length > 0) {
    logger.warn(`Unapplied differential elements at level ${level}: ${remainingDiff.map(d => d.id).join(', ')}`);
  }

  return { snapshot: finalSnapshot, remainingDiff };
}

async function reintegrateChildren(
  snapshot: ElementDefinition[],
  remainingDiff: ElementDefinition[],
  level: number,
  getStructureDefinition: (identifier: string) => Promise<any>,
  getSnapshot: (identifier: string) => Promise<any>,
  logger: ILogger
): Promise<ElementDefinition[]> {
  const result: ElementDefinition[] = [];
  const snapChildren = snapshot.filter(e => getLevel(e.id) > level);

  for (const parent of snapshot.filter(e => getLevel(e.id) === level)) {
    const parentChildren = snapChildren.filter(c => c.id.startsWith(parent.id + '.'));

    let additionalChildren: ElementDefinition[] = [];
    const profileUrl = parent.type?.[0]?.profile?.[0];
    const contentRef = parent.contentReference ? resolveContentReference(parent.contentReference) : undefined;

    if (profileUrl) {
      const profileDef = await getStructureDefinition(profileUrl);
      if (profileDef.derivation === 'constraint') {
        const profileDiff = profileDef.differential.element;
        const baseSnapshot = await getSnapshot(profileDef.baseDefinition);
        const baseElements = baseSnapshot.snapshot.element;
        const profileSnapshot = profileDef.snapshot?.element;

        const rootedBase = changeRoot(baseElements, parent);
        const applied = await applyDifferential(
          rootedBase,
          profileDiff,
          profileSnapshot,
          getStructureDefinition,
          getSnapshot,
          logger
        );
        additionalChildren = applied.filter(e => e.id !== parent.id);
      }
    } else if (contentRef) {
      const refElementId = contentRef;
      additionalChildren = snapChildren.filter(c => c.id.startsWith(refElementId + '.'));
    }

    // ✅ Always include children from remainingDiff
    const diffChildren = remainingDiff.filter(
      d => getLevel(d.id) > level && d.id.startsWith(parent.id + '.')
    );

    result.push(parent, ...parentChildren, ...additionalChildren, ...diffChildren);
  }

  return result;
}


function fetchMatchingDiffElement(snapEl: ElementDefinition, diffArray: ElementDefinition[]): ElementDefinition | undefined {
  return diffArray.find(diffEl => diffEl.id === snapEl.id || isMonoPolyMatch(snapEl, diffEl));
}

function mergeElementDefinition(
  base: ElementDefinition,
  diff?: ElementDefinition,
  profileSnap?: ElementDefinition
): ElementDefinition {
  const merged = { ...base, ...diff };

  if (base.constraint || diff?.constraint) {
    merged.constraint = [...(base.constraint || []), ...(diff?.constraint || [])];
  }
  if (base.condition || diff?.condition) {
    merged.condition = Array.from(new Set([...(base.condition || []), ...(diff?.condition || [])]));
  }
  if (profileSnap?.type) {
    merged.type = profileSnap.type;
  }

  return merged;
}

function fetchSliceEntries(snapEl: ElementDefinition, diffArray: ElementDefinition[]): ElementDefinition[] {
  const explicitSlices = diffArray.filter(diffEl => diffEl.sliceName && diffEl.id === `${snapEl.id}:${diffEl.sliceName}`);
  const implicitSlices = diffArray.filter(diffEl => isMonoPolyMatch(snapEl, diffEl)).map(diffEl => ({
    ...diffEl,
    id: `${snapEl.id}:${diffEl.sliceName || toNamedMonoPoly(snapEl).split('.').pop()}`,
    sliceName: diffEl.sliceName || toNamedMonoPoly(snapEl).split('.').pop(),
    _diffId: diffEl.id
  }));

  return [...explicitSlices, ...implicitSlices];
}

function repositionSlices(
  snapshot: ElementDefinition[],
  originalBase: ElementDefinition[],
  level: number
): ElementDefinition[] {
  const originalSlicesAtLevel = originalBase.filter(el => getLevel(el.id) === level && el.sliceName);
  const nonSlicesAtLevel = snapshot.filter(el => getLevel(el.id) === level && !el.sliceName);

  const reordered: ElementDefinition[] = [];

  for (const el of nonSlicesAtLevel) {
    reordered.push(el);
    const matchingSlices = snapshot.filter(s => s.id.startsWith(el.id + ':') && getLevel(s.id) === level);
    const orderedSlices = [
      ...originalSlicesAtLevel.filter(s => matchingSlices.some(ms => ms.id === s.id)),
      ...matchingSlices.filter(ms => !originalSlicesAtLevel.some(s => s.id === ms.id))
    ];
    reordered.push(...orderedSlices);
  }

  return reordered;
}

function isMonoPolyMatch(snapEl: ElementDefinition, diffEl: ElementDefinition): boolean {
  return toNamedMonoPoly(snapEl) === diffEl.id || toPolySlice(snapEl) === diffEl.id;
}

function toNamedMonoPoly(element: ElementDefinition): string {
  const typeName = element.type?.[0]?.code || '';
  const titleCaseType = typeName.charAt(0).toUpperCase() + typeName.slice(1);
  const idWithoutX = element.id.replace('[x]', '');
  return idWithoutX + titleCaseType;
}

function toPolySlice(element: ElementDefinition): string {
  const namedId = toNamedMonoPoly(element);
  const sliceName = namedId.split('.').pop();
  return `${element.id}:${sliceName}`;
}

function getLevel(id: string): number {
  return id.split('.').length;
}

function deduplicate(elements: ElementDefinition[]): ElementDefinition[] {
  const seen = new Set<string>();
  return elements.filter(el => {
    if (seen.has(el.id)) return false;
    seen.add(el.id);
    return true;
  });
}

function removeInternalTags(structureDefinition: any): any {
  const removeFields = ['_diffId', '__fromDefinition', '__rootChildren', '__sliceChildren'];
  function clean(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(clean);
    } else if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const key of Object.keys(obj)) {
        if (!removeFields.includes(key)) {
          result[key] = clean(obj[key]);
        }
      }
      return result;
    }
    return obj;
  }
  return clean(structureDefinition);
}

function resolveContentReference(ref: string): string {
  return ref.startsWith('#') ? ref.substring(1) : ref;
}

function changeRoot(elements: ElementDefinition[], newRoot: ElementDefinition): ElementDefinition[] {
  const oldRoot = elements[0];
  return elements.map(el => {
    if (el.id === oldRoot.id) {
      return { ...el, ...newRoot };
    } else {
      return {
        ...el,
        id: newRoot.id + '.' + el.id.substring(oldRoot.id.length + 1),
        path: newRoot.path + '.' + el.path?.substring((oldRoot.path?.length ?? 0) + 1)
      };
    }
  });
}