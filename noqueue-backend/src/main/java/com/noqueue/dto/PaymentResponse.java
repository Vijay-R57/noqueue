package com.noqueue.dto;

import com.noqueue.model.OrderStatus;
import com.noqueue.model.PaymentMethod;
import com.noqueue.model.PaymentStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Unified response for all payment-related endpoints.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentResponse {
    private Long orderId;
    private String tokenNumber;
    private OrderStatus orderStatus;
    private PaymentMethod paymentMethod;
    private PaymentStatus paymentStatus;
    private String transactionId;
    private BigDecimal amountPaid;
    /** Human-readable message for the frontend */
    private String message;
    /**
     * For QR payment: base64-encoded QR image data or a deep-link URL.
     * null for UPI / CASH flows.
     */
    private String qrData;
}
