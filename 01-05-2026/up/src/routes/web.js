import userRoutes from "./userRoutes.js";
import adminRoutes from "./adminRoutes.js";
import accountRoutes from "./accountRoutes.js";
import apiRoutes from "./apiRoutes.js";
// import middlewareController from "../controllers/middlewareController.js";
// import adminOnly from "../middleware/adminOnly.js";

const initialiseRouting = (app) => {
  app.use("/", userRoutes);
  app.use("/admin", adminRoutes);
  app.use("/api", accountRoutes);
  app.use("/api", apiRoutes);
app.get("/", (req, res) => {
  if (req.cookies?.auth) {
    return res.redirect("/dashboard");
  }

  return res.redirect("/login");
});
  // app.use(middlewareController, (req, res) => {
  //   res.status(500).json({ msg: "URL Not found" })
  // });



  app.use((req, res) => {
    res.status(404).json({ msg: "URL Not found" });
  });
  
};

export default initialiseRouting;
