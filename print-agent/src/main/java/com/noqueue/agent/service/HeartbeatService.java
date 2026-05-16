package com.noqueue.agent.service;

import com.noqueue.agent.config.Config;
import com.noqueue.agent.util.LoggerUtil;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Sends a POST /api/v1/printer/heartbeat every 5 seconds to the backend.
 * The backend stores the latest heartbeat and the Admin Dashboard polls it
 * to show live agent/printer status without a direct browser→localhost connection.
 */
public class HeartbeatService {

    private static final long HEARTBEAT_INTERVAL_SEC = 5;

    private final PrinterService printerService;
    private final AtomicBoolean isPrinting;
    private final AtomicBoolean isPaused;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "heartbeat-thread");
        t.setDaemon(true);
        return t;
    });

    public HeartbeatService(PrinterService printerService,
                            AtomicBoolean isPrinting,
                            AtomicBoolean isPaused) {
        this.printerService = printerService;
        this.isPrinting     = isPrinting;
        this.isPaused       = isPaused;
    }

    public void start() {
        scheduler.scheduleAtFixedRate(this::sendHeartbeat, 1, HEARTBEAT_INTERVAL_SEC, TimeUnit.SECONDS);
        LoggerUtil.info("[HEARTBEAT] Service started — pinging backend every " + HEARTBEAT_INTERVAL_SEC + "s");
    }

    public void stop() {
        scheduler.shutdownNow();
        LoggerUtil.info("[HEARTBEAT] Service stopped.");
    }

    private void sendHeartbeat() {
        try {
            boolean printerConnected = printerService.isPrinterAvailable();
            String  printerName      = printerService.getDefaultPrinterName();
            String  printerState;

            if (isPrinting.get())    printerState = "PRINTING";
            else if (isPaused.get()) printerState = "PAUSED";
            else if (!printerConnected) printerState = "OFFLINE";
            else                     printerState = "IDLE";

            String json = String.format(
                "{\"agentOnline\":true,\"printerName\":\"%s\",\"printerConnected\":%b," +
                "\"printerState\":\"%s\",\"lastPing\":\"%s\"}",
                escape(printerName),
                printerConnected,
                printerState,
                Instant.now().toString()
            );

            URL url = new URL(Config.BASE_URL + "/printer/heartbeat");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(3000);
            conn.setReadTimeout(3000);
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Accept", "application/json");
            if (!Config.AUTH_TOKEN.isEmpty()) {
                conn.setRequestProperty("Authorization", "Bearer " + Config.AUTH_TOKEN);
            }
            conn.setDoOutput(true);

            byte[] body = json.getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body);
            }

            int code = conn.getResponseCode();
            if (code != 200 && code != 204) {
                LoggerUtil.info("[HEARTBEAT] Backend returned HTTP " + code);
            }
            conn.disconnect();

        } catch (Exception e) {
            // Suppress repeated logs — backend may be temporarily unreachable
            LoggerUtil.info("[HEARTBEAT] Could not reach backend: " + e.getMessage() + " — will retry.");
        }
    }

    private String escape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
