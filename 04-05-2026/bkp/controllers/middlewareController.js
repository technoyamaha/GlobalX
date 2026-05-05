import pool from "../config/db.js";

const middlewareController = async (req, res, next) => {
  const auth =
    req.cookies?.auth || req.headers.auth || req.headers.authorization;

  console.log("AUTH:", auth);

  if (!auth) {
    res.clearCookie("auth");
    res.clearCookie("token");
    return res.redirect("/login");
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT `id`, `token`, `status` FROM `users` WHERE `token` = ?",
      [auth],
    );
    await connection.commit();

    if (!rows.length) {
      res.clearCookie("auth");
      res.clearCookie("token");
      return res.redirect("/login");
    }

    const user = rows[0];

    if (auth === user.token && user.status == "1") {
      req.user = {
        id: user.id,
        token: user.token,
      };
      return next();
    } else {
      res.clearCookie("auth");
      res.clearCookie("token");
      return res.redirect("/login");
    }
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Middleware DB error:", error.message);
    res.clearCookie("auth");
    res.clearCookie("token");
    return res.redirect("/login");
  } finally {
    if (connection) connection.release();
  }
};


export default middlewareController;
