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
    
    const [userRows] = await db.execute('SELECT id, login FROM users WHERE id = ?', [userId]);
    
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

module.exports = authMiddleware;