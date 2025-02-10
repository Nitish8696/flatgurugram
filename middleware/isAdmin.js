const isAdmin = (req, res, next) => {
  if (req.user?.isAdmin == false) {
    return res.status(403).json({ message: "Admin access required." });
  }
  next();
};

module.exports = isAdmin;
