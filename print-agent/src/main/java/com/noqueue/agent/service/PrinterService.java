package com.noqueue.agent.service;

import com.noqueue.agent.model.Order;
import com.noqueue.agent.util.LoggerUtil;
import com.noqueue.agent.config.Config;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.printing.PDFPrintable;
import org.apache.pdfbox.printing.Scaling;

import javax.print.*;
import javax.print.attribute.HashPrintRequestAttributeSet;
import javax.print.attribute.PrintRequestAttributeSet;
import javax.print.attribute.standard.Sides;
import java.awt.print.PrinterJob;
import java.io.File;

public class PrinterService {

    // ── List all printers on the system ───────────────────────────────────
    public void listAllPrinters() {
        LoggerUtil.info("[PRINTER] Available printers on this system:");
        PrintService[] services = PrintServiceLookup.lookupPrintServices(null, null);
        if (services.length == 0) {
            LoggerUtil.info("[PRINTER]   (none found — install a printer driver)");
        }
        for (PrintService svc : services) {
            LoggerUtil.info("[PRINTER]   - \"" + svc.getName() + "\"");
        }
    }

    /**
     * Resolves the target PrintService:
     * - If Config.PRINTER_NAME is set → partial case-insensitive match across all printers
     * - If empty → falls back to OS default
     * Logs all available printers if the target is not found.
     */
    public PrintService resolvePrinter() {
        if (!Config.PRINTER_NAME.isEmpty()) {
            PrintService[] allServices = PrintServiceLookup.lookupPrintServices(null, null);
            for (PrintService svc : allServices) {
                if (svc.getName().toLowerCase().contains(Config.PRINTER_NAME.toLowerCase())) {
                    return svc;
                }
            }
            LoggerUtil.error("[PRINTER] No printer matching: \"" + Config.PRINTER_NAME + "\"");
            listAllPrinters();
            return null;
        }

        // Fallback to OS default
        PrintService defaultService = PrintServiceLookup.lookupDefaultPrintService();
        if (defaultService != null) {
            LoggerUtil.info("[PRINTER] PRINTER_NAME not configured. Using default: " + defaultService.getName());
        }
        return defaultService;
    }

    public boolean isPrinterAvailable() {
        return resolvePrinter() != null;
    }

    public String getDefaultPrinterName() {
        PrintService svc = resolvePrinter();
        return svc != null ? svc.getName() : "None";
    }

    /**
     * Prints a PDF file using Apache PDFBox + PrinterJob.
     *
     * Flow:
     *   1. Load PDF with PDFBox (handles all PDF versions reliably)
     *   2. Get a PrinterJob from AWT
     *   3. Assign the resolved PrintService (physical printer, not virtual)
     *   4. Set PDFPrintable with FIT_TO_PAGE scaling
     *   5. Apply duplex/simplex attribute
     *   6. Call job.print() — blocks until the spooler accepts the job
     *   7. Close PDDocument
     */
    public void printDocument(Order order, File file) throws Exception {
        PrintService printer = resolvePrinter();
        if (printer == null) {
            throw new Exception(
                "No target printer found. Set PRINTER_NAME in Config.java or as env var PRINTER_NAME."
            );
        }

        LoggerUtil.info("[PRINTER] Printer    : " + printer.getName());
        LoggerUtil.info("[PRINTER] File       : " + file.getAbsolutePath() + " (" + file.length() + " bytes)");
        LoggerUtil.info("[PRINTER] Print Type : " + order.getPrintType());
        LoggerUtil.info("[PRINTER] Loading PDF with PDFBox...");

        PDDocument document = Loader.loadPDF(file);
        LoggerUtil.info("[PRINTER] PDF loaded. Pages: " + document.getNumberOfPages());

        try {
            // Build PrinterJob and assign the resolved physical PrintService
            PrinterJob job = PrinterJob.getPrinterJob();
            job.setPrintService(printer);

            // PDFPrintable: renders each page at the correct resolution
            // Scaling.ACTUAL_SIZE to preserve original layout;
            // use Scaling.SCALE_TO_FIT if you want to fill the paper
            job.setPrintable(new PDFPrintable(document, Scaling.SCALE_TO_FIT));

            // Duplex / simplex
            PrintRequestAttributeSet attrs = new HashPrintRequestAttributeSet();
            if ("DOUBLE".equalsIgnoreCase(order.getPrintType())) {
                attrs.add(Sides.TWO_SIDED_LONG_EDGE);
                LoggerUtil.info("[PRINTER] Mode: Duplex (Double-Sided)");
            } else {
                attrs.add(Sides.ONE_SIDED);
                LoggerUtil.info("[PRINTER] Mode: Simplex (Single-Sided)");
            }

            LoggerUtil.info("[PRINTER] Submitting job to spooler...");
            job.print(attrs);
            LoggerUtil.info("[PRINTER] Job accepted by spooler successfully.");

        } finally {
            // Always close the document to release file handles
            document.close();
            LoggerUtil.info("[PRINTER] PDDocument closed.");
        }
    }
}
