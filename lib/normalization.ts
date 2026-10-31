import type {
  Column,
  FunctionalDependency,
  NormalizationResult,
  NormalizationViolation,
  NormalForm,
  Table,
} from "./types";
import { newId } from "./schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  return b.every((x) => sa.has(x));
}

function isSubset(subset: string[], superset: string[]): boolean {
  const s = new Set(superset);
  return subset.every((x) => s.has(x));
}

/** Compute closure of `attrs` under `fds`. */
export function closure(attrs: string[], fds: FunctionalDependency[]): Set<string> {
  const result = new Set(attrs);
  let changed = true;
  while (changed) {
    changed = false;
    for (const fd of fds) {
      if (fd.determinant.every((a) => result.has(a))) {
        for (const d of fd.dependent) {
          if (!result.has(d)) {
            result.add(d);
            changed = true;
          }
        }
      }
    }
  }
  return result;
}

/** Find all minimal candidate keys of a relation (column names + fds). */
export function findCandidateKeys(colNames: string[], fds: FunctionalDependency[]): string[][] {
  const allAttrs = new Set(colNames);
  const keys: string[][] = [];
  const checked = new Set<string>();

  for (let size = 1; size <= colNames.length; size++) {
    const combos = combinations(colNames, size);
    for (const combo of combos) {
      const key = combo.slice().sort().join(",");
      if (checked.has(key)) continue;
      checked.add(key);

      // Skip if a known key is a proper subset
      if (keys.some((k) => isSubset(k, combo) && !setsEqual(k, combo))) continue;

      const cl = closure(combo, fds);
      if (allAttrs.size > 0 && [...allAttrs].every((a) => cl.has(a))) {
        keys.push(combo);
      }
    }
    // Once we found any keys, all additional candidate keys must be the same size
    if (keys.length > 0) {
      const minSize = Math.min(...keys.map((k) => k.length));
      if (size > minSize) break;
    }
  }

  return keys.length > 0 ? keys : [[...allAttrs]];
}

function combinations<T>(arr: T[], r: number): T[][] {
  if (r === 0) return [[]];
  if (r > arr.length) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, r - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, r);
  return [...withFirst, ...withoutFirst];
}

/** Is attr a prime attribute (part of any candidate key)? */
function isPrime(attr: string, candidateKeys: string[][]): boolean {
  return candidateKeys.some((k) => k.includes(attr));
}

// ---------------------------------------------------------------------------
// Normal form analysis
// ---------------------------------------------------------------------------

/**
 * Analyse a single table and return its normalization result.
 * The primary key columns are always treated as an implied candidate key when
 * no functional dependencies are declared.
 */
export function analyzeTable(table: Table): NormalizationResult {
  const colNames = table.columns.map((c) => c.name).filter(Boolean);
  const pkCols = table.columns.filter((c) => c.primaryKey).map((c) => c.name);

  if (colNames.length === 0) {
    return {
      tableId: table.id,
      tableName: table.name,
      candidateKeys: pkCols.length > 0 ? [pkCols] : [],
      normalForm: "1NF",
      violations: [],
    };
  }

  const declaredFds = table.dependencies;
  const keyDeterminants = [
    ...(pkCols.length > 0 ? [pkCols] : []),
    ...table.columns.filter((column) => column.unique && column.name).map((column) => [column.name]),
  ];
  const impliedFds: FunctionalDependency[] = keyDeterminants.map((determinant, index) => ({
    id: `implied-key-${index}`,
    determinant,
    dependent: colNames.filter((name) => !determinant.includes(name)),
    raw: `${determinant.join(", ")} -> ${colNames.filter((name) => !determinant.includes(name)).join(", ")}`,
  }));
  const analysisFds = [...declaredFds, ...impliedFds];
  const candidateKeys = findCandidateKeys(colNames, analysisFds);

  const violations: NormalizationViolation[] = [];

  for (const fd of declaredFds) {
    const allKnown = [...fd.determinant, ...fd.dependent].every((a) => colNames.includes(a));
    if (!allKnown) continue;

    if (isSubset(fd.dependent, fd.determinant)) continue;

    const detClosure = closure(fd.determinant, analysisFds);
    const detIsSuperkey = [...new Set(colNames)].every((a) => detClosure.has(a));

    if (!detIsSuperkey) {
      const isPartialDep = candidateKeys.some(
        (k) => k.length > 1 && isSubset(fd.determinant, k) && !setsEqual(fd.determinant, k)
      );
      const nonPrimeDeps = fd.dependent.filter((d) => !isPrime(d, candidateKeys));
      if (isPartialDep && nonPrimeDeps.length > 0) {
        violations.push({
          tableId: table.id,
          tableName: table.name,
          fd,
          violates: "2NF",
          explanation: `{${fd.determinant.join(", ")}} → {${nonPrimeDeps.join(", ")}}: "${fd.determinant.join(", ")}" is a proper subset of a candidate key, so "${nonPrimeDeps.join(", ")}" has a partial dependency (violates 2NF).`,
        });
        continue;
      }

      const nonPrimeDetAttrs = fd.determinant.filter((d) => !isPrime(d, candidateKeys));
      const isTransitiveDep = nonPrimeDetAttrs.length > 0 && nonPrimeDeps.length > 0;
      if (isTransitiveDep) {
        violations.push({
          tableId: table.id,
          tableName: table.name,
          fd,
          violates: "3NF",
          explanation: `{${fd.determinant.join(", ")}} → {${nonPrimeDeps.join(", ")}}: "${fd.determinant.join(", ")}" is not a superkey and "${nonPrimeDeps.join(", ")}" is not a prime attribute (violates 3NF, transitive dependency).`,
        });
        continue;
      }

      violations.push({
        tableId: table.id,
        tableName: table.name,
        fd,
        violates: "BCNF",
        explanation: `{${fd.determinant.join(", ")}} → {${fd.dependent.join(", ")}}: "${fd.determinant.join(", ")}" is not a superkey (violates BCNF).`,
      });
    }
  }

  let normalForm: NormalForm = "BCNF";
  if (violations.some((v) => v.violates === "2NF")) {
    normalForm = "1NF";
  } else if (violations.some((v) => v.violates === "3NF")) {
    normalForm = "2NF";
  } else if (violations.some((v) => v.violates === "BCNF")) {
    normalForm = "3NF";
  }

  return {
    tableId: table.id,
    tableName: table.name,
    candidateKeys,
    normalForm,
    violations,
  };
}

// ---------------------------------------------------------------------------
// Name derivation

/**
 * Derive a clean table name from a determinant column list.
 * - Strip leading "id_" or trailing "_id" from single-column determinants.
 * - For composite determinants, join after stripping each part.
 * - If the result would conflict with an existing name, append "_2".
 */
export function deriveName(det: string[], existingNames: Set<string>): string {
  const cleaned = det.map((col) => {
    let s = col;
    if (s.startsWith("id_")) s = s.slice(3);
    else if (s.endsWith("_id")) s = s.slice(0, -3);
    return s;
  });
  let name = cleaned.join("_");
  if (existingNames.has(name)) name = name + "_2";
  return name;
}

// ---------------------------------------------------------------------------
// Decomposition plan (pure — no side effects, no IDs)
// ---------------------------------------------------------------------------

export interface DecomposedTablePlan {
  /** Proposed name — can be edited by the user in the preview dialog */
  suggestedName: string;
  /** The determinant column names — become PK of the new table */
  primaryKey: string[];
  /** All column names in this table (determinant + dependents, or remainder) */
  columns: string[];
  /** Which FD drove this split (null = remainder) */
  sourceFd: FunctionalDependency | null;
  /** Is this the remainder (original) table? */
  isRemainder: boolean;
}

/**
 * Compute the decomposition plan — pure function that does NOT generate IDs.
 * The remainder table keeps the original table name.
 */
export function planDecomposition(
  table: Table,
  violations: NormalizationViolation[]
): DecomposedTablePlan[] {
  const allColNames = table.columns.map((c) => c.name).filter(Boolean);

  const groups = new Map<string, { det: string[]; deps: string[]; fd: FunctionalDependency }>();
  for (const violation of violations) {
    const key = violation.fd.determinant.slice().sort().join(",");
    if (!groups.has(key)) groups.set(key, { det: violation.fd.determinant, deps: [], fd: violation.fd });
    for (const dependent of violation.fd.dependent) {
      if (!groups.get(key)!.deps.includes(dependent)) groups.get(key)!.deps.push(dependent);
    }
  }

  const usedNames = new Set<string>([table.name]);
  const removedCols = new Set<string>();
  const plans: DecomposedTablePlan[] = [];

  for (const { det, deps, fd } of groups.values()) {
    const name = deriveName(det, usedNames);
    usedNames.add(name);
    plans.push({ suggestedName: name, primaryKey: det, columns: [...det, ...deps], sourceFd: fd, isRemainder: false });
    for (const dependent of deps) removedCols.add(dependent);
  }

  const remainCols = allColNames.filter((column) => !removedCols.has(column));
  plans.push({
    suggestedName: table.name,
    primaryKey: table.columns.filter((column) => column.primaryKey).map((column) => column.name).filter((name) => remainCols.includes(name)),
    columns: remainCols,
    sourceFd: null,
    isRemainder: true,
  });
  return plans;
}

// ---------------------------------------------------------------------------
// Decomposition execution (generates IDs, builds Table objects)
// ---------------------------------------------------------------------------

export interface AppliedDecompositionTable {
  id: string;
  name: string;
  columns: Column[];
  dependencies: FunctionalDependency[];
  position: { x: number; y: number };
}

/**
 * Execute a decomposition plan and return fully constructed Table objects
 * ready to replace the original table in the schema.
 *
 * - Column types, lengths, and NOT NULL are preserved from originals.
 * - Remainder table gets FK columns pointing to each new determinant table.
 * - Each new table carries only the FDs whose attributes are all within it.
 * - Remainder table also carries applicable FDs.
 */
export function applyDecomposition(
  table: Table,
  plans: DecomposedTablePlan[],
  finalNames: string[]
): AppliedDecompositionTable[] {
  const colMap = new Map(table.columns.map((column) => [column.name, column]));
  const planIds = plans.map(() => newId("tbl"));
  const result: AppliedDecompositionTable[] = [];

  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    const tableId = planIds[i];
    const tableName = finalNames[i];
    const columns: Column[] = plan.columns.filter((name) => colMap.has(name)).map((name) => {
      const original = colMap.get(name)!;
      const isPK = plan.primaryKey.includes(name);
      return {
        ...original,
        id: newId("col"),
        primaryKey: isPK,
        notNull: isPK ? true : original.notNull,
        foreignKey: undefined,
      };
    });

    if (plan.isRemainder) {
      for (let j = 0; j < plans.length; j++) {
        if (plans[j].isRemainder) continue;
        for (const determinantColumn of plans[j].primaryKey) {
          const columnIndex = columns.findIndex((column) => column.name === determinantColumn);
          if (columnIndex !== -1) {
            columns[columnIndex] = { ...columns[columnIndex], foreignKey: { tableId: planIds[j], columnName: determinantColumn } };
          }
        }
      }
    }

    const tableColumns = new Set(plan.columns);
    const dependencies = table.dependencies
      .filter((fd) => fd.determinant.every((attribute) => tableColumns.has(attribute)) && fd.dependent.every((attribute) => tableColumns.has(attribute)))
      .map((fd) => ({ ...fd, id: newId("fd") }));
    const nonRemainderCount = plans.filter((item) => !item.isRemainder).length;
    const nonRemainderIndex = plans.slice(0, i).filter((item) => !item.isRemainder).length;
    const position = plan.isRemainder
      ? { x: table.position.x, y: table.position.y + 220 }
      : { x: table.position.x + nonRemainderIndex * 240 - ((nonRemainderCount - 1) * 240) / 2, y: table.position.y };

    result.push({ id: tableId, name: tableName, columns, dependencies, position });
  }

  return result;
}

