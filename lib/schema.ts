import type { Column, FunctionalDependency, Schema, Table, ValidationError } from "./types";

let _idCounter = 0;

/** Call only inside event handlers (never during render) */
export function newId(prefix = "id"): string {
  _idCounter += 1;
  return `${prefix}_${Date.now()}_${_idCounter}`;
}

export function createColumn(overrides: Partial<Column> = {}): Column {
  return {
    id: newId("col"),
    name: "",
    type: "VARCHAR",
    length: 255,
    primaryKey: false,
    notNull: false,
    unique: false,
    autoIncrement: false,
    ...overrides,
  };
}

export function createTable(overrides: Partial<Table> = {}): Table {
  return {
    id: newId("tbl"),
    name: "",
    columns: [],
    dependencies: [],
    position: { x: 40, y: 40 },
    ...overrides,
  };
}

export function createFD(raw: string): FunctionalDependency | null {
  const parts = raw.split("->").map((s) => s.trim());
  if (parts.length !== 2) return null;
  const det = parts[0].split(",").map((s) => s.trim()).filter(Boolean);
  const dep = parts[1].split(",").map((s) => s.trim()).filter(Boolean);
  if (det.length === 0 || dep.length === 0) return null;
  return {
    id: newId("fd"),
    determinant: det,
    dependent: dep,
    raw,
  };
}

export function validateSchema(schema: Schema): ValidationError[] {
  const errors: ValidationError[] = [];
  const tableNames = new Map<string, string>(); // name -> id

  for (const table of schema.tables) {
    // Duplicate table names
    if (tableNames.has(table.name.toLowerCase())) {
      errors.push({
        tableId: table.id,
        message: `Duplicate table name: "${table.name}"`,
        kind: "duplicate_table",
      });
    } else if (table.name.trim()) {
      tableNames.set(table.name.toLowerCase(), table.id);
    }

    // Missing primary key
    const hasPk = table.columns.some((c) => c.primaryKey);
    if (table.columns.length > 0 && !hasPk) {
      errors.push({
        tableId: table.id,
        message: `Table "${table.name || "(unnamed)"}" has no primary key.`,
        kind: "missing_pk",
      });
    }

    // Duplicate column names
    const colNames = new Set<string>();
    for (const col of table.columns) {
      const key = col.name.toLowerCase();
      if (col.name.trim() && colNames.has(key)) {
        errors.push({
          tableId: table.id,
          columnId: col.id,
          message: `Duplicate column name: "${col.name}" in table "${table.name}"`,
          kind: "duplicate_column",
        });
      } else if (col.name.trim()) {
        colNames.add(key);
      }
    }
  }

  // Validate foreign keys (second pass after table names are populated)
  for (const table of schema.tables) {
    for (const col of table.columns) {
      if (col.foreignKey) {
        const targetTable = schema.tables.find((t) => t.id === col.foreignKey!.tableId);
        if (!targetTable) {
          errors.push({
            tableId: table.id,
            columnId: col.id,
            message: `Foreign key in "${col.name}" references non-existent table.`,
            kind: "invalid_fk",
          });
        } else {
          const targetCol = targetTable.columns.find(
            (c) => c.name.toLowerCase() === col.foreignKey!.columnName.toLowerCase()
          );
          if (!targetCol) {
            errors.push({
              tableId: table.id,
              columnId: col.id,
              message: `Foreign key in "${col.name}" references non-existent column "${col.foreignKey.columnName}" in "${targetTable.name}".`,
              kind: "invalid_fk",
            });
          } else if (!targetCol.primaryKey && !targetCol.unique) {
            errors.push({
              tableId: table.id,
              columnId: col.id,
              message: `Foreign key target "${targetTable.name}.${targetCol.name}" must be PRIMARY KEY or UNIQUE.`,
              kind: "invalid_fk",
            });
          }
        }
      }
    }
  }

  return errors;
}
