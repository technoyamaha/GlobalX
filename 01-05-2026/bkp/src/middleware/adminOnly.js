// middlewares/adminOnly.js
import pool from "../config/db.js";

const adminOnly = async (req, res, next) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const [rows] = await connection.query(
            "SELECT level FROM users WHERE token = ?",
            [req.cookies.auth]
        );

        if (!rows.length || rows[0].level !== 1) {
            return res.status(403).send("Access denied. Admins only.");
        }

        next();
    } catch (error) {
        console.error("adminOnly middleware error:", error.message);
        res.status(500).send("Server error");
    } finally {
        if (connection) connection.release();
    }
};

export default adminOnly;
