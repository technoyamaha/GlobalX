import express from "express";
const router = express.Router();
import adminController from "../controllers/adminController.js";
import middlewareController from "../controllers/middlewareController.js";

import cronController from "../cron/dailyEarnings.js";

import adminOnly from "../middleware/adminOnly.js";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Absolute path to images folder
const UPLOAD_DIR = path.join(__dirname, "../public/assets/images");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `usdt_${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ["image/png", "image/jpeg", "image/jpg"];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Only PNG, JPG, JPEG allowed"));
  }
  cb(null, true);
};

const uploadQr = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

// admin login page to get
router.get("/manager/login", adminController.adminLoginPage);
// post route
router.post("/login", adminController.login);

router.get(
  "/dashboard",
  adminOnly,
  middlewareController,
  adminController.adminDashboardPage,
);
router.get(
  "/investments",
  adminOnly,
  middlewareController,
  adminController.investmentsPage,
);
router.get(
  "/membersList",
  adminOnly,
  middlewareController,
  adminController.memberPage,
);
router.get(
  "/member/info/:phone",
  adminOnly,
  middlewareController,
  adminController.memberProfile,
);
router.get(
  "/withdrawalRecord",
  adminOnly,
  middlewareController,
  adminController.withdrawalRecord,
);
router.get(
  "/rechargeRecord",
  adminOnly,
  middlewareController,
  adminController.rechargeRecord,
);
router.get(
  "/browseRecharge",
  adminOnly,
  middlewareController,
  adminController.browseRecharge,
);
router.get(
  "/settings",
  adminOnly,
  middlewareController,
  adminController.settingsPage,
);

// post api
router.post("/listMember", adminOnly, adminController.listMembers);
router.post(
  "/member/info",
  adminOnly,
  middlewareController,
  adminController.memberInfo,
);
router.post(
  "/member/listRecharge/:phone",
  adminOnly,
  middlewareController,
  adminController.listRecharge,
);
router.post(
  "/member/listWithdraw/:phone",
  adminOnly,
  middlewareController,
  adminController.listWithdraw,
);
router.post(
  "/rechargeDuyet",
  adminOnly,
  middlewareController,
  adminController.rechargeDuyet,
);
// recharge list
router.post(
  "/recharge",
  adminOnly,
  middlewareController,
  adminController.recharge,
);
router.get(
  "/totalrecharge",
  adminOnly,
  middlewareController,
  adminController.totalrecharges,
);
//withdrawals list
router.post(
  "/withdrawals",
  adminOnly,
  middlewareController,
  adminController.withdrawals,
);
// update email
router.post(
  "/member/updateEmail",
  adminOnly,
  middlewareController,
  adminController.updateEmail,
);
// dashboard Data
router.post(
  "/dashboardData",
  adminOnly,
  middlewareController,
  adminController.dashboardData,
);

router.get(
  "/withdrawalHistoryRecord",
  adminOnly,
  middlewareController,
  adminController.browseWithdrawalRecord,
);
router.get(
  "/withdraw/form/:orderId",
  adminOnly,
  middlewareController,
  adminController.withdrawalPaymentGateway,
);

// Setting Page Routes
router.get(
  "/settings/usdt-rate",
  adminOnly,
  middlewareController,
  adminController.getUsdtRate,
);
router.post(
  "/settings/usdt-rate",
  adminOnly,
  middlewareController,
  adminController.updateUsdtRate,
);

router.get(
  "/usdt-wallets",
  middlewareController,
  adminController.getUsdtWallets,
);
router.post(
  "/usdt-wallets/add",
  middlewareController,
  uploadQr.single("qr"),
  adminController.addUsdtWallet,
);
router.post(
  "/usdt-wallets/update",
  middlewareController,
  adminController.updateUsdtWallet,
);
router.post(
  "/usdt-wallets/delete",
  middlewareController,
  adminController.deleteUsdtWallet,
);

router.post(
  "/usdt-wallets/update-status",
  middlewareController,
  adminController.updateUsdtWalletStatus,
);

router.post(
  "/adjustWithdrawableBalance",
  middlewareController,
  adminController.adjustWithdrawableBalance,
);

// TESTING CRON ROUTE  :--------------------------------///////////////////////////

router.get("/run-cron-test", async (req, res) => {
  try {
    console.log("Starting the RUN CRON TEST");
    await cronController.runTestCronNow();

    return res.json({
      status: true,
      message: "Cron executed successfully",
    });
  } catch (err) {
    console.error("Manual cron error:", err);

    return res.status(500).json({
      status: false,
      message: "Cron failed",
      error: err.message,
    });
  }
});
export default router;
