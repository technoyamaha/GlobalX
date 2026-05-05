import pool from "../config/db.js";
import { success, error } from "../utils/helper.js";
import { formatCurrency } from "../utils/format.js";
import {
  downlinePercent,
  MINIMUM_INVESTMENT_AMOUNT,
  MINIMUM_REINVESTMENT_AMOUNT,
  REINVESTMENT_DAILY_PERCENT,
  NORMAL_INVESTMENT_TYPE,
  REINVESTMENT_TYPE,
} from "../constants/investmentConstants.js";

const generateOrderId = () => {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
};

const invest = async (req, res) => {
  let connection;

  try {
    const auth = req.cookies.auth;
    if (!auth) return error(res, "Unauthorized: No auth cookie", 401);

    let { amount, investment_type } = req.body;

    amount = Number(
      String(amount || "")
        .replace(/,/g, "")
        .trim(),
    );
    investment_type = investment_type || NORMAL_INVESTMENT_TYPE;

    if (isNaN(amount) || amount <= 0) {
      return error(res, "Invalid amount format", 400);
    }

    if (
      ![NORMAL_INVESTMENT_TYPE, REINVESTMENT_TYPE].includes(investment_type)
    ) {
      return error(res, "Invalid investment type", 400);
    }

    if (
      investment_type === NORMAL_INVESTMENT_TYPE &&
      amount < MINIMUM_INVESTMENT_AMOUNT
    ) {
      return error(
        res,
        `Minimum investment amount is $${MINIMUM_INVESTMENT_AMOUNT}`,
        400,
      );
    }

    if (
      investment_type === REINVESTMENT_TYPE &&
      amount < MINIMUM_REINVESTMENT_AMOUNT
    ) {
      return error(
        res,
        `Minimum reinvestment amount is $${MINIMUM_REINVESTMENT_AMOUNT}`,
        400,
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [users] = await connection.query(
      `
      SELECT id, money, withdrawable_balance
      FROM users
      WHERE token = ?
      LIMIT 1
      `,
      [auth],
    );

    const user = users?.[0];

    if (!user) {
      await connection.rollback();
      return error(res, "Unauthorized: Invalid token", 401);
    }

    const userId = user.id;

    // let planId = null;
    const [plansRows] = await connection.query(`
  SELECT id, min, max
  FROM crypto_plans
`);

    const matchedPlan = plansRows.find(
      (p) => amount >= p.min && amount <= p.max,
    );

    planId = matchedPlan ? matchedPlan.id : null;

    let dailyPercent = 0;

    if (investment_type === NORMAL_INVESTMENT_TYPE) {
      const currentBalance = Number(user.money || 0);

      if (currentBalance < amount) {
        await connection.rollback();
        return error(res, "Insufficient deposit balance", 400);
      }

      const [plansRows] = await connection.query(
        `
        SELECT id, name, min, max, months, daily_percent
        FROM crypto_plans
        ORDER BY id ASC
        `,
      );

      const plans = plansRows.map((p) => ({
        id: p.id,
        min: p.min == null ? -Infinity : Number(p.min),
        max: p.max == null ? Infinity : Number(p.max),
        percent: Number(p.daily_percent),
      }));

      const matchedPlan = plans.find((p) => amount >= p.min && amount <= p.max);

      if (!matchedPlan) {
        await connection.rollback();
        return error(res, "No investment plan available for this amount", 400);
      }

      planId = matchedPlan.id;
      dailyPercent = matchedPlan.percent;

      await connection.query(
        `
        UPDATE users
        SET money = money - ?
        WHERE id = ?
        `,
        [amount, userId],
      );
    }

    if (investment_type === REINVESTMENT_TYPE) {
      const withdrawableBalance = Number(user.withdrawable_balance || 0);

      if (withdrawableBalance < amount) {
        await connection.rollback();
        return error(res, "Insufficient withdrawable balance", 400);
      }

      dailyPercent = REINVESTMENT_DAILY_PERCENT;

      await connection.query(
        `
        UPDATE users
        SET withdrawable_balance = withdrawable_balance - ?
        WHERE id = ?
        `,
        [amount, userId],
      );
    }

    const orderId = `INV-${generateOrderId()}`;
    const startDateMs = Date.now();

    const [result] = await connection.query(
      `
      INSERT INTO investments
      (
        order_id,
        user_id,
        amount,
        plan_id,
        daily_percent,
        investment_type,
        start_date,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `,
      [
        orderId,
        userId,
        amount,
        planId,
        dailyPercent,
        investment_type,
        startDateMs,
      ],
    );

    await connection.commit();

    return success(
      res,
      "Investment created successfully",
      {
        id: result.insertId,
        order_id: orderId,
        user_id: userId,
        amount,
        plan_id: planId,
        daily_percent: dailyPercent,
        investment_type,
        start_date: startDateMs,
      },
      201,
    );
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Invest Error:", err.message, err.stack);
    return error(res, err.message || "Server error", 500);
  } finally {
    if (connection) connection.release();
  }
};

const getMyInvestments = async (req, res) => {
  let connection;
  try {
    const userId = req.user.id;

    connection = await pool.getConnection();

    const [rows] = await connection.query(
      `SELECT 
    i.id,
    i.order_id,
    i.amount,
    i.daily_percent,
    i.start_date,
    i.status,
    u.phone,
    p.name,
    p.min,
    p.max,
    p.months
FROM investments i
JOIN crypto_plans p ON i.plan_id = p.id
JOIN users u ON u.id = i.user_id
WHERE i.user_id = ?`,
      [userId],
    );

    const data = rows.map((inv) => ({
      id: inv.id,
      order_id: inv.order_id,
      amount: formatCurrency(inv.amount),
      daily_percent: inv.daily_percent,
      start_date: inv.start_date,
      status: inv.status,
      phone: inv.phone,
      plan: {
        name: inv.name,
        min: inv.min,
        max: inv.max,
        months: inv.months,
      },
    }));

    return success(res, "My investments fetched successfully", data, 200);
  } catch (err) {
    console.error("GetMyInvestments Error:", err);
    return error(res, err, 500);
  } finally {
    if (connection) connection.release();
  }
};

const distributeDownlineIncome = async (
  userId,
  dailyProfit,
  creditedForDate,
  sourceTransactionId,
) => {
  let connection;

  try {
    const time = Date.now();

    dailyProfit = Number(dailyProfit || 0);

    if (
      !userId ||
      dailyProfit <= 0 ||
      !creditedForDate ||
      !sourceTransactionId
    ) {
      return;
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [userRows] = await connection.query(
      `
      SELECT id, code, invite
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [userId],
    );

    if (!userRows.length) {
      await connection.rollback();
      return;
    }

    let currentUser = userRows[0];

    for (const levelRule of downlinePercent) {
      if (!currentUser.invite) break;

      const [parentRows] = await connection.query(
        `
        SELECT id, code, invite
        FROM users
        WHERE code = ?
        LIMIT 1
        `,
        [currentUser.invite],
      );

      if (!parentRows.length) break;

      const parent = parentRows[0];

      const commission = Number(
        ((dailyProfit * Number(levelRule.percent)) / 100).toFixed(2),
      );

      if (commission > 0) {
        const [insertResult] = await connection.query(
          `
          INSERT INTO downline_income
          (
            user_id,
            from_user_id,
            level,
            amount,
            percent,
            credited_for_date,
            source_transaction_id,
            time
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            parent.id,
            userId,
            levelRule.level,
            commission,
            levelRule.percent,
            creditedForDate,
            sourceTransactionId,
            time,
          ],
        );

        if (insertResult.affectedRows === 1) {
          await connection.query(
            `
            UPDATE users
            SET withdrawable_balance = withdrawable_balance + ?
            WHERE id = ?
            `,
            [commission, parent.id],
          );
        }
      }

      currentUser = parent;
    }

    await connection.commit();
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error in giving downline income:", err.message || err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
};

const getUser = async (req, res) => {
  const query = req.query.query;
  if (!query) {
    return res.status(400).json({ message: "Query is required" });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT id_user, full_name FROM users WHERE id_user = ? OR user_name = ? LIMIT 1`,
      [query, query],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const getMiningData = async (req, res) => {
  let connection = null;
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ status: false, message: "Unauthorized" });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 10),
    );
    const offset = (page - 1) * limit;

    connection = await pool.getConnection();

    // total investments count
    const [countRows] = await connection.query(
      `SELECT COUNT(*) as total FROM investments WHERE user_id = ?`,
      [userId],
    );
    const totalInvestments = Number(countRows?.[0]?.total || 0);
    const totalPages = Math.ceil(totalInvestments / limit);

    // total invested (strip commas if any, then cast)
    const [sumRows] = await connection.query(
      `SELECT COALESCE(SUM(CAST(REPLACE(amount, ',', '') AS DECIMAL(18,2))), 0) AS totalInvested
       FROM investments
       WHERE user_id = ?`,
      [userId],
    );
    const totalInvested = Number(sumRows?.[0]?.totalInvested || 0);

    // paginated investments: select only existing columns
    const [rows] = await connection.query(
      `SELECT
         i.id,
         i.order_id,
         i.amount,
         i.plan_id,
         i.daily_percent,
         i.start_date,
         i.status,
         p.months
       FROM investments i
       LEFT JOIN crypto_plans p ON i.plan_id = p.id
       WHERE i.user_id = ?
       ORDER BY i.id DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset],
    );

    return res.status(200).json({
      status: true,
      data: rows,
      totalPages,
      currentPage: page,
      totalInvested,
      totalInvestments,
    });
  } catch (err) {
    console.error(
      "getMiningData error:",
      err && (err.stack || err.message || err),
    );
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: err && err.message ? String(err.message) : "unknown",
    });
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (e) {
        /* ignore */
      }
    }
  }
};

const investmentController = {
  invest,
  getMyInvestments,
  distributeDownlineIncome,
  getUser,
  getMiningData,
};

export default investmentController;
