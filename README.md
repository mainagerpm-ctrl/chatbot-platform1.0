# 🤖 Chatbot Builder v3.0

Create AI chatbots and embed them on any website.

## What's included
- **Dashboard** to create and manage multiple chatbots
- **Avatar upload** – give each bot a photo
- **Knowledge base** – upload .txt/.md files so the bot knows your business
- **Calendar integration** – bot shares your booking link automatically
- **Email notifications** – get a transcript after every conversation
- **Embed widget** – one script tag, works on any website

## Requirements
- Node.js v16+ (free at https://nodejs.org)
- OpenAI API key (free at https://platform.openai.com/api-keys)

## Run locally
```
node server.js
```
Then open http://localhost:3000

## Deploy to Railway (free)
1. Upload all files to a GitHub repo
2. Connect repo at railway.app
3. Railway auto-detects Node.js and starts the server

## Email notifications setup
Uses smtp2go.com (free 1,000 emails/month):
1. Sign up at https://www.smtp2go.com/signup
2. Get your API key from the dashboard
3. Verify a sender email address
4. Enter both in the Email tab when editing a chatbot
