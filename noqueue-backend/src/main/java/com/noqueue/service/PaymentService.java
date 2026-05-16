package com.noqueue.service;

import com.noqueue.dto.PaymentInitiateRequest;
import com.noqueue.dto.PaymentResponse;
import com.noqueue.dto.PaymentVerifyRequest;
import com.noqueue.model.Order;
import com.noqueue.model.OrderStatus;
import com.noqueue.model.PaymentMethod;
import com.noqueue.model.PaymentStatus;
import com.noqueue.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Handles all payment lifecycle logic for the NoQueue payment-first flow.
 *
 * <pre>
 * createOrder() → PAYMENT_PENDING
 *   ├─ initiatePayment(UPI/QR) → order keeps PAYMENT_PENDING, method recorded
 *   │     └─ verifyPayment(txnId)  → PAID → READY_TO_PRINT  (enters queue)
 *   └─ initiatePayment(CASH)   → CASH_PENDING
 *         └─ confirmCashPayment() → PAID → READY_TO_PRINT  (admin confirms)
 * </pre>
 */
@Service
@RequiredArgsConstructor
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    private final OrderRepository   orderRepository;
    private final OrderEventService orderEventService;   // SSE broadcaster

    // ── Initiate ─────────────────────────────────────────────────────────────

    /**
     * Records the chosen payment method on the order.
     * <ul>
     *   <li>UPI / QR  → order stays PAYMENT_PENDING; returns QR / UPI deep-link data.</li>
     *   <li>CASH       → order moves to CASH_PENDING immediately.</li>
     * </ul>
     */
    @Transactional
    public PaymentResponse initiatePayment(PaymentInitiateRequest request) {
        Order order = findAndValidatePendingOrder(request.getOrderId());

        order.setPaymentMethod(request.getPaymentMethod());

        String qrData = null;

        if (request.getPaymentMethod() == PaymentMethod.CASH) {
            // Cash on Receive path → mark CASH_PENDING right away
            order.setStatus(OrderStatus.CASH_PENDING);
            order.setPaymentStatus(PaymentStatus.PENDING);
            log.info("[PAYMENT] Order #{} → CASH_PENDING (Cash on Receive selected)", order.getId());

        } else if (request.getPaymentMethod() == PaymentMethod.QR) {
            // QR path → generate a mock QR payload (replace with real UPI QR in prod)
            qrData = buildUpiQrString(order);
            log.info("[PAYMENT] Order #{} → QR payment initiated", order.getId());

        } else {
            // UPI deep-link path
            qrData = buildUpiDeepLink(order, request.getUpiId());
            log.info("[PAYMENT] Order #{} → UPI payment initiated (upiId={})",
                    order.getId(), request.getUpiId());
        }

        Order saved = orderRepository.save(order);
        broadcastPaymentEvent(saved);

        return buildResponse(saved, qrData,
                request.getPaymentMethod() == PaymentMethod.CASH
                        ? "Cash on Receive selected. Proceed to the shop for payment."
                        : "Payment initiated. Complete the payment and then verify.");
    }

    // ── Verify (UPI / QR) ─────────────────────────────────────────────────────

    /**
     * Called once the user has paid via UPI / QR and provides the transaction ID.
     * Marks order PAID and moves it to READY_TO_PRINT (enters the queue).
     */
    @Transactional
    public PaymentResponse verifyPayment(PaymentVerifyRequest request) {
        Order order = orderRepository.findById(request.getOrderId())
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + request.getOrderId()));

        if (order.getStatus() != OrderStatus.PAYMENT_PENDING) {
            throw new IllegalStateException(
                    "Order " + order.getId() + " is not in PAYMENT_PENDING state (current: " + order.getStatus() + ")");
        }

        if (order.getPaymentMethod() == PaymentMethod.CASH) {
            throw new IllegalStateException("Cannot verify a CASH order via this endpoint. Use /cash-confirm.");
        }

        // In production, call the actual payment gateway SDK here.
        // For now we accept the transactionId as-is (mock verification).
        order.setTransactionId(request.getTransactionId());
        order.setAmountPaid(order.getPrice());
        order.setPaymentStatus(PaymentStatus.PAID);
        order.setStatus(OrderStatus.READY_TO_PRINT);   // ← enters the print queue

        Order saved = orderRepository.save(order);
        broadcastPaymentEvent(saved);

        log.info("[PAYMENT] Order #{} PAID via {} | txnId={} → READY_TO_PRINT",
                saved.getId(), saved.getPaymentMethod(), saved.getTransactionId());

        return buildResponse(saved, null, "Payment verified! Your order has entered the print queue.");
    }

    // ── Cash Confirm (admin) ─────────────────────────────────────────────────

    /**
     * Admin endpoint: confirms that cash has been collected for a CASH_PENDING order.
     * Marks order PAID and moves it to READY_TO_PRINT.
     */
    @Transactional
    public PaymentResponse confirmCashPayment(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderId));

        if (order.getStatus() != OrderStatus.CASH_PENDING) {
            throw new IllegalStateException(
                    "Order " + orderId + " is not in CASH_PENDING state (current: " + order.getStatus() + ")");
        }

        order.setAmountPaid(order.getPrice());
        order.setPaymentStatus(PaymentStatus.PAID);
        order.setStatus(OrderStatus.READY_TO_PRINT);   // ← enters the print queue

        Order saved = orderRepository.save(order);
        broadcastPaymentEvent(saved);

        log.info("[PAYMENT] Order #{} Cash confirmed by admin → READY_TO_PRINT", saved.getId());

        return buildResponse(saved, null, "Cash payment confirmed. Order has entered the print queue.");
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private Order findAndValidatePendingOrder(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderId));

        if (order.getStatus() != OrderStatus.PAYMENT_PENDING) {
            throw new IllegalStateException(
                    "Order " + orderId + " is not in PAYMENT_PENDING state (current: " + order.getStatus() + ")");
        }
        return order;
    }

    /**
     * Builds a UPI QR string (BharatQR / BHIM format).
     * Replace with a real QR library (e.g., ZXing) in production.
     */
    private String buildUpiQrString(Order order) {
        // Standard UPI payment URI — scan with any UPI app
        return String.format(
                "upi://pay?pa=shopowner@upi&pn=NoQueue+Print+Shop&am=%.2f&cu=INR&tn=Order+%s",
                order.getPrice(), order.getTokenNumber()
        );
    }

    /** Deep-link for UPI apps when the user's UPI ID is known. */
    private String buildUpiDeepLink(Order order, String upiId) {
        return String.format(
                "upi://pay?pa=%s&pn=NoQueue+Print+Shop&am=%.2f&cu=INR&tn=Order+%s",
                upiId != null ? upiId : "shopowner@upi",
                order.getPrice(),
                order.getTokenNumber()
        );
    }

    private PaymentResponse buildResponse(Order order, String qrData, String message) {
        return PaymentResponse.builder()
                .orderId(order.getId())
                .tokenNumber(order.getTokenNumber())
                .orderStatus(order.getStatus())
                .paymentMethod(order.getPaymentMethod())
                .paymentStatus(order.getPaymentStatus())
                .transactionId(order.getTransactionId())
                .amountPaid(order.getAmountPaid())
                .message(message)
                .qrData(qrData)
                .build();
    }

    private void broadcastPaymentEvent(Order order) {
        com.noqueue.dto.OrderEventDto event = com.noqueue.dto.OrderEventDto.builder()
                .orderId(order.getId())
                .tokenNumber(order.getTokenNumber())
                .status(order.getStatus())
                .userName(order.getUser().getEmail())
                .updatedAt(order.getUpdatedAt() != null ? order.getUpdatedAt() : LocalDateTime.now())
                .build();
        orderEventService.broadcast(event);
    }
}
