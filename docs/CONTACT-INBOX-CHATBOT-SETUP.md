# Contact inbox and multilingual AI chat

## Dashboard message replies
- Open Admin Dashboard -> Inbox & Reply (or /admin/manage/messages).
- Open a message and choose Reply. Replies are sent to the visitor by email and saved in cms_message_replies.
- Configure Resend in Vercel Production:
  - RESEND_API_KEY
  - CONTACT_FROM_EMAIL (a sender address/domain verified in Resend)
- CONTACT_TO_EMAIL is optional and sends an email notification for new contact submissions. Messages are still saved to the dashboard inbox without this notification setting.

## Contact form endpoint
The existing HTML form still posts to /contact-submit.php. The Next.js route now handles POST on Vercel, validates fields, ignores the hidden honeypot, limits repeated submissions, and stores accepted messages in cms_messages using LEGACY_DATABASE_URL. The form uses JSON fetch for inline success/error feedback; native form submission redirects back to the contact section.

## AI chat assistant
Configure in Vercel Production:
- OPENAI_API_KEY (required; add this secret in Vercel, never commit it)
- CHATBOT_MODEL (optional; defaults to gpt-6.2-astra)

The widget is embedded in the public portfolio template. It supports multilingual conversation, short context history, web search for current information, and a database-backed rate limit of 10 requests per IP per 10 minutes and a global cap of 100 requests per day. Chat transcripts are not stored in the website database; the browser sends up to 12 recent messages with each request. The API uses the Responses API with store=false. Vercel AI Gateway calls are billed according to the team's Gateway usage; the site-wide daily cap limits request volume.

## Release verification
After adding environment variables, redeploy Production and test:
1. Submit a contact form message; verify it appears under Admin -> Inbox & Reply.
2. Reply from the dashboard; verify the recipient receives the email and the sent reply appears in history.
3. Open the floating chat widget and test Bangla, English, and another language.
4. Check Vercel runtime logs for /contact-submit.php and /api/chat.
