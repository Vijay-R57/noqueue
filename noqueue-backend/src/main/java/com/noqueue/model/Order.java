package com.noqueue.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "orders")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    private String fileUrl;

    private Integer pages;

    private String printType;

    private String colorType;

    private String binding;

    private BigDecimal price;

    private String tokenNumber;

    private Integer priority;

    @Enumerated(EnumType.STRING)
    private OrderStatus status;

    // ── Payment fields ────────────────────────────────────────────────────────

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method")
    private PaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status")
    @Builder.Default
    private PaymentStatus paymentStatus = PaymentStatus.PENDING;

    /** External transaction reference (UPI/QR); null for CASH. */
    @Column(name = "transaction_id")
    private String transactionId;

    @Column(name = "amount_paid")
    private BigDecimal amountPaid;

    // ── Timestamps ────────────────────────────────────────────────────────────

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
