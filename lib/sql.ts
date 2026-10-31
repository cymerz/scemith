import type { Column, Schema, Table } from "./types";

type Dialect = "mysql" | "postgresql";

function columnTypeSql(col: Column, dialect: Dialect): string {
  switch (col.type) {
    case "VARCHAR":
      return `VARCHAR(${col.length ?? 255})`;
    case "CHAR":
      return `CHAR(${col.length ?? 1})`;
    case "DECIMAL":
      return "DECIMAL(10,2)";
    case "BOOLEAN":
      return dialect === "mysql" ? "TINYINT(1)" : "BOOLEAN";
    case "DATETIME":
      return dialect === "mysql" ? "DATETIME" : "TIMESTAMP";
    default:
      return col.type;
  }
}

function quoteIdentifier(name: string, dialect: Dialect): string {
  return dialect === "mysql" ? `\`${name}\`` : `"${name}"`;
}

function q(name: string, dialect: Dialect): string {
  return quoteIdentifier(name, dialect);
}

/** Topological sort of tables by foreign key dependencies. */
function sortedTables(schema: Schema): Table[] {
  const tableById = new Map(schema.tables.map((t) => [t.id, t]));
  const visited = new Set<string>();
  const result: Table[] = [];

  function visit(table: Table) {
    if (visited.has(table.id)) return;
    visited.add(table.id);
    // Visit dependencies first
    for (const col of table.columns) {
      if (col.foreignKey) {
        const dep = tableById.get(col.foreignKey.tableId);
        if (dep && dep.id !== table.id) visit(dep);
      }
    }
    result.push(table);
  }

  for (const table of schema.tables) {
    visit(table);
  }
  return result;
}

export function generateSQL(schema: Schema, dialect: Dialect): string {
  const tables = sortedTables(schema);
  const parts: string[] = [];

  if (dialect === "mysql") {
    parts.push("-- MySQL (InnoDB, utf8mb4)");
    parts.push("SET NAMES utf8mb4;");
    parts.push("SET FOREIGN_KEY_CHECKS = 0;");
    parts.push("");
  } else {
    parts.push("-- PostgreSQL");
    parts.push("");
  }

  for (const table of tables) {
    if (!table.name.trim() || table.columns.length === 0) continue;

    const lines: string[] = [];
    const pkCols = table.columns.filter((c) => c.primaryKey);
    const uniqueCols = table.columns.filter((c) => c.unique && !c.primaryKey);

    for (const col of table.columns) {
      if (!col.name.trim()) continue;
      const parts_col: string[] = [];
      parts_col.push(q(col.name, dialect));
      parts_col.push(columnTypeSql(col, dialect));

      if (col.autoIncrement) {
        if (dialect === "mysql") {
          parts_col.push("AUTO_INCREMENT");
        } else {
          // PostgreSQL uses SERIAL or GENERATED
          parts_col[1] = col.type === "INT" ? "SERIAL" : "BIGSERIAL";
        }
      }

      if (col.notNull || col.primaryKey) {
        parts_col.push("NOT NULL");
      }

      lines.push("  " + parts_col.join(" "));
    }

    // Primary key constraint
    if (pkCols.length === 1 && !pkCols[0].autoIncrement) {
      lines.push(`  PRIMARY KEY (${pkCols.map((c) => q(c.name, dialect)).join(", ")})`);
    } else if (pkCols.length > 1) {
      lines.push(`  PRIMARY KEY (${pkCols.map((c) => q(c.name, dialect)).join(", ")})`);
    } else if (pkCols.length === 1) {
      // auto_increment single pk — inline is fine, but also add explicit
      lines.push(`  PRIMARY KEY (${q(pkCols[0].name, dialect)})`);
    }

    // Unique constraints
    for (const col of uniqueCols) {
      lines.push(`  UNIQUE (${q(col.name, dialect)})`);
    }

    // Foreign key constraints
    for (const col of table.columns) {
      if (!col.foreignKey) continue;
      const refTable = schema.tables.find((t) => t.id === col.foreignKey!.tableId);
      if (!refTable) continue;
      lines.push(
        `  FOREIGN KEY (${q(col.name, dialect)}) REFERENCES ${q(refTable.name, dialect)} (${q(col.foreignKey.columnName, dialect)})`
      );
    }

    let sql = `CREATE TABLE ${q(table.name, dialect)} (\n`;
    sql += lines.join(",\n");
    sql += "\n)";

    if (dialect === "mysql") {
      sql += " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
    }
    sql += ";";

    parts.push(sql);
    parts.push("");
  }

  if (dialect === "mysql") {
    parts.push("SET FOREIGN_KEY_CHECKS = 1;");
  }

  return parts.join("\n");
}
