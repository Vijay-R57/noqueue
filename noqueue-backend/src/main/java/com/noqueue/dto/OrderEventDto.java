package com.noqueue.dto;

import com.noqueue.model.OrderStatus;
import com.noqueue.model.PaymentStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Payload broadcast to all SSE subscribers whenever an order is
 * created or its status / payment status changes.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderEventDto {

    private Long          orderId;
    private String        tokenNumber;
    private OrderStatus   status;
    private PaymentStatus paymentStatus;
    private String        userName;   // user email (identifier)
    private LocalDateTime updatedAt;
}

