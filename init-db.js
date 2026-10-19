const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.resolve(__dirname, "database.sqlite");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log("--- Inicializando la Base de Datos metAMORfosis ---");

  db.run(`PRAGMA foreign_keys = ON;`);

  // Tabla de Pacientes
  db.run(`CREATE TABLE IF NOT EXISTS paciente (
        id_paciente INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        apellido TEXT,
        telefono TEXT,
        correo TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
    );`);

  // Tabla de Administradores
  db.run(`CREATE TABLE IF NOT EXISTS admin (
        id_admin INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        correo TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
    );`);

  // Tabla de Citas
  db.run(`CREATE TABLE IF NOT EXISTS cita (
        id_cita INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        specialty TEXT NOT NULL,
        psychologist TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        motive TEXT,
        status TEXT DEFAULT 'Reservada',
        modalidad TEXT DEFAULT 'En línea'
    );`);

  // Tabla de Disponibilidad
  db.run(`CREATE TABLE IF NOT EXISTS disponibilidad (
        id_disp INTEGER PRIMARY KEY AUTOINCREMENT,
        psychologist TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        status TEXT DEFAULT 'Disponible'
    );`);

  // Insertar usuarios de prueba por defecto si no existen
  db.run(
    `INSERT OR IGNORE INTO admin (nombre, correo, password) VALUES ('Administrador', 'admin@metamorfosis.com', 'admin123')`,
  );
  db.run(
    `INSERT OR IGNORE INTO paciente (nombre, apellido, correo, password) VALUES ('Paciente', 'Prueba', 'paciente@metamorfosis.com', 'paciente123')`,
  );

  console.log("✅ Base de datos inicializada y lista.");
});

db.close();
