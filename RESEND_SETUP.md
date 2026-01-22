# Resend Email Integration Setup Guide

This guide covers the complete setup for sending beautiful, customizable emails via Resend when approving or rejecting applications.

---

## 📋 **What's Been Implemented**

### ✅ Complete Email System
1. **Supabase Edge Function** (`send-email`) for secure email sending
2. **Beautiful HTML Email Templates** with Neesh branding
3. **Admin Email Preview Modal** with live preview and edit capabilities
4. **Integrated Approval Flow** - admins preview before sending
5. **Fixed Checkbox Bug** - checkmarks now visible

---

## 🚀 **Setup Instructions**

### Step 1: Get Your Resend API Key

1. Sign up at [Resend.com](https://resend.com)
2. Verify your domain (or use their test domain for development)
3. Go to **API Keys** and create a new key
4. Copy the API key (starts with `re_...`)

### Step 2: Configure Supabase Environment Variables

1. Go to your Supabase Dashboard
2. Navigate to **Project Settings** → **Edge Functions**
3. Add the following secret:
   - **Name**: `RESEND_API_KEY`
   - **Value**: Your Resend API key from Step 1

Alternatively, use the Supabase CLI:

```bash
supabase secrets set RESEND_API_KEY=re_your_api_key_here
```

### Step 3: Deploy the Edge Function

Deploy the `send-email` function to Supabase:

```bash
# Navigate to your project directory
cd /Users/joshuamiller/activeprojects/neesh-experimental

# Deploy the function
supabase functions deploy send-email

# Verify deployment
supabase functions list
```

### Step 4: Verify Domain in Resend (Production Only)

For production emails:

1. Go to **Domains** in Resend
2. Add your domain (e.g., `neesh.art`)
3. Add the DNS records they provide:
   - SPF record
   - DKIM record
   - DMARC record (optional but recommended)
4. Wait for verification (usually 5-10 minutes)

### Step 5: Update Email From Address (Optional)

If you want to use a custom "from" address:

1. Open `supabase/functions/send-email/index.ts`
2. Change line 78:
   ```typescript
   const fromAddress = emailRequest.from || 'Neesh <hi@neesh.art>'
   ```
   To your verified email address

---

## 🎨 **Email Templates**

### Location
`src/lib/emailTemplates.ts`

### Available Templates

#### 1. **Approval Email**
- **Subject**: `Welcome to Neesh - {Business Name} Approved! 🎉`
- **Features**:
  - Welcome message
  - Magic link button for instant access
  - Next steps checklist (different for publishers/retailers)
  - Help contact info
  - Professional Neesh branding

#### 2. **Rejection Email**
- **Subject**: `Application Update - {Business Name}`
- **Features**:
  - Respectful rejection message
  - Clear reason for rejection
  - Encouragement to reach out
  - Contact information

### Customizing Templates

The templates are in HTML format and can be fully customized:

```typescript
// Edit in src/lib/emailTemplates.ts

export const generateApprovalEmail = (data: ApprovalEmailData): string => {
  // Customize HTML here
  return `<!DOCTYPE html>...`
}
```

**Template Variables:**
- `firstName` - Recipient's first name
- `businessName` - Business/publication name
- `role` - 'publisher' or 'retailer'
- `magicLinkUrl` - Auto-login link
- `reason` - (Rejection only) Reason for rejection

---

## 🎯 **How It Works - User Flow**

### For Admins:

1. **Review Application** in Admin Dashboard
2. **Click "Approve"** or "Decline"
3. **Email Preview Modal Opens**:
   - Preview tab: See exactly what the email looks like
   - Edit tab: Customize subject and HTML before sending
4. **Customize** (optional):
   - Edit the subject line
   - Modify the email HTML
   - Reset to default template if needed
5. **Send Email**:
   - Click "Send Email"
   - Email sent via Resend API
   - Account created automatically (for approvals)
   - Magic link generated and included

### For Applicants:

**Approval Flow:**
1. Receives email: "Welcome to Neesh - Your Business Approved!"
2. Clicks magic link button
3. Automatically signed in
4. Redirected to their dashboard (/publisher or /retailer)
5. Can set password later from settings

**Rejection Flow:**
1. Receives email: "Application Update - Your Business"
2. Sees reason for rejection
3. Can reply to discuss or provide more info

---

## 🔧 **Technical Details**

### Edge Function (`send-email`)

**Endpoint**: `https://your-project.supabase.co/functions/v1/send-email`

**Security**:
- ✅ Requires admin authentication
- ✅ Validates user role before sending
- ✅ Uses Authorization header with JWT

**Request Format**:
```json
{
  "to": "user@example.com",
  "subject": "Welcome to Neesh",
  "html": "<html>...</html>",
  "from": "Neesh <hi@neesh.art>",
  "replyTo": "hi@neesh.art"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Email sent successfully",
  "emailId": "resend-email-id-123"
}
```

### Email Preview Modal

**Component**: `src/components/admin/EmailPreviewModal.tsx`

**Features**:
- Live HTML preview in iframe
- Subject line editing
- Full HTML editing (with caution warnings)
- Reset to default template
- Dual-tab interface (Preview/Edit)
- Loading states during send

### Integration Points

1. **`useApplications` hook** (`src/hooks/useApplications.ts`):
   - `getApprovalEmailPreview()` - Generates approval email data
   - `getRejectionEmailPreview()` - Generates rejection email data
   - `approveApplication()` - Creates account + sends email
   - `rejectApplication()` - Updates status + sends email

2. **`AdminApplications` page** (`src/pages/admin/AdminApplications.tsx`):
   - Shows email preview before approval/rejection
   - Handles email customization flow
   - Sends email via edge function

---

## 🧪 **Testing**

### Test in Development

1. **Use Resend's Test Mode**:
   - Emails won't actually send in test mode
   - Check Resend Dashboard → Emails to see "sent" emails

2. **Test the Flow**:
   ```bash
   # Start dev server
   npm run dev

   # As admin:
   # 1. Go to /admin/applications
   # 2. Click on a pending application
   # 3. Click "Approve"
   # 4. Verify email preview shows correctly
   # 5. Customize if needed
   # 6. Click "Send Email"
   ```

3. **Check Logs**:
   - Supabase Dashboard → Edge Functions → Logs
   - Browser Console for frontend errors

### Test Email Delivery

**Option 1: Use Your Own Email**
- Submit a test application with your email
- Approve it as admin
- Check your inbox

**Option 2: Use Resend Test Mode**
- Check the Resend dashboard for "sent" emails
- Preview them there without actual delivery

---

## 🎨 **Customization Examples**

### Change Colors

In `src/lib/emailTemplates.ts`, update the color values:

```typescript
// Header background
style="background-color: #1A1A1A;" // Change to your brand color

// Accent color (buttons, links)
style="background-color: #C49A6C;" // Change to your brand color

// Text colors
style="color: #4A4A4A;" // Body text
style="color: #6B6B6B;" // Muted text
```

### Add Your Logo

```typescript
// In the header section, add:
<tr>
  <td style="background-color: #1A1A1A; padding: 40px; text-align: center;">
    <img src="https://neesh.art/logo.png" alt="Neesh" style="max-width: 200px;" />
  </td>
</tr>
```

### Customize Button Text

```typescript
// Find the CTA button and change:
<a href="${data.magicLinkUrl}" style="...">
  Your Custom Button Text Here
</a>
```

---

## 🐛 **Troubleshooting**

### Email Not Sending

1. **Check Resend API Key**:
   ```bash
   supabase secrets list
   # Verify RESEND_API_KEY is set
   ```

2. **Check Edge Function Logs**:
   - Supabase Dashboard → Edge Functions → send-email → Logs
   - Look for errors

3. **Verify Domain** (production only):
   - Resend Dashboard → Domains
   - Ensure all DNS records are verified

### Email Goes to Spam

1. **Verify Domain**: Must have SPF, DKIM, DMARC records
2. **Warm Up Domain**: Send gradually increasing volumes
3. **Check Content**: Avoid spam trigger words
4. **Add Unsubscribe Link** (for marketing emails)

### Preview Not Showing

1. **Check Browser Console**: Look for errors
2. **Verify Template HTML**: Must be valid HTML
3. **Check iframe sandbox**: Browser may block certain content

### Magic Link Not Working

1. **Check Supabase Auth Settings**:
   - Enable email authentication
   - Set redirect URLs correctly

2. **Verify Link Expiry**: Magic links expire in 24 hours

3. **Check Email Confirmations**: Auto-confirm must be enabled

---

## 📊 **Monitoring**

### Resend Dashboard

Track email metrics:
- **Sent**: Total emails sent
- **Delivered**: Successfully delivered
- **Opened**: Recipient opened email
- **Clicked**: Recipient clicked links
- **Bounced**: Failed to deliver
- **Complaints**: Marked as spam

### Supabase Logs

Monitor edge function performance:
- Response times
- Error rates
- Request volumes

---

## 🔒 **Security Best Practices**

1. ✅ **API Key Protection**: Never commit API keys to git
2. ✅ **Admin-Only Access**: Edge function requires admin role
3. ✅ **Rate Limiting**: Consider adding rate limits to prevent abuse
4. ✅ **Input Validation**: All email inputs are validated
5. ✅ **HTML Sanitization**: Be cautious when allowing HTML editing

---

## 📝 **Next Steps**

### Optional Enhancements

1. **Email Analytics Tracking**:
   - Add UTM parameters to links
   - Track open/click rates
   - Store in database

2. **Email Templates in Database**:
   - Allow admins to save custom templates
   - Version control for templates

3. **Scheduled Emails**:
   - Welcome series for new users
   - Reminder emails for incomplete applications

4. **Bulk Email Support**:
   - Send to multiple applicants at once
   - Preview for each recipient

5. **Reply-To Routing**:
   - Automatically route replies to support system
   - Track email conversations

---

## 🎉 **You're All Set!**

The complete email system is now ready to use. Admins can preview, customize, and send beautiful emails with just a few clicks.

**Test Checklist:**
- [ ] Resend API key configured
- [ ] Edge function deployed
- [ ] Domain verified (production)
- [ ] Test email sent successfully
- [ ] Email preview working
- [ ] Magic links working
- [ ] Approval flow complete
- [ ] Rejection flow complete

**Questions?** Check the troubleshooting section or reach out!
