# JoaLLM Monetization Plan

**Date:** 2026-04-01  
**Status:** Draft aligned to current platform capabilities

## 1. Positioning

JoaLLM should be sold as a **private AI work platform**, not just a chat app.

The strongest current value proposition is:

> Chat with top models, search your private knowledge, automate repeatable workflows, and work in AI notebooks from one secure workspace.

This positioning fits the current product surface:

- Multi-model chat with model parameters and exports
- Knowledge manager with upload, indexing, hybrid RAG, grounded answers, and confidence logic
- Workflow builder with execution history
- Notebook interface with AI, code, chart, knowledge, agent, and debug cells
- Usage tracking, roles, tiers, admin, security, bookmarks, and custom API keys

## 2. Recommended Revenue Model

Use a hybrid SaaS model:

- **Seat/platform revenue** for access to the workspace
- **Usage-based expansion revenue** for heavy model, storage, and processing usage
- **Service revenue** for onboarding, setup, and custom vertical deployments

This is a better fit than pure usage billing because the platform already has premium workspace features beyond token consumption.

## 3. Primary Customer Segments

### Segment A: Solo power users

Target:

- Founders
- Consultants
- Analysts
- Researchers
- Independent operators

What they buy:

- Better AI workspace
- Their own knowledge base
- Notebooks for analysis
- Workflow automation
- Model flexibility

### Segment B: Small teams

Target:

- Agencies
- Ops teams
- Sales enablement teams
- Support teams
- Internal strategy teams

What they buy:

- Shared knowledge
- Shared workflows
- Shared notebooks
- Admin visibility
- Predictable usage and governance

### Segment C: Enterprise buyers

Target:

- Mid-market and enterprise internal AI programs
- Departments with regulated or high-value knowledge

What they buy:

- Security
- Admin controls
- private deployment
- custom contracts
- onboarding and support

## 4. Packaging Strategy

Keep the current `free`, `pro`, and `enterprise` structure, but sharpen what each tier means.

### Free

Goal:

- Acquisition
- Product-led growth
- Low-friction evaluation

Recommended package:

- Limited daily requests
- Limited files and storage
- Limited chat sessions
- Limited workflows
- Limited notebooks
- Standard models only
- No export
- No custom API keys
- JoaLLM branding visible

Who it converts:

- Curious users
- Students
- Light individual users

### Pro

Goal:

- Primary self-serve revenue tier

Recommended package:

- Higher request and token limits
- More files and storage
- More workflows and notebooks
- Chat export enabled
- Custom API keys enabled
- Usage dashboard enabled
- Priority processing
- Premium model access where margin allows

Recommended price:

- `$29/month` monthly
- `$290/year` annual

This already aligns with the current backend plan price fields and is a good first self-serve price point.

### Team

Add this as a distinct tier even if the backend still maps it internally to `pro` in the first release.

Goal:

- Best near-term growth tier

Recommended package:

- Per-seat billing
- Shared workspace
- Shared knowledge collections
- Shared workflows
- Shared notebooks
- Admin controls
- Team usage views
- Better support

Recommended price:

- `$49/user/month` with a 3-seat minimum

Why this matters:

- The product already supports role-aware UI, workspace modes, admin patterns, and usage visibility
- Team collaboration is easier to justify than a premium solo chat tool

### Enterprise

Goal:

- High ACV sales motion

Recommended package:

- Custom usage terms
- Custom storage limits
- SSO/SAML later
- Audit and retention controls later
- Private deployment or dedicated environment
- Security review support
- Priority support and onboarding
- Contract + invoice billing

Recommended pricing:

- Start at `$12k-$30k ARR` depending on deployment, support, and usage profile

## 5. Feature Gating Matrix

### Free

- Chat: yes
- RAG upload/search: yes, but strongly capped
- Workflows: limited create/run
- Notebooks: limited create/use
- Model farm browsing: yes
- Bookmarks: yes
- Export: no
- Custom API keys: no
- Advanced admin/security value: no

### Pro

- Chat: expanded limits
- RAG upload/search: expanded limits
- Workflows: full personal use
- Notebooks: full personal use
- Export: yes
- Custom API keys: yes
- Usage dashboard: yes
- Better model access: yes

### Team

- Everything in Pro
- Shared workspaces
- Shared knowledge
- Shared assets
- Team-level admin
- Team usage reporting
- Team onboarding

### Enterprise

- Everything in Team
- Contracted limits
- Security and deployment upgrades
- Dedicated support
- Custom integration and procurement support

## 6. Best Monetization Hooks By Existing Feature

### Multi-model chat

Monetize:

- Premium access to top models
- Faster priority inference
- Advanced parameter controls
- Higher daily and monthly usage ceilings

### Knowledge manager and RAG

Monetize:

- Indexed document count
- Storage volume
- Reindexing and processing volume
- Shared team knowledge spaces
- High-trust grounded answers for business use

This is one of the strongest value drivers because it moves the product from entertainment to work utility.

### Workflow builder

Monetize:

- Number of saved workflows
- Workflow execution volume
- Premium templates
- Scheduled and automated execution later

This can become a major expansion lever once repeatable business tasks are packaged into templates.

### Notebooks

Monetize:

- Persistent AI analysis workspace
- More notebook count
- More cell executions
- Better export/share options later

This is especially attractive for analysts, consultants, and technical teams.

### Usage tracking

Monetize:

- Overage billing
- Usage transparency
- Margin-aware premium model packaging

Because the platform already records requests, tokens, costs, and models, you can support overages and better plan economics without rebuilding your backend later.

### Custom API keys

Monetize:

- Premium control feature for Pro and above
- Margin-protection tool for heavy users

This is strategically important: it keeps power users on the platform even when they want to control provider spend directly.

## 7. Pricing Recommendation

Use this initial structure:

### Free

- `$0`
- 50 requests/day
- 10 files
- 100 MB storage
- 3 workflows
- 3 notebooks
- No export
- No custom API keys

### Pro

- `$29/month`
- 2,000 requests/day
- 200 files
- 5 GB storage
- 50 workflows
- 50 notebooks
- Export enabled
- Custom API keys enabled

### Team

- `$49/user/month`
- Shared workspace
- Higher pooled limits
- Team knowledge/workflows/notebooks
- Admin and reporting

### Enterprise

- Custom pricing
- Unlimited or contracted limits
- Security and deployment add-ons

## 8. Launch Strategy

### Phase 1: Monetize what already exists

Timeline:

- 2 to 4 weeks

Ship:

- Public pricing page
- Free and Pro checkout flow
- Pro gating around export, custom API keys, higher limits, and premium usage
- Usage dashboard as a visible Pro value prop

Success metric:

- Convert activated free users into Pro

### Phase 2: Add Team packaging

Timeline:

- 4 to 8 weeks after Phase 1

Ship:

- Team plan page
- Shared workspace language in product and site
- Team billing flow
- Simple seat management

Success metric:

- First 5 to 10 paying teams

### Phase 3: Enterprise motion

Timeline:

- After repeated Team usage patterns appear

Ship:

- Sales-led page
- Security questionnaire packet
- Deployment options
- Onboarding service package

Success metric:

- First 2 to 3 enterprise pilots

## 9. Go-To-Market Messaging

### Best homepage message

**Private AI workspace for teams that need more than chat**

Supporting points:

- Ground answers in your documents
- Compare and use multiple top AI models
- Build repeatable AI workflows
- Work in notebooks, not just chat threads
- Bring your own provider keys when needed

### Best Pro message

**Upgrade from casual prompting to serious AI work**

### Best Team message

**Give your team one secure place for AI chat, knowledge, and automation**

### Best Enterprise message

**Deploy AI workflows on your terms with security, control, and support**

## 10. Revenue Expansion Opportunities

After the base plans are live, add:

- Storage add-on packs
- Workflow execution credit packs
- Premium model access packs
- White-label workspace option
- Paid onboarding and knowledge-base setup
- Vertical templates for legal, research, sales, support, and operations
- Private deployment fees

## 11. Key Metrics To Track

Track these weekly:

- Free to Pro conversion rate
- Activated users who upload at least 1 file
- Activated users who create at least 1 workflow
- Activated users who create at least 1 notebook
- Pro retention after month 1
- Average cost per active Pro user
- Gross margin by plan
- Team expansion rate by seat count

Most important activation metric:

> User has chatted, uploaded documents, and run at least one grounded workflow or notebook flow in the first week.

## 12. What To Prioritize Next In Product

If the goal is revenue soon, prioritize in this order:

1. Make billing and plan enforcement feel complete
2. Turn the usage dashboard into a real upgrade driver
3. Make Team packaging visible across landing page and app
4. Add shared workspace and collaboration details where light implementation is enough
5. Build vertical templates for one niche instead of broad generic messaging

## 13. Recommended Immediate Decisions

Make these calls now:

1. Keep `Free`, `Pro`, and `Enterprise` in the backend
2. Market a visible `Team` plan in the product and site, even if implemented in phases
3. Price `Pro` at `$29/month`
4. Use RAG, notebooks, workflows, export, and custom API keys as the main upgrade levers
5. Sell Enterprise manually

## 14. Suggested One-Sentence Strategy

JoaLLM should monetize as a multi-surface AI work platform: free for discovery, Pro for serious individual use, Team for collaboration and governance, and Enterprise for security, deployment, and support.
