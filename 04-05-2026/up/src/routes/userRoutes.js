import express from "express";
const router = express.Router();
import homecontroller from "../controllers/homecontroller.js";
import middlewareController from "../controllers/middlewareController.js";
import accountController from "../controllers/accountController.js";
import paymentController from "../controllers/paymentController.js";

router.get("/", homecontroller.landingPage);
router.get("/peerToPeer/transfer", middlewareController, homecontroller.getTransferPage);
router.get("/peerToPeer/transactions", middlewareController, homecontroller.getTransactionsPage);
router.get("/market", middlewareController, homecontroller.marketPage);
router.get("/dashboard", middlewareController, homecontroller.dashboardPage);
router.get("/mining", middlewareController, homecontroller.stakingPage);
router.get("/mining/team", middlewareController, homecontroller.teamstakingPage);
router.get("/farming", middlewareController, homecontroller.farmingPage);
router.get("/privilege", middlewareController, homecontroller.getPrivilegePage);
router.get("/wallet/deposit", middlewareController, homecontroller.getDepositPage);
router.get("/wallet/withdraw", middlewareController, homecontroller.getWithdrawPage);
router.get("/checkEmail", accountController.confirmEmail);

router.get("/team", middlewareController, homecontroller.getTeamStatsPage);
router.get("/income/team", middlewareController, homecontroller.getTeamIncomePage);
router.get("/income/rank", middlewareController, homecontroller.getRankIncomePage);
router.get("/income/mining", middlewareController, homecontroller.getStakingIncomePage);
router.get("/income/farming", middlewareController, homecontroller.getFarmingIncomePage);
router.get("/income/daily", middlewareController, homecontroller.getDailyYieldPage);

router.get("/history/deposit", middlewareController, homecontroller.getDepositHistoryPage);
router.get("/history/withdraw", middlewareController, homecontroller.getWithdrawHistoryPage);
router.get("/settings/profile", middlewareController, homecontroller.getProfilePage);
router.get("/settings/security", middlewareController, homecontroller.getSecurityPage);
router.get("/exchange", middlewareController, homecontroller.getExchangePage);
router.get("/register", homecontroller.registerPage);
router.get("/login", homecontroller.loginPage);
router.get("/forgot-password", homecontroller.forgotPasswordPage);

// router.post("/check-user-rank", paymentController.checkUpdateUserRank);
router.post("/rank-income", paymentController.rankIncome);
// coming soon page 
router.get("/comingSoon", middlewareController, homecontroller.comingSoonPage);

router.get("/getCollectionPage", middlewareController, homecontroller.getCollectionPage);
router.get("/getCollectionDetailsPage",middlewareController,  homecontroller.getCollectionDetailsPage);
router.get("/invitePage", middlewareController, homecontroller.invitePage);
router.get("/investmentPage", middlewareController, homecontroller.investmentPage);
router.get("/miningpool", middlewareController, homecontroller.miningPool);
router.get("/depositHistoryPage",middlewareController, homecontroller.depositHistoryPage);
router.get("/withdrawHistoryPage",middlewareController, homecontroller.depositHistoryPage);


export default router;


