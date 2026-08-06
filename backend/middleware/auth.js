// middleware/auth.js
/*const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });
    req.admin=admin;
 
    req.user = user;
    
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};*/
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Admin = require("../models/Admin");

const protect = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "No token provided"
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        let account;

        if (decoded.type === "admin") {

            account = await Admin.findById(decoded.id).select("-password");

            if (!account || !account.isActive) {
                return res.status(401).json({
                    success: false,
                    message: "Admin account not found or inactive"
                });
            }

            req.admin = account;
            req.userType = "admin";

        } else {

            account = await User.findById(decoded.id).select("-password");

            if (!account || !account.isActive) {
                return res.status(401).json({
                    success: false,
                    message: "User account not found or inactive"
                });
            }

            req.user = account;
            req.userType = "user";
        }

        next();

    } catch (err) {

        if (err.name === "TokenExpiredError") {
            return res.status(401).json({
                success: false,
                message: "Token expired"
            });
        }

        return res.status(401).json({
            success: false,
            message: "Invalid token"
        });
    }
};

const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = null;
        req.userType = 'guest';
        return next();
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        let account;
        if (decoded.type === 'admin') {
            account = await Admin.findById(decoded.id).select('-password');
            if (account && account.isActive) {
                req.admin = account;
                req.userType = 'admin';
            }
        } else {
            account = await User.findById(decoded.id).select('-password');
            if (account && account.isActive) {
                req.user = account;
                req.userType = 'user';
            }
        }
    } catch (err) {
        req.user = null;
        req.userType = 'guest';
    }

    next();
};

module.exports = { protect, optionalAuth };
