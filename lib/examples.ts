import type { Schema } from "./types";

export interface Example {
  id: string;
  label: string;
  description: string;
  schema: Schema;
}

export function getExamples(): Example[] {
  // IDs are hardcoded strings (not random) — safe for SSR
  const tblPeminjaman = "tbl_peminjaman";
  const tblMahasiswa = "tbl_mahasiswa";

  return [
    {
      id: "peminjaman",
      label: "peminjaman (2NF violation)",
      description:
        "Table with composite PK (id_anggota, id_buku) where non-key attributes partially depend on part of the key.",
      schema: {
        tables: [
          {
            id: tblPeminjaman,
            name: "peminjaman",
            position: { x: 80, y: 80 },
            columns: [
              {
                id: "col_p1",
                name: "id_anggota",
                type: "INT",
                primaryKey: true,
                notNull: true,
                unique: false,
                autoIncrement: false,
              },
              {
                id: "col_p2",
                name: "id_buku",
                type: "INT",
                primaryKey: true,
                notNull: true,
                unique: false,
                autoIncrement: false,
              },
              {
                id: "col_p3",
                name: "nama_anggota",
                type: "VARCHAR",
                length: 255,
                primaryKey: false,
                notNull: false,
                unique: false,
                autoIncrement: false,
              },
              {
                id: "col_p4",
                name: "judul_buku",
                type: "VARCHAR",
                length: 255,
                primaryKey: false,
                notNull: false,
                unique: false,
                autoIncrement: false,
              },
              {
                id: "col_p5",
                name: "tgl_pinjam",
                type: "DATE",
                primaryKey: false,
                notNull: false,
                unique: false,
                autoIncrement: false,
              },
            ],
            dependencies: [
              {
                id: "fd_p1",
                determinant: ["id_anggota", "id_buku"],
                dependent: ["tgl_pinjam"],
                raw: "id_anggota, id_buku -> tgl_pinjam",
              },
              {
                id: "fd_p2",
                determinant: ["id_anggota"],
                dependent: ["nama_anggota"],
                raw: "id_anggota -> nama_anggota",
              },
              {
                id: "fd_p3",
                determinant: ["id_buku"],
                dependent: ["judul_buku"],
                raw: "id_buku -> judul_buku",
              },
            ],
          },
        ],
      },
    },
    {
      id: "mahasiswa",
      label: "mahasiswa (3NF violation)",
      description:
        "Table where nama_prodi transitively depends on nim via kode_prodi (violates 3NF).",
      schema: {
        tables: [
          {
            id: tblMahasiswa,
            name: "mahasiswa",
            position: { x: 80, y: 80 },
            columns: [
              {
                id: "col_m1",
                name: "nim",
                type: "VARCHAR",
                length: 20,
                primaryKey: true,
                notNull: true,
                unique: false,
                autoIncrement: false,
              },
              {
                id: "col_m2",
                name: "nama",
                type: "VARCHAR",
                length: 255,
                primaryKey: false,
                notNull: false,
                unique: false,
                autoIncrement: false,
              },
              {
                id: "col_m3",
                name: "kode_prodi",
                type: "VARCHAR",
                length: 10,
                primaryKey: false,
                notNull: false,
                unique: false,
                autoIncrement: false,
              },
              {
                id: "col_m4",
                name: "nama_prodi",
                type: "VARCHAR",
                length: 255,
                primaryKey: false,
                notNull: false,
                unique: false,
                autoIncrement: false,
              },
            ],
            dependencies: [
              {
                id: "fd_m1",
                determinant: ["nim"],
                dependent: ["nama", "kode_prodi"],
                raw: "nim -> nama, kode_prodi",
              },
              {
                id: "fd_m2",
                determinant: ["kode_prodi"],
                dependent: ["nama_prodi"],
                raw: "kode_prodi -> nama_prodi",
              },
            ],
          },
        ],
      },
    },
  ];
}
