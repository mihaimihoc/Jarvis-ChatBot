# Jarvis-ChatBot: An AI Voice Assistant



JARVIS-Chat is a full-stack web application that emulates the functionality of a voice-activated AI assistant, inspired by Tony Stark's JARVIS. The application uses a wake word to activate a listening mode and responds to user queries using a large language model (LLM). It features a conversational interface, context management to maintain coherent conversations, and user authentication.

![Hey Jarvis](https://uploads.dailydot.com/2025/02/jarvis_memes_usable.jpg?auto=compress&fit=fit&fm=jpg&h=600&w=1200)

---

## ✨ Features

- **Wake Word Detection:** Utilizes the Porcupine wake word engine to listen for a specific phrase (e.g., "Hey Jarvis") to activate speech recognition, ensuring privacy and efficiency.
- **Voice-to-Text:** After the wake word is detected, the Web Speech API transcribes the user's spoken query into text.
- **Conversational AI:** Integrates with a local Ollama server to provide intelligent, contextual responses using a large language model.
- **Advanced Context Management:** A custom `ContextManager` class handles conversation history by creating and updating a running summary. This prevents conversations from becoming too long, reducing API costs and improving response times while maintaining a detailed conversational memory.
- **User Authentication:** Secure registration and login using **Bcrypt** for password hashing and **JWT** for session management.
- **Email Verification:** Handled using **Nodemailer** with **Mailtrap** for testing in development.
- **Database Integration:** Chat history and user accounts are stored in **PostgreSQL** for persistence across sessions.
- **Responsive UI:** A modern SPA built with React for a seamless user experience.
- **Web Searching:** With the help of **Tavily** the AI can search on the web questions about different topics.

---

## 🛠 Technologies Used

### Frontend
- **React** – Core JavaScript library for the UI
- **Vite** – Fast build tool for frontend development and bundling
- **@picovoice/porcupine-react** – React hooks for integrating Porcupine wake word detection
- **Web Speech API** – Browser’s native API for speech recognition
- **CSS** – Styling and layout

### Backend
- **Node.js & Express** – Runtime and framework for the backend API
- **Ollama** – Local framework for running large language models
- **PostgreSQL** – Relational database for storing application data
- **pg** – Node.js driver for PostgreSQL
- **Bcrypt** – Secure password hashing
- **jsonwebtoken** – JWT creation and verification
- **Nodemailer** – Email sending, integrated with **Mailtrap** for development
- **Tavily** - Used to help AI search on the web

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** – [Download & Install](https://nodejs.org/)
- **PostgreSQL** – [Create Account ](https://supabase.com/) to supabase  to get access to Database system
- **Ollama** – [Download & Install](https://ollama.ai/) and get a model (I used Llama3.1)  
- **MailTrap** – [Create Account ](https://mailtrap.io/) to get access to the free mail sending system
- **Tavily** – [Create Account ](https://www.tavily.com/) to get access to the free plan
- **Picovoice** - [Create Account ](https://picovoice.ai/) to get access to porcupine with free plan
  
---
## 😎 Instalation

### 1. Clone the repository
  ```bash
git clone https://github.com/mihaimihoc/Jarvis-ChatBot.git
cd Jarvis-ChatBot
```

### 2. Set up the backend
```bash
cd server
npm install
```
#### 2.1 Complete these variables with their respective links for APIs in server.js
```bash
connectionString: 'postgresql-key(supabase)' //from Supabase
const TAVILY_API_KEY = 'tavily-api-key'; //from Tavily dashoabrd
const transporter = nodemailer.createTransport({
    host: 'sandbox.smtp.mailtrap.io', // from mailtrap
    port: 2525,
    auth: {
        user: 'user',
        pass: 'pass'
    }
});
```
#### 2.2 Create the tables in the database.

**user_accounts**
```bash
create table public.user_accounts (
  user_id uuid not null default gen_random_uuid (),
  username character varying(255) not null,
  email character varying(255) not null,
  password_hash character varying(255) not null,
  is_verified boolean null default false,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint user_accounts_pkey primary key (user_id),
  constraint user_accounts_email_key unique (email),
  constraint user_accounts_username_key unique (username)
) TABLESPACE pg_default;

create trigger user_accounts_updated_at_trigger BEFORE
update on user_accounts for EACH row
execute FUNCTION update_updated_at_column ();
```

**chats**
```bash
create table public.chats (
  chat_id uuid not null default gen_random_uuid (),
  title character varying(255) not null,
  created_by_user_id uuid not null,
  context jsonb null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint chats_pkey primary key (chat_id),
  constraint fk_created_by foreign KEY (created_by_user_id) references user_accounts (user_id) on delete CASCADE
) TABLESPACE pg_default;

create trigger chats_updated_at_trigger BEFORE
update on chats for EACH row
execute FUNCTION update_updated_at_column ();
```

**messages**
```bash
create table public.messages (
  message_id uuid not null default gen_random_uuid (),
  chat_id uuid not null,
  sender_id uuid not null,
  content text not null,
  sent_at timestamp with time zone null default now(),
  constraint messages_pkey primary key (message_id),
  constraint fk_chat foreign KEY (chat_id) references chats (chat_id) on delete CASCADE,
  constraint fk_sender foreign KEY (sender_id) references user_accounts (user_id) on delete CASCADE
) TABLESPACE pg_default;
```

### 3. Set up the frontend
Make sure you are in the main directory (you can open another terminal)
```bash
npm install
```
#### 3.1 Add your porcupine key in the constants.js file
```bash
PORCUPINE_ACCESS_KEY: "porcupine-key" //from Picovoice console
```

### 4. Start the App
#### 4.1 Start the Ollama server by opening the Ollama app
#### 4.2 Start the Backend server
```bash
# Inside the server directory
node server.js
```
#### 4.3 Start the Frontend.
```bash
# Inside the main directory
npm run dev
```
#### If everything was set up correctly, the application will be accessible at:
```bash
http://localhost:3000
```
