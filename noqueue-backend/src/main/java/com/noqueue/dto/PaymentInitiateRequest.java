package com.noqueue.dto;

import com.noqueue.model.PaymentMethod;
import lombok.Data;

/**
 * Request body for POST /api/v1/payment/initiate
 * Called right after an order is created (status = PAYMENT_PENDING).
 */
@Data
public class PaymentInitiateRequest {
    private Long orderId;
    private PaymentMethod paymentMethod;
    /** Optional: UPI ID provided by user for UPI method */
    private String upiId;
}
