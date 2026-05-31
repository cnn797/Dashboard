module.exports = function handler(req, res) {
  res.status(200).json({ clientId: process.env.GOOGLE_CLIENT_ID || '' });
};
