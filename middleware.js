const db = require('./db');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const [rows] = await db.execute('SELECT user_id FROM tokens WHERE token = ?', [token]);
    
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = rows[0].user_id;
    
    const [userRows] = await db.execute('SELECT id, login, name, role, store_id FROM users WHERE id = ?', [userId]);
    
    if (userRows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = userRows[0];
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Authorization middleware for store-scoped access
const authorizeStoreAccess = (allowReadOnly = false) => {
  return async (req, res, next) => {
    try {
      // Admins have full access to everything
      if (req.user.role === 'ADMIN') {
        return next();
      }

      // Regular users must have a store assigned
      if (!req.user.store_id) {
        return res.status(403).json({ 
          error: 'User not assigned to any store. Contact administrator.' 
        });
      }

      // Check if this route is trying to access a specific store
      const requestedStoreId = req.params.storeId || req.body.store_id || req.query.store_id;
      
      if (requestedStoreId) {
        // User can only access their own store
        if (parseInt(requestedStoreId) !== req.user.store_id) {
          if (allowReadOnly) {
            // For read-only access, we'll filter results later
            req.readOnlyAccess = true;
            return next();
          } else {
            return res.status(403).json({ 
              error: 'Access denied. You can only access your assigned store.' 
            });
          }
        }
      }

      // For operations that don't specify a store, limit to user's store
      req.userStoreId = req.user.store_id;
      next();
    } catch (error) {
      console.error('Authorization error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  };
};

module.exports = { authMiddleware, authorizeStoreAccess };