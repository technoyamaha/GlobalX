import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = "public/assets/images";

// ensure folder exists (already exists in your case)
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = "usdt_qr_" + Date.now() + ext;
    cb(null, name);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ["image/png", "image/jpeg", "image/jpg"];
  cb(null, allowed.includes(file.mimetype));
};

export const uploadUsdtQr = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});
