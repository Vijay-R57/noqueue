package com.noqueue.agent.service;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.noqueue.agent.config.Config;
import com.noqueue.agent.model.Order;
import com.noqueue.agent.util.LoggerUtil;

import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class ApiService {

    private final Gson gson = new Gson();
    // Guard flag: prevents infinite login loops if credentials are wrong
    private boolean refreshInProgress = false;

    // ── Auto-login: POST /auth/login → store JWT ──────────────────────────
    public boolean login() {
        LoggerUtil.info("[AUTH] Logging in as: " + Config.AGENT_EMAIL);
        try {
            URL url = new URL(Config.BASE_URL + "/auth/login");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);

            String body = "{\"email\":\"" + Config.AGENT_EMAIL + "\",\"password\":\"" + Config.AGENT_PASSWORD + "\"}";
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.getBytes(StandardCharsets.UTF_8));
            }

            int code = conn.getResponseCode();
            if (code == 200) {
                InputStreamReader reader = new InputStreamReader(conn.getInputStream());
                JsonObject json = gson.fromJson(reader, JsonObject.class);
                reader.close();

                if (json.has("token")) {
                    Config.AUTH_TOKEN = json.get("token").getAsString();
                    LoggerUtil.info("[AUTH] Login successful. Token acquired.");
                    return true;
                } else {
                    LoggerUtil.error("[AUTH] Login response missing 'token' field.");
                    return false;
                }
            } else {
                LoggerUtil.error("[AUTH] Login failed. HTTP " + code
                        + ". Check AGENT_EMAIL / AGENT_PASSWORD in Config.java");
                return false;
            }
        } catch (Exception e) {
            LoggerUtil.error("[AUTH] Login exception", e);
            return false;
        }
    }

    // ── Attach Authorization header ────────────────────────────────────────
    private void addAuthHeader(HttpURLConnection conn) {
        if (!Config.AUTH_TOKEN.isEmpty()) {
            conn.setRequestProperty("Authorization", "Bearer " + Config.AUTH_TOKEN);
        }
    }

    /**
     * Handle 401 responses with automatic token refresh.
     * Calls login() once, then signals the caller to retry.
     * Returns true if a refresh was attempted and succeeded.
     * The refreshInProgress flag prevents infinite retry loops.
     */
    private boolean tryRefreshToken() {
        if (refreshInProgress) {
            LoggerUtil.error("[AUTH] Token refresh already attempted. Skipping to prevent loop.");
            return false;
        }
        LoggerUtil.info("[AUTH] Received 401. Attempting token refresh...");
        refreshInProgress = true;
        boolean ok = login();
        refreshInProgress = false;
        if (ok) {
            LoggerUtil.info("[AUTH] Token refreshed. Retrying request...");
        } else {
            LoggerUtil.error("[AUTH] Token refresh failed. Agent will retry next poll cycle.");
        }
        return ok;
    }

    // ── GET /orders/next ──────────────────────────────────────────────────
    public Order fetchNextJob() {
        return fetchNextJobInternal(false);
    }

    private Order fetchNextJobInternal(boolean isRetry) {
        LoggerUtil.info("[API] Fetching job from backend...");
        try {
            URL url = new URL(Config.BASE_URL + "/orders/next");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Accept", "application/json");
            addAuthHeader(conn);

            int code = conn.getResponseCode();

            if (code == 401) {
                if (!isRetry && tryRefreshToken()) {
                    return fetchNextJobInternal(true); // retry once with fresh token
                }
                LoggerUtil.error("[API] Unauthorized access. Check AUTH_TOKEN.");
                return null;
            }

            if (code == 403) {
                LoggerUtil.error("[API] Forbidden (403). Agent account may lack permissions.");
                return null;
            }

            if (code == 204) {
                return null; // Queue is empty
            }

            if (code == 200) {
                InputStreamReader reader = new InputStreamReader(conn.getInputStream());
                Order order = gson.fromJson(reader, Order.class);
                reader.close();

                if (order != null && order.getId() != null) {
                    LoggerUtil.info("[API] Job received: ID " + order.getId()
                            + " | Token: " + order.getTokenNumber()
                            + " | Type: " + order.getPrintType()
                            + " | Pages: " + order.getPages());
                    return order;
                }
                return null;
            }

            LoggerUtil.error("[API] Unexpected HTTP " + code + " fetching next job.");
            return null;

        } catch (Exception e) {
            LoggerUtil.error("[API] Exception fetching next job", e);
            return null;
        }
    }

    // ── PUT /orders/{id}/status?status=XYZ ───────────────────────────────
    public boolean updateJobStatus(Long orderId, String status) {
        return updateJobStatusInternal(orderId, status, false);
    }

    private boolean updateJobStatusInternal(Long orderId, String status, boolean isRetry) {
        LoggerUtil.info("[API] Updating status to " + status + " for Order #" + orderId);
        try {
            URL url = new URL(Config.BASE_URL + "/orders/" + orderId + "/status?status=" + status);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("PUT");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Accept", "application/json");
            addAuthHeader(conn);
            conn.setDoOutput(true);
            try (OutputStream os = conn.getOutputStream()) {
                os.write("{}".getBytes(StandardCharsets.UTF_8));
            }

            int code = conn.getResponseCode();

            if (code == 401) {
                if (!isRetry && tryRefreshToken()) {
                    return updateJobStatusInternal(orderId, status, true); // retry once
                }
                LoggerUtil.error("[API] Unauthorized access updating status. Check AUTH_TOKEN.");
                return false;
            }

            if (code == 403) {
                LoggerUtil.error("[API] Forbidden (403) updating status for Order #" + orderId);
                return false;
            }

            if (code == 200 || code == 204) {
                LoggerUtil.info("[API] Status updated to " + status + " for Order #" + orderId);
                return true;
            }

            LoggerUtil.error("[API] Failed to update status. HTTP " + code);
            return false;

        } catch (Exception e) {
            LoggerUtil.error("[API] Exception updating status for Order #" + orderId, e);
            return false;
        }
    }
}
