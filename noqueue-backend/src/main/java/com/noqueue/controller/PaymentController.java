package com.noqueue.controller;

import com.noqueue.dto.PaymentInitiateRequest;
import com.noqueue.dto.PaymentResponse;
import com.noqueue.dto.PaymentVerifyRequest;
import com.noqueue.service.PaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Payment API — three endpoints covering the full payment lifecycle.
 *
 * <pre>
 * POST /api/v1/payment/initiate        (authenticated user)
 * POST /api/v1/payment/verify          (authenticated user)
 * PUT  /api/v1/orders/{id}/cash-confirm (ADMIN only)
 * </pre>
 */
@RestController
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;

    /**
     * Step 1 — user selects payment method (UPI / QR / CASH) for an order
     * that is in PAYMENT_PENDING state.
     */
    @PostMapping("/api/v1/payment/initiate")
    public ResponseEntity<PaymentResponse> initiatePayment(
            @RequestBody PaymentInitiateRequest request) {
        return ResponseEntity.ok(paymentService.initiatePayment(request));
    }

    /**
     * Step 2 (UPI / QR only) — user submits the transaction ID after paying.
     * Moves order from PAYMENT_PENDING → PAID → READY_TO_PRINT.
     */
    @PostMapping("/api/v1/payment/verify")
    public ResponseEntity<PaymentResponse> verifyPayment(
            @RequestBody PaymentVerifyRequest request) {
        return ResponseEntity.ok(paymentService.verifyPayment(request));
    }

    /**
     * Admin action — confirm cash collection for a CASH_PENDING order.
     * Moves order CASH_PENDING → PAID → READY_TO_PRINT.
     */
    @PutMapping("/api/v1/orders/{id}/cash-confirm")
    public ResponseEntity<PaymentResponse> confirmCashPayment(
            @PathVariable Long id) {
        return ResponseEntity.ok(paymentService.confirmCashPayment(id));
    }
}
