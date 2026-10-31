# SchemaSmith

**SchemaSmith** is a web application for designing relational database schemas — built for computer science students and junior developers.

## Features

### 1. Schema Editor
- Add and edit tables and columns (name, type, primary key, NOT NULL, UNIQUE, AUTO_INCREMENT, foreign key references)
- Composite primary keys supported
- Functional dependency input per table (e.g. `id_anggota -> nama_anggota`)
- Inline validation: duplicate names, missing primary keys, invalid foreign keys

### 2. ERD Diagram
- Automatically generated SVG with **crow's foot notation**
- Relationship lines inferred from foreign keys
- **Draggable tables** for custom layout

### 3. Normalization Analyzer
- Computes **candidate keys** from functional dependencies
- Determines the highest **normal form** (1NF → BCNF)
- Explains every violation with the offending dependency and the rule it breaks
- **"Apply suggested decomposition"** button that splits the table, updates the diagram and SQL output

### 4. SQL Generator
- Generates `CREATE TABLE` statements with `PRIMARY KEY`, `FOREIGN KEY`, and `UNIQUE`
- Tables emitted in correct **dependency order** (topological sort)
- **MySQL / PostgreSQL toggle** — MySQL output includes `ENGINE=InnoDB` and `DEFAULT CHARSET=utf8mb4`
- One-click **Copy** button

### 5. Built-in Examples
- **peminjaman** (2NF violation): composite PK `(id_anggota, id_buku)` with partial dependencies
- **mahasiswa** (3NF violation): transitive dependency via `kode_prodi → nama_prodi`

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Schema logic | Pure functions in `lib/` — no external dependencies |

## Project Structure

```
app/
  page.tsx              # Main page (viewport layout, state)
  layout.tsx            # Root layout + metadata
  globals.css           # Tailwind + base styles
  components/
    SchemaEditor.tsx    # Left panel — table & column editor
    ERDDiagram.tsx      # Center panel — SVG ERD with drag
    NormalizationPanel.tsx  # Right panel — NF analysis + decompose
    SQLPanel.tsx        # Right panel — SQL generator
    ExampleModal.tsx    # Modal for loading examples
lib/
  types.ts              # Shared TypeScript types
  schema.ts             # Schema mutations + validation
  normalization.ts      # Candidate key / NF analysis + decomposition
  sql.ts                # SQL generation (MySQL + PostgreSQL)
  examples.ts           # Built-in example schemas
```

## Design

- **Viewport-locked**: `h-dvh / overflow-hidden` — panels scroll internally, the page itself never scrolls
- **Responsive**: 3-column layout on desktop (md+), bottom-tab navigation on mobile
- **Color palette**: Indigo + white with amber accent, WCAG AA contrast
- **Hydration-safe**: no `Date`, `Math.random`, or random IDs during render; IDs generated only inside event handlers

## License

MIT
