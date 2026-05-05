import path from "path";
import express from "express";

async function staticConfig(app) {
  app.set("view engine", "ejs");
  // app.set("views", path.join(process.cwd(), "src", "views"));
  app.set("views", path.join(process.cwd(), "views"));

  // Serve: project-root/public
  app.use(
    express.static(path.join(process.cwd(), "public"), {
      maxAge: "1d",
    }),
  );

  // Serve: project-root/src/public
  app.use(
    express.static(path.join(process.cwd(), "src", "public"), {
      maxAge: "1d",
    }),
  );
  // Explicit fix: serve /assets separately (bypasses auth middleware)
  app.use(
    "/assets",
    express.static(path.join(process.cwd(), "src", "public", "assets"), {
      maxAge: "1d",
    }),
  );
}

export default staticConfig;
