# How to Get a GitHub Token

## Overview
A GitHub token (Personal Access Token) allows your application to authenticate with the GitHub API without using your password. This is required to access private repositories or to increase API rate limits.

## Step-by-Step Guide

### 1. Go to GitHub Settings
1. Log in to your GitHub account at https://github.com
2. Click your profile icon in the top-right corner
3. Select **Settings** from the dropdown menu

### 2. Navigate to Developer Settings
1. In the left sidebar, scroll down and click **Developer settings**
2. Click **Personal access tokens** in the left sidebar
3. Click **Tokens (classic)** (or **Fine-grained tokens** for more control)

### 3. Generate a New Token
1. Click the **Generate new token** button
2. Click **Generate new token (classic)** if using the classic tokens

### 4. Configure Token Permissions
Fill in the token details:

**Token name**: `historian-reports-github-api` (or any descriptive name)

**Expiration**: Choose an expiration date (90 days is recommended for security)

**Select scopes** (permissions):
- ✓ `public_repo` - Access to public repositories (minimum required)
- ✓ `repo` - Full control of private repositories (if your repo is private)
- ✓ `read:repo_hook` - Read repository hooks
- ✓ `workflow` - Update GitHub Action workflows (optional)

**For public repositories**, you only need:
- `public_repo`

**For private repositories**, you need:
- `repo` (full control)

### 5. Generate and Copy Token
1. Click **Generate token** at the bottom
2. **IMPORTANT**: Copy the token immediately - you won't be able to see it again!
3. Store it securely (password manager, secure note, etc.)

## Using the Token

### Option 1: Add to .env File (Development)
```bash
# .env
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Option 2: Add to Environment Variables (Production)
```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Option 3: Add to GitHub Actions Secrets (CI/CD)
1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `GITHUB_TOKEN`
5. Value: Paste your token
6. Click **Add secret**

## Token Format
GitHub tokens typically look like:
```
ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Where:
- `ghp_` = GitHub Personal token prefix
- `xxxx...` = Random alphanumeric characters

## Security Best Practices

### DO:
✓ Use tokens instead of passwords
✓ Set an expiration date (90 days recommended)
✓ Use minimal required permissions (principle of least privilege)
✓ Rotate tokens regularly
✓ Store tokens securely (never commit to git)
✓ Use different tokens for different purposes

### DON'T:
✗ Commit tokens to version control
✗ Share tokens with others
✗ Use tokens with excessive permissions
✗ Use tokens without expiration dates
✗ Reuse the same token across multiple applications

## Troubleshooting

### Token Not Working
1. Verify the token hasn't expired
2. Check that the token has the correct permissions
3. Ensure the token is correctly set in `.env` or environment variables
4. Restart your application after adding the token

### "Not Found" Error from GitHub API
This usually means:
1. The repository doesn't exist or is private without proper authentication
2. The token doesn't have permission to access the repository
3. The repository name is incorrect

### Rate Limiting
- **Without token**: 60 requests per hour
- **With token**: 5,000 requests per hour

If you're hitting rate limits, ensure your token is properly configured.

## Testing Your Token

### Test with curl
```bash
curl -H "Authorization: token YOUR_TOKEN_HERE" \
  https://api.github.com/user
```

Should return your GitHub user information.

### Test Repository Access
```bash
curl -H "Authorization: token YOUR_TOKEN_HERE" \
  https://api.github.com/repos/ricmagno/KagomeReports/releases
```

Should return your repository's releases (or 404 if repo doesn't exist).

## Next Steps

1. **Create your token** following the steps above
2. **Add to .env file**:
   ```
   GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
3. **Restart your backend server**:
   ```bash
   npm run dev
   ```
4. **Test the update check endpoint**:
   ```bash
   curl http://localhost:3000/api/updates/check
   ```
5. **Create a GitHub release** with a version higher than 1.0.0

## Important Notes

- The token in `.env` is for **development only**
- For production, use GitHub Actions secrets or environment variables
- Never commit `.env` to version control (it's in `.gitignore`)
- Tokens are case-sensitive
- After adding the token, you may need to restart your application

## References
- [GitHub Personal Access Tokens Documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [GitHub API Authentication](https://docs.github.com/en/rest/authentication/authenticating-with-the-rest-api)
