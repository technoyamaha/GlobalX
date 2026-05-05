import cron from "node-cron";
import pool from "../config/db.js";
import investmentController from "../controllers/investmentController.js";
import {
  SIGNUP_BONUS_DAILY_INCOME,
  SIGNUP_BONUS_AMOUNT,
} from "../constants/investmentConstants.js";

const CRON_TIMEZONE = "Asia/Kolkata";
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getTodayStartEpochMsIST() {
  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  istNow.setUTCHours(0, 0, 0, 0);
  return istNow.getTime() - IST_OFFSET_MS;
}

function getProcessingWindowIST() {
  const todayStart = getTodayStartEpochMsIST();
  const oneDayMs = 24 * 60 * 60 * 1000;

  const yesterdayStart = todayStart - oneDayMs;
  const yesterdayEnd = todayStart - 1;

  return {
    todayStart,
    yesterdayStart,
    yesterdayEnd,
    creditedForDate: yesterdayStart,
  };
}
function generateTransactionId() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

async function startCronLog(connection, jobName, runForDate) {
  const now = Date.now();

  const [result] = await connection.query(
    `
    INSERT IGNORE INTO cron_logs
    (job_name, run_for_date, status, started_at)
    VALUES (?, ?, 'running', ?)
    `,
    [jobName, runForDate, now],
  );

  return result.affectedRows === 1;
}

async function finishCronLog(
  connection,
  jobName,
  runForDate,
  status,
  errorMessage = null,
) {
  await connection.query(
    `
    UPDATE cron_logs
    SET status = ?, finished_at = ?, error_message = ?
    WHERE job_name = ? AND run_for_date = ?
    `,
    [status, Date.now(), errorMessage, jobName, runForDate],
  );
}

const startDailyEarningsCron = () => {
  cron.schedule(
    "5 0 * * *",
    async () => {
      await creditSignupBonusDailyIncome();
      await dailyIncome();
    },
    {
      timezone: CRON_TIMEZONE,
    },
  );

  cron.schedule(
    "6 0 * * *",
    async () => {
      await processDownlineIncomeCron();
    },
    {
      timezone: CRON_TIMEZONE,
    },
  );

  cron.schedule(
    "10 0 1 * *",
    async () => {
      await processMonthlyLeadershipReward();
    },
    {
      timezone: CRON_TIMEZONE,
    },
  );
};

// Sign-Up Bonus Giving Cron Method
async function creditSignupBonusDailyIncome() {
  console.log(
    "Signup bonus daily income cron started:",
    new Date().toISOString(),
  );

  let connection;
  const { creditedForDate } = getProcessingWindowIST();

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const canRun = await startCronLog(
      connection,
      "signup_bonus_daily_income",
      creditedForDate,
    );

    if (!canRun) {
      await connection.rollback();
      console.log("Signup bonus income already processed today — skipping");
      return;
    }

    const [users] = await connection.query(`
      SELECT u.id
      FROM users u
      WHERE u.status = 1
        AND EXISTS (
          SELECT 1
          FROM bonuses b
          WHERE b.user_id = u.id
            AND b.type = 'signup_bonus'
        )
    `);

    console.log(`Signup bonus eligible users: ${users.length}`);

    for (const user of users) {
      const [sumRows] = await connection.query(
        `
        SELECT COALESCE(SUM(amount), 0) as totalEarned
        FROM signup_bonus_income
        WHERE user_id = ?
        `,
        [user.id],
      );

      const totalEarned = Number(sumRows[0].totalEarned);

      if (totalEarned >= SIGNUP_BONUS_AMOUNT) {
        continue;
      }

      const remaining = SIGNUP_BONUS_AMOUNT - totalEarned;

      const amountToGive = Math.min(SIGNUP_BONUS_DAILY_INCOME, remaining);

      const now = Date.now();

      const [insertResult] = await connection.query(
        `
        INSERT IGNORE INTO signup_bonus_income
        (user_id, amount, credited_for_date, created_at)
        VALUES (?, ?, ?, ?)
        `,
        [user.id, amountToGive, creditedForDate, now],
      );

      if (insertResult.affectedRows === 0) {
        continue;
      }

      await connection.query(
        `
        UPDATE users
        SET withdrawable_balance = withdrawable_balance + ?
        WHERE id = ?
        `,
        [amountToGive, user.id],
      );

      console.log(
        `Signup daily income $${amountToGive} credited to user ${user.id}`,
      );
    }

    await finishCronLog(
      connection,
      "signup_bonus_daily_income",
      creditedForDate,
      "success",
    );

    await connection.commit();

    console.log(
      "Signup bonus daily income cron finished:",
      new Date().toISOString(),
    );
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }

    console.error("Signup bonus daily income cron error:", err.message || err);
  } finally {
    if (connection) connection.release();
  }
}

// Daily Rate of Interest Giving Cron Method
async function dailyIncome() {
  console.log("Daily earnings cron started:", new Date().toISOString());

  let connection;
  const { creditedForDate, yesterdayEnd } = getProcessingWindowIST();

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const canRun = await startCronLog(
      connection,
      "daily_investment_roi",
      creditedForDate,
    );

    if (!canRun) {
      await connection.rollback();
      console.log("Daily investment ROI already processed today — skipping");
      return;
    }

    const [investments] = await connection.query(
      `
  SELECT 
    id,
    user_id,
    plan_id,
    amount,
    daily_percent
  FROM investments
  WHERE status = 1
    AND CAST(start_date AS UNSIGNED) <= ?
  `,
      [yesterdayEnd],
    );

    console.log(`Found ${investments.length} active investments`);

    for (const inv of investments) {
      const commission = Number(
        ((Number(inv.amount) * Number(inv.daily_percent)) / 100).toFixed(2),
      );

      if (commission <= 0) {
        continue;
      }

      const txId = `TX-${generateTransactionId()}`;
      const createdAt = Date.now();

      const [insertResult] = await connection.query(
        `
        INSERT IGNORE INTO inv_transaction
        (
          transaction_id,
          investment_id,
          user_id,
          plan_id,
          type,
          commission,
          daily_percent,
          amount,
          credited_for_date,
          created_at
        )
        VALUES (?, ?, ?, ?, 'income', ?, ?, ?, ?, ?)
        `,
        [
          txId,
          inv.id,
          inv.user_id,
          inv.plan_id,
          commission,
          inv.daily_percent,
          inv.amount,
          creditedForDate,
          createdAt,
        ],
      );

      if (insertResult.affectedRows === 0) {
        console.log(`Investment ${inv.id} already credited today — skipping`);
        continue;
      }

      await connection.query(
        `
        UPDATE users
        SET withdrawable_balance = withdrawable_balance + ?
        WHERE id = ?
        `,
        [commission, inv.user_id],
      );

      console.log(
        `ROI $${commission} credited to user ${inv.user_id} [Investment ${inv.id}]`,
      );
    }

    await finishCronLog(
      connection,
      "daily_investment_roi",
      creditedForDate,
      "success",
    );
    await connection.commit();

    console.log("Daily earnings cron finished:", new Date().toISOString());
  } catch (err) {
    if (connection) {
      await connection.rollback();

      try {
        connection = await pool.getConnection();
        await connection.query(
          `
          UPDATE cron_logs
          SET status = 'failed', finished_at = ?, error_message = ?
          WHERE job_name = 'daily_investment_roi' AND run_for_date = ?
          `,
          [Date.now(), String(err.message || err), creditedForDate],
        );
      } catch (_) {}
    }

    console.error("Daily earnings cron error:", err.message || err);
  } finally {
    if (connection) connection.release();
  }
}

// Level Income Giving Cron Method
async function processDownlineIncomeCron() {
  console.log("Downline cron started:", new Date().toISOString());

  let connection;
  const { creditedForDate } = getProcessingWindowIST();

  try {
    connection = await pool.getConnection();

    const [rows] = await connection.query(
      `
      SELECT 
        transaction_id,
        user_id,
        commission
      FROM inv_transaction
      WHERE credited_for_date = ?
        AND type = 'income'
      `,
      [creditedForDate],
    );

    console.log(`Downline records to process: ${rows.length}`);

    for (const row of rows) {
      try {
        await investmentController.distributeDownlineIncome(
          row.user_id,
          Number(row.commission),
          creditedForDate,
          row.transaction_id,
        );

        console.log(
          `Downline paid for user ${row.user_id}, ROI profit $${row.commission}`,
        );
      } catch (err) {
        console.error(
          `Downline failed for user ${row.user_id}:`,
          err.message || err,
        );
      }
    }

    console.log("Downline cron finished:", new Date().toISOString());
  } catch (err) {
    console.error("Downline cron fatal error:", err.message || err);
  } finally {
    if (connection) connection.release();
  }
}

// MONTHLY LEADERSHIP REWARD Giving Cron Method
async function processMonthlyLeadershipReward() {
  let connection;

  try {
    connection = await pool.getConnection();

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;

    const [rows] = await connection.query(`
      SELECT *
      FROM user_leadership_rewards
      WHERE monthly_active = 1
    `);

    for (const row of rows) {
      if (row.last_monthly_paid_for === currentMonth) continue;

      await connection.query(
        `
        UPDATE users
        SET withdrawable_balance = withdrawable_balance + ?
        WHERE id = ?
        `,
        [row.monthly_reward, row.user_id],
      );

      await connection.query(
        `
        UPDATE user_leadership_rewards
        SET last_monthly_paid_for = ?
        WHERE id = ?
        `,
        [currentMonth, row.id],
      );
    }

    console.log("Monthly leadership rewards processed");
  } catch (err) {
    console.error("Monthly leadership error:", err);
  } finally {
    if (connection) connection.release();
  }
}

// TESTING CRON METHOD :--------------------------------///////////////////////////

const runTestCronNow = async () => {
  console.log("Manual cron run started");

  await creditSignupBonusDailyIncome();
  await dailyIncome();
  await processDownlineIncomeCron();
};

const cronController = {
  startDailyEarningsCron,
  runTestCronNow,
};

export default cronController;
