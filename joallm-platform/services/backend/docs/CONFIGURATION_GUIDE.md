# Configuration Guide

## API Key Management System

This guide explains how the hybrid API key system works in the JoaLLM Platform.

### Overview

The platform uses a **hybrid API key system** that combines:
- **Backend Default Keys**: Set in environment variables or `.env` file
- **User Override Keys**: Set by individual users in the frontend settings

### How It Works

1. **Backend Configuration**: The backend loads API keys from environment variables or uses placeholder defaults
2. **User Override**: Users can set their own API keys in the frontend settings panel
3. **Priority System**: User keys override backend keys when available
4. **Fallback**: If user keys are not set, the system falls back to backend keys

### Backend API Keys

#### Environment Variables

Set these in your `.env` file or system environment:

```bash
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
GROQ_API_KEY=gsk-your-groq-key-here
COHERE_API_KEY=cohere-your-cohere-key-here
OLLAMA_API_KEY=ollama-your-ollama-key-here
```

#### Default Values

If no environment variables are set, the system uses these placeholder values:
- `PLACEHOLDER-OPENAI-KEY-NOT-SET`
- `PLACEHOLDER-ANTHROPIC-KEY-NOT-SET`
- `PLACEHOLDER-GROQ-KEY-NOT-SET`
- `PLACEHOLDER-COHERE-KEY-NOT-SET`
- `PLACEHOLDER-OLLAMA-KEY-NOT-SET`

#### Mock Mode Detection

The system automatically detects when to use mock mode:
- **Mock Mode**: All API keys are placeholder values
- **Real Mode**: At least one API key is a real key

### User API Keys

#### Setting User Keys

Users can set their own API keys through the frontend settings panel:
1. Open the settings panel
2. Go to the "API Keys" tab
3. Enter your API keys for each provider
4. Click "Save Settings"

#### Storage

User API keys are stored:
- **Backend**: In the `users.api_keys` JSONB column
- **Frontend**: Cached in localStorage for performance

#### Security

- API keys are masked in the UI (showing only first 8 and last 4 characters)
- Keys are encrypted in localStorage
- Backend validates and sanitizes all key inputs

### API Endpoints

#### Get User API Keys
```
GET /api/users/settings/api-keys
```

Returns masked API keys for the authenticated user.

#### Update User API Keys
```
PUT /api/users/settings/api-keys
Content-Type: application/json

{
  "apiKeys": {
    "openai": "sk-your-key-here",
    "anthropic": "sk-ant-your-key-here",
    "groq": "gsk-your-key-here",
    "cohere": "cohere-your-key-here",
    "ollama": "ollama-your-key-here"
  }
}
```

#### Delete Specific Provider Key
```
DELETE /api/users/settings/api-keys/:provider
```

Where `:provider` is one of: `openai`, `anthropic`, `groq`, `cohere`, `ollama`

#### Configuration Status
```
GET /api/health/config-status
```

Returns the current configuration status including:
- Mock mode status
- Provider configuration status
- Whether keys are default placeholders

### Debugging

#### Check Environment Variables
```bash
npm run debug:env
```

#### Check Configuration Sources
The backend logs configuration sources on startup in development mode:
```
🔧 Configuration Sources:
  openai: environment
  groq: default
  anthropic: environment
  cohere: default
```

#### Configuration Status Endpoint
```bash
curl http://localhost:3001/api/health/config-status
```

### Troubleshooting

#### Common Issues

1. **Mock Mode When It Shouldn't Be**
   - Check if all API keys contain "PLACEHOLDER"
   - Verify environment variables are set correctly
   - Check the configuration status endpoint

2. **User Keys Not Working**
   - Verify user is authenticated
   - Check if keys are saved in the database
   - Look for errors in the browser console

3. **API Calls Failing**
   - Check if the API key is valid
   - Verify the provider is supported
   - Check the backend logs for specific errors

#### Debug Steps

1. Check configuration status:
   ```bash
   curl http://localhost:3001/api/health/config-status
   ```

2. Check environment variables:
   ```bash
   npm run debug:env
   ```

3. Check backend logs for configuration sources

4. Verify user API keys in the database:
   ```sql
   SELECT id, email, api_keys FROM users WHERE id = 'user-id';
   ```

### Migration

#### Adding User API Keys Column

If you need to add the user API keys column to an existing database:

```sql
-- Add api_keys column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS api_keys JSONB DEFAULT '{}';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS users_api_keys_idx ON users USING GIN(api_keys);
```

### Best Practices

1. **Backend Keys**: Use for default/shared access
2. **User Keys**: Use for individual user preferences
3. **Security**: Never log actual API keys
4. **Validation**: Always validate API key formats
5. **Fallback**: Always have a fallback mechanism
6. **Monitoring**: Monitor API usage and costs

### Example Scenarios

#### Scenario 1: Development Setup
- Backend has placeholder keys → Mock mode
- Users can set their own keys → Real mode for those users
- Other users get mock responses

#### Scenario 2: Production with Shared Keys
- Backend has real API keys → Real mode for all users
- Users can override with their own keys → Uses user keys instead
- Fallback to backend keys if user keys fail

#### Scenario 3: Multi-tenant Setup
- Backend has no keys → Mock mode by default
- Each user sets their own keys → Individual API usage
- Complete isolation between users
