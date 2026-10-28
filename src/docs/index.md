# Documentation

Welcome to the Convex Components Directory documentation. This guide covers how to use the directory as a user and how to manage it as an admin.

## What is the Components Directory?

The Convex Components Directory is a curated catalog of open-source backend components built for the Convex ecosystem. Users can browse, search, and discover components to add to their Convex projects.

## Quick links

### For users

- [Directory](/components/documentation/directory) - Browse and search components
- [Submit a component](/components/documentation/submit) - How to submit your component
- [Preflight checker](/components/documentation/submit) - Validate your repo before submitting
- [Your profile](/components/documentation/profile) - Manage your submissions
- [Component pages](/components/documentation/component-detail) - Understanding component details
- [Submission FAQ](/components/documentation/submit#frequently-asked-questions) - Contributor terms, takedown process, review flow

### For admins

- [Admin dashboard](/components/documentation/admin-dashboard) - Dashboard overview
- [Package management](/components/documentation/admin-packages) - Managing packages
- [Review workflow](/components/documentation/admin-review) - Review process
- [AI review](/components/documentation/admin-ai-review) - Automated AI reviews
- [Security scanning](/components/documentation/admin-security-scan) - Security scan providers and backlog queue
- [SEO content](/components/documentation/admin-seo) - SEO and content generation
- [Thumbnails](/components/documentation/admin-thumbnails) - Thumbnail management
- [Settings](/components/documentation/admin-settings) - Admin settings
- [Activity](/components/documentation/admin-activity) - Timeline of user submissions, messages, and edits
- [Users](/components/documentation/admin-users) - Search users, kick, deactivate, ban, and reactivate
- [GitHub Broadcast](/components/documentation/admin-broadcast) - Broadcast issues to submitter repos and sync replies
- [Notes and comments](/components/documentation/admin-notes) - Communication system and GitHub issue messaging

### Integrations

- [API endpoints](/components/documentation/api-endpoints) - Public REST and content APIs
- [Badges](/components/documentation/badges) - README badge endpoint
- [MCP](/components/documentation/mcp) - Model Context Protocol for AI agents

### Contributing

- [Updating the docs](/components/documentation/updating-docs) - How to add and edit documentation pages

## Technology stack

The directory is built with:

- **Frontend**: React, Vite, TypeScript, Tailwind CSS
- **Backend**: Convex (database, functions, file storage)
- **Authentication**: WorkOS AuthKit with Connect OAuth
- **AI providers**: Anthropic Claude, OpenAI GPT, Google Gemini (with automatic failover)
- **Hosting**: Netlify (with edge functions for OG meta, badges, and markdown proxying)

## Access levels

| Role | Access |
|------|--------|
| Public | Browse directory, view component details, use REST API (rate limited), guest preflight check (3 per hour) |
| Authenticated user | Submit components, manage profile, preflight check, generate API key |
| Admin (@convex.dev email) | Full admin dashboard access, API access grants |
