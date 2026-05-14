package com.noqueue.agent.server;

import com.noqueue.agent.service.PrinterService;
import com.noqueue.agent.util.LoggerUtil;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;

import javax.print.PrintService;
import javax.print.PrintServiceLookup;
import java.awt.print.PrinterJob;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

import org.apache.pdfbox.printing.PDFPrintable;
import org.apache.pdfbox.printing.Scaling;

public class StatusServer {

    private static final int PORT = 9090;
    private static final String TEST_PDF_PATH = "temp/test-print.pdf";
    private static final DateTimeFormatter TIMESTAMP_FMT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZoneId.systemDefault());

    /** Virtual/software printer keywords — filtered out of /printer/list */
    private static final Set<String> VIRTUAL_KEYWORDS = Set.of(
        "microsoft print to pdf",
        "microsoft xps document writer",
        "fax",
        "onenote",
        "send to onenote",
        "xps document writer",
        "adobe pdf",
        "cutepdf",
        "pdf creator",
        "bullzip",
        "foxit"
    );

    private final PrinterService printerService;
    private final AtomicBoolean isPrinting;
    private final AtomicBoolean isPaused;
    private HttpServer server;

    public StatusServer(PrinterService printerService, AtomicBoolean isPrinting, AtomicBoolean isPaused) {
        this.printerService = printerService;
        this.isPrinting = isPrinting;
        this.isPaused = isPaused;
    }

    /** Returns the shared pause flag so QueueWorker can observe it. */
    public AtomicBoolean getPausedFlag() {
        return isPaused;
    }

    public void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress(PORT), 0);
        server.createContext("/printer/status",     this::handleStatus);
        server.createContext("/printer/test",       this::handleTestPrint);
        server.createContext("/printer/list",       this::handlePrinterList);
        server.createContext("/printer/connect",    this::handleConnect);
        server.createContext("/printer/disconnect", this::handleDisconnect);
        server.createContext("/printer/pause",      this::handlePause);
        server.createContext("/printer/resume",     this::handleResume);
        server.setExecutor(null);
        server.start();
        LoggerUtil.info("[STATUS-SERVER] Listening on http://localhost:" + PORT);
        LoggerUtil.info("[STATUS-SERVER]   GET  /printer/status");
        LoggerUtil.info("[STATUS-SERVER]   GET  /printer/list");
        LoggerUtil.info("[STATUS-SERVER]   POST /printer/test");
        LoggerUtil.info("[STATUS-SERVER]   POST /printer/connect");
        LoggerUtil.info("[STATUS-SERVER]   POST /printer/disconnect");
        LoggerUtil.info("[STATUS-SERVER]   POST /printer/pause");
        LoggerUtil.info("[STATUS-SERVER]   POST /printer/resume");
    }

    public void stop() {
        if (server != null) {
            server.stop(1);
            LoggerUtil.info("[STATUS-SERVER] Stopped.");
        }
    }

    // ── GET /printer/status ────────────────────────────────────────────────
    private void handleStatus(HttpExchange exchange) throws IOException {
        addCorsHeaders(exchange);

        if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(204, -1);
            return;
        }

        boolean online       = printerService.isPrinterAvailable();
        String  name         = printerService.getDefaultPrinterName();
        boolean printing     = isPrinting.get();
        boolean paused       = isPaused.get();
        // activePrinter: the runtime-selected printer (null = using config/default)
        String activePrinter = printerService.getActivePrinterName();

        String json = String.format(
            "{\"name\":\"%s\",\"status\":\"%s\",\"isPrinting\":%b,\"isPaused\":%b,\"lastChecked\":\"%s\",\"activePrinter\":%s}",
            escape(name),
            online ? "ONLINE" : "OFFLINE",
            printing,
            paused,
            Instant.now().toString(),
            activePrinter != null ? "\"" + escape(activePrinter) + "\"" : "null"
        );

        sendJson(exchange, 200, json);
    }

    // ── POST /printer/connect ──────────────────────────────────────────────
    private void handleConnect(HttpExchange exchange) throws IOException {
        addCorsHeaders(exchange);

        if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(204, -1);
            return;
        }

        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendJson(exchange, 405, "{\"error\":\"Method not allowed. Use POST.\"}");
            return;
        }

        // Read request body
        String body;
        try (InputStream is = exchange.getRequestBody()) {
            body = new String(is.readAllBytes(), StandardCharsets.UTF_8).trim();
        }

        // Parse printerName from JSON: {"printerName":"<name>"}
        String printerName = extractJsonString(body, "printerName");
        if (printerName == null || printerName.isBlank()) {
            sendJson(exchange, 400, "{\"status\":\"failed\",\"message\":\"Missing printerName in request body\"}");
            return;
        }

        LoggerUtil.info("[CONNECT] Request to connect printer: \"" + printerName + "\"");
        String matched = printerService.setActivePrinter(printerName);

        if (matched != null) {
            LoggerUtil.info("[CONNECT] Successfully connected to: \"" + matched + "\"");
            sendJson(exchange, 200,
                "{\"status\":\"connected\",\"printer\":\"" + escape(matched) + "\"}");
        } else {
            LoggerUtil.error("[CONNECT] Printer not found: \"" + printerName + "\"");
            sendJson(exchange, 404,
                "{\"status\":\"failed\",\"message\":\"Printer not found: " + escape(printerName) + "\"}");
        }
    }

    // ── POST /printer/test ─────────────────────────────────────────────────
    private void handleTestPrint(HttpExchange exchange) throws IOException {
        addCorsHeaders(exchange);

        if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(204, -1);
            return;
        }

        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendJson(exchange, 405, "{\"error\":\"Method not allowed. Use POST.\"}");
            return;
        }

        LoggerUtil.info("[TEST-PRINT] Test print requested by admin.");

        if (!printerService.isPrinterAvailable()) {
            LoggerUtil.error("[TEST-PRINT] No printer found. Cannot run test print.");
            sendJson(exchange, 503, "{\"status\":\"failed\",\"reason\":\"No printer available\"}");
            return;
        }

        try {
            // 1. Generate test PDF in memory
            File testFile = generateTestPdf();
            LoggerUtil.info("[TEST-PRINT] Test PDF generated: " + testFile.getAbsolutePath());

            // 2. Resolve printer
            PrintService printer = printerService.resolvePrinter();
            if (printer == null) {
                sendJson(exchange, 503, "{\"status\":\"failed\",\"reason\":\"Printer not found\"}");
                return;
            }

            // 3. Print using PDFBox + PrinterJob
            LoggerUtil.info("[TEST-PRINT] Sending to printer: " + printer.getName());
            PDDocument document = org.apache.pdfbox.Loader.loadPDF(testFile);
            try {
                PrinterJob job = PrinterJob.getPrinterJob();
                job.setPrintService(printer);
                job.setPrintable(new PDFPrintable(document, Scaling.SCALE_TO_FIT));
                job.print();
            } finally {
                document.close();
            }

            LoggerUtil.info("[TEST-PRINT] Test print submitted successfully.");
            sendJson(exchange, 200, "{\"status\":\"success\",\"printer\":\"" + escape(printer.getName()) + "\"}");

        } catch (Exception e) {
            LoggerUtil.error("[TEST-PRINT] Test print failed", e);
            sendJson(exchange, 500,
                "{\"status\":\"failed\",\"reason\":\"" + escape(e.getMessage()) + "\"}");
        }
    }

    // ── GET /printer/list ──────────────────────────────────────────────────
    private void handlePrinterList(HttpExchange exchange) throws IOException {
        addCorsHeaders(exchange);

        if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(204, -1);
            return;
        }

        PrintService[] all = PrintServiceLookup.lookupPrintServices(null, null);
        List<String> physical = new ArrayList<>();
        for (PrintService svc : all) {
            if (!isVirtualPrinter(svc.getName())) {
                physical.add(svc.getName());
            }
        }
        LoggerUtil.info("[PRINTER-LIST] " + physical.size() + " physical printer(s) (" + all.length + " total, virtual filtered out).");

        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < physical.size(); i++) {
            sb.append("\"").append(escape(physical.get(i))).append("\"");
            if (i < physical.size() - 1) sb.append(",");
        }
        sb.append("]");

        sendJson(exchange, 200, sb.toString());
    }

    // ── POST /printer/disconnect ───────────────────────────────────────────
    private void handleDisconnect(HttpExchange exchange) throws IOException {
        addCorsHeaders(exchange);

        if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(204, -1);
            return;
        }

        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendJson(exchange, 405, "{\"error\":\"Method not allowed. Use POST.\"}");
            return;
        }

        printerService.clearActivePrinter();
        LoggerUtil.info("[DISCONNECT] Active printer cleared — falling back to OS default.");
        sendJson(exchange, 200, "{\"status\":\"disconnected\"}");
    }

    // ── POST /printer/pause ────────────────────────────────────────────────
    private void handlePause(HttpExchange exchange) throws IOException {
        addCorsHeaders(exchange);

        if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(204, -1);
            return;
        }

        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendJson(exchange, 405, "{\"error\":\"Method not allowed. Use POST.\"}");
            return;
        }

        isPaused.set(true);
        LoggerUtil.info("[QUEUE] Queue PAUSED by admin.");
        sendJson(exchange, 200, "{\"status\":\"paused\"}");
    }

    // ── POST /printer/resume ───────────────────────────────────────────────
    private void handleResume(HttpExchange exchange) throws IOException {
        addCorsHeaders(exchange);

        if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(204, -1);
            return;
        }

        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendJson(exchange, 405, "{\"error\":\"Method not allowed. Use POST.\"}");
            return;
        }

        isPaused.set(false);
        LoggerUtil.info("[QUEUE] Queue RESUMED by admin.");
        sendJson(exchange, 200, "{\"status\":\"resumed\"}");
    }

    // ── Generate a simple test PDF using PDFBox ────────────────────────────
    private File generateTestPdf() throws IOException {
        File dir = new File("temp");
        if (!dir.exists()) dir.mkdirs();

        File file = new File(TEST_PDF_PATH);

        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);

            try (PDPageContentStream content = new PDPageContentStream(doc, page)) {
                // ── Title ──
                content.beginText();
                content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 28);
                content.newLineAtOffset(60, 720);
                content.showText("NoQueue - Test Print");
                content.endText();

                // ── Divider line ──
                content.setLineWidth(1.5f);
                content.moveTo(60, 710);
                content.lineTo(535, 710);
                content.stroke();

                // ── Body ──
                content.beginText();
                content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 14);
                content.newLineAtOffset(60, 685);
                content.showText("If you can read this, your printer is working correctly.");
                content.endText();

                content.beginText();
                content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                content.newLineAtOffset(60, 655);
                content.showText("Timestamp: " + TIMESTAMP_FMT.format(Instant.now()));
                content.endText();

                content.beginText();
                content.newLineAtOffset(60, 635);
                content.showText("Printer Agent: NoQueue Print Agent v1.2");
                content.endText();
            }

            doc.save(file);
        }

        return file;
    }

    // ── Helpers ────────────────────────────────────────────────────────────
    /** Returns true if the printer name matches any known virtual/software printer. */
    private boolean isVirtualPrinter(String name) {
        if (name == null) return true;
        String lower = name.toLowerCase();
        return VIRTUAL_KEYWORDS.stream().anyMatch(lower::contains);
    }

    private void addCorsHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().add("Access-Control-Allow-Origin",  "*");
        exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");
        exchange.getResponseHeaders().add("Content-Type", "application/json");
    }

    private void sendJson(HttpExchange exchange, int code, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(code, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private String escape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
    }

    /**
     * Minimal JSON string extractor — pulls the value of a given key from a flat JSON object.
     * Avoids adding a JSON library dependency just for this small use-case.
     */
    private String extractJsonString(String json, String key) {
        String search = "\"" + key + "\"";
        int keyIdx = json.indexOf(search);
        if (keyIdx < 0) return null;
        int colonIdx = json.indexOf(':', keyIdx + search.length());
        if (colonIdx < 0) return null;
        int quoteStart = json.indexOf('"', colonIdx + 1);
        if (quoteStart < 0) return null;
        int quoteEnd = json.indexOf('"', quoteStart + 1);
        if (quoteEnd < 0) return null;
        return json.substring(quoteStart + 1, quoteEnd);
    }
}
