# Contributing to GlassFlow ClickHouse ETL

Thank you for your interest in contributing to GlassFlow ClickHouse ETL! This document provides guidelines and instructions for contributing to our project. We welcome all types of contributions, from bug reports to feature requests, documentation improvements, and code contributions.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Types of Contributions](#types-of-contributions)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before making any contributions.

## Getting Started

1. **Fork the Repository**
   - Click the "Fork" button on the GitHub repository page
   - Clone your fork: `git clone https://github.com/your-username/clickhouse-etl.git`
   - Add the upstream remote: `git remote add upstream https://github.com/glassflow/clickhouse-etl.git`

2. **Set Up Development Environment**
   - Install Docker and Docker Compose
   - Install Go (for API development)
   - Install Node.js and npm (for UI development)
   - Follow the setup instructions in the main README.md

3. **Understand the Architecture**
   - Review the architecture section in the main README.md
   - Familiarize yourself with the key components:
     - GlassFlow API (Go)
     - Web UI (React/TypeScript)
     - NATS message broker
     - Kafka bridge

## Types of Contributions

### 1. Bug Reports
- Use the GitHub issue tracker
- Include:
  - Clear description of the bug
  - Steps to reproduce
  - Expected vs actual behavior
  - Environment details (OS, Docker version, etc.)
  - Relevant logs or error messages

### 2. Feature Requests
- Use the GitHub issue tracker
- Include:
  - Clear description of the feature
  - Use cases and benefits
  - Potential implementation approach
  - Any relevant examples or references

### 3. Documentation
- Improve existing documentation
- Add new documentation for features
- Create tutorials or examples
- Fix typos or clarify confusing sections

### 4. Code Contributions
- Bug fixes
- New features
- Performance improvements
- Test coverage
- Code refactoring

## Development Workflow

1. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make Changes**
   - Follow the code standards
   - Write tests for new features
   - Update documentation as needed

3. **Test Your Changes**
   ```bash
   # Run unit tests
   make test
   
   # Run integration tests
   make integration-test
   
   # Run all tests
   make test-all
   ```

4. **Commit Your Changes**
   - Write clear, descriptive commit messages
   - Reference issues in your commits (e.g., "Fixes #123")
   - Follow the conventional commits format:
     ```
     feat: add new feature
     fix: resolve bug
     docs: update documentation
     test: add tests
     chore: maintenance
     ```

5. **Push to Your Fork**
   ```bash
   git push origin your-branch-name
   ```

## Code Standards

### Go (API)
- Follow the [Go Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments)
- Use `gofmt` for formatting
- Run `golint` and `go vet` before submitting
- Keep functions small and focused
- Add comments for exported functions and types
- Write unit tests for new code

### TypeScript/React (UI)
- Follow the [TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- Use ESLint and Prettier for formatting
- Write functional components with hooks
- Add PropTypes or TypeScript interfaces
- Write unit tests using Jest and React Testing Library

### General
- Write clear, self-documenting code
- Add comments for complex logic
- Keep functions and methods focused
- Use meaningful variable and function names
- Follow the existing code style

## Testing

### Unit Tests
- Write tests for all new code
- Maintain high test coverage
- Use descriptive test names
- Test edge cases and error conditions

### Integration Tests
- Test component interactions
- Test API endpoints
- Test data flow through the system
- Test error handling and recovery

### End-to-End Tests
- Test complete user workflows
- Test system integration
- Test performance under load

## Documentation

### Code Documentation
- Document all exported functions and types
- Add inline comments for complex logic
- Keep documentation up to date

### User Documentation
- Update README.md for new features
- Add or update configuration examples
- Document API changes
- Add usage examples

## Pull Request Process

1. **Create Pull Request**
   - Target the `main` branch
   - Fill out the PR template
   - Link related issues

2. **Review Process**
   - Address reviewer comments
   - Update documentation if needed
   - Ensure all tests pass
   - Update CHANGELOG.md if necessary

3. **Merge Criteria**
   - All tests pass
   - Code review approved
   - Documentation updated
   - No merge conflicts

## Release Process

1. **Version Bumping**
   - Follow semantic versioning
   - Update version in relevant files
   - Update CHANGELOG.md

2. **Release Notes**
   - Document new features
   - List bug fixes
   - Note breaking changes
   - Thank contributors

3. **Tagging**
   - Create git tag
   - Push tag to repository
   - Create GitHub release

## Questions?

If you have any questions about contributing, please:
- Open an issue
- Join our community discussions
- Contact the maintainers

Thank you for contributing to GlassFlow ClickHouse ETL! 