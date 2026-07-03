from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import sessions, practitioners, chatbot

# Initialize the FastAPI app
app = FastAPI(
    title="AyurSutra API",
    description="Backend API for managing Panchakarma therapy sessions and AI-powered Ayurvedic guidance.",
    version="1.0.0"
)

# --- CORS (Cross-Origin Resource Sharing) Middleware ---
import os

origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5000",
    "http://127.0.0.1:5000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]

# Add any additional frontend URL from environment
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    origins.append(frontend_url)

# Add Replit domain if present
replit_domain = os.getenv("REPLIT_DEV_DOMAIN", "")
if replit_domain:
    origins.append(f"https://{replit_domain}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Include Routers ---
app.include_router(sessions.router)
app.include_router(practitioners.router)
app.include_router(chatbot.router)

# --- Root Endpoint ---
@app.get("/", tags=["Root"])
def read_root():
    """
    A simple root endpoint to confirm the API is running.
    """
    return {"message": "Welcome to the AyurSutra Backend API!"}