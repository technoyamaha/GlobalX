import path from "path";
import pool from "../config/db.js";
import {
  MINIMUM_DEPOSIT_FOR_ACTIVATION,
  SIGNUP_BONUS_AMOUNT,
  FASTTRACK_DIRECT_REQUIRED,
  FASTTRACK_DAYS_LIMIT,
  leadershipRewards,
} from "../constants/investmentConstants.js";
import { success, error } from "../utils/helper.js";

const renderWithLayout = (
  res,
  viewPath,
  data = {},
  layout = "layout/layout",
) => {
  res.render(viewPath, data, (err, html) => {
    if (err) {
      console.error("EJS render error:", err);
      return res.status(500).send("Template rendering error");
    }
    res.render(layout, { ...data, body: html });
  });
};

const adminDashboardPage = (req, res) => {
  renderWithLayout(
    res,
    "manage/dashBoardPage",
    {
      title: "Admin Dashboard",
      userType: "admin",
      activePage: "dashboard",
    },
    "layout/adminLayout",
  );
};

function adminLoginPage(req, res) {
  res.render("account/adminLogin.ejs", {
    title: "Admin Login",
    userType: "admin",
    activePage: "login",
  });
}

const settingsPage = (req, res) => {
  renderWithLayout(
    res,
    "manage/settings.ejs",
    {
      title: "Settings",
      userType: "admin",
      activePage: "Settings",
    },
    "layout/adminLayout",
  );
};

const memberPage = (req, res) => {
  renderWithLayout(
    res,
    "manage/members.ejs",
    {
      title: "Member List",
      userType: "admin",
      activePage: "members",
    },
    "layout/adminLayout",
  );
};

const withdrawalRecord = (req, res) => {
  renderWithLayout(
    res,
    "manage/withdrawalPage.ejs",
    {
      title: "Withdrawal List",
      userType: "admin",
      activePage: "Withdrawal",
    },
    "layout/adminLayout",
  );
};

const rechargeRecord = (req, res) => {
  renderWithLayout(
    res,
    "manage/rechargePage.ejs",
    {
      title: "Recharge List",
      userType: "admin",
      activePage: "Recharge",
    },
    "layout/adminLayout",
  );
};

const browseRecharge = (req, res) => {
  renderWithLayout(
    res,
    "manage/rechargeRecord.ejs",
    {
      title: "Recharge Record",
      userType: "admin",
      activePage: "Recharge",
    },
    "layout/adminLayout",
  );
};

const investmentsPage = (req, res) => {
  // Replace this with DB fetch later
  const mockInvestments = [
    {
      id: 1,
      user: "John Doe",
      amount: 100,
      status: "Active",
      created_at: "2025-08-25",
    },
    {
      id: 2,
      user: "Jane Smith",
      amount: 200,
      status: "Pending",
      created_at: "2025-08-26",
    },
  ];

  renderWithLayout(res, "manage/investments", {
    title: "Investments",
    userType: "admin",
    activePage: "investments",
    investments: mockInvestments,
  });
};

const login = async (req, res) => {
  let connection;
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "Email and password are required",
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    //  Fetch user
    const [rows] = await connection.query(
      "SELECT * FROM users WHERE email = ? AND status = 1",
      [email],
    );

    await connection.commit();

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        status: 401,
        message: "E-mail doesn't exist.",
      });
    }

    const user = rows[0];

    if (user.level !== 1) {
      return res.status(403).json({
        success: false,
        status: 403,
        message: "Access denied. Admins only",
      });
    }

    if (user.plain_password !== password) {
      return res.status(401).json({
        success: false,
        status: 401,
        message: "Invalid password",
      });
    }

    const currentTimestamp = new Date().toISOString();

    return success(
      res,
      "Login successful",
      {
        ...user,
        today: currentTimestamp,
        login_at: currentTimestamp,
      },
      200,
    );
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Login Error:", err);
    return error(res, err.message || "Server error", 500);
  } finally {
    if (connection) connection.release();
  }
};

// Fetch members with pagination + search
const listMembers = async (req, res) => {
  let connection;
  try {
    const { pageno = 1, limit = 20, search = "" } = req.body;
    const offset = (pageno - 1) * limit;

    const searchLower = search.toLowerCase();
    const levelMatch = searchLower === "admin" ? 1 : null;
    const statusMatch = searchLower === "active" ? 1 : null;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const conditions = [
      "u.phone LIKE ?",
      "u.id_user LIKE ?",
      "u.email LIKE ?",
      "CAST(u.level AS CHAR) LIKE ?",
      "CAST(u.status AS CHAR) LIKE ?",
      "CAST(u.money AS CHAR) LIKE ?",
      "CAST(u.deposit_money AS CHAR) LIKE ?",
      "CAST(COALESCE(w.total_withdrawal, 0) AS CHAR) LIKE ?",
    ];

    if (levelMatch !== null) conditions.push("u.level = " + levelMatch);
    if (statusMatch !== null) conditions.push("u.status = " + statusMatch);

    const whereClause = conditions.join(" OR ");

    const params = Array(8).fill(`%${search}%`);

    const [rows] = await connection.query(
      `SELECT 
    u.id,
    u.id_user,
    u.phone,
    u.email,
    u.level,
    u.money,
    u.withdrawable_balance,    
    u.status,
    u.plain_password,
    u.deposit_money AS total_recharge,
    COALESCE(w.total_withdrawal, 0) AS total_withdrawal
  FROM users u
  LEFT JOIN (
      SELECT user_id, SUM(amount) AS total_withdrawal
      FROM withdrawals
      WHERE status = 3
      GROUP BY user_id
  ) w ON w.user_id = u.id
  WHERE ${whereClause}
  ORDER BY u.id ASC
  LIMIT ? OFFSET ?`,
      [...params, +limit, +offset],
    );

    const [[{ total }]] = await connection.query(
      `SELECT COUNT(*) as total
       FROM users u
       LEFT JOIN (
          SELECT user_id, SUM(amount) AS total_withdrawal
          FROM withdrawals
          WHERE status = 3
          GROUP BY user_id
      ) w ON w.user_id = u.id
      WHERE ${whereClause}`,
      [...params],
    );

    await connection.commit();

    return res.json({
      status: true,
      datas: rows,
      page_total: Math.ceil(total / limit),
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("ListMembers Error:", err);
    return res.json({ status: false, message: "Something went wrong" });
  } finally {
    if (connection) connection.release();
  }
};

const memberProfile = (req, res) => {
  const { phone } = req.params;
  renderWithLayout(
    res,
    "manage/profileMember.ejs",
    {
      title: "User Profile",
      userType: "admin",
      activePage: "user profile",
      phone,
    },
    "layout/adminLayout",
  );
};

// get member info
const memberInfo = async (req, res) => {
  let connection;
  try {
    const { phone } = req.body;

    connection = await pool.getConnection();

    // Get user
    const [users] = await connection.query(
      "SELECT * FROM users WHERE phone = ?",
      [phone],
    );

    if (!users.length) return res.json({ status: false });

    const user = users[0];

    // Get inviter
    const [inviter] = await connection.query(
      "SELECT phone, code FROM users WHERE id_user = ?",
      [user.inviter_id],
    );

    // Total recharge
    // const [rechargeRows] = await connection.query(
    //     "SELECT SUM(amount) AS total FROM recharge WHERE phone = ?",
    //     [phone]
    // );
    // const total_r = rechargeRows[0]?.total || 0;

    // Total withdraw
    // const [withdrawRows] = await connection.query(
    //     "SELECT SUM(amount) AS total FROM withdrawals WHERE phone = ?",
    //     [phone]
    // );
    // const total_w = withdrawRows[0]?.total || 0;

    res.json({
      status: true,
      user,
      inviter,
      // total_r,
      // total_w,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, error: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// recharge list
const listRecharge = async (req, res) => {
  let connection;
  try {
    const { phone } = req.params;
    connection = await pool.getConnection();

    // Get user ID
    const [users] = await connection.query(
      "SELECT id FROM users WHERE phone = ?",
      [phone],
    );
    if (!users.length) return res.json({ data: [] });
    const user_id = users[0].id;

    const [rows] = await connection.query(
      "SELECT * FROM recharge WHERE user_id = ? ORDER BY id DESC",
      [user_id],
    );

    res.json({ data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ data: [] });
  } finally {
    if (connection) connection.release();
  }
};

// withdraw list
const listWithdraw = async (req, res) => {
  let connection;
  try {
    const { phone } = req.params;
    if (!phone) {
      return res
        .status(400)
        .json({ message: "Phone number is required.", data: [] });
    }

    connection = await pool.getConnection();

    // Get user ID
    const [users] = await connection.query(
      "SELECT id FROM users WHERE phone = ?",
      [phone],
    );
    if (!users.length) {
      return res.json({ message: "User not found", data: [] });
    }

    const user_id = users[0].id;

    const [rows] = await connection.query(
      "SELECT * FROM withdrawals WHERE user_id = ? ORDER BY id DESC",
      [user_id],
    );

    res.json({ message: "Success", data: rows });
  } catch (error) {
    console.error("listWithdraw Error:", error);
    res.status(500).json({ message: "Internal Server Error", data: [] });
  } finally {
    if (connection) connection.release();
  }
};

// Get recharge records (paginated + searchable)
const recharge = async (req, res) => {
  let connection;
  try {
    const auth = req.cookies.auth;
    if (!auth) {
      return res.status(401).json({
        message: "Unauthorized. Missing auth cookie.",
        status: false,
      });
    }

    const { page = 1, limit = 10, search = "", status = "" } = req.body;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const searchTerm = `%${search}%`;

    connection = await pool.getConnection();

    /* -------------------------------------------------
       WHERE CONDITIONS (shared by data + count query)
    --------------------------------------------------*/
    let whereClause = `
      WHERE (
        u.email LIKE ?
        OR u.phone LIKE ?
        OR r.id_order LIKE ?
        OR r.utr LIKE ?
        OR r.wallet_id LIKE ?
        OR r.money LIKE ?
        OR r.type LIKE ?
      )
    `;

    const params = [
      searchTerm,
      searchTerm,
      searchTerm,
      searchTerm,
      searchTerm,
      searchTerm,
      searchTerm,
    ];

    if (status !== "") {
      whereClause += " AND r.status = ?";
      params.push(status);
    }

    /* -------------------------------------------------
       DATA QUERY
    --------------------------------------------------*/
    const [allRecords] = await connection.query(
      `
      SELECT r.*, u.phone, u.email
      FROM recharge r
      LEFT JOIN users u ON r.user_id = u.id
      ${whereClause}
      ORDER BY CAST(r.time AS UNSIGNED) DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limitNum, offset],
    );

    /* -------------------------------------------------
       COUNT QUERY (MUST MATCH WHERE)
    --------------------------------------------------*/
    const [countRows] = await connection.query(
      `
      SELECT COUNT(*) AS total
      FROM recharge r
      LEFT JOIN users u ON r.user_id = u.id
      ${whereClause}
      `,
      params,
    );

    const totalRecordsFiltered = countRows[0]?.total || 0;
    const totalPages = Math.ceil(totalRecordsFiltered / limitNum);

    /* -------------------------------------------------
       TOTAL RECORDS (OPTIONAL – ALL RECHARGES)
    --------------------------------------------------*/
    const [totalCountRows] = await connection.query(
      `SELECT COUNT(*) AS total FROM recharge`,
    );
    const totalCount = totalCountRows[0]?.total || 0;

    /* -------------------------------------------------
       RESPONSE
    --------------------------------------------------*/
    return res.status(200).json({
      message: "Success",
      status: true,
      datas: allRecords,
      totalRechargesPages: totalPages,
      currentPage: pageNum,
      totalRecords: totalCount,
    });
  } catch (error) {
    console.error("Recharge Error:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      status: false,
      datas: [],
    });
  } finally {
    if (connection) connection.release();
  }
};

// Get total recharge for a given date range
const totalrecharges = async (req, res) => {
  let connection;
  try {
    const { start, end } = req.query;
    if (!start || !end) {
      return res.status(400).json({
        status: false,
        message: "Start and end timestamps are required.",
      });
    }

    // Convert ms → MySQL DATETIME (if needed)
    const startDate = new Date(parseInt(start));
    const endDate = new Date(parseInt(end));

    // Format to MySQL DATETIME
    const formatDate = (d) => d.toISOString().slice(0, 19).replace("T", " ");

    connection = await pool.getConnection();

    const [rows] = await connection.query(
      "SELECT SUM(money) AS total FROM recharge WHERE status = 1 AND time > ? AND time < ?",
      [formatDate(startDate), formatDate(endDate)],
    );

    return res.status(200).json({
      status: true,
      total_value: rows[0].total || 0,
      message: "Total recharge calculated successfully",
    });
  } catch (error) {
    console.error("totalrecharges Error:", error);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
      total_value: 0,
    });
  } finally {
    if (connection) connection.release();
  }
};

const withdrawals = async (req, res) => {
  let connection;
  try {
    const { page = 1, limit = 10, search = "", status } = req.body;
    const offset = (page - 1) * limit;
    connection = await pool.getConnection();

    let query = `
      SELECT w.*, u.email 
      FROM withdrawals w 
      LEFT JOIN users u ON w.user_id = u.id
      WHERE 1=1
    `;

    let countQuery = `
      SELECT COUNT(*) AS total 
      FROM withdrawals w 
      LEFT JOIN users u ON w.user_id = u.id
      WHERE 1=1
    `;

    const params = [];
    const countParams = [];

    if (typeof status !== "undefined") {
      query += ` AND w.status = ?`;
      countQuery += ` AND w.status = ?`;
      params.push(status);
      countParams.push(status);
    }

    if (search.trim()) {
      query += ` AND (u.email LIKE ? OR w.wallet LIKE ?)`;
      countQuery += ` AND (u.email LIKE ? OR w.wallet LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
      countParams.push(searchTerm, searchTerm);
    }

    query += " ORDER BY w.id ASC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), offset);

    const [rows] = await connection.query(query, params);
    const [count] = await connection.query(countQuery, countParams);

    const totalPages = Math.ceil(count[0].total / limit);

    res.json({
      status: true,
      datas: rows,
      totalWithdrawPages: totalPages,
      currentPage: page,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, datas: [] });
  } finally {
    if (connection) connection.release();
  }
};

const updateEmail = async (req, res) => {
  let connection;
  try {
    const { phone, email } = req.body;
    if (!phone || !email) {
      return res.json({ status: false, error: "Phone and Email required" });
    }

    connection = await pool.getConnection();

    const [existing] = await connection.query(
      "SELECT id_user FROM users WHERE email = ? AND phone != ?",
      [email, phone],
    );

    if (existing.length > 0) {
      return res.json({
        status: false,
        error: "Email already in use, please choose another",
      });
    }

    const [result] = await connection.query(
      "UPDATE users SET email = ? WHERE phone = ?",
      [email, phone],
    );

    if (result.affectedRows === 0) {
      return res.json({ status: false, error: "User not found" });
    }

    res.json({ status: true, message: "Email updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, error: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

const dashboardData = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    // Run all queries in parallel
    const queries = [
      connection.query(`SELECT COUNT(id) as total FROM users`), // total users
      connection.query(`SELECT COUNT(id) as total FROM users WHERE status = 1`), // active users
      connection.query(
        `SELECT SUM(money) as total FROM recharge WHERE status = 1`,
      ), // total deposits
      connection.query(
        `SELECT SUM(amount) as total FROM withdrawals WHERE status = 1`,
      ), // total withdrawals
    ];

    const results = await Promise.all(queries);
    const [users, activeUsers, totalDeposit, totalWithdraw] = results.map(
      ([rows]) => rows,
    );

    const data = [
      {
        category: "Total Users",
        value: users[0]?.total || 0,
        icon: "fa fa-users",
        url: "/admin/membersList",
      },
      {
        category: "Total Active Users",
        value: activeUsers[0]?.total || 0,
        icon: "fa fa-user-check",
        url: "/admin/membersList",
      },
      {
        category: "Total Deposit Amount",
        value: totalDeposit[0]?.total || 0,
        icon: "fa fa-money-bill",
        url: "/admin/rechargeRecord",
      },
      {
        category: "Total Withdrawal Amount",
        value: totalWithdraw[0]?.total || 0,
        icon: "fa fa-wallet",
        url: "/admin/withdrawalRecord",
      },
    ];

    return res.status(200).json({
      status: true,
      data,
    });
  } catch (error) {
    console.error("Dashboard Error:", error);
    return res.status(500).json({
      status: false,
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

// harjit
const browseWithdrawalRecord = (req, res) => {
  renderWithLayout(
    res,
    "manage/brouseWithdraws.ejs",
    {
      title: "Withdrawal Records",
      userType: "admin",
      activePage: "Withdrawal",
    },
    "layout/adminLayout",
  );
};

const withdrawalPaymentGateway = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const orderId = req.params.orderId;
    const [rows] = await connection.query(
      `SELECT * FROM withdrawals WHERE order_id = ?`,
      [orderId],
    );

    if (!rows.length) {
      return res.status(404).send("Withdrawal not found");
    }

    const withdrawal = rows[0];
    const amount = withdrawal.amount;
    const feeDeduct = withdrawal.fee_deduct;

    const netAmount = (amount - feeDeduct).toFixed(2);

    const address = withdrawal.wallet;
    const currency = withdrawal.method;
    const network = withdrawal.network;

    return res.render("manage/withdrawal_usdt_payment_gateway.ejs", {
      amount: netAmount,
      address,
      currency,
      network,
      orderId,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  } finally {
    if (connection) connection.release();
  }
};

// Helper Method : find referrer of activated user, get referrer’s active investment ,  check 7-day window
// count direct activated users ,  insert into fasttrack_bonus, Credit principal to withdrawable_balance
const processFastTrackBonus = async (connection, activatedUserId) => {
  const now = Date.now();
  const sevenDaysMs = FASTTRACK_DAYS_LIMIT * 24 * 60 * 60 * 1000;

  // Find who referred this activated user
  const [refRows] = await connection.query(
    `
    SELECT 
      ref.id AS referrer_id
    FROM users child
    JOIN users ref ON child.invite = ref.code
    WHERE child.id = ?
    LIMIT 1
    `,
    [activatedUserId],
  );

  if (!refRows.length) return;

  const referrerId = refRows[0].referrer_id;

  // Get referrer's first active normal investment
  const [investmentRows] = await connection.query(
    `
    SELECT id, amount, start_date
    FROM investments
    WHERE user_id = ?
      AND status = 1
      AND investment_type = 'normal'
    ORDER BY CAST(start_date AS UNSIGNED) ASC
    LIMIT 1
    `,
    [referrerId],
  );

  if (!investmentRows.length) return;

  const investment = investmentRows[0];
  const investmentId = investment.id;
  const principalAmount = Number(investment.amount || 0);
  const investmentStartDate = Number(investment.start_date || 0);

  if (!investmentStartDate || principalAmount <= 0) return;

  const fastTrackDeadline = investmentStartDate + sevenDaysMs;

  if (now > fastTrackDeadline) return;

  // Prevent duplicate fasttrack for same investment
  const [alreadyPaid] = await connection.query(
    `
    SELECT id
    FROM fasttrack_bonus
    WHERE user_id = ?
      AND investment_id = ?
    LIMIT 1
    `,
    [referrerId, investmentId],
  );

  if (alreadyPaid.length) return;

  // Count direct users activated by SINGLE deposit >= 50 within 7 days
  const [directRows] = await connection.query(
    `
    SELECT 
      COUNT(DISTINCT child.id) AS direct_count,
      COALESCE(SUM(r.money), 0) AS qualified_business
    FROM users child
    JOIN recharge r ON r.user_id = child.id
    WHERE child.invite = (
      SELECT code FROM users WHERE id = ? LIMIT 1
    )
      AND r.status = 1
      AND r.money >= ?
      AND CAST(r.time AS UNSIGNED) >= ?
      AND CAST(r.time AS UNSIGNED) <= ?
    `,
    [
      referrerId,
      MINIMUM_DEPOSIT_FOR_ACTIVATION,
      investmentStartDate,
      fastTrackDeadline,
    ],
  );

  const directCount = Number(directRows[0]?.direct_count || 0);
  const qualifiedBusiness = Number(directRows[0]?.qualified_business || 0);

  if (directCount < FASTTRACK_DIRECT_REQUIRED) return;

  // Insert bonus first for duplicate safety
  const [insertResult] = await connection.query(
    `
    INSERT IGNORE INTO fasttrack_bonus
    (
      user_id,
      investment_id,
      principal_amount,
      direct_count,
      qualified_business,
      status,
      credited_at,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `,
    [
      referrerId,
      investmentId,
      principalAmount,
      directCount,
      qualifiedBusiness,
      now,
      now,
    ],
  );

  if (insertResult.affectedRows === 0) return;

  // Credit 100% principal return
  await connection.query(
    `
    UPDATE users
    SET withdrawable_balance = withdrawable_balance + ?
    WHERE id = ?
    `,
    [principalAmount, referrerId],
  );
};

const getUplineUsers = async (connection, userId) => {
  const uplines = [];

  let [userRows] = await connection.query(
    `SELECT id, invite FROM users WHERE id = ? LIMIT 1`,
    [userId],
  );

  if (!userRows.length) return uplines;

  let currentUser = userRows[0];

  while (currentUser.invite) {
    const [parentRows] = await connection.query(
      `SELECT id, code, invite FROM users WHERE code = ? LIMIT 1`,
      [currentUser.invite],
    );

    if (!parentRows.length) break;

    const parent = parentRows[0];
    uplines.push(parent.id);
    currentUser = parent;
  }

  return uplines;
};

const getAllDownlineUserIds = async (connection, userId) => {
  const allDownlineIds = [];
  let currentLevelIds = [userId];

  while (currentLevelIds.length) {
    const [children] = await connection.query(
      `
      SELECT id
      FROM users
      WHERE invite IN (
        SELECT code FROM users WHERE id IN (?)
      )
      `,
      [currentLevelIds],
    );

    if (!children.length) break;

    const childIds = children.map((child) => child.id);
    allDownlineIds.push(...childIds);
    currentLevelIds = childIds;
  }

  return allDownlineIds;
};

const calculateDownlineBusiness = async (connection, userId) => {
  const downlineIds = await getAllDownlineUserIds(connection, userId);

  if (!downlineIds.length) return 0;

  const [rows] = await connection.query(
    `
    SELECT COALESCE(SUM(money), 0) AS total_business
    FROM recharge
    WHERE status = 1
      AND user_id IN (?)
    `,
    [downlineIds],
  );

  return Number(rows[0]?.total_business || 0);
};

const processLeadershipReward = async (connection, depositedUserId) => {
  const now = Date.now();

  const uplineIds = await getUplineUsers(connection, depositedUserId);

  if (!uplineIds.length) return;

  for (const uplineId of uplineIds) {
    const businessAmount = await calculateDownlineBusiness(
      connection,
      uplineId,
    );

    const eligibleRanks = leadershipRewards
      .filter((rank) => businessAmount >= rank.businessRequired)
      .sort((a, b) => a.rankLevel - b.rankLevel);

    if (!eligibleRanks.length) continue;

    for (const rank of eligibleRanks) {
      const [existingRows] = await connection.query(
        `
        SELECT id
        FROM user_leadership_rewards
        WHERE user_id = ?
          AND reward_id = ?
        LIMIT 1
        `,
        [uplineId, rank.rankLevel],
      );

      if (existingRows.length) {
        await connection.query(
          `
          UPDATE user_leadership_rewards
          SET business_amount = ?,
              updated_at = ?
          WHERE user_id = ?
            AND reward_id = ?
          `,
          [businessAmount, now, uplineId, rank.rankLevel],
        );

        continue;
      }

      const [insertResult] = await connection.query(
        `
        INSERT IGNORE INTO user_leadership_rewards
        (
          user_id,
          reward_id,
          rank_name,
          business_amount,
          one_time_reward,
          monthly_reward,
          one_time_paid,
          monthly_active,
          last_monthly_paid_for,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 1, 1, NULL, ?, ?)
        `,
        [
          uplineId,
          rank.rankLevel,
          rank.name,
          businessAmount,
          rank.oneTimeReward,
          rank.monthlyReward,
          now,
          now,
        ],
      );

      if (insertResult.affectedRows === 1) {
        await connection.query(
          `
          UPDATE users
          SET withdrawable_balance = withdrawable_balance + ?
          WHERE id = ?
          `,
          [rank.oneTimeReward, uplineId],
        );
      }
    }
  }
};

const rechargeDuyet = async (req, res) => {
  let auth = req.cookies.auth;
  let id = req.body.id;
  let type = req.body.type;
  let connection;

  if (!auth || !id || !type) {
    return res.status(200).json({
      message: "Failed",
      status: false,
      timeStamp: new Date().toISOString(),
    });
  }

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    if (type === "confirm") {
      const [info] = await connection.query(
        `SELECT * FROM recharge WHERE id = ? FOR UPDATE`,
        [id],
      );

      if (!info.length) {
        await connection.rollback();
        return res.status(404).json({
          message: "Recharge record not found",
          status: false,
        });
      }

      const recharge = info[0];

      if (Number(recharge.status) === 1) {
        await connection.rollback();
        return res.status(400).json({
          message: "Recharge already confirmed",
          status: false,
        });
      }

      if (Number(recharge.status) === 2) {
        await connection.rollback();
        return res.status(400).json({
          message: "Recharge already cancelled",
          status: false,
        });
      }

      const depositAmount = Number(recharge.money || 0);
      const userId = recharge.user_id;
      const now = Date.now();

      const [beforeDepositRows] = await connection.query(
        `
    SELECT COALESCE(SUM(money), 0) AS total_deposit
    FROM recharge
    WHERE user_id = ?
      AND status = 1
    `,
        [userId],
      );

      const previousTotalDeposit = Number(
        beforeDepositRows[0]?.total_deposit || 0,
      );
      const newTotalDeposit = previousTotalDeposit + depositAmount;

      await connection.query(
        `
    UPDATE users
    SET money = money + ?,
        deposit_money = deposit_money + ?
    WHERE id = ?
    `,
        [depositAmount, depositAmount, userId],
      );

      await connection.query(
        `
    UPDATE recharge
    SET status = 1
    WHERE id = ?
    `,
        [recharge.id],
      );

      const shouldActivateSignupBonus =
        depositAmount >= MINIMUM_DEPOSIT_FOR_ACTIVATION;

      if (shouldActivateSignupBonus) {
        const [alreadyBonus] = await connection.query(
          `
      SELECT id
      FROM bonuses
      WHERE user_id = ?
        AND type = 'signup_bonus'
      LIMIT 1
      `,
          [userId],
        );

        if (!alreadyBonus.length) {
          await connection.query(
            `
        INSERT INTO bonuses
        (
          user_id,
          type,
          amount,
          description,
          status,
          created_at,
          updated_at
        )
        VALUES (?, 'signup_bonus', ?, ?, 1, ?, ?)
        `,
            [
              userId,
              SIGNUP_BONUS_AMOUNT,
              `Signup bonus activated after minimum $${MINIMUM_DEPOSIT_FOR_ACTIVATION} deposit`,
              now,
              now,
            ],
          );
        }
      }

      await processFastTrackBonus(connection, userId);
      await processLeadershipReward(connection, userId);
      await connection.commit();

      return res.status(200).json({
        message: "Recharge confirmed successfully",
        status: true,
      });
    }

    if (type === "delete") {
      await connection.query(`UPDATE recharge SET status = 2 WHERE id = ?`, [
        id,
      ]);

      await connection.commit();

      return res.status(200).json({
        message: "Cancellation successful",
        status: true,
      });
    }

    await connection.rollback();
    return res.status(400).json({
      message: "Invalid type",
      status: false,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error in rechargeDuyet:", error);
    return res.status(500).json({
      message: "Server error",
      status: false,
    });
  } finally {
    if (connection) connection.release();
  }
};

const getUsdtRate = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const [rows] = await connection.query(
      "SELECT value, created_at FROM settings WHERE type = ? LIMIT 1",
      ["USDT_RATE"],
    );

    if (!rows.length) {
      return res.status(200).json({
        status: true,
        data: {
          rate: null,
          updated_at: null,
        },
      });
    }

    return res.status(200).json({
      status: true,
      data: {
        rate: Number(rows[0].value),
        updated_at: rows[0].created_at,
      },
    });
  } catch (err) {
    console.error("getUsdtRate error:", err);
    return res.status(500).json({
      status: false,
      message: "Failed to load USDT rate",
      ErrorMessage: err.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

const updateUsdtRate = async (req, res) => {
  let connection;
  const timeNow = Date.now();

  try {
    const rate = Number(req.body.rate);

    if (!rate || isNaN(rate) || rate <= 0) {
      return res.status(400).json({
        status: false,
        message: "Invalid USDT rate",
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [existing] = await connection.query(
      "SELECT id FROM settings WHERE type = ? LIMIT 1",
      ["USDT_RATE"],
    );

    if (existing.length) {
      // UPDATE (no new row)
      await connection.query(
        "UPDATE settings SET value = ?, created_at = ? WHERE type = ?",
        [String(rate), timeNow, "USDT_RATE"],
      );
    } else {
      // INSERT (first time)
      await connection.query(
        "INSERT INTO settings (type, value, created_at) VALUES (?, ?, ?)",
        ["USDT_RATE", String(rate), timeNow],
      );
    }

    await connection.commit();

    return res.status(200).json({
      status: true,
      message: "USDT rate updated successfully",
      rate,
      updated_at: timeNow,
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("updateUsdtRate error:", err);
    return res.status(500).json({
      status: false,
      message: "Failed to update USDT rate",
      ErrorMessage: err.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

const getUsdtWallets = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query(
      "SELECT * FROM usdt_wallets ORDER BY id DESC",
    );

    res.json({ status: true, data: rows });
  } catch (err) {
    res.status(500).json({ status: false, message: "Failed to load wallets" });
  } finally {
    if (connection) connection.release();
  }
};

const addUsdtWallet = async (req, res) => {
  let connection;
  try {
    const { address } = req.body;

    if (!address || !req.file) {
      return res.json({
        status: false,
        message: "Wallet address and QR image are required",
      });
    }

    const qrPath = "/assets/images/" + req.file.filename;

    connection = await pool.getConnection();

    await connection.query(
      `INSERT INTO usdt_wallets 
       (address, qr_image, is_active, created_at)
       VALUES (?, ?, 1, ?)`,
      [address.trim(), qrPath, Date.now()],
    );

    return res.json({
      status: true,
      message: "USDT wallet added successfully",
    });
  } catch (err) {
    console.error("addUsdtWallet error:", err);
    return res.status(500).json({
      status: false,
      message: "Failed to add wallet",
    });
  } finally {
    if (connection) connection.release();
  }
};

const updateUsdtWallet = async (req, res) => {
  let connection;
  try {
    const { id, address } = req.body;
    const qrFile = req.file;

    if (!id || !address) {
      return res.json({
        status: false,
        message: "Wallet ID and address are required",
      });
    }

    let qrPath = null;

    connection = await pool.getConnection();

    // If QR uploaded → update both
    if (qrFile) {
      qrPath = "/assets/images/" + qrFile.filename;

      await connection.query(
        "UPDATE usdt_wallets SET address=?, qr_image=? WHERE id=?",
        [address.trim(), qrPath, id],
      );
    } else {
      // Update only address
      await connection.query("UPDATE usdt_wallets SET address=? WHERE id=?", [
        address.trim(),
        id,
      ]);
    }

    res.json({ status: true, message: "Wallet updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "Update failed",
      errorMessage: err.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

const updateUsdtWalletStatus = async (req, res) => {
  let connection;
  try {
    const { id, is_active } = req.body;

    if (!id || typeof is_active === "undefined") {
      return res.json({ status: false, message: "Invalid request" });
    }

    connection = await pool.getConnection();

    await connection.query("UPDATE usdt_wallets SET is_active=? WHERE id=?", [
      is_active,
      id,
    ]);

    res.json({ status: true, message: "Wallet status updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "Update failed",
      errorMessage: err.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

const deleteUsdtWallet = async (req, res) => {
  let connection;
  try {
    const { id } = req.body;
    connection = await pool.getConnection();
    await connection.query("DELETE FROM usdt_wallets WHERE id=?", [id]);
    res.json({ status: true, message: "Wallet deleted" });
  } catch (err) {
    res.status(500).json({ status: false, message: "Delete failed" });
  } finally {
    if (connection) connection.release();
  }
};

const adjustWithdrawableBalance = async (req, res) => {
  let connection;
  try {
    const { userId, action, amount } = req.body;

    if (!userId || !action || !amount || amount <= 0) {
      return res.status(400).json({
        status: false,
        message: "Invalid request data",
      });
    }

    // OPTIONAL: admin auth check here (recommended)
    // if (req.admin.level !== 1) return res.status(403).json({ status:false, message:"Unauthorized" });

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT withdrawable_balance FROM users WHERE id = ? FOR UPDATE",
      [userId],
    );

    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    const currentBalance = Number(rows[0].withdrawable_balance);

    if (action === "debit" && amount > currentBalance) {
      await connection.rollback();
      return res.status(400).json({
        status: false,
        message: "Insufficient balance to debit",
      });
    }

    const newBalance =
      action === "credit" ? currentBalance + amount : currentBalance - amount;

    await connection.query(
      "UPDATE users SET withdrawable_balance = ? WHERE id = ?",
      [newBalance, userId],
    );

    await connection.commit();

    return res.json({
      status: true,
      message: "Wallet updated successfully",
      data: {
        before: currentBalance,
        after: newBalance,
      },
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Adjust Wallet Error:", err);
    return res.status(500).json({
      status: false,
      message: "Wallet update failed",
      errorMessage: err.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

const controller = {
  adminDashboardPage,
  login,
  adminLoginPage,
  investmentsPage,
  memberPage,
  settingsPage,
  listMembers,
  withdrawalRecord,
  updateUsdtWallet,
  rechargeRecord,
  memberProfile,
  updateUsdtWalletStatus,
  listRecharge,
  listWithdraw,
  getUsdtWallets,
  addUsdtWallet,
  memberInfo,
  recharge,
  totalrecharges,
  deleteUsdtWallet,
  withdrawals,
  updateEmail,
  dashboardData,
  getUsdtRate,
  updateUsdtRate,
  browseWithdrawalRecord,
  withdrawalPaymentGateway,
  browseRecharge,
  rechargeDuyet,
  adjustWithdrawableBalance,
};

export default controller;
