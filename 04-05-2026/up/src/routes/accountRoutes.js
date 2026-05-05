import express from "express";
const router = express.Router();
import accountController from "../controllers/accountController.js";
import investmentController from "../controllers/investmentController.js"
import middlewareController from "../controllers/middlewareController.js";

router.get("/plans", accountController.getCryptoPlans);
router.post("/invest",middlewareController, investmentController.invest);
router.get("/myInvestments/:userId", investmentController.getMyInvestments);
// regisration 
router.post("/send-register-otp", accountController.sendRegisterOtp);
router.post("/register", accountController.register);
router.get("/checkEmail", accountController.confirmEmail);
// forgot password 
router.post("/forgot-password", accountController.forgotPassword);
router.post("/reset-password",accountController.resetPassword)
router.post("/verify-otp", accountController.verifyOtp);
//login 
router.post("/login",accountController.login);

router.post("/logout",accountController.logout);
// changePAssword
router.post('/user/change-password',middlewareController, accountController.changePassword);


export default router;



