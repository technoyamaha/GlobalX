import dotenv from "dotenv";
import Joi from "joi";
import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { UAParser } from "ua-parser-js";
import pool from "../config/db.js";
import _ from "lodash";
import md5 from "md5";


const saltRounds = parseInt(process.env.SALT_ROUNDS || 5);


const createMailTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// helper to generate the OTP's
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const getCryptoPlans = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const [plans] = await connection.query(
      `SELECT 
         id AS plan_id,
         name,
         min,
         max,
         months,
         daily_percent,
         created_at,
         updated_at
       FROM crypto_plans
       ORDER BY min ASC`,
    );

    return res.status(200).json({
      success: true,
      data: plans,
    });
  } catch (error) {
    console.error("getCryptoPlans error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  } finally {
    if (connection) connection.release();
  }
};

const utils = {
  generateUniqueNumberCodeByDigit(digit) {
    const timestamp = new Date().getTime().toString();
    const randomNum = _.random(1e12).toString();
    const combined = timestamp + randomNum;
    return _.padStart(combined.slice(-digit), digit, "0");
  },
  getIpAddress(req) {
    let ipAddress =
      req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    if (ipAddress.substr(0, 7) == "::ffff:") {
      ipAddress = ipAddress.substr(7);
    }
    return ipAddress;
  },
};

const login = async (req, res) => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Invalid email address",
      "string.empty": "Email is required",
    }),
    pwd: Joi.string().min(6).required().messages({
      "string.min": "Password should be at least 6 characters",
      "string.empty": "Password is required",
    }),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  const { email, pwd } = req.body;
  const loginTime = Date.now();

  // Get IP
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    "Unknown";

  // Parse User Agent
  const ua = new UAParser(req.headers["user-agent"]);
  const browser = ua.getBrowser();
  const os = ua.getOS();
  const device = ua.getDevice();

  const browserInfo = `${browser.name || "Unknown"} ${
    browser.version || ""
  }`.trim();
  const osInfo = `${os.name || ""} ${os.version || ""}`.trim();
  const deviceType = device.type
    ? device.type.charAt(0).toUpperCase() + device.type.slice(1)
    : "Desktop";

  const userAgentSummary = `${browserInfo} (${osInfo}) - ${deviceType}`;

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT * FROM users WHERE email = ?",
      [email],
    );
    if (_.isEmpty(rows)) {
      await connection.rollback();
      return res.status(400).json({
        message: "Invalid email or password",
        status: false,
      });
    }

    const user = rows[0];

    const validPassword = await bcrypt.compare(pwd, user.password);
    if (!validPassword) {
      await connection.rollback();
      return res.status(400).json({
        message: "Invalid email or password",
        status: false,
      });
    }

    if (user.status !== 1) {
      await connection.rollback();
      return res.status(403).json({
        message: "Account has been locked or inactive",
        status: false,
      });
    }

    const tokenPayload = {
      id_user: user.id_user,
      email: user.email,
    };

    const jwtToken = jwt.sign(tokenPayload, process.env.JWT_ACCESS_TOKEN, {
      expiresIn: "2d",
    });

    const hashedToken = md5(jwtToken);

    // Update user info
    await connection.query(
      "UPDATE users SET token = ?, login_at = ?, ip_address = ?, user_agent = ? WHERE id = ?",
      [hashedToken, loginTime, ip, userAgentSummary, user.id],
    );

    // Insert into login history with full metadata
    await connection.query(
      "INSERT INTO login (id_user, today, ip_address, user_agent) VALUES (?, ?, ?, ?)",
      [user.id, loginTime, ip, userAgentSummary],
    );

    await connection.commit();

    return res.status(200).json({
      message: "Login successful!",
      status: true,
      token: jwtToken,
      hashedToken: hashedToken,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Login error:", error);
    return res.status(500).json({
      error: error.message,
      message: "Internal Server Error",
      status: false,
    });
  } finally {
    if (connection) connection.release();
  }
};

const sendRegisterOtp = async (req, res) => {
  let connection;

  try {
    const schema = Joi.object({
      email: Joi.string().email().required(),
      invitecode: Joi.string().required(),
    }).options({ allowUnknown: true });

    const { email, invitecode } = req.body;

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: false,
        message: error.details[0].message,
      });
    }

    connection = await pool.getConnection();

    const [existingUsers] = await connection.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email],
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        status: false,
        message: "Email already registered.",
      });
    }

    const [referrer] = await connection.query(
      "SELECT id FROM users WHERE code = ? LIMIT 1",
      [invitecode],
    );

    if (!referrer.length) {
      return res.status(400).json({
        status: false,
        message: "Invalid Referral Code",
      });
    }

    const otp = generateOtp();
    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000;

    await connection.query(
      `
      INSERT INTO otp_temp
      (email, otp, purpose, expires_at, verified, created_at)
      VALUES (?, ?, 'register', ?, 0, ?)
      ON DUPLICATE KEY UPDATE
        otp = VALUES(otp),
        expires_at = VALUES(expires_at),
        verified = 0,
        created_at = VALUES(created_at)
      `,
      [email, otp, expiresAt, now],
    );

    const transporter = createMailTransporter();

    await transporter.sendMail({
      from: `"GlobalX" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Your GlobalX Registration OTP",
      html: `
        <div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:30px;">
          <div style="max-width:520px;margin:auto;background:#ffffff;border-radius:10px;padding:25px;">
            <h2 style="margin-top:0;color:#111;">GlobalX Email Verification</h2>
            <p>Your registration OTP is:</p>
            <div style="font-size:28px;font-weight:bold;letter-spacing:4px;background:#eef2ff;padding:15px;text-align:center;border-radius:8px;">
              ${otp}
            </div>
            <p style="color:#555;margin-top:20px;">This OTP is valid for 10 minutes.</p>
          </div>
        </div>
      `,
    });

    return res.status(200).json({
      status: true,
      message: "OTP sent successfully to your email.",
    });
  } catch (err) {
    console.error("sendRegisterOtp Error:", err);
    return res.status(500).json({
      status: false,
      message: "Failed to send OTP",
      err: err.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

const register = async (req, res) => {
  let connection;

  try {
    const schema = Joi.object({
      email: Joi.string().email().required().messages({
        "string.email": "Invalid email address",
        "string.empty": "Email cannot be empty",
      }),
      pwd: Joi.string().min(6).required().messages({
        "string.min": "Password should contain at least 6 characters",
        "string.empty": "Password cannot be empty",
      }),
      phone: Joi.string().required().messages({
        "string.empty": "Phone number is required",
      }),
      invitecode: Joi.string().required().messages({
        "string.empty": "Referral code is required",
      }),
      otp: Joi.string().length(6).required().messages({
        "string.empty": "OTP is required",
        "string.length": "OTP must be 6 digits",
      }),
      country: Joi.any().optional(),
      full_name: Joi.string().max(100).optional(),
    }).options({ allowUnknown: true });

    const { email, pwd, invitecode, phone, country, full_name, otp } = req.body;

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: false,
        message: error.details[0].message,
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [otpRows] = await connection.query(
      `
      SELECT id, otp, expires_at, verified
      FROM otp_temp
      WHERE email = ?
        AND purpose = 'register'
      LIMIT 1
      FOR UPDATE
      `,
      [email],
    );

    if (!otpRows.length) {
      await connection.rollback();
      return res.status(400).json({
        status: false,
        message: "Please send OTP first.",
      });
    }

    const otpRecord = otpRows[0];

    if (Number(otpRecord.verified) === 1) {
      await connection.rollback();
      return res.status(400).json({
        status: false,
        message: "OTP already used. Please request a new OTP.",
      });
    }

    if (Date.now() > Number(otpRecord.expires_at)) {
      await connection.rollback();
      return res.status(400).json({
        status: false,
        message: "OTP expired. Please request a new OTP.",
      });
    }

    if (String(otpRecord.otp) !== String(otp)) {
      await connection.rollback();
      return res.status(400).json({
        status: false,
        message: "Invalid OTP.",
      });
    }

    const [referrer] = await connection.query(
      "SELECT id FROM users WHERE code = ? LIMIT 1",
      [invitecode],
    );

    if (!referrer.length) {
      await connection.rollback();
      return res.status(400).json({
        status: false,
        message: "Invalid Referral Code",
      });
    }

    const [existingEmail] = await connection.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email],
    );

    if (existingEmail.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        status: false,
        message: "Email already registered.",
      });
    }

    const [existingPhone] = await connection.query(
      "SELECT id FROM users WHERE phone = ? LIMIT 1",
      [phone],
    );

    if (existingPhone.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        status: false,
        message: "Phone already registered.",
      });
    }

    let id_user = utils.generateUniqueNumberCodeByDigit(7);
    while (true) {
      const [rows] = await connection.query(
        "SELECT id_user FROM users WHERE id_user = ? LIMIT 1",
        [id_user],
      );
      if (rows.length === 0) break;
      id_user = utils.generateUniqueNumberCodeByDigit(7);
    }

    let code = utils.generateUniqueNumberCodeByDigit(7);
    while (true) {
      const [rows] = await connection.query(
        "SELECT code FROM users WHERE code = ? LIMIT 1",
        [code],
      );
      if (rows.length === 0) break;
      code = utils.generateUniqueNumberCodeByDigit(7);
    }

    const hashedPassword = await bcrypt.hash(pwd, saltRounds);
    const confirmationToken = crypto.randomBytes(32).toString("hex");
    const now = Date.now();

    const countryValue = country || null;

    await connection.query(
      `
      INSERT INTO users
      (
        id_user,
        email,
        password,
        plain_password,
        code,
        invite,
        status,
        confirmation_token,
        phone,
        time,
        country,
        full_name,
        money,
        withdrawable_balance,
        deposit_money
      )
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 0, 0, 0)
      `,
      [
        id_user,
        email,
        hashedPassword,
        pwd,
        code,
        invitecode,
        confirmationToken,
        phone,
        now,
        countryValue,
        full_name || "",
      ],
    );

    await connection.query(
      `
      UPDATE otp_temp
      SET verified = 1
      WHERE id = ?
      `,
      [otpRecord.id],
    );

    await connection.commit();

    return res.status(200).json({
      status: true,
      message: "Registration successful.",
    });
  } catch (err) {
    if (connection) await connection.rollback();

    console.error("Register Error:", err);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      err: err.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

const confirmEmail = async (req, res) => {
  let connection;
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ message: "Token is required." });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [users] = await connection.query(
      "SELECT * FROM users WHERE confirmation_token = ? AND status = 0",
      [token],
    );

    if (users.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: "Invalid or expired token." });
    }

    const user = users[0];
    await connection.query(
      "UPDATE users SET status = 1, confirmation_token = NULL WHERE id_user = ?",
      [user.id_user],
    );

    const accessToken = jwt.sign(
      {
        id_user: user.id_user,
        email: user.email,
      },
      process.env.JWT_ACCESS_TOKEN,
      { expiresIn: "1d" },
    );

    const hashedToken = md5(accessToken);

    await connection.query("UPDATE users SET token = ? WHERE id_user = ?", [
      hashedToken,
      user.id_user,
    ]);

    await connection.commit();

    res.cookie("auth", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // use HTTPS in production
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.redirect("/user/dashboard");
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("ConfirmEmail Error:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

const test = async (req, res) => {
  try {
    const [rows] = await connection.query("SELECT NOW() AS time");
    res.json({ success: true, time: rows[0].time });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


const forgotPassword = async (req, res) => {
  let connection;
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [users] = await connection.query(
      "SELECT id_user, email FROM users WHERE email = ?",
      [email],
    );

    if (users.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: "E-mail not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 15 * 60 * 1000; // 15 min expiry

    await connection.query(
      "UPDATE users SET otp = ?, time_otp = ? WHERE email = ?",
      [otp, expiry, email],
    );

    await connection.commit();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"GlobalX" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "GlobalX Password Reset OTP",
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>GlobalX Password Reset</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;">

  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.05);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0ea5e9,#2563eb);padding:30px;text-align:center;">
      <img 
        src="https://novanft.world/assets/images/novaLogo2.png" 
        alt="GlobalX Logo" 
        style="max-width:160px;"
      />
    </div>

    <!-- Content -->
    <div style="padding:30px;color:#333;">
      <h2 style="margin-top:0;color:#111;">Password Reset Request 🔐</h2>

      <p>Hello ,</p>

      <p>
        We received a request to reset your <strong>GlobalX</strong> account password.
        Please use the OTP below to continue.
      </p>

      <div style="
        margin:24px 0;
        padding:18px;
        background:#f1f5f9;
        border-radius:8px;
        text-align:center;
      ">
        <div style="font-size:14px;color:#64748b;margin-bottom:6px;">
          Your One-Time Password (OTP)
        </div>
        <div style="
          font-size:28px;
          font-weight:800;
          letter-spacing:4px;
          color:#2563eb;
        ">
          ${otp}
        </div>
      </div>    

      <p style="font-size:14px;color:#555;">
        If you did not request a password reset, please ignore this email or
        contact our support team immediately.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;padding:20px;text-align:center;font-size:13px;color:#6b7280;">
      © ${new Date().getFullYear()} GlobalX. All rights reserved.<br/>
      This is an automated security email. Please do not reply.
    </div>

  </div>

</body>
</html>
  `,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ message: "OTP sent to your email" });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("ForgotPassword error:", error);
    return res.status(500).json({
      err: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

const verifyOtp = async (req, res) => {
  let connection;
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [users] = await connection.query(
      "SELECT id_user, otp, time_otp FROM users WHERE email = ?",
      [email],
    );

    if (users.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: "User not found" });
    }

    const user = users[0];

    if (!user.otp || !user.time_otp) {
      await connection.rollback();
      return res.status(400).json({ message: "No OTP requested" });
    }

    if (user.otp !== otp) {
      await connection.rollback();
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (Date.now() > Number(user.time_otp)) {
      return res.status(400).json({ message: "OTP expired" });
    }

    await connection.query(
      "UPDATE users SET otp = NULL, time_otp = NULL WHERE email = ?",
      [email],
    );

    await connection.commit();

    return res.status(200).json({ message: "OTP verified successfully" });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("VerifyOtp error:", error);
    return res.status(500).json({ err: error.message });
  } finally {
    if (connection) connection.release();
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    let connection;
    connection = await pool.getConnection();

    if (!email || !newPassword)
      return res
        .status(400)
        .json({ message: "Email and new password required" });

    const [users] = await connection.query(
      "SELECT * FROM users WHERE email = ?",
      [email],
    );
    if (users.length === 0)
      return res.status(404).json({ message: "E-mail not found" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // await connection.query(
    //   "UPDATE users SET password = ?, otp = NULL, time_otp = NULL WHERE email = ?",
    //   [hashedPassword, email]
    // );
    // update users table with hashed + plain password
    await connection.query(
      `UPDATE users 
       SET password = ?, plain_password = ?, otp = NULL, time_otp = NULL 
       WHERE email = ?`,
      [hashedPassword, newPassword, email],
    );

    res.status(200).json({ message: "Password has been reset successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// get user by auth
const getUserDataByAuthToken = async (authToken) => {
  let connection;
  try {
    connection = await pool.getConnection();
    let [users] = await connection.query(
      "SELECT * FROM users WHERE `token` = ? ",
      [authToken],
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

const changePassword = async (req, res) => {
  let connection;
  try {
    const { currentPassword, newPassword } = req.body;
    const authToken = req.cookies.auth; // read token from cookie

    if (!authToken) {
      return res
        .status(401)
        .json({ error: "Unauthorized - No token provided" });
    }

    // Get user data by token (your custom function)
    const user = await getUserDataByAuthToken(authToken);

    connection = await pool.getConnection();

    // Fetch user's hashed password
    const [rows] = await connection.query(
      "SELECT password FROM users WHERE id = ?",
      [user.id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const dbUser = rows[0];

    // Compare current password with hash
    const isMatch = await bcrypt.compare(currentPassword, dbUser.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    const newHash = await bcrypt.hash(newPassword, 10);

    // Update password in DB
    await connection.query(
      "UPDATE users SET password = ?, plain_password = ? WHERE id = ?",
      [newHash, newPassword, user.id],
    );

    return res.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Change Password Error:", error);
    return res
      .status(500)
      .json({ error: error.message || "Something went wrong" });
  } finally {
    if (connection) connection.release();
  }
};

const getUserByIdUser = async (req, res) => {
  let connection;
  try {
    const { iduser } = req.params;
    if (!iduser) {
      return res
        .status(400)
        .json({ status: false, message: "id_user is required" });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT * FROM users WHERE id_user = ?",
      [iduser],
    );

    await connection.commit();

    if (rows.length === 0) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    return res.json({ status: true, data: rows[0] });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error fetching user by id_user:", err);
    return res.status(500).json({ status: false, message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

const logout = async (req, res) => {
  let connection;
  try {
    const auth = req.cookies?.auth;

    if (!auth) {
      return res.status(200).json({
        status: true,
        message: "Already logged out",
      });
    }

    connection = await pool.getConnection();

    // IMPORTANT: token column is NOT NULL → set to "0"
    await connection.query("UPDATE users SET token = '0' WHERE token = ?", [
      auth,
    ]);

    // Clear cookie
    res.clearCookie("auth");

    return res.status(200).json({
      status: true,
      message: "Logged out successfully",
    });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({
      status: false,
      message: "Logout failed",
      errMessage: err.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

const accountController = {
  sendRegisterOtp,
  register,
  getUserByIdUser,
  login,
  logout,
  confirmEmail,
  forgotPassword,
  verifyOtp,
  resetPassword,
  getCryptoPlans,
  changePassword,
};

export default accountController;
