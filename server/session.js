import crypto from 'node:crypto';

export const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const tokenFrom = (req) => /(?:^|; )sid=([a-f0-9]+)/.exec(req.headers.cookie ?? '')?.[1];

// Express 4 does not catch errors thrown in async handlers, so wrap each one
export const wrap = (handler) => (req, res) =>
  handler(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

// Sets req.user from the session cookie, or answers 401
export const requireUser = (pool) => async (req, res, next) => {
  try {
    const token = tokenFrom(req);
    if (token) {
      const { rows: [user] } = await pool.query(
        'SELECT u.id, u.name, u.email, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()',
        [sha(token)],
      );
      if (user) {
        req.user = user;
        return next();
      }
    }
    res.status(401).json({ error: 'Not signed in' });
  } catch (err) {
    next(err);
  }
};
