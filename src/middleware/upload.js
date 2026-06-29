'use strict';

const multer = require('multer');

// Memory storage: the file is held as a Buffer (req.file.buffer) so the upload
// controller can stream it straight to Cloudinary. When Cloudinary is not
// configured the controller persists the buffer to local disk instead.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  },
});

module.exports = upload;
