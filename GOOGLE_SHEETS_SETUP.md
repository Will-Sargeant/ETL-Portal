# Google Sheets Integration Setup Guide

This guide walks you through setting up Google Sheets integration for your ETL Portal. This is a **one-time setup** performed by an organization administrator. Once configured, all employees can connect their personal Google accounts and use their own spreadsheets in ETL jobs.

## Overview

The setup process involves:
1. Creating a Google Cloud project
2. Enabling required APIs
3. Creating OAuth 2.0 credentials
4. Configuring the ETL Portal with these credentials
5. Employees can then connect their personal Google accounts

## Prerequisites

- Google account with access to Google Cloud Console
- Admin access to the ETL Portal `.env` file
- Ability to restart the backend container

---

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Click the project dropdown at the top of the page
4. Click **"New Project"**
5. Enter a project name (e.g., "ETL Portal" or "Company Data Integration")
6. Click **"Create"**
7. Wait for the project to be created (should take a few seconds)
8. Make sure the new project is selected in the project dropdown

---

## Step 2: Enable Required APIs

### Enable Google Sheets API

1. In the Google Cloud Console, click the hamburger menu (☰) in the top-left
2. Navigate to **"APIs & Services"** → **"Library"**
3. In the search bar, type **"Google Sheets API"**
4. Click on **"Google Sheets API"** in the results
5. Click the **"Enable"** button
6. Wait for the API to be enabled

### Enable Google Drive API

1. Click the back arrow or navigate back to **"APIs & Services"** → **"Library"**
2. In the search bar, type **"Google Drive API"**
3. Click on **"Google Drive API"** in the results
4. Click the **"Enable"** button
5. Wait for the API to be enabled

---

## Step 3: Configure OAuth Consent Screen

Before creating credentials, you need to configure the OAuth consent screen:

1. In the Google Cloud Console, navigate to **"APIs & Services"** → **"OAuth consent screen"**
2. Select **"Internal"** if your organization uses Google Workspace (recommended)
   - This restricts the app to users within your organization
   - If you don't have Google Workspace, select **"External"**
3. Click **"Create"**

### Fill in App Information

1. **App name**: Enter "ETL Portal" (or your preferred name)
2. **User support email**: Select your email from the dropdown
3. **App logo**: (Optional) Upload your company logo
4. **Application home page**: (Optional) Enter your organization's website
5. **Authorized domains**: (Optional) Add your organization's domain
6. **Developer contact information**: Enter your email address
7. Click **"Save and Continue"**

### Configure Scopes

1. Click **"Add or Remove Scopes"**
2. In the filter box, search for these scopes and check them:
   - `https://www.googleapis.com/auth/spreadsheets.readonly` (View your Google Spreadsheets)
   - `https://www.googleapis.com/auth/drive.readonly` (See and download all your Google Drive files)
3. Click **"Update"**
4. Click **"Save and Continue"**

### Test Users (Only if you selected "External")

1. Click **"Add Users"**
2. Add the email addresses of employees who will use the ETL Portal
3. Click **"Save and Continue"**

### Review and Finish

1. Review your settings
2. Click **"Back to Dashboard"**

---

## Step 4: Create OAuth 2.0 Credentials

1. Navigate to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** at the top
3. Select **"OAuth 2.0 Client ID"**

### Configure the OAuth Client

1. **Application type**: Select **"Web application"**
2. **Name**: Enter "ETL Portal Web Client" (or your preferred name)

### Add Authorized Redirect URIs

This is critical - the redirect URI must match your ETL Portal's frontend URL:

1. Under **"Authorized redirect URIs"**, click **"Add URI"**
2. For local development, add:
   ```
   http://localhost:3000/auth/google/callback
   ```
3. For production, add your production URL (replace with your actual domain):
   ```
   https://etl.yourcompany.com/auth/google/callback
   ```

   **Important**: You can add multiple redirect URIs for different environments

4. Click **"Create"**

### Save Your Credentials

A dialog will appear with your credentials:

1. **Client ID**: Copy this value (e.g., `123456789-abc123.apps.googleusercontent.com`)
2. **Client Secret**: Copy this value (e.g., `GOCSPX-abc123xyz789`)
3. Click **"OK"**

**Important**: Keep these credentials secure. They allow access to your OAuth application.

---

## Step 5: Configure the ETL Portal

Now you'll add these credentials to your ETL Portal:

1. Open the `.env` file in the root of your ETL Portal directory
2. Find the Google OAuth Configuration section (around line 44)
3. Update the following values:

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

**Replace**:
- `YOUR_CLIENT_ID_HERE` with the Client ID you copied
- `YOUR_CLIENT_SECRET_HERE` with the Client Secret you copied
- Update `GOOGLE_REDIRECT_URI` if using a different URL than localhost

### Example

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=123456789-abc123def456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123xyz789def456
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

4. Save the `.env` file

---

## Step 6: Restart the Backend

The backend needs to be restarted to pick up the new environment variables:

```bash
docker-compose restart backend
```

Wait for the backend to restart (about 10-20 seconds). You can verify it's running with:

```bash
docker-compose logs backend --tail 20
```

Look for a line that says:
```
INFO:     Application startup complete.
```

---

## Step 7: Test the Integration

1. Open the ETL Portal in your browser (http://localhost:3000)
2. Navigate to **"ETL Jobs"** → **"Create New Job"**
3. In Step 1 (Source Selection), click the **"Google Sheets"** tab
4. Click **"Connect Google Sheets"**

### What Should Happen

1. A popup window opens
2. You're redirected to Google's sign-in page
3. You sign in with your personal Google account
4. Google asks you to grant permission to the ETL Portal
5. You click **"Allow"**
6. The popup closes and you're back in the ETL Portal
7. You should see a success message: "Connected to Google Sheets"
8. A list of your Google Spreadsheets appears

### Troubleshooting

**Popup blocked**: If the popup is blocked, allow popups for this site in your browser settings

**Error: redirect_uri_mismatch**:
- The redirect URI in your `.env` file doesn't match what you configured in Google Cloud Console
- Double-check both values match exactly (including http:// vs https://)

**Error: Access denied**:
- You may not be on the allowed test users list (if using "External" mode)
- Ask your admin to add your email to the test users

**500 Internal Server Error**:
- The backend couldn't read the environment variables
- Make sure you restarted the backend after updating `.env`
- Check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are not empty

---

## How It Works for Employees

Once you've completed this setup, here's how employees will use Google Sheets:

### Creating an ETL Job with Google Sheets

1. Employee navigates to **"Create New Job"**
2. Clicks the **"Google Sheets"** tab
3. Clicks **"Connect Google Sheets"**
4. Signs in with **their own** Google account
5. Grants permission for the ETL Portal to access **their** spreadsheets
6. Selects **their** spreadsheet and sheet from the list
7. Continues through the wizard to set up transformations and schedule
8. When the job runs, it uses **their** credentials to access **their** Google Sheet

### Important Security Notes

- Each employee's Google credentials are encrypted and stored with their job
- Employees can only access spreadsheets from their own Google accounts
- The organization's `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are just the "app credentials" - they don't give access to any specific Google account
- Each employee must grant permission individually

---

## Production Considerations

### For Production Deployment

1. **Update Authorized Redirect URI** in Google Cloud Console:
   - Add your production domain (e.g., `https://etl.yourcompany.com/auth/google/callback`)

2. **Update `.env` file**:
   ```bash
   GOOGLE_REDIRECT_URI=https://etl.yourcompany.com/auth/google/callback
   ```

3. **Move from "Testing" to "Production"** (if you used "External" mode):
   - Navigate to **"OAuth consent screen"** in Google Cloud Console
   - Click **"Publish App"**
   - Note: For "Internal" apps, this step is not needed

### Security Best Practices

1. **Restrict Access**: Use "Internal" mode if you have Google Workspace
2. **Regular Audits**: Periodically review which employees have connected Google accounts
3. **Credential Rotation**: If you suspect the Client Secret was compromised:
   - Go to Google Cloud Console → Credentials
   - Delete the old OAuth client
   - Create a new one with a new Client Secret
   - Update the `.env` file and restart

---

## Support

If you encounter issues during setup:

1. Check the backend logs: `docker-compose logs backend --tail 50`
2. Verify all API are enabled in Google Cloud Console
3. Ensure the redirect URI matches exactly
4. Make sure you restarted the backend after updating `.env`

For additional help, refer to:
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Sheets API Documentation](https://developers.google.com/sheets/api)
