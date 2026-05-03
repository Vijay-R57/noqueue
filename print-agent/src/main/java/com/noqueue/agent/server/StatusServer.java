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
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.atomic.AtomicBoolean;

import org.apache.pdfbox.printing.PDFPrintable;
import org.apache.pdfbox.printing.Scaling;

public class StatusServer {

    private static final int PORT = 9090;
    private static final String TEST_PDF_PATH = "temp/test-print.pdf";
    private static final DateTimeFormatter TIMESTAMP_FMT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZoneId.systemDefault());

    private final PrinterService printerService;
    private final AtomicBoolean isPrinting;
    private HttpServer server;

    public StatusServer(PrinterService printerService, AtomicBoolean isPrinting) {
        this.printerService = printerService;
        this.isPrinting = isPrinting;
    }

    public void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress(PORT), 0);
        server.createContext("/printer/status", this::handleStatus);
        server.createContext("/printer/test",   this::handleTestPrint);
        server.createContext("/printer/list",   this::handlePrinterList);
        server.setExecutor(null);
        server.start();
        LoggerUtil.info("[STATUS-SERVER] Listening on http://localhost:" + PORT);
        LoggerUtil.info("[STATUS-SERVER]   GET  /printer/status");
        LoggerUtil.info("[STATUS-SERVER]   GET  /printer/list");
        LoggerUtil.info("[STATUS-SERVER]   POST /printer/test");
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

        boolean online = printerService.isPrinterAvailable();
        String name    = printerService.getDefaultPrinterName();
        boolean printing = isPrinting.get();

        String json = String.format(
            "{\"name\":\"%s\",\"status\":\"%s\",\"isPrinting\":%b,\"lastChecked\":\"%s\"}",
            escape(name),
            online ? "ONLINE" : "OFFLINE",
            printing,
            Instant.now().toString()
        );

        sendJson(exchange, 200, json);
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

        PrintService[] services = PrintServiceLookup.lookupPrintServices(null, null);
        LoggerUtil.info("[PRINTER-LIST] Returning " + services.length + " printer(s).");

        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < services.length; i++) {
            sb.append("\"").append(escape(services[i].getName())).append("\"");
            if (i < services.length - 1) sb.append(",");
        }
        sb.append("]");

        sendJson(exchange, 200, sb.toString());
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
    private void addCorsHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().add("Access-Control-Allow-Origin",  "*");
        exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");
        exchange.getResponseHeaders().add("Content-Type", "application/json");
    }

    private void sendJson(HttpExchange exchange, int code, String json) throws IOException {
        byte[] bytes = json.getBytes();
        exchange.sendResponseHeaders(code, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private String escape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
    }
}
