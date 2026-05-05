import pool from "../config/db.js";
import PaymentMethodsMap from "../constants/PaymentMethods.js";
// import { USDT_WALLETS } from "../config/usdtWallets.js";
import dotenv from 'dotenv';
import nodemailer from "nodemailer"
import axios from "axios";
dotenv.config();

// called inside recharge to distributeRechargeCommission
async function distributeRechargeCommission(data) {
  const rechargeId = data.id;
  const userid = data.userId;
  const money = data.money;
  const code = data.user_code;
}

const WITHDRAWAL_STATUS_MAP = {
  PENDING: 0,
  APPROVED: 1,
  DENIED: 2,
};
const WITHDRAWAL_METHODS_MAP = {
  USDT_ADDRESS: "USDT_ADDRESS",
  BANK_CARD: "BANK_CARD",
};
function AppError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.name = 'AppError';
  error.isAppError = true;
  return error;
}

// Helper: generate unique order id (same pattern you used earlier)
function generateWithdrawOrderId() {
  const date = new Date();
  const datePart = `${date.getUTCFullYear()}${date.getUTCMonth() + 1}${date.getUTCDate()}`;
  const randomPart = Math.floor(Math.random() * (99999999999999 - 10000000000000 + 1)) + 10000000000000;
  return `${datePart}${randomPart}`;
}

// function pickRandomWallet() {
//   const index = Math.floor(Math.random() * USDT_WALLETS.length);
//   return USDT_WALLETS[index];
// }

const pickRandomWalletFromDB = async (connection) => {
  const [rows] = await connection.query(
    `SELECT id, address, qr_image 
     FROM usdt_wallets 
     WHERE is_active = 1`
  );

  if (!rows.length) {
    throw new Error("No active USDT wallets available");
  }

  const index = Math.floor(Math.random() * rows.length);
  return rows[index];
};

const getRechargeOrderId = () => {
  const date = new Date();
  let id_time =
    date.getUTCFullYear() +
    "" +
    date.getUTCMonth() +
    1 +
    "" +
    date.getUTCDate();
  let id_order =
    Math.floor(Math.random() * (99999999999999 - 10000000000000 + 1)) +
    10000000000000;

  return id_time + id_order;
};

const getUserDataByAuthToken = async (authToken) => {
  let connection;
  try {
    connection = await pool.getConnection();
    let [users] = await connection.query(
      "SELECT * FROM users WHERE `token` = ? ",
      [authToken]
    );
    const user = users?.[0];

    if (user === undefined || user === null) {
      throw Error("Unable to get user data!");
    }

    return {
      id: user.id,
      phone: user.phone,
      code: user.code,
      invite: user.invite,
    };
  } catch (error) {
    throw Error("Unable to get user data!");
  } finally {
    connection.release();
  }
};

const getUserDataById = async (id) => {
  let connection;
  try {
    connection = await pool.getConnection();
    let [users] = await connection.query(
      "SELECT `id` FROM users WHERE `id` = ? ",
      [id]
    );
    const user = users?.[0];

    if (user === undefined || user === null) {
      throw Error("Unable to get user data!");
    }

    return {
      id: user.id,
    };
  } catch (error) {
    await connection.rollback();
    throw Error(error);
  } finally {
    connection.release;
  }
};

const addUserMoney = async (userId, money) => {
  if (!userId || !money) {
    throw new AppError(
      `add User Money userId ${userId} or money ${money} not provided`,
      400
    );
  }
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      "UPDATE users SET money = money + ?, deposit_money = deposit_money + ? WHERE `id` = ? ",
      [money, money, userId]
    );

    await connection.commit();
  } catch (error) {
    connection.rollback();
    throw Error(error);
  } finally {
    connection.release();
  }
};

// const checkUpdateUserRank = async (userId, req, res) => {
//   // const checkUpdateUserRank = async (req, res) => {
//   // const { userId } = req.body;
//   if (!userId) {
//     throw new AppError(
//       `UserId not provided`,
//       400
//     );
//   }

//   let connection;
//   try {
//     connection = await pool.getConnection();
//     await connection.beginTransaction();

//     let user = await connection.query(
//       "SELECT deposit_money FROM users WHERE id = ?",
//       [userId]
//     );

//     if (user.length === 0 || user[0].length === 0) {
//       await connection.rollback();
//       throw new AppError(
//         `User not found`,
//         400
//       );
//       return res.status(404).json({ error: "User not found" });
//     }

//     let deposit_money = user[0][0].deposit_money;

//     let ranksResult = await connection.query(
//       "SELECT id, min_amount,monthly_income_for_5_month FROM rank_income ORDER BY min_amount ASC"
//     );

//     if (ranksResult.length === 0) {
//       await connection.rollback();
//       throw new AppError(
//         `No ranks found`,
//         400
//       );
//       return res.status(400).json({ error: "No ranks found" });
//     }

//     let ranks = ranksResult[0];

//     let cumulativeSum = 0;
//     let userRank = null;
//     let incomeAmount = 0;

//     for (const rank of ranks) {
//       if (cumulativeSum + rank.min_amount <= deposit_money) {
//         cumulativeSum += rank.min_amount;
//         userRank = rank;
//         incomeAmount = rank.monthly_income_for_5_month
//       } else {
//         break;
//       }
//     }

//     if (!userRank) {
//       await connection.rollback();
//       throw new AppError(
//         `Deposit money does not qualify for any rank`,
//         400
//       );
//       return res.status(400).json({ error: "Deposit money does not qualify for any rank" });
//     }

//     let existingRankIncomeResult = await connection.query(
//       "SELECT id, rank_id FROM user_rank_income WHERE user_id = ?",
//       [userId]
//     );

//     if (existingRankIncomeResult[0].length > 0) {
//       if (existingRankIncomeResult[0][0].rank_id !== userRank.id) {
//         await connection.query(
//           `UPDATE user_rank_income SET rank_id = ?,income_amount = ?,income_start_from =UNIX_TIMESTAMP() * 1000,  updated_at = UNIX_TIMESTAMP() * 1000  WHERE user_id = ?`,
//           [userRank.id, incomeAmount, userId]
//         );
//       }
//     } else {
//       await connection.query(
//         `INSERT INTO user_rank_income (user_id, rank_id,income_amount, is_active, created_at, updated_at,income_start_from)
//          VALUES (?, ?,?, '1', UNIX_TIMESTAMP() * 1000 , UNIX_TIMESTAMP() * 1000 , UNIX_TIMESTAMP() * 1000)`,
//         [userId, userRank.id, incomeAmount]
//       );
//     }

//     await connection.commit();

//     /* return res.status(200).json({
//       message: "User rank income updated",
//       rank_id: userRank.id,
//       cumulative_deposit_considered: cumulativeSum
//     }); */
//   } catch (error) {
//     if (connection) {
//       await connection.rollback();
//     }
//     console.error(error);
//     return res.status(500).json({ error: "Internal Server Error" });
//   } finally {
//     if (connection) connection.release();
//   }
// };

const rankIncome = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    /* months */
    //   const [rows] = await connection.query(
    //     `SELECT 
    //    user_id, 
    //    rank_id, 
    //    is_active, 
    //    income_amount, 
    //    TIMESTAMPDIFF(MONTH, FROM_UNIXTIME(income_start_from / 1000), NOW()) AS months_since_start
    //  FROM user_rank_income
    //      -- WHERE income_start_from <= (UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 5 MONTH)) * 1000)
    //      `
    //   );
    /* hours */
    let [rows] = await connection.query(
      `SELECT 
     user_id, 
     rank_id, 
     is_active, 
     income_amount, 
     TIMESTAMPDIFF(HOUR, FROM_UNIXTIME(income_start_from / 1000), NOW()) AS hours_since_start
   FROM user_rank_income
   -- WHERE income_start_from <= (UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 5 MONTH)) * 1000)`
    );
    if (rows.length > 0) {
      for (const row of rows) {
        if (row.hours_since_start < 5) {
          await connection.query(
            `UPDATE user_rank_income SET accumulated_amount = accumulated_amount + ? ,   updated_at = UNIX_TIMESTAMP() * 1000  WHERE user_id = ?`,
            [row.income_amount, row.user_id]
          );

        }
      }
      return res.status(200).json({
        message: "Users eligible for 5-month income",
        data: rows
      });
    }

  } catch (error) {
    console.error("Error fetching 5-month income eligible users:", error);
    return res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
}

const addUserAccountBalance = async ({ userId, money }) => {
  // await addReferralBonusIfFirstDeposit(userId, money)
  await addUserMoney(userId, money);
  // await checkUpdateUserRank(userId);
};

const rechargeTable = {
  getCurrentTimeForTimeField: async () => {
    return Date.now();
  },
  create: async (newRecharge) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      if (newRecharge.url === undefined || newRecharge.url === null) {
        newRecharge.url = "0";
      }

      await connection.query(
        `INSERT INTO recharge SET id_order = ?, user_id = ?, money = ?, type = ?, status = ?,  url = ?, time = ?, utr = ?`,
        [
          newRecharge.orderId,
          newRecharge.user_id,
          newRecharge.money,
          newRecharge.type,
          newRecharge.status,
          newRecharge.url,
          newRecharge.time,
          newRecharge?.utr,
        ]
      );

      const [recharge] = await connection.query(
        "SELECT * FROM recharge WHERE id_order = ?",
        [newRecharge.orderId]
      );

      if (recharge.length === 0) {
        throw Error("Unable to create recharge!");
      }

      await connection.commit();
      return recharge[0];
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },
};

// helper mehtod for referral either 1st dspoit of first p2p transfer
// const addReferralBonusIfEligible = async (userId, amount, source) => {
//   let connection;
//   try {
//     connection = await pool.getConnection();

//     // Check if bonus already given for this user (any source:- p2p or 1st depsoit)
//     const [bonusRows] = await connection.query(
//       "SELECT COUNT(*) AS cnt FROM bonuses WHERE description LIKE ?",
//       [`Referral bonus for first% by user ID ${userId}%`]
//     );
//     if (bonusRows[0].cnt > 0) return; // Already rewarded, exit

//     // Get referrer info
//     const [rows] = await connection.query(
//       `SELECT ref.id, ref.id_user, ref.code
//        FROM users AS u
//        JOIN users AS ref ON u.invite = ref.code
//        WHERE u.id = ?`,
//       [userId]
//     );

//     if (rows.length === 0) return;

//     const referrerId = rows[0].id;
//     const referrerUserId = rows[0].id_user;
//     const bonusAmount = parseFloat((amount * 0.05).toFixed(2));
//     const nowMs = Date.now();

//     // Insert bonus
//     await connection.query(
//       `INSERT INTO bonuses (user_id, type, amount, description, status, created_at, updated_at)
//        VALUES (?, ?, ?, ?, 1, ?, ?)`,
//       [
//         referrerId,
//         source, // 'first_deposit' OR 'first_p2p'
//         bonusAmount,
//         `Referral bonus for ${source.replace("_", " ")} by user ID ${userId} (credited to referrer ${referrerUserId})`,
//         nowMs,
//         nowMs,
//       ]
//     );

//     // Update referrer balance
//     await connection.query(
//       `UPDATE users 
//        SET withdrawable_balance = withdrawable_balance + ? 
//        WHERE id = ?`,
//       [bonusAmount, referrerId]
//     );

//   } catch (error) {
//     console.error("Error adding referral bonus:", error.message);
//   } finally {
//     if (connection) connection.release();
//   }
// };

// const addReferralBonusIfFirstDeposit = async (userId, depositAmount) => {
//   let connection;
//   try {
//     connection = await pool.getConnection();

//     // Check if this is the first completed deposit
//     const [depositRows] = await connection.query(
//       "SELECT COUNT(*) AS completedDeposits FROM recharge WHERE user_id = ? AND status = 1",
//       [userId]
//     );

//     if (depositRows[0].completedDeposits !== 1) return;

//     // call addReferralBonusIfEligible
//     await addReferralBonusIfEligible(userId, depositAmount, 'first_deposit');

//   } catch (error) {
//     console.error("Error adding referral bonus:", error.message);
//   } finally {
//     if (connection) connection.release();
//   }
// };

const createOxaPayDeposit = async (req, res) => {
  try {
    const requestData = req.body;
    let money = req.body.money;
    let money_usdt = parseInt(requestData.money);
    const minimumMoneyAllowed = parseInt(process.env.MINIMUM_MONEY_USDT);

    if (!money_usdt || !(money_usdt >= minimumMoneyAllowed)) {
      return res.status(400).json({
        message: `Money is Required and it should be USDT ${minimumMoneyAllowed.toFixed(
          2
        )} or above!`,
        status: false,
        timeStamp: Date.now(),
      });
    }

    let auth = req.cookies.auth;
    const user = await getUserDataByAuthToken(auth);
    const orderId = getRechargeOrderId();
    let cus_time = await rechargeTable.getCurrentTimeForTimeField();

    const baseURL = process.env.APP_BASE_URL;
    const url = "https://api.oxapay.com/v1/payment/invoice";
    const data = {
      amount: money,
      currency: "USDT",
      lifetime: 30,
      callback_url: `${baseURL}api/verify/oxaPay/callback`,
      return_url: `${baseURL}user/wallet/deposit`,
      email: "customer@oxapay.com",
      order_id: orderId,
      thanks_message: "Thanks message",
      description: "",
      sandbox: false,
    };
    const headers = {
      merchant_api_key: `${process.env.OXAPAY_KEY_PAYIN}`,
      "Content-Type": "application/json",
    };
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });

      const result = await response.json();

      const newRecharge = {
        orderId: orderId,
        utr: result.data?.track_id,
        user_id: user.id,
        money: money_usdt,
        type: PaymentMethodsMap.OXA_PAY,
        status: 0,
        url: JSON.stringify(result?.data?.payment_url || result),
        time: cus_time,
      };

      if (result?.status == 200) {
        let recharge = await rechargeTable.create(newRecharge);
        return res.status(200).json({
          status: true,
          data: result,
        });
      }
      return res.status(400).json({
        status: false,
        message: "Gateway Under Maintainance..",
        data: result,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        status: false,
        message: "An error occurred while processing the payment",
        error: error.message,
      });
    }
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      error: error,
      err: error.message,
    });
  }
};

const oxaPayVerify = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const response = req.body;
    const responseString = JSON.stringify(response);
    await connection.query(
      `INSERT INTO api_response (response) VALUES ('${responseString}')`
    );
    const track_id = response.track_id;

    if (response.status == "Paid") {
      let orderid_user = await connection.query(
        `SELECT * FROM recharge WHERE utr  = ? ORDER BY id DESC LIMIT 1`,
        [track_id]
      );
      const recharge = orderid_user[0][0];
      if (recharge) {
        const rechargeId = recharge.id;
        const recharge_status = recharge.status.toString();
        const user = await getUserDataById(recharge.user_id);
        if (recharge_status == "0") {
          await connection.query(
            "UPDATE recharge SET status = 1 WHERE id = ?",
            [rechargeId]
          );
          await connection.commit();
          await addUserAccountBalance({
            userId: user.id,
            money: recharge.money,
          });
        }
      }
    }

    return res.status(200).json({
      status: true,
      data: response,
    });
  } catch (error) {
    console.log("error", error);
    connection.rollback();
    return res.status(400).json({
      status: false,
      data: error,
    });
  } finally {
    connection.release();
  }
};

//  -------------------------     harjit 
async function generateUnique6DigitOrderId() {
  let orderId;
  let exists = true;

  while (exists) {
    orderId = Math.floor(100000 + Math.random() * 900000).toString();
    let connection = await pool.getConnection();

    // Check if orderId already exists in DB
    const [rows] = await connection.query(
      "SELECT COUNT(*) as count FROM withdrawals WHERE order_id = ?",
      [orderId]
    );

    exists = rows[0].count > 0;
  }

  return orderId;
}

//withdraw oxa pay
const createOxaPayWithdraw = async (req, res) => {
  try {
    const requestData = req.body;

    const url = "https://api.oxapay.com/v1/payout";
    const app_Url = process.env.APP_BASE_URL;

    // Parse amount and calculate fee
    const rawAmount = parseFloat(requestData.amount);
    if (isNaN(rawAmount) || rawAmount <= 0) {
      return res.status(400).json({ status: false, message: "Invalid withdrawal amount." });
    }

    const [rows] = await connection.query(
      "SELECT * FROM withdrawals WHERE order_id = ? AND status = 0",
      [requestData.reqId]
    );

    if (!rows.length) {
      return res.status(404).json({ status: false, message: "Invalid or already processed withdrawal request." });
    }

    const fee = +(rawAmount * 0.05).toFixed(2); // 5% fee
    const netAmount = +(rawAmount - fee).toFixed(2); // Final amount sent to OxaPay

    const data = {
      address: requestData.address,
      amount: netAmount,
      currency: requestData.currency,
      network: requestData.network,
      callback_url: `${app_Url}/api/oxapay/withdraw/verify/callback`,
      memo: "Memo12345",
      description: requestData.reqId,
    };

    const headers = {
      payout_api_key: "SRVP2A-3Y2LKC-OZ2D38-PND5MB",
      "Content-Type": "application/json",
    };

    const response = await axios.post(url, data, { headers });

    return res.status(200).json({
      status: true,
      message: "OxaPay payout initiated.",
      data: response.data,
      fee_deducted: fee,
      net_amount_sent: netAmount,
    });
  } catch (error) {
    console.error(" OXA PAY Error:", error.response?.data || error.message);
    return res.status(500).json({
      status: false,
      message: error.response?.data?.error?.message || "Withdrawal failed",
    });
  }
};

const withdrawDB = {
  async getWithdrawalById(id) {
    let connection;

    connection = await pool.getConnection();

    let [withdrawalList] = await connection.query(
      "SELECT * FROM withdrawals WHERE `id` = ?",
      [id],
    );

    if (withdrawalList.length === 0) {
      return {
        isAvailable: false,
      };
    }

    const item = withdrawalList[0];

    return {
      isAvailable: true,
      withdrawal: {
        id: item.id,
        orderId: item.order_id,
        userId: item.user_id,
        wallet: item.wallet,
        network: item.network,
        amount: item.amount,
        method: item.method,
        status: item.status,
        remarks: item.remarks,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      },
    };
  },
};


const approveOrDenyWithdrawalRequest = async (req, res) => {
  let timeNow = Date.now();
  try {
    let auth = req.cookies.auth;
    let id = req.body.id;
    let status = req.body.status;
    let remarks = req.body.remarks;

    let connection;

    connection = await pool.getConnection();
    if (!auth) {
      return res.status(400).json({
        message: "Admin authentication is required!",
        status: false,
        timeStamp: timeNow,
      });
    }


    if (!id || status === undefined) {
      return res.status(400).json({
        message: "Please Provide the required fields!",
        status: false,
        timeStamp: timeNow,
      });
    }

    const withdraw = await withdrawDB.getWithdrawalById(id);

    if (!withdraw.isAvailable) {
      return res.status(400).json({
        message: "Withdrawal request not found!",
        status: false,
        timeStamp: timeNow,
      });
    }
    if (status == WITHDRAWAL_STATUS_MAP.PENDING) {
      await connection.execute(
        `UPDATE withdrawals SET status = 1, remarks = ? WHERE id = ?`,
        [remarks, id],
      );

      return res.status(200).json({
        message: "Approved Withdrawal Request!",
        status: true,
        timeStamp: timeNow,
      });
    }

    if (status == WITHDRAWAL_STATUS_MAP.DENIED) {
      const amount = Number(withdraw.withdrawal.amount);
      let actualAmount = Number(amount);

      await connection.query(
        `UPDATE withdrawals SET status = 2, remarks = ? WHERE id = ?`,
        [remarks, id],
      );

      await connection.query(
        "UPDATE users SET withdrawable_balance = withdrawable_balance + ? WHERE id = ? ",
        [actualAmount, withdraw.withdrawal.userId],
      );

      return res.status(200).json({
        message: "Denied Withdrawal Request!",
        status: true,
        timeStamp: timeNow,
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Something went wrong!",
      status: false,
      error: error.message,
      timeStamp: timeNow,
    });
  }
};

const depositHistory = async (req, res) => {
  const auth = req.cookies.auth;
  let connection;

  if (!auth) return res.status(401).json({ status: 401, message: 'Unauthorized' });

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [userRows] = await connection.query(
      "SELECT id FROM users WHERE token = ?",
      [auth]
    );

    if (userRows.length === 0) {
      return res.status(401).json({ status: 401, message: 'Invalid user' });
    }

    const userId = userRows[0].id;

    const [depositRows] = await connection.query(
      "SELECT id, time, type, money, status, utr FROM recharge WHERE user_id = ? AND status IN (0, 1) ORDER BY time DESC",
      [userId]
    );

    await connection.commit();

    res.status(200).json({
      status: 200,
      message: "Deposit history fetched",
      data: depositRows
    });

  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error:", err);
    res.status(500).json({ status: 500, message: "Failed to fetch deposit history" });
  } finally {
    if (connection) connection.release();
  }
};

const withdrawHistory = async (req, res) => {
  const auth = req.cookies.auth;
  let connection;

  if (!auth) return res.status(401).json({ status: 401, message: 'Unauthorized' });

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();


    const [userRows] = await connection.query(
      "SELECT id FROM users WHERE token = ?",
      [auth]
    );

    if (userRows.length === 0) {
      return res.status(401).json({ status: 401, message: 'Invalid user' });
    }

    const userId = userRows[0].id;

    const [withdrawals] = await connection.query(
      `SELECT id, created_at, wallet, amount, fee_deduct, method, status, order_id
       FROM withdrawals 
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    await connection.commit();

    // Map to add amount_received and readable status
    const statusMap = {
      0: "Pending",
      1: "Approved",
      2: "Failed",
      3: "Completed"
    };

    const dataWithExtras = withdrawals.map(w => {
      const amountNum = Number(w.amount) || 0;
      const feeNum = Number(w.fee_deduct) || 0;

      return {
        ...w,
        amount_received: (amountNum - feeNum).toFixed(2),
        amount: amountNum.toFixed(2),
        fee_deduct: feeNum.toFixed(2),
        status_text: statusMap[w.status] || "Unknown"
       
      };
    });

    res.status(200).json({
      status: 200,
      message: "Withdrawal history fetched",
      data: dataWithExtras
    });

  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error:", err);
    res.status(500).json({ status: 500, message: "Failed to fetch withdrawal history" });
  } finally {
    if (connection) connection.release();
  }
};



const createWithdrawalRequestWORK = async (req, res) => {
  let connection;
  try {
    const auth = req.cookies?.auth;
    if (!auth) return res.status(401).json({ status: false, message: "Unauthorized" });

    const { amount, method, walletAddress, walletNetwork } = req.body || {};

    // basic validation
    if (amount === undefined || amount === null) {
      return res.status(400).json({ status: false, message: "Amount is required" });
    }

    const parsedAmount = Number(String(amount).replace(/,/g, "").trim());
    if (!parsedAmount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ status: false, message: "Invalid amount" });
    }

    // Minimum withdraw check (server-side). Adjust if you want to read from env/config.
    const MIN_WITHDRAW = Number(process.env.MIN_WITHDRAW || 1);
    if (parsedAmount < MIN_WITHDRAW) {
      return res.status(400).json({ status: false, message: `Minimum withdrawal is $${MIN_WITHDRAW}` });
    }

    // method validation
    const METHOD = String(method || "bank").toLowerCase();
    const allowedMethods = ["bank", "upi", "usdt"];
    if (!allowedMethods.includes(METHOD)) {
      return res.status(400).json({ status: false, message: "Invalid withdrawal method" });
    }

    // if USDT require wallet & network
    if (METHOD === "usdt") {
      if (!walletAddress || !String(walletAddress).trim()) {
        return res.status(400).json({ status: false, message: "Wallet address is required for USDT withdrawals" });
      }
      if (!walletNetwork || !String(walletNetwork).trim()) {
        return res.status(400).json({ status: false, message: "Wallet network is required for USDT withdrawals" });
      }
      // Optional: basic BEP20 check
      const wa = String(walletAddress).trim();
      if (!wa.startsWith("0x") || wa.length < 40 || wa.length > 66) {
        return res.status(400).json({ status: false, message: "Wallet address looks invalid (expecting BEP20 address e.g. 0x...)" });
      }
    }

    // Acquire connection + transaction
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Get user by auth cookie token
    const [users] = await connection.query(
      "SELECT id, email, withdrawable_balance FROM users WHERE token = ? LIMIT 1",
      [auth]
    );

    if (!users || users.length === 0) {
      await connection.rollback();
      return res.status(401).json({ status: false, message: "User not found / invalid token" });
    }

    const user = users[0];

    // Lock the row for update and re-check balance to avoid race
    const [lockedRows] = await connection.query(
      "SELECT id, withdrawable_balance FROM users WHERE id = ? FOR UPDATE",
      [user.id]
    );
    if (!lockedRows || lockedRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ status: false, message: "User not found" });
    }

    const currentBalance = Number(lockedRows[0].withdrawable_balance || 0);
    if (currentBalance < parsedAmount) {
      await connection.rollback();
      return res.status(400).json({ status: false, message: "Insufficient withdrawable balance" });
    }

    // Compute fee (if you want no fee set to 0). Here I use 5% as in your previous code.
    const FEE_PERCENT = Number(process.env.WITHDRAW_FEE_PCT || 0.05); // e.g. 0.05 => 5%
    const fee = Number((parsedAmount * FEE_PERCENT).toFixed(2));

  

    // Insert withdrawal record
    const order_id = generateWithdrawOrderId();
    const now = Date.now();
    // Map fields to your DB columns. Adjust column names if different.
    const insertSql = `
      INSERT INTO withdrawals
        (user_id, amount, wallet, fee_deduct, method, network, order_id, status, email_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const insertParams = [
      user.id,
      parsedAmount,
      METHOD === "usdt" ? String(walletAddress).trim() : '', 
      fee,
      METHOD,
      METHOD === "usdt" ? String(walletNetwork).trim() : '',
      order_id,
      0, 
      1,
      now,
      now
    ];

    await connection.query(insertSql, insertParams);

    // Retrieve created withdrawal (by order_id)
    const [createdRows] = await connection.query("SELECT * FROM withdrawals WHERE order_id = ? LIMIT 1", [order_id]);
    if (!createdRows || createdRows.length === 0) {
      await connection.rollback();
      return res.status(500).json({ status: false, message: "Unable to create withdrawal record" });
    }

    const created = createdRows[0];

    await connection.commit();

    return res.status(201).json({
      status: true,
      message: "Withdrawal request created",
      withdrawal: created
    });

  } catch (err) {
    if (connection) {
      try { await connection.rollback(); } catch (e) { console.error("rollback failed", e); }
    }
    console.error("createWithdrawal error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ status: false, message: "Internal server error", error: err && err.message ? err.message : String(err) });
  } finally {
    if (connection) {
      try { connection.release(); } catch (e) { /* ignore */ }
    }
  }
};

const createWithdrawalRequest = async (req, res) => {
  let connection;

  try {
    const auth = req.cookies?.auth;
    if (!auth) {
      return res.status(401).json({ status: false, message: "Unauthorized" });
    }

    const { amount, method, walletAddress, walletNetwork } = req.body || {};

    /* ---------------- BASIC VALIDATION ---------------- */

    if (amount === undefined || amount === null) {
      return res.status(400).json({ status: false, message: "Amount is required" });
    }

    const parsedAmount = Number(String(amount).replace(/,/g, "").trim());
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ status: false, message: "Invalid amount" });
    }

    const MIN_WITHDRAW = Number(process.env.MIN_WITHDRAW || 1);
    if (parsedAmount < MIN_WITHDRAW) {
      return res.status(400).json({
        status: false,
        message: `Minimum withdrawal is $${MIN_WITHDRAW}`,
      });
    }

    const METHOD = String(method || "bank").toLowerCase();
    const allowedMethods = ["bank", "upi", "usdt"];
    if (!allowedMethods.includes(METHOD)) {
      return res.status(400).json({ status: false, message: "Invalid withdrawal method" });
    }

    if (METHOD === "usdt") {
      if (!walletAddress || !walletAddress.trim()) {
        return res.status(400).json({
          status: false,
          message: "Wallet address is required for USDT withdrawals",
        });
      }

      if (!walletNetwork || !walletNetwork.trim()) {
        return res.status(400).json({
          status: false,
          message: "Wallet network is required for USDT withdrawals",
        });
      }

      const wa = walletAddress.trim();
      if (!wa.startsWith("0x") || wa.length < 40 || wa.length > 66) {
        return res.status(400).json({
          status: false,
          message: "Invalid BEP20 wallet address",
        });
      }
    }

    /* ---------------- DB TRANSACTION ---------------- */

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [users] = await connection.query(
      "SELECT id, email, withdrawable_balance FROM users WHERE token = ? LIMIT 1",
      [auth]
    );

    if (!users.length) {
      await connection.rollback();
      return res.status(401).json({ status: false, message: "Invalid user" });
    }

    const user = users[0];

    // Lock balance row
    const [locked] = await connection.query(
      "SELECT withdrawable_balance FROM users WHERE id = ? FOR UPDATE",
      [user.id]
    );

    const currentBalance = Number(locked[0].withdrawable_balance || 0);
    if (currentBalance < parsedAmount) {
      await connection.rollback();
      return res.status(400).json({
        status: false,
        message: "Insufficient withdrawable balance",
      });
    }

    /* ---------------- OTP CREATION ---------------- */

    const otp = Math.floor(100000 + Math.random() * 900000);
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins
    const order_id = generateWithdrawOrderId();

    await connection.query(
      `INSERT INTO withdrawal_otps
       (user_id, order_id, otp, amount, wallet, method, network, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        order_id,
        otp,
        parsedAmount,
        METHOD === "usdt" ? walletAddress.trim() : "",
        METHOD,
        METHOD === "usdt" ? walletNetwork.trim() : "",
        expiresAt,
        Date.now(),
      ]
    );

    /* ---------------- SEND OTP EMAIL ---------------- */

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"NovaNFT" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: "NovaNFT Withdrawal OTP Verification",
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Withdrawal OTP</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.08);">

    <div style="background:linear-gradient(135deg,#0ea5e9,#2563eb);padding:30px;text-align:center;">
      <img src="https://novanft.world/assets/images/novaLogo2.png" style="max-width:160px;" />
    </div>

    <div style="padding:30px;color:#333;">
      <h2 style="margin-top:0;">Withdrawal Verification 🔐</h2>

      <p>Hello,</p>
      <p>
        To confirm your <strong>NovaNFT withdrawal request</strong>,
        please use the OTP below.
      </p>

      <div style="margin:24px 0;padding:18px;background:#f1f5f9;border-radius:8px;text-align:center;">
        <div style="font-size:14px;color:#64748b;">Your Withdrawal OTP</div>
        <div style="font-size:30px;font-weight:800;letter-spacing:4px;color:#2563eb;">
          ${otp}
        </div>
      </div>


      <p style="font-size:14px;color:#555;">
        If you did not initiate this withdrawal, please contact NovaNFT support immediately.
      </p>
    </div>

    <div style="background:#f8fafc;padding:20px;text-align:center;font-size:13px;color:#6b7280;">
      © ${new Date().getFullYear()} NovaNFT. All rights reserved.
    </div>
  </div>
</body>
</html>
      `,
    };

    await transporter.sendMail(mailOptions);

    await connection.commit();

    return res.status(200).json({
      status: true,
      otp_required: true,
      message: "OTP sent to your registered email",
      order_id,
    });

  } catch (err) {
    if (connection) {
      try { await connection.rollback(); } catch (e) {}
    }

    console.error("createWithdrawalRequest error:", err);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: err.message,
    });

  } finally {
    if (connection) {
      try { connection.release(); } catch (e) {}
    }
  }
};

const verifyWithdrawalOTP = async (req, res) => {
  let connection;
  try {
    const { order_id, otp } = req.body;
    const auth = req.cookies.auth;

    console.log("Request body:", req.body);
    console.log("Auth token:", auth);

    if (!auth) return res.status(401).json({ message: "Unauthorized" });
    if (!order_id || !otp) return res.status(400).json({ message: "Order ID and OTP required" });

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Get authenticated user ID
    const [users] = await connection.query(
      "SELECT id FROM users WHERE token = ?",
      [auth]
    );
    console.log("Authenticated users found:", users);

    if (!users.length) {
      await connection.rollback();
      return res.status(401).json({ message: "Unauthorized" });
    }
    const authUserId = users[0].id;
    console.log("Authenticated user ID:", authUserId);

    // Fetch OTP data from DB for this user
    const [rows] = await connection.query(
      "SELECT * FROM withdrawal_otps WHERE order_id = ? AND user_id = ?",
      [order_id, authUserId]
    );
    console.log("OTP rows found:", rows);

    if (!rows.length) {
      await connection.rollback();
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const otpData = rows[0];
    console.log("OTP data:", otpData);

    // Type-safe OTP comparison
    if (otpData.otp.toString().padStart(6, '0') !== otp.toString().padStart(6, '0')) {
      console.log("OTP mismatch:", otpData.otp, otp);
      await connection.rollback();
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Validate OTP expiry
    if (Date.now() > otpData.expires_at) {
      console.log("OTP expired:", Date.now(), otpData.expires_at);
      await connection.rollback();
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Lock user row and verify balance
    const [userRows] = await connection.query(
      "SELECT id, withdrawable_balance FROM users WHERE id = ? FOR UPDATE",
      [authUserId]
    );
    console.log("User rows for balance check:", userRows);

    if (!userRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: "User not found" });
    }

    const user = userRows[0];
    const otpAmount = parseFloat(otpData.amount);
    if (user.withdrawable_balance < otpAmount) {
      console.log("Insufficient balance:", user.withdrawable_balance, otpAmount);
      await connection.rollback();
      return res.status(400).json({ message: "Insufficient balance" });
    }

    const fee = +(otpAmount * 0.05).toFixed(2);
    const now = Date.now();
    // Deduct balance
    await connection.query(
      "UPDATE users SET withdrawable_balance = withdrawable_balance - ? WHERE id = ?",
      [otpAmount, authUserId]
    );

    // Insert withdrawal row
    await connection.query(
      `INSERT INTO withdrawals
   (user_id, amount, wallet, fee_deduct, method, network, order_id,
    status, email_status, created_at, updated_at, otp_verified)
   VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, true)`,
      [
        authUserId,
        otpAmount,
        otpData.wallet,
        fee,
        otpData.method,
        otpData.network,
        otpData.order_id,
        now,
        now
      ]
    );


    // Delete temporary OTP row
    await connection.query("DELETE FROM withdrawal_otps WHERE id = ?", [otpData.id]);

    await connection.commit();

    console.log("OTP verified and withdrawal created successfully for order:", order_id);
    return res.status(200).json({ message: "OTP verified. Withdrawal request confirmed." });

  } catch (err) {
    if (connection) await connection.rollback();
    console.error("verifyWithdrawalOTP error:", err);
    return res.status(500).json({ message: "Internal server error", err: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// const initiateUsdtManual = async (req, res) => {
//   try {
//     const { am } = req.query;
//     if (!am) return res.status(400).send('Missing amount (am) query parameter');
//     const num = Number(String(am).replace(/,/g, '').trim());
//     if (isNaN(num) || num <= 0) return res.status(400).send('Invalid amount');
//     const formattedAmount = num.toFixed(2);
//     const defaultWallet = "0xdC9502Ea5373307644Bebf2fC5dF1BD0185B2cBf";    
//     const qrRelativePath = '/assets/images/usdt_qr1.jpg';

//     return res.render("wallet/usdt_manual_payment.ejs", {
//       Amount: formattedAmount,
//       UsdtWalletAddress: defaultWallet,
//       QrImageSrc: qrRelativePath,   
//       PaymentCurrency: "USDT",
//       SourceType: "usdt"
//     });
//   } catch (err) {
//     console.error("initiateUsdtManual (no-db) error:", err && err.stack ? err.stack : err);
//     return res.status(500).send("Something went wrong");
//   }
// };

// const initiateUsdtManual = async (req, res) => {
//   try {
//     const { am } = req.query;
//     if (!am) return res.status(400).send("Missing amount");

//     const num = Number(String(am).replace(/,/g, ""));
//     if (isNaN(num) || num <= 0) return res.status(400).send("Invalid amount");

//     const wallet = pickRandomWallet(); 

//     return res.render("wallet/usdt_manual_payment.ejs", {
//       Amount: num.toFixed(2),
//       UsdtWalletAddress: wallet.address,
//       QrImageSrc: wallet.qr,
//       WalletId: wallet.id,             
//       PaymentCurrency: "USDT",
//       SourceType: "usdt"
//     });

//   } catch (err) {
//     console.error(err);
//     return res.status(500).send("Something went wrong");
//   }
// };

const initiateUsdtManual = async (req, res) => {
  let connection;
  try {
    const { am } = req.query;
    if (!am) return res.status(400).send("Missing amount");

    const num = Number(String(am).replace(/,/g, ""));
    if (isNaN(num) || num <= 0) return res.status(400).send("Invalid amount");

    connection = await pool.getConnection();

    const wallet = await pickRandomWalletFromDB(connection);

    return res.render("wallet/usdt_manual_payment.ejs", {
      Amount: num.toFixed(2),
      UsdtWalletAddress: wallet.address,
      QrImageSrc: wallet.qr_image,
      WalletId: wallet.id,     
      PaymentCurrency: "USDT",
      SourceType: "usdt",
    });

  } catch (err) {
    console.error(err);
    return res.status(500).send("No wallet available");
  } finally {
    if (connection) connection.release();
  }
};


const addManualUSDTPaymentRequest = async (req, res) => {
  let connection;
  const timeNow = Date.now();

  try {
    const data = req.body || {};
    const auth = req.cookies?.auth;
    if (!auth) {
      return res.status(401).json({ status: false, message: "Unauthorized", timeStamp: timeNow });
    }

    // Parse inputs
    const rawMoney = data.money || "";
    const money_usdt = Number(String(rawMoney).replace(/,/g, "").trim());
    const utr = data.utr ? String(data.utr).trim() : "";

    if (!money_usdt || isNaN(money_usdt) || money_usdt <= 0) {
      return res.status(400).json({ status: false, message: "Invalid USDT amount", timeStamp: timeNow });
    }

    if (!utr) {
      return res.status(400).json({ status: false, message: "Ref No. / Txn Hash is required", timeStamp: timeNow });
    }


    const wallet_id = data.wallet_id ? Number(data.wallet_id) : null;

if (!wallet_id || isNaN(wallet_id)) {
  return res.status(400).json({
    status: false,
    message: "Invalid or missing wallet ID",
    timeStamp: timeNow,
  });
}

    // Limits (env fallbacks)
    const minUSDT = Number(process.env.MINIMUM_MONEY_USDT );
    const maxUSDT = Number(process.env.MAXIMUM_MONEY_USDT || 50000);

    if (money_usdt < minUSDT) {
      return res.status(400).json({
        status: false,
        message: `Minimum USDT deposit is ${minUSDT}`,
        timeStamp: timeNow,
      });
    }

    if (money_usdt > maxUSDT) {
      return res.status(400).json({
        status: false,
        message: `Maximum USDT deposit is ${maxUSDT}`,
        timeStamp: timeNow,
      });
    }

    // Determine rate (env-based, no settings table)
    const isMVPay = String(data.source || "").toLowerCase() === "mv_pay";
    // const RATE = isMVPay ? Number(process.env.MV_PAY_RATE || 1) : Number(process.env.USDT_RATE || 1);

       // Acquire DB connection + transaction
    connection = await pool.getConnection();
    await connection.beginTransaction();


    // const [rateRows] = await connection.query(
    //  "SELECT value FROM settings WHERE type = ? LIMIT 1",
    // ["USDT_RATE"]
    //  );

    // const RATE = rateRows.length ? Number(rateRows[0].value) : 1; 
    //    const usdt_amount = Number(money_usdt.toFixed(2));

    const [rateRows] = await connection.query(
  "SELECT value FROM settings WHERE type = ? LIMIT 1",
  ["USDT_RATE"]
);

const RATE = rateRows.length ? Number(rateRows[0].value) : 1;

const usdt_amount = Number(money_usdt.toFixed(2));
const inr_amount = Number((usdt_amount * RATE).toFixed(2));

 

    // Resolve user by auth token and get user id
    const [userRows] = await connection.query("SELECT id FROM users WHERE token = ? LIMIT 1", [auth]);
    if (!userRows || userRows.length === 0) {
      await connection.rollback();
      return res.status(401).json({ status: false, message: "Invalid user", timeStamp: timeNow });
    }
    const user = userRows[0];

    // Remove pending recharges for this user_id and type
    const rechargeType = isMVPay ? "mv_pay" : "usdt_manual";
    // await connection.query("DELETE FROM recharge WHERE user_id = ? AND status = 0 AND type = ?", [
    //   user.id,
    //   rechargeType,
    // ]);

    // Generate id_order (keeps same pattern you used before)
    const d = new Date();
    const datePart = `${d.getUTCFullYear()}${d.getUTCMonth() + 1}${d.getUTCDate()}`;
    const randomPart = Math.floor(Math.random() * (99999999999999 - 10000000000000 + 1)) + 10000000000000;
    const id_order = `${datePart}${randomPart}`;


     const unixEpoch13 = new Date().getTime();   
    await connection.query(
  `INSERT INTO recharge (
    id_order,
    user_id,
    wallet_id,
    utr,
    money,
    inr_amount,
    type,
    status,
    time,
    url
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [
    id_order,
    user.id,
    wallet_id,
    utr,
    usdt_amount,
    inr_amount,       
    rechargeType,
    0,
    unixEpoch13,
    "0"
  ]
);

    // Retrieve created row to return
    const [createdRows] = await connection.query("SELECT * FROM recharge WHERE id_order = ? LIMIT 1", [id_order]);
    if (!createdRows || createdRows.length === 0) {
      await connection.rollback();
      return res.status(500).json({ status: false, message: "Unable to create recharge", timeStamp: timeNow });
    }

    const created = createdRows[0];

    await connection.commit();

    return res.status(200).json({
      status: true,
      message: "Payment requested successfully!",
      recharge: created,
      timeStamp: timeNow,
    });
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (e) {
        console.error("rollback error", e);
      }
    }
    console.error("addManualUSDTPaymentRequest error:", err && err.stack ? err.stack : err);
    return res.status(500).json({
      status: false,
      message: "Something went wrong!",
      timestamp: timeNow,
      errorMsg: err && err.message ? err.message : String(err),
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


const checkRechargeStatus = async (req, res) => {
  let connection;
  try {
    const auth = req.cookies?.auth;
    if (!auth) {
      return res.status(401).json({
        status: null,
        message: "Unauthorized",
      });
    }

    const rechargeId = Number(req.query.id);
    if (!rechargeId || isNaN(rechargeId)) {
      return res.status(400).json({
        status: null,
        message: "Invalid recharge id",
      });
    }

    connection = await pool.getConnection();

    // Get user by token
    const [userRows] = await connection.query(
      "SELECT id FROM users WHERE token = ? LIMIT 1",
      [auth]
    );

    if (!userRows.length) {
      return res.status(401).json({
        status: null,
        message: "Invalid user",
      });
    }

    const userId = userRows[0].id;

    // Get recharge status (ensure ownership)
    const [rows] = await connection.query(
      `
      SELECT status 
      FROM recharge 
      WHERE id = ? AND user_id = ? 
      LIMIT 1
      `,
      [rechargeId, userId]
    );

    if (!rows.length) {
      return res.status(404).json({
        status: null,
        message: "Recharge not found",
      });
    }

    // status meanings:
    // 0 = pending
    // 1 = approved
    // 2 = rejected / expired
    return res.status(200).json({
      status: rows[0].status,
    });
  } catch (err) {
    console.error("checkRechargeStatus error:", err);
    return res.status(500).json({
      status: null,
      message: "Internal server error",
    });
  } finally {
    if (connection) connection.release();
  }
};

const getUsdtLimits = async (req, res) => {
  try {
    const minUSDT = Number(process.env.MINIMUM_MONEY_USDT || 1);
    const maxUSDT = Number(process.env.MAXIMUM_MONEY_USDT || 50000);

    return res.status(200).json({
      status: true,
      data: {
        min: minUSDT,
        max: maxUSDT,
      },
    });
  } catch (err) {
    console.error("getUsdtLimits error:", err);
    return res.status(500).json({
      status: false,
      message: "Failed to load deposit limits",
    });
  }
};

const cancelInvestment = async (req, res) => {
  let connection;
  try {
    const auth = req.cookies.auth;
    if (!auth) return error(res, "Unauthorized", 401);

    const { investment_id } = req.body;
    if (!investment_id) return error(res, "Investment ID required", 400);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // ---- USER AUTH ----
    const [users] = await connection.query(
      "SELECT id FROM users WHERE token = ?",
      [auth]
    );
    if (!users.length) {
      await connection.rollback();
      return error(res, "Unauthorized", 401);
    }
    const userId = users[0].id;

    // ---- FETCH INVESTMENT ----
    const [invRows] = await connection.query(
      `SELECT id, user_id, amount, start_date, status
       FROM investments
       WHERE id = ? FOR UPDATE`,
      [investment_id]
    );

    if (!invRows.length) {
      await connection.rollback();
      return error(res, "Investment not found", 404);
    }

    const inv = invRows[0];

    if (inv.user_id !== userId) {
      await connection.rollback();
      return error(res, "Unauthorized investment access", 403);
    }

    if (inv.status !== 1) {
      await connection.rollback();
      return error(res, "Investment already closed", 400);
    }

    // ---- CALCULATE PENALTY ----
    const now = Date.now();
    const DAYS_30_MS = 30 * 24 * 60 * 60 * 1000;

    const isEarlyClose = now - Number(inv.start_date) < DAYS_30_MS;
    const feePercent = isEarlyClose ? 0.30 : 0;
    const feeAmount = Number((inv.amount * feePercent).toFixed(2));
    const creditAmount = Number((inv.amount - feeAmount).toFixed(2));

    // ---- UPDATE INVESTMENT ----
    await connection.query(
      "UPDATE investments SET status = 0 WHERE id = ?",
      [investment_id]
    );

    // ---- CREDIT USER ----
    await connection.query(
      `UPDATE users
       SET withdrawable_balance = withdrawable_balance + ?
       WHERE id = ?`,
      [creditAmount, userId]
    );

    await connection.commit();

    return res.json({
      status: true,
      message: "Investment closed successfully",
      data: {
        invested_amount: inv.amount,
        fee_deducted: feeAmount,
        credited_amount: creditAmount,
        early_close: isEarlyClose,
      },
    });

  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Cancel Investment Error:", err);
    return res.status(500).json({
      status: false,
      message: "Cancel investment failed",
    });
  } finally {
    if (connection) connection.release();
  }
};




const paymentController = {
  createOxaPayDeposit, oxaPayVerify,  getUsdtLimits,
  // checkUpdateUserRank,
  cancelInvestment,
   rankIncome,
  createOxaPayWithdraw, createWithdrawalRequest,
  approveOrDenyWithdrawalRequest, depositHistory,
  withdrawHistory, verifyWithdrawalOTP ,
   initiateUsdtManual,   addManualUSDTPaymentRequest ,
   checkRechargeStatus
}; 

export default paymentController;
