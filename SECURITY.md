# Security Policy

## Supported Versions

| Version | Supported          |
|---------|-------------------|
| 0.2.x   | :white_check_mark: |
| < 0.2   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability within GradBridge, please send an email to the project maintainer. All security vulnerabilities will be promptly addressed.

**Please do NOT report security vulnerabilities through public GitHub issues.**

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response timeline

- **Acknowledgment**: within 48 hours
- **Initial assessment**: within 1 week
- **Fix release**: depends on severity, typically 1-2 weeks

## Security Measures

### Authentication

- Passwords hashed with **scrypt** (per-user salt, 64-byte key)
- Session tokens: **HMAC-SHA256** signed JWTs
- httpOnly, SameSite=Lax cookies
- 7-day session expiry
- Timing-safe password comparison

### API Security

- All endpoints require authentication
- Input validation on all routes
- Rate limiting recommended for production
- CSRF protection via SameSite cookies

### Headers

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy` (restrictive)
- `Strict-Transport-Security` (HSTS)
- `Permissions-Policy` (camera, mic, geo disabled)

### Database

- All user-scoped resources linked via `userId`
- Cascade deletes for user data isolation
- Parameterized queries (Prisma ORM)
- No raw SQL injection vectors

## Best Practices for Deployment

1. Set `GRADBRIDGE_SECRET` to a strong random value
2. Use HTTPS in production (Vercel does this automatically)
3. Enable database connection pooling (Neon/Supabase)
4. Set up monitoring and error tracking
5. Regular dependency updates

---

Designed & Developed by [Rhasan](https://rhasan-dev-bd-com.vercel.app/)
