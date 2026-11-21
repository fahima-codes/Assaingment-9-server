const jwt = require('jsonwebtoken');

// Authorization header theke token nikal gulo: "Bearer <token>"
const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return null;
};

// verifyToken: Token verify kore req.user e user gulo
const verifyToken = (req, res, next) => {
  const token = extractToken(req);

  // Token nai -> 401
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // User er shomoye email diye data chahile -> token owner e chahil na hoy -> 403
    const targetEmail = req.params?.email || req.body?.email;
    if (targetEmail && req.user.email && targetEmail !== req.user.email) {
      return res.status(403).json({ message: 'Forbidden: You are not allowed to access this data' });
    }

    next();
  } catch (err) {
    // Invalid / Expired token -> 401
    return res.status(401).json({ message: 'Unauthorized: Invalid or expired token' });
  }
};

// Customer only access dhebe
const verifyCustomer = (req, res, next) => {
  if (req.user?.role !== 'customer') {
    return res.status(403).json({ message: 'Forbidden: Customer access required' });
  }
  next();
};

// Technician only access dhebe
const verifyTechnician = (req, res, next) => {
  if (req.user?.role !== 'technician') {
    return res.status(403).json({ message: 'Forbidden: Technician access required' });
  }
  next();
};

// Admin only access dhebe
const verifyAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: Admin access required' });
  }
  next();
};

module.exports = { verifyToken, verifyCustomer, verifyTechnician, verifyAdmin };
