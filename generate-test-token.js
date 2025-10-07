import jwt from 'jsonwebtoken';

const secret = 'Cvgii9bYKF1HtfD8TODRyZFTmFP4vu70oR59YrjGVpS2fXzQ41O3UPRaR8u9uAqNhwK5ZxZPbX5rAOlMrqe8ag==';

const payload = {
  sub: 'test-user-123',      // User ID
  tenant: '2f6f5ec2-a56f-47d0-887d-c6b9c1bb56ff', // Valid Tenant ID (Default Organization)
  scope: 'test',             // Scope
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour expiry
};

const token = jwt.sign(payload, secret);
console.log('Generated JWT Token:');
console.log(token);