const express = require("express");
const cors = require("cors");
const path = require("path");
const db = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ==========================================
// RUTAS DE AUTENTICACIÓN
// ==========================================

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const mail = email.trim().toLowerCase();

  // 1. Validar Admin
  db.get(
    `SELECT * FROM admin WHERE LOWER(correo) = ? AND password = ?`,
    [mail, password],
    (err, admin) => {
      if (err) return res.status(500).json({ error: err.message });
      if (admin) {
        return res.json({
          success: true,
          tipo: "admin",
          nombre: admin.nombre,
          email: admin.correo,
        });
      }

      // 2. Validar Paciente
      db.get(
        `SELECT * FROM paciente WHERE LOWER(correo) = ? AND password = ?`,
        [mail, password],
        (err, paciente) => {
          if (err) return res.status(500).json({ error: err.message });
          if (paciente) {
            return res.json({
              success: true,
              tipo: "paciente",
              nombre: `${paciente.nombre} ${paciente.apellido || ""}`.trim(),
              email: paciente.correo,
            });
          }

          return res
            .status(401)
            .json({
              success: false,
              message: "Correo o contraseña incorrectos.",
            });
        },
      );
    },
  );
});

/* ==========================================
   REGISTRO DE NUEVOS PACIENTES
========================================== */

app.post("/api/registro", (req, res) => {
  const { nombre, apellido, telefono, email, password } = req.body;

  // Validar los datos recibidos
  if (
    !nombre?.trim() ||
    !email?.trim() ||
    !password ||
    password.length < 6
  ) {
    return res.status(400).json({
      success: false,
      message: "Completa los campos obligatorios. La contraseña debe tener al menos 6 caracteres."
    });
  }

  const nombreLimpio = nombre.trim();
  const apellidoLimpio = apellido?.trim() || "";
  const telefonoLimpio = telefono?.trim() || "";
  const correo = email.trim().toLowerCase();

  // Verificar si el correo ya está registrado
  db.get(
    "SELECT id_paciente FROM paciente WHERE LOWER(correo) = ?",
    [correo],
    (err, pacienteExistente) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Error al verificar el correo."
        });
      }

      if (pacienteExistente) {
        return res.status(409).json({
          success: false,
          message: "Este correo ya está registrado. Inicia sesión."
        });
      }

      // Crear la cuenta del paciente
      db.run(
        `INSERT INTO paciente
        (nombre, apellido, telefono, correo, password)
        VALUES (?, ?, ?, ?, ?)`,
        [
          nombreLimpio,
          apellidoLimpio,
          telefonoLimpio,
          correo,
          password
        ],
        function (err) {
          if (err) {
            if (err.code === "SQLITE_CONSTRAINT") {
              return res.status(409).json({
                success: false,
                message: "Este correo ya está registrado."
              });
            }

            return res.status(500).json({
              success: false,
              message: "No se pudo crear la cuenta."
            });
          }

          return res.status(201).json({
            success: true,
            message: "Cuenta creada correctamente. Ya puedes iniciar sesión.",
            paciente: {
              id: this.lastID,
              nombre: nombreLimpio,
              apellido: apellidoLimpio,
              email: correo
            }
          });
        }
      );
    }
  );
});

// ==========================================
// RUTAS DE CITAS
// ==========================================

// Obtener todas las citas
app.get("/api/citas", (req, res) => {
  db.all(`SELECT * FROM cita ORDER BY date ASC, time ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Registrar nueva cita
app.post("/api/citas", (req, res) => {
  const {
    email,
    specialty,
    psychologist,
    date,
    time,
    motive,
    status,
    modalidad,
  } = req.body;

  const sql = `INSERT INTO cita (email, specialty, psychologist, date, time, motive, status, modalidad) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  db.run(
    sql,
    [
      email,
      specialty,
      psychologist,
      date,
      time,
      motive || "",
      status || "Reservada",
      modalidad || "En línea",
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        success: true,
        id: this.lastID,
        message: "Cita registrada con éxito",
      });
    },
  );
});

// Eliminar cita
app.delete("/api/citas/:id", (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM cita WHERE id_cita = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
});

// ==========================================
// RUTAS DE DISPONIBILIDAD
// ==========================================

// Obtener disponibilidad
app.get("/api/disponibilidad", (req, res) => {
  db.all(
    `SELECT * FROM disponibilidad WHERE status != 'Bloqueado'`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    },
  );
});

// Guardar masivamente disponibilidad
app.post("/api/disponibilidad", (req, res) => {
  const { items } = req.body; // Array de horarios

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Lista de disponibilidades vacía." });
  }

  const stmt = db.prepare(
    `INSERT INTO disponibilidad (psychologist, date, time, status) VALUES (?, ?, ?, ?)`,
  );
  items.forEach((item) => {
    stmt.run(
      item.psychologist,
      item.date,
      item.time,
      item.status || "Disponible",
    );
  });
  stmt.finalize((err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, message: "Disponibilidad actualizada" });
  });
});

// Eliminar disponibilidad por profesional y fecha
app.delete("/api/disponibilidad", (req, res) => {
  const { date, psychologist } = req.query;
  db.run(
    `DELETE FROM disponibilidad WHERE date = ? AND psychologist = ?`,
    [date, psychologist],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, changes: this.changes });
    },
  );
});

// Iniciar Servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor metAMORfosis corriendo en http://localhost:${PORT}`);
});
