# Contributing to Niro Media

Thank you for your interest in Niro Media. As a production-level application owned by **EstherMinds**, we maintain a high standard for security and reliability.

## Guidelines

1. **Focus on Security**: Any changes to the `tauri.conf.json` or core Rust logic must be reviewed for security implications (CSP, scoped filesystem access, etc.).
2. **Branding Consistency**: Ensure the "Niro Media" and "EstherMinds" branding remains intact.
3. **Code Quality**: Follow the established TypeScript/React patterns for the frontend and idiomatic Rust for the backend.
4. **Testing**: Run a full production build (`npm run build` and `npm run tauri build`) before submitting changes to ensure stability.

## Maintenance and Updates

Updates should be versioned correctly in both `package.json` and `tauri.conf.json`. For production releases, ensure the version number is incremented following semantic versioning.

---
*Owned and Maintained by EstherMinds.*
