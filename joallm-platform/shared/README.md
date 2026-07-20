# Shared

This directory contains shared code, types, utilities, and configurations used across multiple services in the JoaLLM platform.

## Structure

```
shared/
├── types/           # TypeScript types and interfaces
├── utils/           # Utility functions
├── config/          # Shared configuration
└── constants/       # Application constants
```

## Usage

### In Backend

```typescript
import { User, ApiResponse } from '../../shared/types';
```

### In Frontend Services

```typescript
import { User, ChatMessage } from '../../shared/types';
```

## Adding New Shared Code

1. Create or update files in the appropriate subdirectory
2. Export from an index file
3. Update this README if adding new sections
4. Consider backward compatibility when making changes

## Types

Common TypeScript interfaces and types used across services:
- `User` - User data structure
- `ApiResponse<T>` - Standardized API response format
- Knowledge Acquisition contracts (`Person`, `PersonIdentity`, `AcquisitionEvent`, `Interaction`, `KnowledgeArtifact`, …) — see `types/knowledge-acquisition.ts` and [Knowledge Acquisition Direction](../docs/04-architecture/KNOWLEDGE_ACQUISITION_DIRECTION.md)

Frontend resolves `@joallm/shared` → `shared/types` via Vite/tsconfig path alias.- `ChatMessage` - Chat message structure
- `Document` - Document metadata
- `LLMModel` - LLM model configuration


