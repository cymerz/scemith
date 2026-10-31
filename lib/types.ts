export type ColumnType =
  | "INT"
  | "BIGINT"
  | "SMALLINT"
  | "TINYINT"
  | "DECIMAL"
  | "FLOAT"
  | "DOUBLE"
  | "VARCHAR"
  | "CHAR"
  | "TEXT"
  | "BOOLEAN"
  | "DATE"
  | "DATETIME"
  | "TIMESTAMP"
  | "TIME"
  | "JSON";

export interface ForeignKeyRef {
  tableId: string;
  columnName: string;
}

export interface Column {
  id: string;
  name: string;
  type: ColumnType;
  length?: number;
  primaryKey: boolean;
  notNull: boolean;
  unique: boolean;
  autoIncrement: boolean;
  foreignKey?: ForeignKeyRef;
}

export interface FunctionalDependency {
  id: string;
  determinant: string[]; // column names
  dependent: string[]; // column names
  raw: string; // original text e.g. "id_anggota -> nama_anggota"
}

export interface Table {
  id: string;
  name: string;
  columns: Column[];
  dependencies: FunctionalDependency[];
  position: { x: number; y: number };
}

export interface Schema {
  tables: Table[];
}

// Validation errors
export interface ValidationError {
  tableId: string;
  columnId?: string;
  message: string;
  kind: "duplicate_column" | "missing_pk" | "invalid_fk" | "invalid_fd" | "duplicate_table";
}

// Normalization
export type NormalForm = "Not 1NF" | "1NF" | "2NF" | "3NF" | "BCNF";

export interface NormalizationViolation {
  tableId: string;
  tableName: string;
  fd: FunctionalDependency;
  violates: "2NF" | "3NF" | "BCNF";
  explanation: string;
}

export interface NormalizationResult {
  tableId: string;
  tableName: string;
  candidateKeys: string[][];
  normalForm: NormalForm;
  violations: NormalizationViolation[];
}

export interface DecomposedTable {
  name: string;
  columns: string[];
  primaryKey: string[];
  note: string;
}
