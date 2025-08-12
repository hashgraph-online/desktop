# Contributing to Hashgraph Online Desktop

Thanks for your interest in contributing. This guide covers how to get started.

## Getting Started

### Prerequisites

- Node.js 18+ (20+ recommended)
- pnpm 8+
- Git
- Hedera testnet account for testing

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/desktop.git
   cd desktop
   ```
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Start development:
   ```bash
   pnpm dev
   ```

## Development Workflow

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions or fixes

### Making Changes

1. Create a new branch from `main`
2. Make your changes
3. Write/update tests as needed
4. Ensure all tests pass
5. Commit with clear messages

### Commit Messages

Format: `type: description`

Types:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Formatting (no code change)
- `refactor:` Code restructuring
- `test:` Test changes
- `chore:` Maintenance

Examples:
- `feat: add token balance display`
- `fix: resolve network connection timeout`
- `docs: update environment variables section`

### DCO Sign-off Requirement

All commits must be signed with a Developer Certificate of Origin (DCO). This certifies that you wrote the code or have the right to submit it.

#### Signing Commits

Add `-s` or `--signoff` to your commit command:

```bash
git commit -s -m "feat: add new feature"
```

This adds a sign-off line to your commit:
```
Signed-off-by: Your Name <your.email@example.com>
```

#### Configure Git for DCO

Set up your name and email:
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

#### Fixing Unsigned Commits

If you forgot to sign previous commits:

For the last commit:
```bash
git commit --amend -s --no-edit
```

For multiple commits:
```bash
git rebase --signoff HEAD~3  # for last 3 commits
```

#### DCO Text

By signing off, you agree to the [Developer Certificate of Origin v1.1](https://developercertificate.org/):

```
By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

## Code Standards

### TypeScript

- Use explicit types
- Avoid `any` type
- Define interfaces for complex objects
- Use enums for constants

### React

- Functional components only
- Use hooks for state and effects
- Keep components focused and small
- Extract reusable logic to custom hooks

### Styling

- Use Tailwind classes
- Define custom colors in config
- Use Typography component for text
- Maintain consistent spacing

### Testing

```bash
pnpm test           # Run all tests
pnpm test:watch     # Watch mode
pnpm test:coverage  # Coverage report
```

Write tests for:
- New features
- Bug fixes
- Edge cases
- Error handling

### Code Quality

Before submitting:

```bash
pnpm typecheck  # Type checking
pnpm test       # Run tests
```

## Submission Process

### Pull Request Checklist

- [ ] All commits are DCO signed (`git commit -s`)
- [ ] Tests pass
- [ ] TypeScript builds without errors
- [ ] Code follows project style
- [ ] Commit messages are clear
- [ ] PR description explains changes
- [ ] Screenshots included (for UI changes)
- [ ] Tested on testnet

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested locally
- [ ] Added tests
- [ ] All tests pass

## Screenshots
(if applicable)
```

## Project Structure

```
src/
├── main/           # Electron main process
│   ├── services/   # Backend services
│   ├── ipc/        # IPC handlers
│   └── config/     # Configuration
├── renderer/       # React application
│   ├── components/ # UI components
│   ├── pages/      # App pages
│   ├── stores/     # State management
│   └── hooks/      # Custom hooks
├── preload/        # Preload scripts
└── shared/         # Shared types/schemas
```

## Key Areas

### High Priority

- Performance improvements
- Security enhancements
- Bug fixes
- Test coverage
- Documentation

### Feature Ideas

- Additional MCP server integrations
- Enhanced transaction visualization
- Improved error handling
- Accessibility improvements

## Security

### Reporting Issues

For security vulnerabilities, email security@hashgraphonline.com instead of using public issues.

### Best Practices

- Never commit API keys or secrets
- Validate all user inputs
- Use testnet for development
- Review dependencies for vulnerabilities
- Follow principle of least privilege

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev)
- [Hedera Documentation](https://docs.hedera.com)
- [MCP Specification](https://modelcontextprotocol.io)

## Questions?

- Open a GitHub issue for bugs
- Start a discussion for features
- Join our Discord for chat

## License

By contributing, you agree that your contributions will be licensed under the project's license.