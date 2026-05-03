package com.noqueue.agent.config;

import java.io.File;

public class Config {
    // ── Backend URL ────────────────────────────────────────────────────────
    public static final String BASE_URL = "http://localhost:8080/api/v1";

    // ── Polling interval in milliseconds ──────────────────────────────────
    public static final long POLLING_INTERVAL_MS = 5000;

    // ── Temp file storage directory ────────────────────────────────────────
    public static final String TEMP_DIR = "temp";

    // ── Target printer name (partial match, case-insensitive) ──────────────
    // Leave empty "" to use the OS default printer (not recommended in production)
    // Set to part of your printer name e.g. "HP LaserJet" or "Canon LBP"
    // Virtual printers like "Microsoft Print to PDF" will be REJECTED if this is set
    public static final String PRINTER_NAME = System.getenv("PRINTER_NAME") != null
            ? System.getenv("PRINTER_NAME")
            : ""; // <-- Set your printer name here

    // ── JWT Auth Token ─────────────────────────────────────────────────────
    // Set this to the token you receive from POST /api/v1/auth/login
    // You can also pass it via environment variable: AGENT_TOKEN
    public static String AUTH_TOKEN = System.getenv("AGENT_TOKEN") != null
            ? System.getenv("AGENT_TOKEN")
            : "";  // <-- Paste your JWT token here if not using env var

    // ── Agent Login Credentials (for auto-login on startup) ────────────────
    // Create a dedicated agent/admin account in your backend for this
    public static final String AGENT_EMAIL    = "agent@noqueue.com";
    public static final String AGENT_PASSWORD = "agent_secret_123";

    static {
        File tempDir = new File(TEMP_DIR);
        if (!tempDir.exists()) {
            tempDir.mkdirs();
        }
    }
}
