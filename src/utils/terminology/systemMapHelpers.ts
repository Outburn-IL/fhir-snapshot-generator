export type SystemCodeMap = Map<string, Map<string, string | undefined>>;

export function toSystemCodeMapFromContains(contains: any[] | undefined): SystemCodeMap {
  const out: SystemCodeMap = new Map();
  if (!Array.isArray(contains)) return out;
  for (const item of contains) {
    if (!item || typeof item !== 'object') continue;
    const system: string | undefined = item.system;
    const code: string | undefined = item.code;
    if (!system || !code) continue;
    if (!out.has(system)) out.set(system, new Map());
    const m = out.get(system)!;
    if (!m.has(code)) m.set(code, item.display);
  }
  return out;
}

export function mergeSystemMaps(target: SystemCodeMap, source: SystemCodeMap): void {
  for (const [system, codes] of source.entries()) {
    if (!target.has(system)) target.set(system, new Map());
    const t = target.get(system)!;
    for (const [code, display] of codes.entries()) {
      if (!t.has(code)) t.set(code, display);
    }
  }
}

export function subtractSystemMaps(target: SystemCodeMap, exclude: SystemCodeMap): void {
  for (const [system, codes] of exclude.entries()) {
    const t = target.get(system);
    if (!t) continue;
    for (const code of codes.keys()) {
      t.delete(code);
    }
  }
}

export function buildExpansionFromSystemMap(map: SystemCodeMap): { contains: any[]; total: number } {
  const contains: any[] = [];
  for (const [system, codes] of map.entries()) {
    for (const [code, display] of codes.entries()) {
      contains.push({ system, code, display });
    }
  }
  return { contains, total: contains.length };
}
