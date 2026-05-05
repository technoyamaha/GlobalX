import pool from "../config/db.js";
import { error } from "../utils/helper.js";
import { roiRules } from "../utils/roi.js";

function renderWithLayout(res, viewPath, data = {}) {
  res.render(viewPath, data, (err, renderedBody) => {
    if (err) {
      console.error("EJS rendering error:", err);
      return res.status(500).send("Internal Server Error");
    }

    res.render("layout/layout", {
      ...data,
      body: renderedBody,
      userType: "user",
    });
  });
}

function dashboardPage(req, res) {
  renderWithLayout(res, "dashboard/dashboard", {
    title: "Dashboard - GlobalX",
    activePage: "dashboard",
  });
}

function investmentPage(req, res) {
  renderWithLayout(res, "investment/investment.ejs", {
    title: "NovaNFT- Investment",
    activePage: "Investment Page",
  });
}

function depositHistoryPage(req, res) {
  renderWithLayout(res, "wallet/depositHistory.ejs", {
    title: "Deposit History",
    activePage: "Deposit History Page",
  });
}

function withdrawHistoryPage(req, res) {
  renderWithLayout(res, "wallet/withdrawHistory.ejs", {
    title: "Withdraw History",
    activePage: "Withdraw History Page",
  });
}

function miningPool(req, res) {
  renderWithLayout(res, "investment/miningpool.ejs", {
    title: "NovaNFT- Mining Pool",
    activePage: "Mining Pool Page",
  });
}

function invitePage(req, res) {
  renderWithLayout(res, "invite/invite.ejs", {
    title: "NovaNFT- Invite",
    activePage: "dashboard",
  });
}

function registerPage(req, res) {
  res.render("account/register.ejs", {    
    title: "Register - GlobalX",
    activePage: "Register",
  });
}

function loginPage(req, res) {
  res.render("account/login.ejs", {
    title: "Login - GlobalX",
    activePage: "login",
  });
}

function forgotPasswordPage(req, res) {
  res.render("account/forgotPassword.ejs", {
    title: "Forgot Password",
    activePage: "forgotPassword",
  });
}

function getTransferPage(req, res) {
  renderWithLayout(res, "peertopeer/transfer.ejs", {
    title: "Peer to Peer Transfer",

    activePage: "peer-transfer",
  });
}

function getTransactionsPage(req, res) {
  renderWithLayout(res, "peertopeer/transaction.ejs", {
    title: "Transactions",
    activePage: "peer-transactions",
  });
}

function getCollectionPage(req, res) {
  renderWithLayout(res, "collection/collection.ejs", {
    title: "Collection",
    activePage: "Collection",
  });
}

function getCollectionDetailsPage(req, res) {
  renderWithLayout(res, "collection/collectiondetails.ejs", {
    title: "CollectionDetails",
    activePage: "CollectionDetails",
  });
}

function marketPage(req, res) {
  const assets = [
    { name: "Bitcoin", description: "Digital currency", price: 30000 },
    { name: "Ethereum", description: "Smart contracts platform", price: 2000 },
    { name: "Litecoin", description: "Lightweight cryptocurrency", price: 150 },
  ];

  renderWithLayout(res, "market/marketPage.ejs", {
    title: "Market Overview",
    userType: "user",
    activePage: "market-overview",
    assets,
  });
}

async function stakingPage(req, res) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [plans] = await connection.query(
      "SELECT id, min, max, months, daily_percent FROM crypto_plans ORDER BY min ASC",
    );

    await connection.commit();

    let amounts = plans.map((p) => p.min);
    if (plans.length > 0) {
      amounts.push(plans[0].max);
    }

    const months = [...new Set(plans.map((p) => p.months))].sort(
      (a, b) => a - b,
    );

    renderWithLayout(res, "stacking/stacking.ejs", {
      title: "NovaNFT- Mining",
      activePage: "staking",
      amounts,
      months,
      plans,
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("StakingPage Error:", err);
    res.status(500).send("Error loading staking page");
  } finally {
    if (connection) connection.release();
  }
}

async function teamstakingPage(req, res) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [plans] = await connection.query(
      "SELECT id, min, max, months, daily_percent FROM crypto_plans ORDER BY min ASC",
    );

    await connection.commit();

    let amounts = plans.map((p) => p.min);
    if (plans.length > 0) {
      amounts.push(plans[0].max);
    }

    const months = [...new Set(plans.map((p) => p.months))].sort(
      (a, b) => a - b,
    );

    renderWithLayout(res, "stacking/teamStacking.ejs", {
      title: "NovaNFT- Team Mining",
      activePage: "team-staking",
      amounts,
      months,
      plans,
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("StakingPage Error:", err);
    res.status(500).send("Error loading staking page");
  } finally {
    if (connection) connection.release();
  }
}

async function test(req, res) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // logic here
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error:", err);
    res.status(500).send("Error");
  } finally {
    if (connection) connection.release();
  }
}

function farmingPage(req, res) {
  renderWithLayout(res, "farming/farming.ejs", {
    title: "Farming",
    activePage: "farming",
  });
}

function getPrivilegePage(req, res) {
  renderWithLayout(res, "privilege/privilege.ejs", {
    title: "Privilege Club",
    activePage: "privilege",
  });
}

function getDepositPage(req, res) {
  renderWithLayout(res, "wallet/deposit.ejs", {
    title: "NovaNFT- Deposit",
    activePage: "deposit",
  });
}

async function getWithdrawPage(req, res) {
  let connection;
  try {
    const auth = req.cookies && req.cookies.auth ? req.cookies.auth : null;
    let user = null;
    let last5 = [];

    if (auth) {
      connection = await pool.getConnection();
      const [uRows] = await connection.query(
        "SELECT id, user_name , money, phone, token FROM users WHERE token = ? LIMIT 1",
        [auth],
      );
      if (uRows && uRows.length) user = uRows[0];

      if (user && user.id) {
        const [rows] = await connection.query(
          `SELECT id, id_order, utr, money, type, status, time, url
           FROM recharge
           WHERE user_id = ?
           ORDER BY id DESC
           LIMIT 5`,
          [user.id],
        );

        last5 = (rows || []).map((r) => ({
          id: r.id,
          id_order: r.id_order || null,
          utr: r.utr === null || r.utr === undefined ? "" : String(r.utr),
          money:
            r.money === null || r.money === undefined ? 0 : Number(r.money),
          type: r.type || "",
          status: typeof r.status !== "undefined" ? Number(r.status) : 0,
          time: r.time || "",
          url: r.url || "",
        }));
      }
    }

    // Safe default data (covers many variable names templates/layouts commonly use)
    const safeData = {
      title: "NovaNFT- Withdraw",
      activePage: "withdraw",
      Amount: "0.00",
      PaymentCurrency: "USD",
      SourceType: "usdt",
      // UsdtWalletAddress: "0xdC9502Ea5373307644Bebf2fC5dF1BD0185B2cBf",
      QrImageSrc: "/assets/images/usdt_qr1.jpg",
      user: user || null,
      availableBalance:
        user && typeof user.money !== "undefined" ? user.money : 0,
      withdrawHistory: last5,

      // helpers / config
      withdrawMethods: [
        { id: "bank", label: "Bank Transfer" },
        { id: "upi", label: "UPI" },
        { id: "usdt", label: "USDT (BEP20)" },
      ],
      minimumWithdraw: Number(process.env.MINIMUM_WITHDRAW || 10),
      maximumWithdraw: Number(process.env.MAXIMUM_WITHDRAW || 50000),
    };

    // --- DIAGNOSTIC PRE-RENDER ---
    // First render the withdraw view to catch template errors early
    await new Promise((resolve, reject) => {
      req.app.render("wallet/withdraw.ejs", safeData, (err, renderedBody) => {
        if (err) {
          // Return detailed error to browser so you can see line + stack
          console.error("EJS error rendering withdraw.ejs:", err);
          return res
            .status(500)
            .send(
              `<pre>Template render error (withdraw.ejs):\n\n${err.stack || err.message || err}</pre>`,
            );
        }
        // Next render the layout with the body injected to catch layout errors too
        const layoutData = {
          ...safeData,
          body: renderedBody,
          userType: "user",
        };
        req.app.render("layout/layout", layoutData, (err2, finalHtml) => {
          if (err2) {
            // Layout rendering error — show stack
            console.error("EJS error rendering layout/layout:", err2);
            return res
              .status(500)
              .send(
                `<pre>Template render error (layout/layout):\n\n${err2.stack || err2.message || err2}</pre>`,
              );
          }
          // All good — send final HTML
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.send(finalHtml);
          return resolve();
        });
      });
    });
  } catch (err) {
    console.error(
      "getWithdrawPage unexpected error:",
      err && err.stack ? err.stack : err,
    );
    // return stack to browser for debugging
    return res
      .status(500)
      .send(`<pre>Server error:\n\n${err.stack || err.message || err}</pre>`);
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (e) {
        /* ignore */
      }
    }
  }
}

function getTeamStatsPage(req, res) {
  renderWithLayout(res, "team/teamStats.ejs", {
    title: "Team Stats",
    activePage: "team",
  });
}

function getTeamIncomePage(req, res) {
  renderWithLayout(res, "income/teamIncome.ejs", {
    title: "Team Income",
    activePage: "income-team",
  });
}

function getRankIncomePage(req, res) {
  renderWithLayout(res, "income/rankIncome.ejs", {
    title: "Rank Income",

    activePage: "income-rank",
  });
}

function getStakingIncomePage(req, res) {
  renderWithLayout(res, "income/stackingIncome.ejs", {
    title: "Staking Income",
    activePage: "income-staking",
  });
}

function getFarmingIncomePage(req, res) {
  renderWithLayout(res, "income/farmingIncome.ejs", {
    title: "Farming Income",

    activePage: "income-farming",
  });
}

function getDailyYieldPage(req, res) {
  renderWithLayout(res, "income/dailyFarmingYield.ejs", {
    title: "Daily Earning Yield",
    activePage: "income-daily",
  });
}

function getDepositHistoryPage(req, res) {
  renderWithLayout(res, "history/depositHistory.ejs", {
    title: "Deposit History",
    activePage: "history-deposit",
  });
}

function getWithdrawHistoryPage(req, res) {
  renderWithLayout(res, "history/withdrawHistory.ejs", {
    title: "Withdraw History",
    activePage: "history-withdraw",
  });
}

function getProfilePage(req, res) {
  renderWithLayout(res, "settings/profile.ejs", {
    title: "NovaNFT- User Profile",
    activePage: "settings-profile",
  });
}

function getSecurityPage(req, res) {
  renderWithLayout(res, "settings/security.ejs", {
    title: "Security Settings",
    activePage: "settings-security",
  });
}

function getExchangePage(req, res) {
  renderWithLayout(res, "exchange/exchange.ejs", {
    title: "Exchange",

    activePage: "exchange",
  });
}

function comingSoonPage(req, res) {
  renderWithLayout(res, "comingsoon/comingSoon.ejs", {
    title: "comingSoon",
    activePage: "comingSoon",
  });
}

const userInfoOLD = async (req, res) => {
  const auth = req.cookies.auth;
  if (!auth) {
    return res.status(401).json({
      status: false,
      message: "Unauthorized: No auth token provided",
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [users] = await connection.query(
      `
      SELECT 
      u.id,
        u.code,
        u.deposit_money,
        u.email,
        u.id_user,
        u.ip_address,
        u.withdrawable_balance,
        u.money,
        u.level,
        u.rank,
        u.status,
         u.full_name,
          u.user_name,
         u.country,
          u.phone,
        u.user_agent,
        (SELECT COUNT(*) FROM users WHERE invite = u.code) AS invited_count
      FROM users u
      WHERE u.token = ?
      LIMIT 1
      `,
      [auth],
    );
    const user = users?.[0];
    if (!user) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized: Invalid token",
      });
    }

    // Separate query for last 5 logins (safe, no JSON functions)
    const [last_5_login] = await connection.query(
      "SELECT * FROM login WHERE id_user = ? ORDER BY today DESC LIMIT 5",
      [user.id],
    );

    const last_login = last_5_login?.[0] || null;

    const [withdrawSum] = await connection.query(
      `
      SELECT COALESCE(SUM(CAST(amount AS DECIMAL(18,2))), 0) AS totalWithdrawAmount
      FROM withdrawals
      WHERE user_id = ?
      `,
      [user.id],
    );

    const totalWithdrawAmount = Number(
      withdrawSum?.[0]?.totalWithdrawAmount || 0,
    );

    return res.status(200).json({
      status: true,
      user: {
        code: user.code,
        deposit_money: user.deposit_money,
        email: user.email,
        id_user: user.id_user,
        ip_address: user.ip_address,
        money: user.money,
        level: user.level,
        rank: user.rank,
        status: user.status,
        user_agent: user.user_agent,
        withdrawable_balance: user.withdrawable_balance,
        full_name: user.full_name,
        country: user.country,
        phone: user.phone,
        user_name: user.user_name,
      },
      last_5_login,
      last_login,
      invited_count: user.invited_count,
      totalWithdrawAmount: totalWithdrawAmount,
    });
  } catch (error) {
    console.error("userInfo error:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while fetching user info",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

const userInfo = async (req, res) => {
  const auth = req.cookies.auth;
  if (!auth) {
    return res.status(401).json({
      status: false,
      message: "Unauthorized: No auth token provided",
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    // Get user info
    const [users] = await connection.query(
      `
      SELECT 
        u.id,
        u.code,
        CAST(u.deposit_money AS DECIMAL(18,2)) AS deposit_money,
        u.email,
        u.id_user,
        u.ip_address,
        CAST(u.withdrawable_balance AS DECIMAL(18,2)) AS withdrawable_balance,
        CAST(u.money AS DECIMAL(18,2)) AS money,
        u.level,
        u.rank,
        u.status,
        u.full_name,
        u.user_name,
        u.country,
        u.phone,
        u.user_agent,
        (SELECT COUNT(*) FROM users WHERE invite = u.code) AS invited_count
      FROM users u
      WHERE u.token = ?
      LIMIT 1
      `,
      [auth],
    );

    const user = users?.[0];
    if (!user) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized: Invalid token",
      });
    }

    // Last 5 logins
    const [last_5_login] = await connection.query(
      "SELECT * FROM login WHERE id_user = ? ORDER BY today DESC LIMIT 5",
      [user.id],
    );
    const last_login = last_5_login?.[0] || null;

    // Total Withdraw Amount
    const [withdrawSum] = await connection.query(
      `
      SELECT COALESCE(SUM(CAST(amount AS DECIMAL(18,2))), 0) AS totalWithdrawAmount
      FROM withdrawals
      WHERE user_id = ?
      `,
      [user.id],
    );
    const totalWithdrawAmount = parseFloat(
      withdrawSum?.[0]?.totalWithdrawAmount || 0,
    ).toFixed(2);

    // Prepare response ensuring all money fields are numbers with 2 decimals
    const formattedUser = {
      code: user.code,
      deposit_money: parseFloat(user.deposit_money || 0).toFixed(2),
      email: user.email,
      id_user: user.id_user,
      ip_address: user.ip_address,
      money: parseFloat(user.money || 0).toFixed(2),
      level: user.level,
      rank: user.rank,
      status: user.status,
      user_agent: user.user_agent,
      withdrawable_balance: parseFloat(user.withdrawable_balance || 0).toFixed(
        2,
      ),
      full_name: user.full_name,
      country: user.country,
      phone: user.phone,
      user_name: user.user_name,
    };

    return res.status(200).json({
      status: true,
      user: formattedUser,
      last_5_login,
      last_login,
      invited_count: user.invited_count,
      totalWithdrawAmount: totalWithdrawAmount,
    });
  } catch (error) {
    console.error("userInfo error:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while fetching user info",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

const getUserRank = async (req, res) => {
  const auth = req.cookies.auth;
  if (!auth) {
    return res.status(401).json({ status: false, message: "Unauthorized" });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    const [users] = await connection.query(
      "SELECT id, code, withdrawable_balance FROM users WHERE token = ?",
      [auth],
    );
    const withdrawableBalance = parseFloat(
      users[0].withdrawable_balance || 0,
    ).toFixed(2);

    if (!users.length) {
      return res.status(404).json({ status: false, message: "User not found" });
    }
    const userId = users[0].id;
    const userCode = String(users[0].code);

    const [userRank] = await connection.query(
      `SELECT ri.ranks 
       FROM user_rank_income uri 
       JOIN rank_income ri ON uri.rank_id = ri.id 
       WHERE uri.user_id = ? AND uri.is_active = '1' 
       LIMIT 1`,
      [userId],
    );

    const userRankName = userRank.length ? userRank[0].ranks : "N/A";

    //  Get total deposit (status = 1 only)
    const [deposit] = await connection.query(
      `SELECT money AS totalDeposit 
       FROM users 
       WHERE id = ? AND status = 1`,
      [userId],
    );
    const totalDeposit = parseFloat(deposit[0].totalDeposit || 0).toFixed(2);

    // Get total withdrawn amount (status = 3 = Completed)
    const [withdrawals] = await connection.query(
      `SELECT SUM(amount) AS totalWithdrawn 
       FROM withdrawals 
       WHERE user_id = ? AND status = 3`,
      [userId],
    );
    const totalWithdrawn = parseFloat(
      withdrawals[0].totalWithdrawn || 0,
    ).toFixed(2);

    // Get total team size (recursive)
    const [teamRows] = await connection.query(
      `
  WITH RECURSIVE team_tree AS (
    SELECT id, code FROM users WHERE invite = ?
    UNION ALL
    SELECT u.id, u.code FROM users u
    INNER JOIN team_tree tt ON u.invite = tt.code
  )
  SELECT COUNT(*) AS teamSize FROM team_tree
  `,
      [userCode],
    );

    const teamSize = teamRows[0]?.teamSize || 0;

    // Get direct referrals only (users who directly used my code)
    const [directRows] = await connection.query(
      `SELECT COUNT(*) AS directRefers 
   FROM users 
   WHERE invite = ?`,
      [userCode],
    );

    const directRefers = directRows[0]?.directRefers || 0;

    return res.status(200).json({
      status: true,
      rank: userRankName,
      totalDeposit,
      totalWithdrawn,
      teamSize,
      directRefers,
      withdrawableBalance,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Error fetching user rank",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

const getUserStakingsOLD = async (req, res) => {
  const auth = req.cookies.auth;
  if (!auth) {
    return res.status(401).json({ status: false, message: "Unauthorized" });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    const [users] = await connection.query(
      "SELECT id FROM users WHERE token = ?",
      [auth],
    );
    if (!users.length) {
      return res.status(404).json({ status: false, message: "User not found" });
    }
    const userId = users[0].id;

    const [stakings] = await connection.query(
      `SELECT 
    i.amount,
    i.status,
    i.start_date,
    i.matured_at,
    cp.months AS tenure
  FROM investments i
  JOIN crypto_plans cp ON i.plan_id = cp.id
  WHERE i.user_id = ?
  ORDER BY i.start_date DESC`,
      [userId],
    );

    const totalAmount = stakings
      .filter((stake) => stake.status === 1)
      .reduce((sum, stake) => sum + parseFloat(stake.amount || 0), 0)
      .toFixed(2);

    const formattedStakings = stakings.map((stake) => {
      const startDate = new Date(parseInt(stake.start_date));
      const maturedDate = stake.matured_at
        ? new Date(parseInt(stake.matured_at))
        : null;
      return {
        amount: parseFloat(stake.amount).toFixed(2),
        tenure: `${stake.tenure} Months`,
        unlockOn: maturedDate ? maturedDate.toISOString().split("T")[0] : null,
        status: stake.status === 1 ? "Active" : "Inactive",
        date: startDate.toISOString().replace("T", " ").substring(0, 19),
      };
    });

    return res.status(200).json({
      status: true,
      staking: formattedStakings,
      totalActiveAmount: totalAmount,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Error fetching staking data",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

const getUserStakings = async (req, res) => {
  const auth = req.cookies.auth;
  if (!auth) {
    return res.status(401).json({ status: false, message: "Unauthorized" });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    // Find user id from token
    const [users] = await connection.query(
      "SELECT id FROM users WHERE token = ?",
      [auth],
    );
    if (!users.length) {
      return res.status(404).json({ status: false, message: "User not found" });
    }
    const userId = users[0].id;

    // Fetch investments only from new schema (no crypto_plans, no matured_at)
    const [stakings] = await connection.query(
      `
      SELECT 
        i.amount,
        i.status,
        i.start_date,
        i.plan_id,
        i.daily_percent
      FROM investments i
      WHERE i.user_id = ?
      ORDER BY i.start_date DESC
      `,
      [userId],
    );

    // Total active amount
    const totalAmount = stakings
      .filter((stake) => stake.status === 1)
      .reduce((sum, stake) => sum + parseFloat(stake.amount || 0), 0)
      .toFixed(2);

    // Map investments + ROI rules to nice UI data
    const formattedStakings = stakings.map((stake) => {
      const startDate = new Date(Number(stake.start_date));

      // Find matching ROI rule by plan_id (or fallback by index)
      let rule =
        roiRules.find((r) => r.plan_id === stake.plan_id) ||
        roiRules[stake.plan_id - 1] ||
        null;

      let packageLabel = "Unknown Package";
      let roiLabel = `${stake.daily_percent}% Daily`;

      if (rule) {
        const min = rule.min;
        const max = rule.max;
        if (max === null) {
          packageLabel = `${min} USDT & above`;
        } else {
          packageLabel = `${min} USDT – ${max} USDT`;
        }
        roiLabel = `${rule.percent}% Daily`;
      }

      return {
        amount: parseFloat(stake.amount).toFixed(2),
        package: packageLabel, // e.g. "50 USDT – 100 USDT"
        dailyROI: roiLabel, // e.g. "1% Daily"
        status: stake.status === 1 ? "Active" : "Inactive",
        date: startDate.toISOString().replace("T", " ").substring(0, 19),
      };
    });

    return res.status(200).json({
      status: true,
      staking: formattedStakings,
      totalActiveAmount: totalAmount,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Error fetching staking data",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

const updateProfile = async (req, res) => {
  const auth = req.cookies.auth;
  if (!auth) {
    return res.status(401).json({ status: false, message: "Unauthorized" });
  }

  const { full_name, phone, country } = req.body;
  if (!full_name || !phone || !country) {
    return res
      .status(400)
      .json({ status: false, message: "All fields are required" });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    const [users] = await connection.query(
      "SELECT * FROM users WHERE token = ?",
      [auth],
    );
    const user = users?.[0];
    if (!user) {
      return res.status(401).json({ status: false, message: "Invalid token" });
    }

    // Only update allowed fields
    await connection.query(
      "UPDATE users SET full_name = ?, phone = ?, country = ? WHERE id = ?",
      [full_name, phone, country, user.id],
    );

    return res
      .status(200)
      .json({ status: true, message: "Profile updated successfully" });
  } catch (error) {
    console.error("updateProfile error:", error);
    return res.status(500).json({
      status: false,
      message: "Error updating profile",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

const getP2PTransactions = async (req, res) => {
  const auth = req.cookies.auth;
  if (!auth) {
    return res.status(401).json({ status: false, message: "Unauthorized" });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    // get user by token
    const [users] = await connection.query(
      "SELECT id FROM users WHERE token = ?",
      [auth],
    );

    if (!users.length) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    const userId = users[0].id;

    await connection.beginTransaction();

    // Fetch transactions
    // Only fetch debit transactions for logged-in user
    const [transactions] = await connection.query(
      `SELECT pt.id, 
          pt.user_id, 
          pt.to_user_id, 
          pt.money, 
          pt.type, 
          pt.today AS datetime,
          u.user_name as counterparty_name
   FROM p2p_transfer pt
   LEFT JOIN users u ON pt.to_user_id = u.id
   WHERE pt.user_id = ?   -- only when user initiated the transfer (debit)
   ORDER BY pt.id DESC`,
      [userId],
    );

    // Calculate totals
    const [creditResult] = await connection.query(
      `SELECT IFNULL(SUM(money),0) as totalCredit 
       FROM p2p_transfer 
       WHERE to_user_id = ?`,
      [userId],
    );

    const [debitResult] = await connection.query(
      `SELECT IFNULL(SUM(money),0) as totalDebit 
       FROM p2p_transfer 
       WHERE user_id = ?`,
      [userId],
    );

    await connection.commit();

    res.json({
      status: true,
      transactions,
      totalCredit: creditResult[0].totalCredit,
      totalDebit: debitResult[0].totalDebit,
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error:", err);
    res
      .status(500)
      .json({ status: false, message: "Error fetching transactions" });
  } finally {
    if (connection) connection.release();
  }
};

const getRankIncome = async (req, res) => {
  const auth = req.cookies.auth;
  if (!auth) {
    return res.status(401).json({ status: false, message: "Unauthorized" });
  }
  console.log("page----------");

  let connection;
  try {
    connection = await pool.getConnection();

    // get user by token
    const [users] = await connection.query(
      "SELECT id FROM users WHERE token = ?",
      [auth],
    );

    if (!users.length) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    const userId = users[0].id;

    const page = parseInt(req.query.page) || 1; // Default page 1
    const pageSize = parseInt(req.query.pageSize) || 100; // Default page size 10
    const offset = (page - 1) * pageSize; // Calculate offset

    await connection.beginTransaction();

    const [rankResult] = await connection.query(
      `SELECT id, user_id, type, amount, description, status, created_at, updated_at 
     FROM bonuses 
     WHERE type = 'RANK INCOME' AND user_id = ? order by id desc LIMIT ? OFFSET ?`,
      [userId, pageSize, offset],
    );
    const [totalCountResult] = await connection.query(
      `SELECT COUNT(*) as totalCount
       FROM bonuses
       WHERE type = 'RANK INCOME' AND user_id = ?`,
      [userId],
    );

    const totalCount = totalCountResult[0].totalCount;
    const totalPages = Math.ceil(totalCount / pageSize);

    await connection.commit();

    return res.json({
      status: true,
      data: rankResult,
      pagination: {
        currentPage: page,
        pageSize: pageSize,
        totalCount: totalCount,
        totalPages: totalPages,
      },
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error:", err);
    res
      .status(500)
      .json({ status: false, message: "Error fetching transactions" });
  } finally {
    if (connection) connection.release();
  }
};

const getUserBylevels = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const auth = req.cookies.auth;
    const level = parseInt(req.body.level);
    const page = parseInt(req.body.page) || 1;
    const limit = parseInt(req.body.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.body.search ? `%${req.body.search}%` : null;

    if (level < 1 || level > 10) {
      return res.status(400).json({
        status: false,
        message: "incorrect level",
      });
    }
    if (page < 1) {
      return res.status(400).json({
        status: false,
        message: "incorrect page",
      });
    }
    const [users] = await connection.query(
      "SELECT id, code FROM users WHERE token = ?",
      [auth],
    );
    const userCode = String(users[0].code);

    const [teamRows] = await connection.query(
      `
      WITH RECURSIVE team_tree AS (
        SELECT 
          u.code,
          u.deposit_money,
          u.email,
          u.id_user,
          u.ip_address,
          u.money,
          u.level,
          u.rank,
          u.login_at,
          u.status,
          u.user_agent, 
          1 AS tree_level,
          u.code AS root_code
        FROM users u
        WHERE u.invite = ?

        UNION ALL

        SELECT 
          u.code,
          u.deposit_money,
          u.email,
          u.id_user,
          u.ip_address,
          u.money,
          u.level,
          u.rank,
          u.login_at,
          u.status,
          u.user_agent, 
          tt.tree_level + 1 AS tree_level,
          tt.root_code
        FROM users u
        INNER JOIN team_tree tt ON u.invite = tt.code
      )
      SELECT 
        parent.code,
        parent.deposit_money,
        parent.email,
        parent.id_user,
        parent.ip_address,
        parent.money,
        parent.level,
        parent.rank,
        parent.login_at,
        parent.status,
        parent.user_agent,
        parent.tree_level,
        (
          SELECT COUNT(*) 
          FROM team_tree child 
          WHERE child.root_code = parent.code 
            AND child.code != parent.code
        ) AS total_downline,
        COUNT(*) OVER() AS total_matching
      FROM team_tree parent
      WHERE parent.tree_level = ?
        ${search ? "AND (parent.email LIKE ? OR parent.id_user LIKE ?)" : ""}
      LIMIT ? OFFSET ?;
      `,
      search
        ? [userCode, level, search, search, limit, offset]
        : [userCode, level, limit, offset],
    );

    connection.commit();
    return res.status(200).json({
      status: true,
      data: teamRows,
      total: teamRows.length > 0 ? teamRows[0].total_matching : 0,
    });
  } catch (error) {
    if (connection) connection.rollback();
    return res.status(400).json({
      status: false,
      error: error,
      err: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

const getUserStatsDasboardOLD = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const auth = req.cookies.auth;
    if (!auth) {
      return res.status(400).json({
        status: false,
        message: "No Auth Provided",
      });
    }

    const [rows] = await connection.query(
      `
      SELECT
        (SELECT COALESCE(MAX(ur.accumulated_amount), 0)
           FROM user_rank_income ur
           INNER JOIN users u ON u.id = ur.user_id
           WHERE u.token = ?) AS rankIncome,
        (SELECT COALESCE(SUM(inv.earned_amount), 0)
           FROM investments inv
           INNER JOIN users u ON u.id = inv.user_id
           WHERE u.token = ?) AS miningIncome,
        (SELECT COALESCE(SUM(di.amount), 0)
           FROM downline_income di
           INNER JOIN users u ON u.id = di.user_id
           WHERE u.token = ?) AS downLineIncome,
        (SELECT COALESCE(SUM(b.amount), 0)
           FROM bonuses b
           INNER JOIN users u ON u.id = b.user_id
           WHERE u.token = ?) AS dailySignupBonus,
        (SELECT COUNT(r.id) FROM recharge r WHERE r.status = 1 AND r.user_id
         IN ( SELECT u1.id FROM users u1 INNER JOIN users u ON u.code = u1.invite 
         WHERE u.token = ? )) AS activeuser
      `,
      [auth, auth, auth, auth, auth],
    );

    // console.log("rowsrowsrows", rows[0]);
    // Extract values from single row
    const rankIncome = Number(rows[0]?.rankIncome || 0.0).toFixed(2);
    const miningIncome = Number(rows[0]?.miningIncome || 0.0).toFixed(2);
    const downLineIncome = Number(rows[0]?.downLineIncome || 0.0).toFixed(2);
    const dailySignupBonus = Number(rows[0]?.dailySignupBonus || 0.0).toFixed(
      2,
    );
    const activeUsers = Number(rows[0]?.activeuser || 0);

    connection.commit();
    return res.status(200).json({
      status: true,
      data: {
        rankIncome: rankIncome,
        miningIncome: miningIncome,
        downLineIncome: downLineIncome,
        dailySignupBonus: dailySignupBonus,
        activeUsers: activeUsers,
      },
    });
  } catch (error) {
    if (connection) connection.rollback();
    console.log("error", error);
    return res.status(500).json({
      status: false,
      error: error,
      err: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};
const getUserStatsDasboard = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const auth = req.cookies.auth;
    if (!auth) {
      return res.status(400).json({
        status: false,
        message: "No Auth Provided",
      });
    }

    const [rows] = await connection.query(
      `
      SELECT
        -- Rank income from user_rank_income
        (SELECT COALESCE(MAX(ur.accumulated_amount), 0)
           FROM user_rank_income ur
           INNER JOIN users u ON u.id = ur.user_id
           WHERE u.token = ?) AS rankIncome,

        -- Mining income: sum of daily commissions from inv_transaction
        (SELECT COALESCE(SUM(it.commission), 0)
           FROM inv_transaction it
           INNER JOIN users u ON u.id = it.user_id
           WHERE u.token = ?
             AND it.type = 'income') AS miningIncome,

        -- Downline income (unchanged)
        (SELECT COALESCE(SUM(di.amount), 0)
           FROM downline_income di
           INNER JOIN users u ON u.id = di.user_id
           WHERE u.token = ?) AS downLineIncome,

        -- Daily signup bonus (unchanged)
        (SELECT COALESCE(SUM(b.amount), 0)
           FROM bonuses b
           INNER JOIN users u ON u.id = b.user_id
           WHERE u.token = ?) AS dailySignupBonus,

        -- Active users in team (unchanged)
        (SELECT COUNT(r.id) FROM recharge r WHERE r.status = 1 AND r.user_id
         IN ( SELECT u1.id FROM users u1 INNER JOIN users u ON u.code = u1.invite 
         WHERE u.token = ? )) AS activeuser
      `,
      [auth, auth, auth, auth, auth],
    );

    const rankIncome = Number(rows[0]?.rankIncome || 0.0).toFixed(2);
    const miningIncome = Number(rows[0]?.miningIncome || 0.0).toFixed(2);
    const downLineIncome = Number(rows[0]?.downLineIncome || 0.0).toFixed(2);
    const dailySignupBonus = Number(rows[0]?.dailySignupBonus || 0.0).toFixed(
      2,
    );
    const activeUsers = Number(rows[0]?.activeuser || 0);

    return res.status(200).json({
      status: true,
      data: {
        rankIncome,
        miningIncome,
        downLineIncome,
        dailySignupBonus,
        activeUsers,
      },
    });
  } catch (error) {
    console.log("error", error);
    return res.status(500).json({
      status: false,
      error: error,
      err: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

const getTeamIncomeOLD = async (req, res) => {
  let connection;
  try {
    const auth = req.cookies.auth;
    if (!auth)
      return res.status(401).json({ status: false, message: "Unauthorized" });

    connection = await pool.getConnection();

    const [users] = await connection.query(
      "SELECT id FROM users WHERE token = ?",
      [auth],
    );
    const user = users?.[0];

    if (!user)
      return res.status(401).json({ status: false, message: "Unauthorized" });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const [countRows] = await connection.query(
      `SELECT COUNT(*) AS total FROM downline_income WHERE user_id = ?`,
      [user.id],
    );
    const total = countRows[0].total;

    const [incomeRows] = await connection.query(
      `SELECT
  di.*,
  COALESCE(u.full_name, u.user_name, CONCAT('User ', di.from_user_id)) AS from_user_name
FROM downline_income di
LEFT JOIN users u ON di.from_user_id = u.id`,
      [user.id, limit, offset],
    );
    return res.json({
      status: true,
      data: incomeRows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("/api/team-income error:", err.message);
    res.status(500).json({ status: false, message: error.message });
  }
};

const getTeamIncome = async (req, res) => {
  let connection;
  try {
    const auth = req.cookies.auth;
    if (!auth) {
      return res.status(401).json({ status: false, message: "Unauthorized" });
    }

    connection = await pool.getConnection();

    // 🔐 Logged-in user
    const [users] = await connection.query(
      "SELECT id, code FROM users WHERE token = ?",
      [auth],
    );
    const user = users?.[0];
    if (!user) {
      return res.status(401).json({ status: false, message: "Unauthorized" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const [[{ total }]] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM downline_income
       WHERE user_id = ?`,
      [user.id],
    );

    const [incomeRows] = await connection.query(
      `
  SELECT
    di.from_user_id,
    di.level,
    di.amount AS daily_amount,
    di.time,

    u.email,
    COALESCE(u.full_name, u.user_name, CONCAT('User ', di.from_user_id)) AS from_user_name,

    -- TOTAL INVESTED BY THIS REFERRED USER
    COALESCE(inv.total_invested, 0) AS total_invested

  FROM downline_income di

  JOIN users u 
    ON u.id = di.from_user_id

  LEFT JOIN (
    SELECT 
      user_id,
      SUM(amount) AS total_invested
    FROM investments
    WHERE status = 1
    GROUP BY user_id
  ) inv ON inv.user_id = di.from_user_id

  WHERE di.user_id = ?
  ORDER BY di.id DESC
  LIMIT ? OFFSET ?
  `,
      [user.id, limit, offset],
    );

    return res.json({
      status: true,
      data: incomeRows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("/api/team-income error:", err.message);
    return res.status(500).json({
      status: false,
      message: "Server error",
      ErrorMessage: err.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

const homeController = {
  getTransferPage,
  getTeamIncome,
  invitePage,
  getTransactionsPage,
  dashboardPage,
  marketPage,
  stakingPage,
  teamstakingPage,
  farmingPage,
  getPrivilegePage,
  getDepositPage,
  getWithdrawPage,
  getTeamStatsPage,
  getTeamIncomePage,
  getRankIncomePage,
  getStakingIncomePage,
  getFarmingIncomePage,
  getDailyYieldPage,
  getDepositHistoryPage,
  getWithdrawHistoryPage,
  getProfilePage,
  getSecurityPage,
  getExchangePage,
  registerPage,
  loginPage,
  forgotPasswordPage,
  comingSoonPage,
  userInfo,
  getUserRank,
  getUserStakings,
  updateProfile,
  getP2PTransactions,
  getUserBylevels,
  getUserStatsDasboard,
  getRankIncome,
  getCollectionPage,
  getCollectionDetailsPage,
  investmentPage,
  withdrawHistoryPage,
  depositHistoryPage,
  miningPool,
};
export default homeController;
