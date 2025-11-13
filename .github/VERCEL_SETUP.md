# Vercel Deployment Setup Guide

This repository is configured to automatically deploy to Vercel whenever code is pushed to any branch using GitHub Actions.

## Required GitHub Secrets

To enable automatic deployments, you need to add the following secrets to your GitHub repository:

### 1. VERCEL_TOKEN

**How to get it:**
1. Go to [Vercel Account Settings](https://vercel.com/account/tokens)
2. Click "Create Token"
3. Give it a name (e.g., "GitHub Actions")
4. Select the appropriate scope (usually "Full Account")
5. Click "Create" and copy the token

### 2. VERCEL_ORG_ID

**How to get it:**
1. Install Vercel CLI locally: `npm i -g vercel`
2. Run `vercel login` to authenticate
3. Navigate to your project directory
4. Run `vercel link`
5. Open `.vercel/project.json` in your project
6. Copy the `orgId` value

Alternatively, you can find it in your Vercel dashboard URL:
- URL format: `https://vercel.com/[your-org-id]/[project-name]`

### 3. VERCEL_PROJECT_ID

**How to get it:**
1. Follow the same steps as VERCEL_ORG_ID above
2. Open `.vercel/project.json` in your project
3. Copy the `projectId` value

Alternatively, go to your project settings in Vercel dashboard:
- Project Settings → General → Project ID

## Adding Secrets to GitHub

1. Go to your GitHub repository
2. Click on "Settings" tab
3. In the left sidebar, click "Secrets and variables" → "Actions"
4. Click "New repository secret"
5. Add each secret:
   - Name: `VERCEL_TOKEN`, Value: [your token]
   - Name: `VERCEL_ORG_ID`, Value: [your org ID]
   - Name: `VERCEL_PROJECT_ID`, Value: [your project ID]

## How It Works

- **Any branch push**: Creates a preview deployment on Vercel
- **Main/Master branch push**: Creates a production deployment on Vercel
- **Pull requests**: Creates a preview deployment

## Verifying Setup

After adding the secrets:
1. Make a commit to any branch
2. Push to GitHub: `git push`
3. Go to the "Actions" tab in your GitHub repository
4. You should see the "Vercel Deployment" workflow running
5. Once complete, check your Vercel dashboard for the deployment

## Troubleshooting

If deployments fail:
1. Verify all three secrets are correctly added to GitHub
2. Check that the Vercel token has the correct permissions
3. Ensure your Vercel project is properly linked
4. Review the GitHub Actions logs for specific error messages
