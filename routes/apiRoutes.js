import express from "express";
const router = express.Router();
import middlewareController from "../controllers/middlewareController.js";
import paymentController from "../controllers/paymentController.js";
import homecontroller from "../controllers/homecontroller.js";
import investmentController from "../controllers/investmentController.js"
import accountController from "../controllers/accountController.js";

router.post(
  "/create/oxapay/recharge",
  middlewareController,
  paymentController.createOxaPayDeposit
);
router.post("/verify/oxaPay/callback", paymentController.oxaPayVerify);

router.get("/info", middlewareController, homecontroller.userInfo);
router.get("/user/rank", middlewareController, homecontroller.getUserRank);
router.get("/user/getUserStakings", middlewareController, homecontroller.getUserStakings);
router.post("/updateProfile", middlewareController, homecontroller.updateProfile);
router.post("/user/teamByLevel", middlewareController, homecontroller.getUserBylevels);
//  router.post(
//     "/admin/api/withdraw/oxapay", // add  middleware
//     paymentController.createOxaPayWithdraw,
//   );

// harjit p2p transfer 



router.get("/users/search",middlewareController, investmentController.getUser)
// router.post("/p2p/transfer",middlewareController, investmentController.p2pTransfer)
// router.get('/p2p/transferHistory',middlewareController, investmentController.getP2PTransfersHistory);
router.get("/mining-income", middlewareController, investmentController.getMiningData);
router.get("/getRankIncome", middlewareController, homecontroller.getRankIncome);

router.post("/withdraw/create", middlewareController, paymentController.createWithdrawalRequest);
router.post("/withdraw/oxapay", paymentController.createOxaPayWithdraw);
router.post("/webapi/withdraw/status", paymentController.approveOrDenyWithdrawalRequest);
router.get("/deposit-history", middlewareController, paymentController.depositHistory);
router.get("/withdraw-history", middlewareController, paymentController.withdrawHistory);
router.get("/create-deposit", middlewareController, paymentController.initiateUsdtManual);

router.post("/wallet/paynow/manual_usdt_request", middlewareController, paymentController.addManualUSDTPaymentRequest);
router.get("/check_recharge_status", middlewareController, paymentController.checkRechargeStatus);

router.get("/plans", middlewareController, accountController.getCryptoPlans);
router.get("/getUserByIdUser/:iduser", middlewareController, accountController.getUserByIdUser);
router.post("/invest", middlewareController, investmentController.invest);
router.get("/myInvestments", middlewareController, investmentController.getMyInvestments);
router.get("/team-income", middlewareController, homecontroller.getTeamIncome)
router.post("/getUserStats/dashboard", middlewareController, homecontroller.getUserStatsDasboard)

// withdraw otp 
router.post("/withdraw/verify-otp", middlewareController, paymentController.verifyWithdrawalOTP);
router.get("/deposit/usdt-limits", middlewareController,  paymentController.getUsdtLimits);

// sourav cancel investment
router.post("/cancelInvestment", middlewareController, paymentController.cancelInvestment);


// 05-05-2026
router.get("/team/stats", middlewareController, homecontroller.getTeamStats)

export default router;
