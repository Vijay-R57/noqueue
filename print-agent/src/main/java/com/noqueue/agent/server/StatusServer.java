package com.noqueue.agent.server;

import com.noqueue.agent.service.PrinterService;
import com.noqueue.agent.util.LoggerUtil;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicBoolean;

public class StatusServer {

    private static final int PORT = 9090;

    private final PrinterService printerService;
    // Shared flag — QueueWorker sets this true/false around each print job
    private final AtomicBoolean isPrinting;
    private HttpServer server;

    public StatusServer(PrinterService printerService, AtomicBoolean isPrinting) {
        this.printerService = printerService;
        this.isPrinting = isPrinting;
    }

    public void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress(PORT), 0);

        // GET /printer/status
        server.createContext("/printer/status", this::handleStatus);

        // Simple CORS pre-flight for Next.js frontend on a different port
        server.setExecutor(null);
        server.start();
        LoggerUtil.info("[STATUS-SERVER] Listening on http://localhost:" + PORT + "/printer/status");
    }

    public void stop() {
        if (server != null) {
            server.stop(1);
            LoggerUtil.info("[STATUS-SERVER] Stopped.");
        }
    }

    private void handleStatus(HttpExchange exchange) throws IOException {
        // Allow cross-origin requests from the Next.js dev server
        exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().add("Content-Type", "application/json");

        if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(204, -1);
            return;
        }

        boolean online = printerService.isPrinterAvailable();
        String printerName = printerService.getDefaultPrinterName();
        boolean printing = isPrinting.get();

        String json = String.format(
            "{\"name\":\"%s\",\"status\":\"%s\",\"isPrinting\":%b,\"lastChecked\":\"%s\"}",
            escape(printerName),
            online ? "ONLINE" : "OFFLINE",
            printing,
            Instant.now().toString()
        );

        byte[] bytes = json.getBytes();
        exchange.sendResponseHeaders(200, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    // Minimal JSON string escaping
    private String escape(String s) {
        return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
